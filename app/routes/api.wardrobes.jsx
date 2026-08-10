/* global process */
import prisma from "../db.server.js";

const ADMIN_TAG = "YCS_ADMIN";
const ITEM_TYPES = new Set([
  "top",
  "bottom",
  "dress_jumpsuit",
  "outer_layer",
  "shoe",
  "bag"
]);

function getCorsHeaders(origin) {
  const allowedOrigins = [
    "https://yourcolorstyle.com",
    "https://www.yourcolorstyle.com"
  ];

  return {
    "Access-Control-Allow-Origin": allowedOrigins.includes(origin) ? origin : "https://yourcolorstyle.com",
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

function escapeFormulaValue(value) {
  return String(value || "").replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

async function fetchCustomerDirectoryTags(customerId) {
  const baseId = process.env.AIRTABLE_BASE_ID;
  const token = process.env.AIRTABLE_TOKEN;

  if (!baseId || !token) {
    const error = new Error("Missing customer directory configuration");
    error.status = 500;
    throw error;
  }

  const params = new URLSearchParams({
    maxRecords: "1",
    filterByFormula: `{CustomerId}="${escapeFormulaValue(customerId)}"`
  });

  const response = await fetch(`https://api.airtable.com/v0/${baseId}/CustomerDirectory?${params.toString()}`, {
    headers: {
      Authorization: `Bearer ${token}`
    }
  });
  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    const message = data.error?.message || data.error || "Customer directory lookup failed";
    const error = new Error(message);
    error.status = response.status || 500;
    throw error;
  }

  const fields = data.records?.[0]?.fields || {};
  return String(fields.ShopifyTags || fields.Tags || "")
    .split(",")
    .map((tag) => tag.trim().toUpperCase())
    .filter(Boolean);
}

async function getShopifyAccessToken({ shop, apiKey, apiSecret }) {
  const response = await fetch(`https://${shop}/admin/oauth/access_token`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      client_id: apiKey,
      client_secret: apiSecret,
      grant_type: "client_credentials"
    })
  });
  const data = await response.json().catch(() => ({}));

  if (!response.ok || !data.access_token) {
    const error = new Error("Failed to generate Shopify access token");
    error.status = response.status || 500;
    throw error;
  }

  return data.access_token;
}

async function fetchCustomerTagsWithToken({ shop, accessToken, customerId }) {
  const response = await fetch(`https://${shop}/admin/api/2026-04/graphql.json`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Shopify-Access-Token": accessToken
    },
    body: JSON.stringify({
      query: `
        query getCustomerTags($id: ID!) {
          customer(id: $id) {
            tags
          }
        }
      `,
      variables: { id: `gid://shopify/Customer/${customerId}` }
    })
  });
  const json = await response.json().catch(() => ({}));

  if (!response.ok || json.errors) {
    const message = json.errors?.[0]?.message || json.error || "Shopify customer lookup failed";
    const error = new Error(message);
    error.status = response.status || 500;
    throw error;
  }

  return Array.isArray(json.data?.customer?.tags)
    ? json.data.customer.tags.map((tag) => String(tag).trim().toUpperCase())
    : [];
}

async function fetchCustomerTags(customerId) {
  const safeCustomerId = normalizeCustomerId(customerId);
  if (!safeCustomerId) return [];

  const shop = String(process.env.SHOPIFY_SYNC_SHOP || process.env.SHOPIFY_SHOP || "")
    .replace(/^https?:\/\//, "")
    .replace(/\/.*$/, "");
  const staticAccessToken = process.env.SHOPIFY_ADMIN_ACCESS_TOKEN;

  if (!shop) {
    const error = new Error("Missing Shopify shop configuration");
    error.status = 500;
    throw error;
  }

  if (staticAccessToken) {
    try {
      return await fetchCustomerTagsWithToken({
        shop,
        accessToken: staticAccessToken,
        customerId: safeCustomerId
      });
    } catch (error) {
      console.error("Static Shopify customer lookup failed, trying generated app token:", error);
    }
  }

  const apiSecret = process.env.SHOPIFY_API_SECRET || process.env.SHOPIFY_API_TOKEN;

  if (!process.env.SHOPIFY_API_KEY || !apiSecret) {
    const error = new Error("Missing Shopify API credentials");
    error.status = 500;
    throw error;
  }

  const generatedAccessToken = await getShopifyAccessToken({
    shop,
    apiKey: process.env.SHOPIFY_API_KEY,
    apiSecret
  });

  return fetchCustomerTagsWithToken({
    shop,
    accessToken: generatedAccessToken,
    customerId: safeCustomerId
  });
}

async function authorizeAdmin(customerId) {
  const ownerCustomerId = normalizeCustomerId(customerId);
  if (!ownerCustomerId) {
    return { ok: false, status: 401, error: "You must be signed in to use Wardrobe Builder" };
  }

  let tags = [];
  try {
    tags = await fetchCustomerTags(ownerCustomerId);
  } catch (error) {
    console.error("Shopify wardrobe authorization failed, trying CustomerDirectory:", error);
    tags = await fetchCustomerDirectoryTags(ownerCustomerId);
  }

  if (!tags.includes(ADMIN_TAG)) {
    return { ok: false, status: 403, error: "YCS_ADMIN access required" };
  }

  return { ok: true, ownerCustomerId };
}

function serializeItem(item) {
  const colors = (item.colors || [])
    .slice()
    .sort((a, b) => a.displayOrder - b.displayOrder)
    .map((color) => ({
      id: color.id,
      name: color.colorName,
      colorName: color.colorName,
      hex: color.hexCode,
      hexCode: color.hexCode,
      paletteCode: color.paletteCode || "",
      displayOrder: color.displayOrder
    }));

  return {
    id: item.id,
    description: item.description,
    itemType: item.itemType,
    colors,
    wardrobeIds: (item.memberships || []).map((membership) => membership.wardrobeId),
    createdAt: item.createdAt,
    updatedAt: item.updatedAt
  };
}

function serializeWardrobe(wardrobe) {
  const items = (wardrobe.memberships || [])
    .map((membership) => membership.item)
    .filter(Boolean)
    .map(serializeItem)
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());

  return {
    id: wardrobe.id,
    name: wardrobe.name,
    items,
    itemCount: items.length,
    createdAt: wardrobe.createdAt,
    updatedAt: wardrobe.updatedAt
  };
}

