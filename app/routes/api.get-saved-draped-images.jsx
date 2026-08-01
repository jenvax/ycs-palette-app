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

function escapeFormulaString(value) {
  return String(value || "").replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

function firstField(fields, names) {
  for (const name of names) {
    const value = fields?.[name];
    if (value !== undefined && value !== null && String(value).trim() !== "") {
      return value;
    }
  }

  return null;
}

function mapSavedDrapedImage(record) {
  const fields = record.fields || {};
  const savedAt = firstField(fields, ["SavedAt", "Saved At", "CreatedAt", "Created At"]) || record.createdTime || null;
  const fileName = firstField(fields, ["File Name", "FileName", "Label", "Title", "Name"]);

  return {
    id: record.id,
    drapedImageId: firstField(fields, ["DrapedImageId", "Draped Image ID"]),
    clientRecordId: firstField(fields, ["ClientRecordId", "Client Record ID"]),
    customerId: firstField(fields, ["CustomerId", "Customer ID"]),
    consultantId: firstField(fields, ["ConsultantId", "Consultant ID"]),
    sourceTool: firstField(fields, ["SourceTool", "Source Tool", "Tool"]),
    paletteCode: firstField(fields, ["Palette Code", "PaletteCode"]),
    panel: firstField(fields, ["Panel", "View", "Side"]),
    drapeColorName: firstField(fields, ["Drape Color Name", "DrapeColorName", "ColorName", "Color Name"]),
    drapeColorHex: firstField(fields, ["Drape Color Hex", "DrapeColorHex"]),
    lipColorName: firstField(fields, ["Lip Color Name", "LipColorName"]),
    lipColorHex: firstField(fields, ["Lip Color Hex", "LipColorHex"]),
    imageUrl: firstField(fields, ["Image URL", "ImageUrl", "Image", "DrapedImageUrl"]),
    cloudinaryPublicId: firstField(fields, ["Cloudinary Public ID", "CloudinaryPublicId"]),
    fileName,
    label: fileName,
    createdAt: savedAt,
    savedAt,
    notes: firstField(fields, ["Notes"])
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
    const customerId = cleanString(url.searchParams.get("customerId"));
    const paletteCode = cleanString(url.searchParams.get("paletteCode"))?.toUpperCase();

    if (!clientRecordId && !customerId) {
      return Response.json(
        { error: "Missing clientRecordId or customerId" },
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

    const recordFilter = clientRecordId
      ? `{ClientRecordId}="${escapeFormulaString(clientRecordId)}"`
      : `{CustomerId}="${escapeFormulaString(customerId)}"`;

    const filters = [recordFilter];

    if (paletteCode) {
      filters.push(`{Palette Code}="${escapeFormulaString(paletteCode)}"`);
    }

    const formula = filters.length > 1 ? `AND(${filters.join(",")})` : filters[0];
    const params = new URLSearchParams({
      filterByFormula: formula,
      pageSize: "100",
      "sort[0][field]": "Created At",
      "sort[0][direction]": "desc"
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
        console.error("Airtable saved draped images lookup failed:", data);
        return Response.json(
          { error: "Airtable lookup failed", details: data },
          { status: 500, headers: corsHeaders }
        );
      }

      records.push(...(data.records || []));
      offset = data.offset || "";
    } while (offset);

    const images = records
      .map(mapSavedDrapedImage)
      .filter((image) => image.imageUrl);

    return Response.json(
      {
        success: true,
        images
      },
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
