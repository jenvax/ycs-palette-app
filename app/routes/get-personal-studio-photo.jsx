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

function parsePhotoTransform(fields) {
  try {
    return fields.PhotoTransformJson
      ? JSON.parse(fields.PhotoTransformJson)
      : fields.PhotoTransform
        ? JSON.parse(fields.PhotoTransform)
        : null;
  } catch (error) {
    return null;
  }
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
    const photoId = cleanString(url.searchParams.get("photoId"));

    if (!photoId) {
      return Response.json(
        { error: "Missing photoId" },
        { status: 400, headers: corsHeaders }
      );
    }

    const airtableBase = process.env.AIRTABLE_BASE_ID;
    const airtableToken = process.env.AIRTABLE_TOKEN;
    const airtableTable = "PersonalStudioPhotos";

    if (!airtableBase || !airtableToken) {
      return Response.json(
        { error: "Missing Airtable configuration" },
        { status: 500, headers: corsHeaders }
      );
    }

    const formula = `AND({PhotoId}="${photoId}", OR({IsArchived}=BLANK(), {IsArchived}=0, {IsArchived}=FALSE()))`;

    const airtableUrl =
      `https://api.airtable.com/v0/${airtableBase}/${airtableTable}` +
      `?filterByFormula=${encodeURIComponent(formula)}`;

    const response = await fetch(airtableUrl, {
      headers: {
        Authorization: `Bearer ${airtableToken}`
      }
    });

    const data = await response.json();

    if (!response.ok) {
      return Response.json(
        {
          error: "Airtable fetch failed",
          details: data
        },
        { status: 500, headers: corsHeaders }
      );
    }

    const record = data.records?.[0] || null;

    if (!record) {
      return Response.json(
        { error: "Photo not found" },
        { status: 404, headers: corsHeaders }
      );
    }

    const fields = record.fields || {};
    const originalPhotoUrl = fields.OriginalPhotoUrl || null;
    const adjustedPhotoUrl = fields.AdjustedPhotoUrl || null;
    const activePhotoUrl =
      fields.ActivePhotoUrl ||
      adjustedPhotoUrl ||
      originalPhotoUrl ||
      null;

    return Response.json(
      {
        photo: {
          airtableRecordId: record.id,
          photoId: fields.PhotoId || null,
          customerId: fields.CustomerId || null,
          label: fields.Label || null,
          originalPhotoUrl,
          adjustedPhotoUrl,
          activePhotoUrl,
          photoTransform: parsePhotoTransform(fields),
          createdAt: fields.CreatedAt || null,
          updatedAt: fields.UpdatedAt || null
        }
      },
      { status: 200, headers: corsHeaders }
    );
  } catch (error) {
    console.error("Get personal studio photo failed:", error);

    return Response.json(
      {
        error: "Server error",
        details: error.message
      },
      { status: 500, headers: corsHeaders }
    );
  }
}