async function listWardrobes(ownerCustomerId) {
  const wardrobes = await prisma.wardrobe.findMany({
    where: { ownerCustomerId },
    orderBy: [{ updatedAt: "desc" }],
    include: {
      memberships: {
        include: {
          item: {
            include: {
              colors: { orderBy: { displayOrder: "asc" } },
              memberships: true
            }
          }
        }
      }
    }
  });

  return { wardrobes: wardrobes.map(serializeWardrobe) };
}

async function requireOwnedWardrobe(ownerCustomerId, wardrobeId) {
  const wardrobe = await prisma.wardrobe.findFirst({
    where: { id: wardrobeId, ownerCustomerId }
  });

  if (!wardrobe) {
    const error = new Error("Wardrobe not found");
    error.status = 404;
    throw error;
  }

  return wardrobe;
}

async function requireOwnedItem(ownerCustomerId, itemId) {
  const item = await prisma.wardrobeItem.findFirst({
    where: { id: itemId, ownerCustomerId }
  });

  if (!item) {
    const error = new Error("Wardrobe item not found");
    error.status = 404;
    throw error;
  }

  return item;
}

function cleanColors(colors) {
  if (!Array.isArray(colors)) return [];

  const seen = new Set();
  return colors
    .map((color, index) => {
      const hexCode = normalizeHex(color.hexCode || color.hex);
      const colorName = cleanString(color.colorName || color.name) || hexCode;
      const paletteCode = cleanString(color.paletteCode);
      if (!hexCode || !colorName) return null;
      const key = `${hexCode}:${colorName}`;
      if (seen.has(key)) return null;
      seen.add(key);
      return { colorName, hexCode, paletteCode, displayOrder: index };
    })
    .filter(Boolean);
}

async function readWardrobe(ownerCustomerId, wardrobeId) {
  const wardrobe = await prisma.wardrobe.findFirst({
    where: { id: wardrobeId, ownerCustomerId },
    include: {
      memberships: {
        include: {
          item: {
            include: {
              colors: { orderBy: { displayOrder: "asc" } },
              memberships: true
            }
          }
        }
      }
    }
  });

  if (!wardrobe) {
    const error = new Error("Wardrobe not found");
    error.status = 404;
    throw error;
  }

  return serializeWardrobe(wardrobe);
}

