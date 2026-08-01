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
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Vary": "Origin"
  };
}

function cleanString(value) {
  const stringValue = String(value || "").trim();
  return stringValue || null;
}

function firstField(fields, names) {
  for (const name of names) {
    const value = fields?.[name];
    if (value !== undefined && value !== null && String(value).trim() !== "") {
      return value;
    }
  }

  return "";
}

function serializeImage(record) {
  const fields = record.fields || {};

  return {
    id: record.id,
    clientRecordId: firstField(fields, ["ClientRecordId", "Client Record ID"]),
    imageUrl: firstField(fields, ["ImageUrl", "Image URL", "Image", "DrapedImageUrl"]),
    sourceTool: firstField(fields, ["SourceTool", "Source Tool", "Tool"]),
    panel: firstField(fields, ["Panel", "View", "Side"]),
    paletteCode: firstField(fields, ["PaletteCode", "Palette Code"]),
    drapeColorName: firstField(fields, ["DrapeColorName", "Drape Color Name", "ColorName", "Color Name"]),
    lipColorName: firstField(fields, ["LipColorName", "Lip Color Name"]),
    lipColorHex: firstField(fields, ["LipColorHex", "Lip Color Hex"]),
    label: firstField(fields, ["Label", "Title", "Name"]),
    savedAt: firstField(fields, ["SavedAt", "Saved At", "CreatedAt", "Created At"]) || record.createdTime
  };
}

export async function loader({ request }) {
  const origin = request.headers.get("Origin") || "";
  const corsHeaders = getCorsHeaders(origin);

  if (request.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: corsHeaders
    });
  }

  try {
    const url = new URL(request.url);
    const clientRecordId = cleanString(url.searchParams.get("clientRecordId"));

    if (!clientRecordId) {
      return Response.json(
        { error: "Missing clientRecordId" },
        { status: 400, headers: corsHeaders }
      );
    }

    const airtableBase = process.env.AIRTABLE_BASE_ID;
    const airtableToken = process.env.AIRTABLE_TOKEN;

    if (!airtableBase || !airtableToken) {
      return Response.json(
        { error: "Missing Airtable configuration" },
        { status: 500, headers: corsHeaders }
      );
    }

    const formula = `{ClientRecordId}="${clientRecordId.replace(/"/g, '\\"')}"`;
    const params = new URLSearchParams({
      filterByFormula: formula,
      pageSize: "100"
    });

    const records = [];
    let offset = "";

    do {
      if (offset) params.set("offset", offset);

      const response = await fetch(
        `https://api.airtable.com/v0/${airtableBase}/${encodeURIComponent("SavedDrapedImages")}?${params.toString()}`,
        {
          headers: {
            Authorization: `Bearer ${airtableToken}`
          }
        }
      );

      const data = await response.json();

      if (!response.ok) {
        return Response.json(
          { error: "Could not load saved draped images", details: data },
          { status: 500, headers: corsHeaders }
        );
      }

      records.push(...(data.records || []));
      offset = data.offset || "";
    } while (offset);

    const images = records
      .map(serializeImage)
      .filter((image) => image.imageUrl)
      .sort((a, b) => new Date(b.savedAt || 0) - new Date(a.savedAt || 0));

    return Response.json(
      { images },
      { status: 200, headers: corsHeaders }
    );
  } catch (error) {
    console.error("Get saved draped images failed:", error);

    return Response.json(
      { error: error.message || "Unknown error" },
      { status: 500, headers: corsHeaders }
    );
  }
}
