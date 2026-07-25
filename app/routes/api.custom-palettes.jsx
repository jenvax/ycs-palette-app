import crypto from "node:crypto";

const COLORS_TABLE = "CustomColors";
const PALETTES_TABLE = "CustomPalettes";
const PALETTE_COLORS_TABLE = "CustomPaletteColors";

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

function toBool(value) {
  return value === true || String(value || "").trim().toLowerCase() === "true";
}

function makeId(prefix) {
  return `${prefix}_${Date.now()}_${crypto.randomBytes(4).toString("hex")}`;
}

function escapeFormulaValue(value) {
  return String(value || "")
    .replace(/\\/g, "\\\\")
    .replace(/"/g, '\\"');
}

function getAirtableConfig() {
  const baseId = process.env.AIRTABLE_BASE_ID;
  const token = process.env.AIRTABLE_TOKEN;

  if (!baseId || !token) {
    throw new Error("Missing Airtable configuration");
  }

  return { baseId, token };
}

function airtableUrl(tableName, searchParams) {
  const { baseId } = getAirtableConfig();
  const url = new URL(`https://api.airtable.com/v0/${baseId}/${encodeURIComponent(tableName)}`);

  Object.entries(searchParams || {}).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") {
      url.searchParams.set(key, value);
    }
  });

  return url;
}

async function airtableFetchJson(tableName, options = {}) {
  const { token } = getAirtableConfig();
  const response = await fetch(airtableUrl(tableName, options.searchParams), {
    method: options.method || "GET",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...(options.headers || {})
    },
    body: options.body ? JSON.stringify(options.body) : undefined
  });
  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    const message = data?.error?.message || data?.error?.type || JSON.stringify(data);
    throw new Error(`${response.status} ${message}`);
  }

  return data;
}

async function fetchAllRecords(tableName, searchParams = {}) {
  const records = [];
  let offset = "";

  do {
    const data = await airtableFetchJson(tableName, {
      searchParams: {
        pageSize: "100",
        ...searchParams,
        ...(offset ? { offset } : {})
      }
    });
    records.push(...(data.records || []));
    offset = data.offset || "";
  } while (offset);

  return records;
}

async function createRecord(tableName, fields) {
  const data = await airtableFetchJson(tableName, {
    method: "POST",
    body: { records: [{ fields }] }
  });

  return data.records?.[0] || null;
}

async function updateRecord(tableName, recordId, fields) {
  const data = await airtableFetchJson(tableName, {
    method: "PATCH",
    body: { records: [{ id: recordId, fields }] }
  });

  return data.records?.[0] || null;
}

async function deleteRecord(tableName, recordId) {
  await airtableFetchJson(tableName, {
    method: "DELETE",
    searchParams: { "records[]": recordId }
  });
}

async function deleteRecords(tableName, recordIds) {
  for (const recordId of recordIds) {
    await deleteRecord(tableName, recordId);
  }
}

function ownerFormula(ownerCustomerId) {
  return `{OwnerCustomerId}="${escapeFormulaValue(ownerCustomerId)}"`;
}

function authorizeGrowthAccess({ customerId, hasGrowthAccess }) {
  const ownerCustomerId = normalizeCustomerId(customerId);

  if (!ownerCustomerId) {
    return { ok: false, status: 401, error: "You must be signed in to use My Custom Palettes" };
  }

  if (toBool(hasGrowthAccess)) {
    return { ok: true, ownerCustomerId };
  }

  return { ok: false, status: 403, error: "CATOOLGROWTH access required" };
}

function colorFromRecord(record, paletteCount = 0) {
  const fields = record.fields || {};
  return {
    id: fields.ColorId || record.id,
    name: fields.Name || "",
    hexCode: fields.HexCode || "",
    paletteCount,
    createdAt: fields.CreatedAt || record.createdTime || "",
    updatedAt: fields.UpdatedAt || fields.CreatedAt || record.createdTime || ""
  };
}

