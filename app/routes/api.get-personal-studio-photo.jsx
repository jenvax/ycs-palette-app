/* global process */

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

function parseJson(value) {
  try {
    return value ? JSON.parse(value) : null;
  } catch (error) {
    return null;
  }
}

export async function loader({ request }) {
  const origin = request.headers.get("Origin") || "";
  const corsHeaders = getCorsHeaders(origin);

  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
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

    const notArchivedFormula =
      "OR({IsArchived}=BLANK(), {IsArchived}=0, {IsArchived}=FALSE())";

    const formula = photoId.startsWith("rec")
      ? `AND(RECORD_ID()="${photoId}", ${notArchivedFormula})`
      : `AND({PhotoId}="${photoId}", ${notArchivedFormula})`;

    const airtableUrl =
      `https://api.airtable.com/v0/${airtableBase}/PersonalStudioPhotos` +
      `?filterByFormula=${encodeURIComponent(formula)}`;

    const response = await fetch(airtableUrl, {
      headers: {
        Authorization: `Bearer ${airtableToken}`
      }
    });

    const data = await response.json();

    if (!response.ok) {
      return Response.json(
        { error: "Airtable fetch failed", details: data },
        { status: 500, headers: corsHeaders }
      );
    }

    const record = data.records?.[0];

    if (!record) {
      return Response.json(
        { error: "Photo not found" },
        { status: 404, headers: corsHeaders }
      );
    }

    const f = record.fields || {};
    const photoTransform =
      parseJson(f.PhotoTransform) ||
      parseJson(f.PhotoTransformJson) ||
      null;
    const lipMask = parseJson(f.LipMaskJson) || null;
    const originalPhotoUrl = f.OriginalPhotoUrl || null;
    const adjustedPhotoUrl = f.AdjustedPhotoUrl || null;
    const photoUrl = f.PhotoUrl || null;
    const activePhotoUrl =
      f.ActivePhotoUrl ||
      adjustedPhotoUrl ||
      photoUrl ||
      originalPhotoUrl ||
      null;

    return Response.json(
      {
        photo: {
          photoId: f.PhotoId || record.id,
          photoSource: "PersonalStudioPhotos",
          customerId: f.CustomerId,
          photoUrl,
          originalPhotoUrl,
          adjustedPhotoUrl,
          activePhotoUrl,
          photoTransform,
          lipMask
        }
      },
      { status: 200, headers: corsHeaders }
    );

  } catch (error) {
    return Response.json(
      { error: "Server error", details: error.message },
      { status: 500, headers: corsHeaders }
    );
  }
}