export async function loader({ request }) {
  const origin = request.headers.get("Origin") || "";
  const corsHeaders = getCorsHeaders(origin);

  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  try {
    const url = new URL(request.url);
    const auth = await authorizeAdmin(url.searchParams.get("customerId"));

    if (!auth.ok) {
      return Response.json({ error: auth.error }, { status: auth.status, headers: corsHeaders });
    }

    return Response.json(await listWardrobes(auth.ownerCustomerId), { headers: corsHeaders });
  } catch (error) {
    console.error("wardrobes loader failed:", error);
    return Response.json(
      { error: error.message || "Failed to load wardrobes" },
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
    const auth = await authorizeAdmin(body.customerId);

    if (!auth.ok) {
      return Response.json({ error: auth.error }, { status: auth.status, headers: corsHeaders });
    }

    const ownerCustomerId = auth.ownerCustomerId;
    const actionName = String(body.action || "").trim();

    if (actionName === "createWardrobe") {
      const name = cleanString(body.name);
      if (!name) return Response.json({ error: "Wardrobe name is required" }, { status: 400, headers: corsHeaders });

      const wardrobe = await prisma.wardrobe.create({
        data: { ownerCustomerId, name },
        include: { memberships: true }
      });

      return Response.json({ wardrobe: serializeWardrobe(wardrobe) }, { headers: corsHeaders });
    }

    if (actionName === "renameWardrobe") {
      const wardrobeId = cleanString(body.wardrobeId);
      const name = cleanString(body.name);
      if (!wardrobeId) return Response.json({ error: "Missing wardrobeId" }, { status: 400, headers: corsHeaders });
      if (!name) return Response.json({ error: "Wardrobe name is required" }, { status: 400, headers: corsHeaders });

      await requireOwnedWardrobe(ownerCustomerId, wardrobeId);
      await prisma.wardrobe.update({ where: { id: wardrobeId }, data: { name } });

      return Response.json({ wardrobe: await readWardrobe(ownerCustomerId, wardrobeId) }, { headers: corsHeaders });
    }

    if (actionName === "deleteWardrobe") {
      const wardrobeId = cleanString(body.wardrobeId);
      if (!wardrobeId) return Response.json({ error: "Missing wardrobeId" }, { status: 400, headers: corsHeaders });

      await requireOwnedWardrobe(ownerCustomerId, wardrobeId);
      await prisma.wardrobe.delete({ where: { id: wardrobeId } });

      return Response.json({ success: true }, { headers: corsHeaders });
    }

    if (actionName === "createItem") {
      const wardrobeId = cleanString(body.wardrobeId);
      const description = cleanString(body.description);
      const itemType = cleanString(body.itemType);
      const colors = cleanColors(body.colors);

      if (!wardrobeId) return Response.json({ error: "Choose a wardrobe" }, { status: 400, headers: corsHeaders });
      if (!description) return Response.json({ error: "Description is required" }, { status: 400, headers: corsHeaders });
      if (!ITEM_TYPES.has(itemType)) return Response.json({ error: "Choose an item type" }, { status: 400, headers: corsHeaders });
      if (!colors.length) return Response.json({ error: "Select at least one color" }, { status: 400, headers: corsHeaders });

      await requireOwnedWardrobe(ownerCustomerId, wardrobeId);

      const item = await prisma.wardrobeItem.create({
        data: {
          ownerCustomerId,
          description,
          itemType,
          colors: { create: colors },
          memberships: { create: { wardrobeId } }
        },
        include: {
          colors: { orderBy: { displayOrder: "asc" } },
          memberships: true
        }
      });

      return Response.json({ item: serializeItem(item), wardrobe: await readWardrobe(ownerCustomerId, wardrobeId) }, { headers: corsHeaders });
    }

    if (actionName === "updateItem") {
      const wardrobeId = cleanString(body.wardrobeId);
      const itemId = cleanString(body.itemId);
      const description = cleanString(body.description);
      const itemType = cleanString(body.itemType);
      const colors = cleanColors(body.colors);

      if (!wardrobeId) return Response.json({ error: "Missing wardrobeId" }, { status: 400, headers: corsHeaders });
      if (!itemId) return Response.json({ error: "Missing itemId" }, { status: 400, headers: corsHeaders });
      if (!description) return Response.json({ error: "Description is required" }, { status: 400, headers: corsHeaders });
      if (!ITEM_TYPES.has(itemType)) return Response.json({ error: "Choose an item type" }, { status: 400, headers: corsHeaders });
      if (!colors.length) return Response.json({ error: "Select at least one color" }, { status: 400, headers: corsHeaders });

      await requireOwnedWardrobe(ownerCustomerId, wardrobeId);
      await requireOwnedItem(ownerCustomerId, itemId);

      await prisma.$transaction([
        prisma.wardrobeItem.update({
          where: { id: itemId },
          data: { description, itemType }
        }),
        prisma.wardrobeItemColor.deleteMany({ where: { wardrobeItemId: itemId } }),
        prisma.wardrobeItemColor.createMany({
          data: colors.map((color) => ({ ...color, wardrobeItemId: itemId }))
        })
      ]);

      return Response.json({ wardrobe: await readWardrobe(ownerCustomerId, wardrobeId) }, { headers: corsHeaders });
    }

    if (actionName === "removeFromWardrobe") {
      const wardrobeId = cleanString(body.wardrobeId);
      const itemId = cleanString(body.itemId);
      if (!wardrobeId) return Response.json({ error: "Missing wardrobeId" }, { status: 400, headers: corsHeaders });
      if (!itemId) return Response.json({ error: "Missing itemId" }, { status: 400, headers: corsHeaders });

      await requireOwnedWardrobe(ownerCustomerId, wardrobeId);
      await requireOwnedItem(ownerCustomerId, itemId);
      await prisma.wardrobeMembership.deleteMany({ where: { wardrobeId, wardrobeItemId: itemId } });

      const remainingMemberships = await prisma.wardrobeMembership.count({ where: { wardrobeItemId: itemId } });
      if (remainingMemberships === 0) {
        await prisma.wardrobeItem.delete({ where: { id: itemId } });
      }

      return Response.json({ success: true, wardrobe: await readWardrobe(ownerCustomerId, wardrobeId) }, { headers: corsHeaders });
    }

    return Response.json({ error: "Unknown wardrobe action" }, { status: 400, headers: corsHeaders });
  } catch (error) {
    console.error("wardrobes action failed:", error);
    return Response.json(
      { error: error.message || "Failed to update wardrobes" },
      { status: error.status || 500, headers: corsHeaders }
    );
  }
}