function paletteShellFromRecord(record) {
  const fields = record.fields || {};
  return {
    id: fields.PaletteId || record.id,
    name: fields.Name || "",
    colorCount: 0,
    colors: [],
    createdAt: fields.CreatedAt || record.createdTime || "",
    updatedAt: fields.UpdatedAt || fields.CreatedAt || record.createdTime || ""
  };
}

function joinFromRecord(record, color) {
  const fields = record.fields || {};
  return {
    id: fields.PaletteColorId || record.id,
    displayOrder: Number(fields.DisplayOrder || 0),
    color
  };
}

async function fetchOwnedData(ownerCustomerId) {
  const formula = ownerFormula(ownerCustomerId);
  const [colorRecords, paletteRecords, joinRecords] = await Promise.all([
    fetchAllRecords(COLORS_TABLE, { filterByFormula: formula }),
    fetchAllRecords(PALETTES_TABLE, { filterByFormula: formula }),
    fetchAllRecords(PALETTE_COLORS_TABLE, { filterByFormula: formula })
  ]);

  const joinsByColorId = new Map();
  joinRecords.forEach((record) => {
    const colorId = record.fields?.ColorId;
    if (!colorId) return;
    joinsByColorId.set(colorId, (joinsByColorId.get(colorId) || 0) + 1);
  });

  const colorById = new Map(
    colorRecords.map((record) => {
      const color = colorFromRecord(record, joinsByColorId.get(record.fields?.ColorId) || 0);
      return [color.id, { record, color }];
    })
  );

  const palettes = paletteRecords.map(paletteShellFromRecord);
  const paletteById = new Map(palettes.map((palette) => [palette.id, palette]));

  joinRecords.forEach((record) => {
    const palette = paletteById.get(record.fields?.PaletteId);
    const colorEntry = colorById.get(record.fields?.ColorId);
    if (!palette || !colorEntry) return;
    palette.colors.push(joinFromRecord(record, colorEntry.color));
  });

  palettes.forEach((palette) => {
    palette.colors.sort((a, b) => a.displayOrder - b.displayOrder);
    palette.colorCount = palette.colors.length;
  });

  return {
    colorRecords,
    paletteRecords,
    joinRecords,
    colors: Array.from(colorById.values()).map((entry) => entry.color),
    palettes
  };
}

async function listCustomData(ownerCustomerId, search = "") {
  const data = await fetchOwnedData(ownerCustomerId);
  const query = String(search || "").trim().toLowerCase();
  const colors = query
    ? data.colors.filter((color) =>
        color.name.toLowerCase().includes(query) ||
        color.hexCode.toLowerCase().includes(query)
      )
    : data.colors;

  colors.sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)));
  data.palettes.sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)));

  return { colors, palettes: data.palettes };
}

async function requireOwnedColorRecord(ownerCustomerId, colorId) {
  const records = await fetchAllRecords(COLORS_TABLE, {
    maxRecords: "1",
    filterByFormula: `AND(${ownerFormula(ownerCustomerId)}, {ColorId}="${escapeFormulaValue(colorId)}")`
  });
  const record = records[0];

  if (!record) {
    const error = new Error("Custom color not found");
    error.status = 404;
    throw error;
  }

  return record;
}

async function requireOwnedPaletteRecord(ownerCustomerId, paletteId) {
  const records = await fetchAllRecords(PALETTES_TABLE, {
    maxRecords: "1",
    filterByFormula: `AND(${ownerFormula(ownerCustomerId)}, {PaletteId}="${escapeFormulaValue(paletteId)}")`
  });
  const record = records[0];

  if (!record) {
    const error = new Error("Custom palette not found");
    error.status = 404;
    throw error;
  }

  return record;
}

async function readPalette(ownerCustomerId, paletteId) {
  const data = await fetchOwnedData(ownerCustomerId);
  const palette = data.palettes.find((item) => item.id === paletteId);

  if (!palette) {
    const error = new Error("Custom palette not found");
    error.status = 404;
    throw error;
  }

  return palette;
}

async function fetchPaletteJoinRecords(ownerCustomerId, paletteId) {
  return fetchAllRecords(PALETTE_COLORS_TABLE, {
    filterByFormula: `AND(${ownerFormula(ownerCustomerId)}, {PaletteId}="${escapeFormulaValue(paletteId)}")`
  });
}

