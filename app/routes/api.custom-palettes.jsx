/* global process */
import prisma from "../db.server.js";

const GROWTH_TAG = "CATOOLGROWTH";
const ADMIN_TAG = "YCS_ADMIN";
const VIP_TAG = "VIP";

function getCorsHeaders(origin) {
  const allowedOrigins = [
    "https://yourcolorstyle.com",
    "https://www.yourcolorstyle.com"
  ];

  const allowOrigin = allowedOrigins.includes(origin)
    ? origin
    : "https://yourcolorstyle.com";

  return {
    "Access-Control-Allow-Origin": allowOrigin,
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Vary": "Origin"
  };
}

function cleanString(value) {
  const stringValue = String(value || "").trim();
  return stringValue || null;
}

function normalizeCustomerId(value) {
  return String(value || "")
    .replace("gid://shopify/Customer/", "")
    .trim();
}

function normalizeHex(value) {
  const raw = String(value || "").trim().replace(/^#/, "");
  if (!/^[0-9a-fA-F]{6}$/.test(raw)) return null;
  return `#${raw.toUpperCase()}`;
}

async function shopifyAdminGraphQL({ query, variables = {} }) {
  const shop = String(process.env.SHOPIFY_SYNC_SHOP || process.env.SHOPIFY_SHOP || "")
    .replace(/^https?:\/\//, "")
    .replace(/\/.*$/, "");
  const accessToken = process.env.SHOPIFY_ADMIN_ACCESS_TOKEN;

  if (!shop || !accessToken) {
    throw new Error("Missing Shopify admin configuration");
  }

  const response = await fetch(`https://${shop}/admin/api/2026-04/graphql.json`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Shopify-Access-Token": accessToken
    },
    body: JSON.stringify({ query, variables })
  });

  const json = await response.json();

  if (!response.ok || json.errors) {
    throw new Error(json.errors?.[0]?.message || "Shopify Admin GraphQL request failed");
  }

  return json.data;
}

async function fetchCustomerTags(customerId) {
  const safeCustomerId = normalizeCustomerId(customerId);
  if (!safeCustomerId) return [];

  const data = await shopifyAdminGraphQL({
    query: `
      query getCustomerTags($id: ID!) {
        customer(id: $id) {
          tags
        }
      }
    `,
    variables: { id: `gid://shopify/Customer/${safeCustomerId}` }
  });

  return Array.isArray(data.customer?.tags)
    ? data.customer.tags.map((tag) => String(tag).trim().toUpperCase())
    : [];
}

