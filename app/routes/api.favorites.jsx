function normalizeField(value) {
  if (Array.isArray(value)) return value[0] || "";
  return value || "";
}

function normalizeHex(value) {
  return String(value || "").trim().toLowerCase();
}

function escapeFormulaValue(value) {
  return String(value || "")
    .replace(/\\/g, "\\\\")
    .replace(/"/g, '\\"');
}

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "https://yourcolorstyle.com",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Content-Type": "application/json",
  };
}

async function airtableFetchJson(url, token, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data?.error?.message || "Airtable request failed");
  }

  return data;
}

async function fetchAllAirtableRecords({ baseId, tableName, token, formula }) {
  const params = new URLSearchParams();

  if (formula) {
    params.set("filterByFormula", formula);
  }

  let allRecords = [];
  let offset = "";

  while (true) {
    const pageParams = new URLSearchParams(params);
    if (offset) {
      pageParams.set("offset", offset);
    }

    const pageUrl = `https://api.airtable.com/v0/${baseId}/${encodeURIComponent(
      tableName
    )}?${pageParams.toString()}`;

    const data = await airtableFetchJson(pageUrl, token);

    allRecords = allRecords.concat(data.records || []);

    if (!data.offset) break;
    offset = data.offset;
  }

  return allRecords;
}

async function createAirtableRecord({ baseId, tableName, token, fields }) {
  const url = `https://api.airtable.com/v0/${baseId}/${encodeURIComponent(tableName)}`;

  const data = await airtableFetchJson(url, token, {
    method: "POST",
    body: JSON.stringify({
      records: [{ fields }],
    }),
  });

  return data.records?.[0] || null;
}

async function deleteAirtableRecord({ baseId, tableName, token, recordId }) {
  const url = `https://api.airtable.com/v0/${baseId}/${encodeURIComponent(
    tableName
  )}/${recordId}`;

  return airtableFetchJson(url, token, {
    method: "DELETE",
  });
}

async function getFavorites({ customerId, paletteCode, baseId, tableName, token }) {
  const formula = `AND({CustomerId}="${escapeFormulaValue(
    customerId
  )}",{PaletteCode}="${escapeFormulaValue(paletteCode)}")`;

  const records = await fetchAllAirtableRecords({
    baseId,
    tableName,
    token,
    formula,
  });

  return records
    .map((record) => normalizeField(record.fields?.Hex))
    .filter(Boolean)
    .map(normalizeHex);
}

async function toggleFavorite({
  customerId,
  paletteCode,
  colorName,
  hex,
  baseId,
  tableName,
  token,
}) {
  const normalizedHex = normalizeHex(hex);
  const favoriteKey = `${customerId}__${paletteCode}__${normalizedHex}`;

  const formula = `{FavoriteKey}="${escapeFormulaValue(favoriteKey)}"`;

  const existing = await fetchAllAirtableRecords({
    baseId,
    tableName,
    token,
    formula,
  });

  if (existing.length > 0) {
    await deleteAirtableRecord({
      baseId,
      tableName,
      token,
      recordId: existing[0].id,
    });

    return { success: true, isFavorite: false };
  }

  await createAirtableRecord({
    baseId,
    tableName,
    token,
    fields: {
      CustomerId: String(customerId),
      PaletteCode: String(paletteCode),
      ColorName: String(colorName || ""),
      Hex: String(hex || ""),
      FavoriteKey: favoriteKey,
    },
  });

  return { success: true, isFavorite: true };
}

export async function loader({ request }) {
  const url = new URL(request.url);

  const AIRTABLE_TOKEN = process.env.AIRTABLE_TOKEN;
  const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID;
  const AIRTABLE_FAVORITES_TABLE =
    process.env.AIRTABLE_FAVORITES_TABLE || "PaletteFavorites";

  if (request.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: corsHeaders(),
    });
  }

  if (!AIRTABLE_TOKEN || !AIRTABLE_BASE_ID) {
    return new Response(
      JSON.stringify({ error: "Missing Airtable server configuration" }),
      { status: 500, headers: corsHeaders() }
    );
  }

  const action = String(url.searchParams.get("action") || "").trim();
  const customerId = String(url.searchParams.get("customerId") || "").trim();
  const paletteCode = String(url.searchParams.get("palette") || "").toUpperCase().trim();

  try {
    if (action === "toggleFavorite") {
      const colorName = String(url.searchParams.get("colorName") || "").trim();
      const hex = String(url.searchParams.get("hex") || "").trim();

      if (!customerId || !paletteCode || !hex) {
        return new Response(
          JSON.stringify({ error: "Missing customerId, palette, or hex" }),
          { status: 400, headers: corsHeaders() }
        );
      }

      const result = await toggleFavorite({
        customerId,
        paletteCode,
        colorName,
        hex,
        baseId: AIRTABLE_BASE_ID,
        tableName: AIRTABLE_FAVORITES_TABLE,
        token: AIRTABLE_TOKEN,
      });

      return new Response(JSON.stringify(result), {
        status: 200,
        headers: corsHeaders(),
      });
    }

    if (!customerId || !paletteCode) {
      return new Response(
        JSON.stringify({ error: "Missing customerId or palette" }),
        { status: 400, headers: corsHeaders() }
      );
    }

    const favorites = await getFavorites({
      customerId,
      paletteCode,
      baseId: AIRTABLE_BASE_ID,
      tableName: AIRTABLE_FAVORITES_TABLE,
      token: AIRTABLE_TOKEN,
    });

    return new Response(JSON.stringify({ favorites }), {
      status: 200,
      headers: corsHeaders(),
    });
  } catch (error) {
    console.error(error);
    return new Response(
      JSON.stringify({ error: error.message || "Favorites API failed" }),
      { status: 500, headers: corsHeaders() }
    );
  }
}