async function fetchColorJoinRecords(ownerCustomerId, colorId) {
  return fetchAllRecords(PALETTE_COLORS_TABLE, {
    filterByFormula: `AND(${ownerFormula(ownerCustomerId)}, {ColorId}="${escapeFormulaValue(colorId)}")`
  });
}

export async function loader({ request }) {
  const origin = request.headers.get("Origin") || "";
  const corsHeaders = getCorsHeaders(origin);

  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  try {
    const url = new URL(request.url);
    const auth = authorizeGrowthAccess({
      customerId: url.searchParams.get("customerId"),
      hasGrowthAccess: url.searchParams.get("hasGrowthAccess")
    });

    if (!auth.ok) {
      return Response.json(
        { error: auth.error },
        { status: auth.status, headers: corsHeaders }
      );
    }

    const action = String(url.searchParams.get("action") || "list").trim();

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
    const auth = authorizeGrowthAccess({
      customerId: body.customerId,
      hasGrowthAccess: body.hasGrowthAccess
    });

    if (!auth.ok) {
      return Response.json(
        { error: auth.error },
        { status: auth.status, headers: corsHeaders }
      );
    }

    const ownerCustomerId = auth.ownerCustomerId;
    const actionName = String(body.action || "").trim();
    const nowIso = new Date().toISOString();

    if (actionName === "createColor") {
      const name = cleanString(body.name);
      const hexCode = normalizeHex(body.hexCode);

      if (!name) {
        return Response.json({ error: "Color name is required" }, { status: 400, headers: corsHeaders });
      }

      if (!hexCode) {
        return Response.json({ error: "Enter a valid six-character hex code" }, { status: 400, headers: corsHeaders });
      }

      const record = await createRecord(COLORS_TABLE, {
        ColorId: makeId("ccolor"),
        OwnerCustomerId: ownerCustomerId,
        Name: name,
        HexCode: hexCode,
        CreatedAt: nowIso,
        UpdatedAt: nowIso
      });

      return Response.json({ color: colorFromRecord(record, 0) }, { headers: corsHeaders });
    }

    if (actionName === "updateColor") {
      const colorId = cleanString(body.colorId);
      const name = cleanString(body.name);
      const hexCode = normalizeHex(body.hexCode);

      if (!colorId) return Response.json({ error: "Missing colorId" }, { status: 400, headers: corsHeaders });
      if (!name) return Response.json({ error: "Color name is required" }, { status: 400, headers: corsHeaders });
      if (!hexCode) return Response.json({ error: "Enter a valid six-character hex code" }, { status: 400, headers: corsHeaders });

      const existing = await requireOwnedColorRecord(ownerCustomerId, colorId);
      const record = await updateRecord(COLORS_TABLE, existing.id, {
        Name: name,
        HexCode: hexCode,
        UpdatedAt: nowIso
      });
      const joins = await fetchAllRecords(PALETTE_COLORS_TABLE, {
        filterByFormula: `AND(${ownerFormula(ownerCustomerId)}, {ColorId}="${escapeFormulaValue(colorId)}")`
      });

      return Response.json({ color: colorFromRecord(record, joins.length) }, { headers: corsHeaders });
    }

    if (actionName === "deleteColor") {
      const colorId = cleanString(body.colorId);
      if (!colorId) return Response.json({ error: "Missing colorId" }, { status: 400, headers: corsHeaders });

      const existing = await requireOwnedColorRecord(ownerCustomerId, colorId);
      const joins = await fetchAllRecords(PALETTE_COLORS_TABLE, {
        filterByFormula: `AND(${ownerFormula(ownerCustomerId)}, {ColorId}="${escapeFormulaValue(colorId)}")`
      });

      await deleteRecords(PALETTE_COLORS_TABLE, joins.map((record) => record.id));
      await deleteRecord(COLORS_TABLE, existing.id);

      return Response.json({ success: true }, { headers: corsHeaders });
    }

    if (actionName === "createPalette") {
      const name = cleanString(body.name);
      if (!name) return Response.json({ error: "Palette name is required" }, { status: 400, headers: corsHeaders });

      const record = await createRecord(PALETTES_TABLE, {
        PaletteId: makeId("cpalette"),
        OwnerCustomerId: ownerCustomerId,
        Name: name,
        CreatedAt: nowIso,
        UpdatedAt: nowIso
      });

      return Response.json({ palette: paletteShellFromRecord(record) }, { headers: corsHeaders });
    }

    if (actionName === "renamePalette") {
      const paletteId = cleanString(body.paletteId);
      const name = cleanString(body.name);
      if (!paletteId) return Response.json({ error: "Missing paletteId" }, { status: 400, headers: corsHeaders });
      if (!name) return Response.json({ error: "Palette name is required" }, { status: 400, headers: corsHeaders });

      const existing = await requireOwnedPaletteRecord(ownerCustomerId, paletteId);
      await updateRecord(PALETTES_TABLE, existing.id, { Name: name, UpdatedAt: nowIso });

      return Response.json({ palette: await readPalette(ownerCustomerId, paletteId) }, { headers: corsHeaders });
    }

    if (actionName === "deletePalette") {
      const paletteId = cleanString(body.paletteId);
      if (!paletteId) return Response.json({ error: "Missing paletteId" }, { status: 400, headers: corsHeaders });

      const existing = await requireOwnedPaletteRecord(ownerCustomerId, paletteId);
      const joins = await fetchPaletteJoinRecords(ownerCustomerId, paletteId);
      await deleteRecords(PALETTE_COLORS_TABLE, joins.map((record) => record.id));
      await deleteRecord(PALETTES_TABLE, existing.id);

      return Response.json({ success: true }, { headers: corsHeaders });
    }

    if (actionName === "addColorsToPalette") {
      const paletteId = cleanString(body.paletteId);
      const colorIds = Array.isArray(body.colorIds)
        ? body.colorIds.map(cleanString).filter(Boolean)
        : [];

      if (!paletteId) return Response.json({ error: "Missing paletteId" }, { status: 400, headers: corsHeaders });
      if (!colorIds.length) return Response.json({ error: "Select at least one color" }, { status: 400, headers: corsHeaders });

      await requireOwnedPaletteRecord(ownerCustomerId, paletteId);

      const ownedColorRecords = await fetchAllRecords(COLORS_TABLE, {
        filterByFormula: `AND(${ownerFormula(ownerCustomerId)}, OR(${colorIds
          .map((colorId) => `{ColorId}="${escapeFormulaValue(colorId)}"`)
          .join(",")}))`
      });
      const ownedColorIds = new Set(ownedColorRecords.map((record) => record.fields?.ColorId));

      if (ownedColorIds.size !== colorIds.length) {
        return Response.json(
          { error: "Only colors from your My Colors collection can be added" },
          { status: 403, headers: corsHeaders }
        );
      }

      const joins = await fetchPaletteJoinRecords(ownerCustomerId, paletteId);
      const existingColorIds = new Set(joins.map((record) => record.fields?.ColorId));
      let displayOrder = joins.reduce(
        (max, record) => Math.max(max, Number(record.fields?.DisplayOrder || 0)),
        -1
      );

      for (const colorId of colorIds) {
        if (existingColorIds.has(colorId)) continue;
        displayOrder += 1;
        await createRecord(PALETTE_COLORS_TABLE, {
          PaletteColorId: makeId("cpcolor"),
          OwnerCustomerId: ownerCustomerId,
          PaletteId: paletteId,
          ColorId: colorId,
          DisplayOrder: displayOrder,
          CreatedAt: nowIso,
          UpdatedAt: nowIso
        });
      }

      return Response.json({ palette: await readPalette(ownerCustomerId, paletteId) }, { headers: corsHeaders });
    }

    if (actionName === "removeColorFromPalette") {
      const paletteId = cleanString(body.paletteId);
      const colorId = cleanString(body.colorId);
      if (!paletteId) return Response.json({ error: "Missing paletteId" }, { status: 400, headers: corsHeaders });
      if (!colorId) return Response.json({ error: "Missing colorId" }, { status: 400, headers: corsHeaders });

      await requireOwnedPaletteRecord(ownerCustomerId, paletteId);
      const joins = await fetchAllRecords(PALETTE_COLORS_TABLE, {
        filterByFormula: `AND(${ownerFormula(ownerCustomerId)}, {PaletteId}="${escapeFormulaValue(paletteId)}", {ColorId}="${escapeFormulaValue(colorId)}")`
      });
      await deleteRecords(PALETTE_COLORS_TABLE, joins.map((record) => record.id));

      return Response.json({ palette: await readPalette(ownerCustomerId, paletteId) }, { headers: corsHeaders });
    }

    if (actionName === "setColorPalettes") {
      const colorId = cleanString(body.colorId);
      const paletteIds = Array.isArray(body.paletteIds)
        ? body.paletteIds.map(cleanString).filter(Boolean)
        : [];
      const uniquePaletteIds = Array.from(new Set(paletteIds));

      if (!colorId) return Response.json({ error: "Missing colorId" }, { status: 400, headers: corsHeaders });

      await requireOwnedColorRecord(ownerCustomerId, colorId);

      const data = await fetchOwnedData(ownerCustomerId);
      const paletteIdSet = new Set(data.palettes.map((palette) => palette.id));

      if (uniquePaletteIds.some((paletteId) => !paletteIdSet.has(paletteId))) {
        return Response.json(
          { error: "Only your custom palettes can be assigned" },
          { status: 403, headers: corsHeaders }
        );
      }

      const existingJoins = await fetchColorJoinRecords(ownerCustomerId, colorId);
      const existingByPaletteId = new Map(
        existingJoins.map((record) => [record.fields?.PaletteId, record])
      );
      const desiredPaletteIds = new Set(uniquePaletteIds);

      await deleteRecords(
        PALETTE_COLORS_TABLE,
        existingJoins
          .filter((record) => !desiredPaletteIds.has(record.fields?.PaletteId))
          .map((record) => record.id)
      );

      for (const paletteId of uniquePaletteIds) {
        if (existingByPaletteId.has(paletteId)) continue;

        const paletteJoins = data.joinRecords.filter((record) => record.fields?.PaletteId === paletteId);
        const displayOrder = paletteJoins.reduce(
          (max, record) => Math.max(max, Number(record.fields?.DisplayOrder || 0)),
          -1
        ) + 1;

        await createRecord(PALETTE_COLORS_TABLE, {
          PaletteColorId: makeId("cpcolor"),
          OwnerCustomerId: ownerCustomerId,
          PaletteId: paletteId,
          ColorId: colorId,
          DisplayOrder: displayOrder,
          CreatedAt: nowIso,
          UpdatedAt: nowIso
        });
      }

      return Response.json(await listCustomData(ownerCustomerId), { headers: corsHeaders });
    }

    if (actionName === "reorderPaletteColors") {
      const paletteId = cleanString(body.paletteId);
      const colorIds = Array.isArray(body.colorIds)
        ? body.colorIds.map(cleanString).filter(Boolean)
        : [];

      if (!paletteId) return Response.json({ error: "Missing paletteId" }, { status: 400, headers: corsHeaders });
      await requireOwnedPaletteRecord(ownerCustomerId, paletteId);

      const joins = await fetchPaletteJoinRecords(ownerCustomerId, paletteId);
      const joinByColorId = new Map(joins.map((record) => [record.fields?.ColorId, record]));

      if (colorIds.length !== joins.length || colorIds.some((colorId) => !joinByColorId.has(colorId))) {
        return Response.json(
          { error: "Reorder request must include the palette's current custom colors" },
          { status: 400, headers: corsHeaders }
        );
      }

      for (const [index, colorId] of colorIds.entries()) {
        await updateRecord(PALETTE_COLORS_TABLE, joinByColorId.get(colorId).id, {
          DisplayOrder: index,
          UpdatedAt: nowIso
        });
      }

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