async function fetchConsultantIdForClientRecord(clientRecordId) {
  const safeClientRecordId = cleanString(clientRecordId);
  if (!safeClientRecordId) return null;

  const airtableBase = process.env.AIRTABLE_BASE_ID;
  const airtableToken = process.env.AIRTABLE_TOKEN;

  if (!airtableBase || !airtableToken) {
    throw new Error("Missing Airtable configuration");
  }

  const airtableUrl =
    `https://api.airtable.com/v0/${airtableBase}/ConsultantClients` +
    `?filterByFormula=${encodeURIComponent(`{ClientRecordId}="${safeClientRecordId}"`)}`;

  const response = await fetch(airtableUrl, {
    headers: {
      Authorization: `Bearer ${airtableToken}`
    }
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error("Airtable consultant client lookup failed");
  }

  return data.records?.[0]?.fields?.ConsultantId || null;
}

async function authorizeGrowthAccess({ customerId, previewCustomerId, viewAs, clientRecordId }) {
  const requestedOwnerCustomerId = normalizeCustomerId(customerId);
  const clientOwnerCustomerId = requestedOwnerCustomerId
    ? ""
    : normalizeCustomerId(await fetchConsultantIdForClientRecord(clientRecordId));
  const ownerCustomerId = requestedOwnerCustomerId || clientOwnerCustomerId;
  const safePreviewCustomerId = normalizeCustomerId(
    previewCustomerId || customerId || ownerCustomerId
  );

  if (!ownerCustomerId) {
    return { ok: false, status: 401, error: "You must be signed in to use My Custom Palettes" };
  }

  let tags = [];
  try {
    tags = await fetchCustomerTags(safePreviewCustomerId);
  } catch (error) {
    console.warn("custom palettes tag lookup failed; falling back to owner-scoped access:", error);
    return {
      ok: true,
      ownerCustomerId:
        previewCustomerId && safePreviewCustomerId !== ownerCustomerId
          ? safePreviewCustomerId
          : ownerCustomerId
    };
  }
  const tagSet = new Set(tags);

  if (tagSet.has(GROWTH_TAG)) {
    return {
      ok: true,
      ownerCustomerId:
        previewCustomerId && safePreviewCustomerId !== ownerCustomerId
          ? safePreviewCustomerId
          : ownerCustomerId
    };
  }

  const isGrowthPreview =
    tagSet.has(ADMIN_TAG) &&
    String(viewAs || "").trim().toLowerCase() === "catoolgrowth";

  if (isGrowthPreview) {
    return { ok: true, ownerCustomerId: safePreviewCustomerId };
  }

  return { ok: false, status: 403, error: "CATOOLGROWTH access required" };
}

async function authorizeVipAccess(customerId) {
  const safeCustomerId = normalizeCustomerId(customerId);
  if (!safeCustomerId) {
    return { ok: false, status: 401, error: "You must be signed in to view Style Masters palettes" };
  }

  const tags = await fetchCustomerTags(safeCustomerId);
  const tagSet = new Set(tags);

  if (tagSet.has(VIP_TAG) || tagSet.has(ADMIN_TAG)) {
    return { ok: true };
  }

  return { ok: false, status: 403, error: "Style Masters access required" };
}

function serializeColor(color) {
  return {
    id: color.id,
    name: color.name,
    hexCode: color.hexCode,
    paletteCount: color._count?.paletteColors || 0,
    createdAt: color.createdAt,
    updatedAt: color.updatedAt
  };
}

function serializePalette(palette) {
  const colors = (palette.colors || [])
    .slice()
    .sort((a, b) => a.displayOrder - b.displayOrder)
    .map((join) => ({
      id: join.id,
      displayOrder: join.displayOrder,
      color: serializeColor(join.color)
    }));

  return {
    id: palette.id,
    name: palette.name,
    visibleToVip: Boolean(palette.visibleToVip),
    isVisibleToVip: Boolean(palette.visibleToVip),
    colorCount: palette._count?.colors ?? colors.length,
    colors,
    createdAt: palette.createdAt,
    updatedAt: palette.updatedAt
  };
}

async function listCustomData(ownerCustomerId, search = "") {
  const query = cleanString(search);
  const colorWhere = {
    ownerCustomerId,
    ...(query
      ? {
          OR: [
            { name: { contains: query } },
            { hexCode: { contains: query.toUpperCase() } }
          ]
        }
      : {})
  };

  const [colors, palettes] = await Promise.all([
    prisma.customColor.findMany({
      where: colorWhere,
      orderBy: [{ updatedAt: "desc" }],
      include: { _count: { select: { paletteColors: true } } }
    }),
    prisma.customPalette.findMany({
      where: { ownerCustomerId },
      orderBy: [{ updatedAt: "desc" }],
      include: {
        _count: { select: { colors: true } },
        colors: {
          orderBy: { displayOrder: "asc" },
          include: { color: { include: { _count: { select: { paletteColors: true } } } } }
        }
      }
    })
  ]);

  return {
    colors: colors.map(serializeColor),
    palettes: palettes.map(serializePalette)
  };
}

async function listVipPalettes() {
  const palettes = await prisma.customPalette.findMany({
    where: { visibleToVip: true },
    orderBy: [{ updatedAt: "desc" }],
    include: {
      _count: { select: { colors: true } },
      colors: {
        orderBy: { displayOrder: "asc" },
        include: { color: { include: { _count: { select: { paletteColors: true } } } } }
      }
    }
  });

  return {
    palettes: palettes.map(serializePalette)
  };
}

async function requireOwnedPalette(ownerCustomerId, paletteId) {
  const palette = await prisma.customPalette.findFirst({
    where: { id: paletteId, ownerCustomerId }
  });

  if (!palette) {
    const error = new Error("Custom palette not found");
    error.status = 404;
    throw error;
  }

  return palette;
}

async function requireOwnedColor(ownerCustomerId, colorId) {
  const color = await prisma.customColor.findFirst({
    where: { id: colorId, ownerCustomerId }
  });

  if (!color) {
    const error = new Error("Custom color not found");
    error.status = 404;
    throw error;
  }

  return color;
}

async function readPalette(ownerCustomerId, paletteId) {
  const palette = await prisma.customPalette.findFirst({
    where: { id: paletteId, ownerCustomerId },
    include: {
      _count: { select: { colors: true } },
      colors: {
        orderBy: { displayOrder: "asc" },
        include: { color: { include: { _count: { select: { paletteColors: true } } } } }
      }
    }
  });

  if (!palette) {
    const error = new Error("Custom palette not found");
    error.status = 404;
    throw error;
  }

  return serializePalette(palette);
}

export async function loader({ request }) {
  const origin = request.headers.get("Origin") || "";
  const corsHeaders = getCorsHeaders(origin);

  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  try {
    const url = new URL(request.url);
    const action = String(url.searchParams.get("action") || "list").trim();

    if (action === "vipList") {
      const auth = await authorizeVipAccess(url.searchParams.get("customerId"));
      if (!auth.ok) {
        return Response.json(
          { error: auth.error },
          { status: auth.status, headers: corsHeaders }
        );
      }

      return Response.json(await listVipPalettes(), { headers: corsHeaders });
    }

    const auth = await authorizeGrowthAccess({
      customerId: url.searchParams.get("customerId"),
      previewCustomerId: url.searchParams.get("previewCustomerId"),
      viewAs: url.searchParams.get("viewAs"),
      clientRecordId: url.searchParams.get("clientRecordId")
    });

    if (!auth.ok) {
      return Response.json(
        { error: auth.error },
        { status: auth.status, headers: corsHeaders }
      );
    }

    if (action === "palette") {
      const paletteId = cleanString(url.searchParams.get("paletteId"));
      if (!paletteId) {
        return Response.json(
          { error: "Missing paletteId" },
          { status: 400, headers: corsHeaders }
        );
      }

      return Response.json(
        { palette: await readPalette(auth.ownerCustomerId, paletteId) },
        { headers: corsHeaders }
      );
    }

    const data = await listCustomData(auth.ownerCustomerId, url.searchParams.get("search"));
    return Response.json(data, { headers: corsHeaders });
  } catch (error) {
    console.error("custom palettes loader failed:", error);
    return Response.json(
      { error: error.message || "Failed to load custom palettes" },
      { status: error.status || 500, headers: corsHeaders }
    );
  }
}

export async function action({ request }) {
  const origin = request.headers.get("Origin") || "";
  const corsHeaders = getCorsHeaders(origin);

  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  try {
    const body = await request.json();
    const auth = await authorizeGrowthAccess({
      customerId: body.customerId,
      previewCustomerId: body.previewCustomerId,
      viewAs: body.viewAs,
      clientRecordId: body.clientRecordId
    });

    if (!auth.ok) {
      return Response.json(
        { error: auth.error },
        { status: auth.status, headers: corsHeaders }
      );
    }

    const ownerCustomerId = auth.ownerCustomerId;
    const actionName = String(body.action || "").trim();

    if (actionName === "createColor") {
      const name = cleanString(body.name);
      const hexCode = normalizeHex(body.hexCode);

      if (!name) {
        return Response.json({ error: "Color name is required" }, { status: 400, headers: corsHeaders });
      }

      if (!hexCode) {
        return Response.json({ error: "Enter a valid six-character hex code" }, { status: 400, headers: corsHeaders });
      }

      const color = await prisma.customColor.create({
        data: { ownerCustomerId, name, hexCode },
        include: { _count: { select: { paletteColors: true } } }
      });

      return Response.json({ color: serializeColor(color) }, { headers: corsHeaders });
    }

    if (actionName === "updateColor") {
      const colorId = cleanString(body.colorId);
      const name = cleanString(body.name);
      const hexCode = normalizeHex(body.hexCode);

      if (!colorId) return Response.json({ error: "Missing colorId" }, { status: 400, headers: corsHeaders });
      if (!name) return Response.json({ error: "Color name is required" }, { status: 400, headers: corsHeaders });
      if (!hexCode) return Response.json({ error: "Enter a valid six-character hex code" }, { status: 400, headers: corsHeaders });

      await requireOwnedColor(ownerCustomerId, colorId);
      const color = await prisma.customColor.update({
        where: { id: colorId },
        data: { name, hexCode },
        include: { _count: { select: { paletteColors: true } } }
      });

      return Response.json({ color: serializeColor(color) }, { headers: corsHeaders });
    }

    if (actionName === "deleteColor") {
      const colorId = cleanString(body.colorId);
      if (!colorId) return Response.json({ error: "Missing colorId" }, { status: 400, headers: corsHeaders });

      await requireOwnedColor(ownerCustomerId, colorId);
      await prisma.customColor.delete({ where: { id: colorId } });

      return Response.json({ success: true }, { headers: corsHeaders });
    }

    if (actionName === "createPalette") {
      const name = cleanString(body.name);
      if (!name) return Response.json({ error: "Palette name is required" }, { status: 400, headers: corsHeaders });

      const palette = await prisma.customPalette.create({
        data: { ownerCustomerId, name },
        include: {
          _count: { select: { colors: true } },
          colors: { include: { color: { include: { _count: { select: { paletteColors: true } } } } } }
        }
      });

      return Response.json({ palette: serializePalette(palette) }, { headers: corsHeaders });
    }

    if (actionName === "renamePalette") {
      const paletteId = cleanString(body.paletteId);
      const name = cleanString(body.name);
      if (!paletteId) return Response.json({ error: "Missing paletteId" }, { status: 400, headers: corsHeaders });
      if (!name) return Response.json({ error: "Palette name is required" }, { status: 400, headers: corsHeaders });

      await requireOwnedPalette(ownerCustomerId, paletteId);
      await prisma.customPalette.update({ where: { id: paletteId }, data: { name } });

      return Response.json({ palette: await readPalette(ownerCustomerId, paletteId) }, { headers: corsHeaders });
    }

    if (
      actionName === "setVipVisibility" ||
      actionName === "toggleVipVisibility" ||
      actionName === "showToVip" ||
      actionName === "hideFromVip" ||
      actionName === "show-to-vip" ||
      actionName === "hide-from-vip" ||
      actionName === "toggle-vip-visibility"
    ) {
      const paletteId = cleanString(body.paletteId);
      if (!paletteId) return Response.json({ error: "Missing paletteId" }, { status: 400, headers: corsHeaders });

      const palette = await requireOwnedPalette(ownerCustomerId, paletteId);
      const nextVisibleToVip =
        actionName === "toggleVipVisibility" || actionName === "toggle-vip-visibility"
          ? !palette.visibleToVip
          : actionName === "hideFromVip" || actionName === "hide-from-vip"
            ? false
            : body.visibleToVip !== undefined
              ? body.visibleToVip === true || String(body.visibleToVip || "") === "true"
              : true;

      await prisma.customPalette.update({
        where: { id: paletteId },
        data: { visibleToVip: nextVisibleToVip }
      });

      return Response.json(
        {
          palette: await readPalette(ownerCustomerId, paletteId),
          visibleToVip: nextVisibleToVip
        },
        { headers: corsHeaders }
      );
    }

    if (actionName === "deletePalette") {
      const paletteId = cleanString(body.paletteId);
      if (!paletteId) return Response.json({ error: "Missing paletteId" }, { status: 400, headers: corsHeaders });

      await requireOwnedPalette(ownerCustomerId, paletteId);
      await prisma.customPalette.delete({ where: { id: paletteId } });

      return Response.json({ success: true }, { headers: corsHeaders });
    }

    if (actionName === "addColorsToPalette") {
      const paletteId = cleanString(body.paletteId);
      const colorIds = Array.isArray(body.colorIds)
        ? body.colorIds.map(cleanString).filter(Boolean)
        : [];

      if (!paletteId) return Response.json({ error: "Missing paletteId" }, { status: 400, headers: corsHeaders });
      if (!colorIds.length) return Response.json({ error: "Select at least one color" }, { status: 400, headers: corsHeaders });

      await requireOwnedPalette(ownerCustomerId, paletteId);

      const ownedColors = await prisma.customColor.findMany({
        where: { ownerCustomerId, id: { in: colorIds } },
        select: { id: true }
      });
      const ownedColorIds = new Set(ownedColors.map((color) => color.id));

      if (ownedColorIds.size !== colorIds.length) {
        return Response.json(
          { error: "Only colors from your My Colors collection can be added" },
          { status: 403, headers: corsHeaders }
        );
      }

      const maxOrder = await prisma.customPaletteColor.aggregate({
        where: { customPaletteId: paletteId },
        _max: { displayOrder: true }
      });
      let displayOrder = maxOrder._max.displayOrder ?? -1;

      for (const colorId of colorIds) {
        displayOrder += 1;
        await prisma.customPaletteColor.upsert({
          where: {
            customPaletteId_customColorId: {
              customPaletteId: paletteId,
              customColorId: colorId
            }
          },
          update: {},
          create: {
            customPaletteId: paletteId,
            customColorId: colorId,
            displayOrder
          }
        });
      }

      return Response.json({ palette: await readPalette(ownerCustomerId, paletteId) }, { headers: corsHeaders });
    }

    if (actionName === "removeColorFromPalette") {
      const paletteId = cleanString(body.paletteId);
      const colorId = cleanString(body.colorId);
      if (!paletteId) return Response.json({ error: "Missing paletteId" }, { status: 400, headers: corsHeaders });
      if (!colorId) return Response.json({ error: "Missing colorId" }, { status: 400, headers: corsHeaders });

      await requireOwnedPalette(ownerCustomerId, paletteId);
      await prisma.customPaletteColor.deleteMany({
        where: { customPaletteId: paletteId, customColorId: colorId }
      });

      return Response.json({ palette: await readPalette(ownerCustomerId, paletteId) }, { headers: corsHeaders });
    }

    if (actionName === "reorderPaletteColors") {
      const paletteId = cleanString(body.paletteId);
      const colorIds = Array.isArray(body.colorIds)
        ? body.colorIds.map(cleanString).filter(Boolean)
        : [];

      if (!paletteId) return Response.json({ error: "Missing paletteId" }, { status: 400, headers: corsHeaders });
      await requireOwnedPalette(ownerCustomerId, paletteId);

      const joins = await prisma.customPaletteColor.findMany({
        where: { customPaletteId: paletteId },
        select: { id: true, customColorId: true }
      });
      const joinByColorId = new Map(joins.map((join) => [join.customColorId, join.id]));

      if (colorIds.length !== joins.length || colorIds.some((colorId) => !joinByColorId.has(colorId))) {
        return Response.json(
          { error: "Reorder request must include the palette's current custom colors" },
          { status: 400, headers: corsHeaders }
        );
      }

      await prisma.$transaction(
        colorIds.map((colorId, index) =>
          prisma.customPaletteColor.update({
            where: { id: joinByColorId.get(colorId) },
            data: { displayOrder: index }
          })
        )
      );

      return Response.json({ palette: await readPalette(ownerCustomerId, paletteId) }, { headers: corsHeaders });
    }

    return Response.json(
      { error: "Unknown custom palette action" },
      { status: 400, headers: corsHeaders }
    );
  } catch (error) {
    console.error("custom palettes action failed:", error);
    return Response.json(
      { error: error.message || "Failed to update custom palettes" },
      { status: error.status || 500, headers: corsHeaders }
    );
  }
}
