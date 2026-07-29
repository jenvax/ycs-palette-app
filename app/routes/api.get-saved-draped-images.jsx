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

function mapSavedDrapedImage(record) {
  const fields = record.fields || {};

  return {
    id: record.id,
    drapedImageId: fields.DrapedImageId || null,
    clientRecordId: fields.ClientRecordId || null,
    customerId: fields.CustomerId || null,
    consultantId: fields.ConsultantId || null,
    paletteCode: fields["Palette Code"] || null,
    panel: fields.Panel || null,
    drapeColorName: fields["Drape Color Name"] || null,
    drapeColorHex: fields["Drape Color Hex"] || null,
    lipColorName: fields["Lip Color Name"] || null,
    lipColorHex: fields["Lip Color Hex"] || null,
    imageUrl: fields["Image URL"] || null,
    cloudinaryPublicId: fields["Cloudinary Public ID"] || null,
    fileName: fields["File Name"] || null,
    createdAt: fields["Created At"] || null,
    notes: fields.Notes || null
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

    if (!process.env.AIRTABLE_BASE_ID || !process.env.AIRTABLE_TOKEN) {
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
      "sort[0][field]": "Created At",
      "sort[0][direction]": "desc"
    });

    const response = await fetch(
      `https://api.airtable.com/v0/${process.env.AIRTABLE_BASE_ID}/SavedDrapedImages?${params.toString()}`,
      {
        headers: {
          Authorization: `Bearer ${process.env.AIRTABLE_TOKEN}`
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

    return Response.json(
      {
        success: true,
        images: (data.records || []).map(mapSavedDrapedImage)
      },
      { status: 200, headers: corsHeaders }
    );
  } catch (error) {
    console.error("Get saved draped images failed:", error);

    return Response.json(
      { error: error.message },
      { status: 500, headers: corsHeaders }
    );
  }
}
