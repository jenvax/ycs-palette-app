function normalizeField(value) {
  if (Array.isArray(value)) return value[0] || "";
  return value || "";
}

function normalizeList(value) {
  if (Array.isArray(value)) return value;
  if (!value) return [];
  return [value];
}

export async function loader({ request }) {
  const url = new URL(request.url);
  const paletteCode = String(url.searchParams.get("palette") || "").toUpperCase().trim();
  const isAdminPalette = paletteCode.startsWith("ADMIN_");

  if (!paletteCode) {
    return Response.json({ error: "Missing palette parameter" }, { status: 400 });
  }

  const AIRTABLE_TOKEN = process.env.AIRTABLE_TOKEN;
  const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID;
  const AIRTABLE_TABLE_NAME = process.env.AIRTABLE_TABLE_NAME;

  if (!AIRTABLE_TOKEN || !AIRTABLE_BASE_ID || !AIRTABLE_TABLE_NAME) {
    return Response.json({ error: "Missing Airtable server configuration" }, { status: 500 });
  }

  const baseUrl = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${encodeURIComponent(
    AIRTABLE_TABLE_NAME
  )}?sort[0][field]=SortOrder&sort[0][direction]=asc`;

  let allRecords = [];
  let offset = "";

  while (true) {
    const pageUrl = offset ? `${baseUrl}&offset=${encodeURIComponent(offset)}` : baseUrl;

    const response = await fetch(pageUrl, {
      headers: {
        Authorization: `Bearer ${AIRTABLE_TOKEN}`,
      },
    });

    const data = await response.json();

    if (!data.records) {
      return Response.json({ error: "Airtable error", details: data }, { status: 500 });
    }

    allRecords = allRecords.concat(data.records);

    if (!data.offset) break;
    offset = data.offset;
  }

  const debugRecords = allRecords.slice(0, 10).map((record) => {
  const f = record.fields || {};

  return {
    colorName: f["ColorName"],
    adminPaletteCodesRaw: f["AdminPaletteCodes"],
    paletteCodesRaw: f["PaletteCodes"],
    bestPaletteCodesRaw: f["BestPaletteCodes"]
  };
});

return Response.json({
  palette: paletteCode,
  isAdminPalette,
  debugRecords
});
}