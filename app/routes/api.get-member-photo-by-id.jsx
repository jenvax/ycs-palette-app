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

    if (!airtableBase || !airtableToken) {
      return Response.json(
        { error: "Missing Airtable configuration" },
        { status: 500, headers: corsHeaders }
      );
    }

    const airtableUrl =
      `https://api.airtable.com/v0/${airtableBase}/CustomerPhotos/${encodeURIComponent(photoId)}`;

    const res = await fetch(airtableUrl, {
      headers: {
        Authorization: `Bearer ${airtableToken}`
      }
    });

    const data = await res.json();

    if (!res.ok) {
      return Response.json(
        {
          error: "Airtable photo lookup failed",
          details: data
        },
        { status: 500, headers: corsHeaders }
      );
    }

    const fields = data.fields || {};

    let photoTransform = null;

    try {
      photoTransform = fields.PhotoTransform
        ? JSON.parse(fields.PhotoTransform)
        : fields.PhotoTransformJson
          ? JSON.parse(fields.PhotoTransformJson)
          : null;
    } catch (error) {
      photoTransform = null;
    }

    const originalPhotoUrl = fields.OriginalPhotoUrl || null;
    const adjustedPhotoUrl = fields.AdjustedPhotoUrl || null;
    const photoUrl = fields.PhotoUrl || null;

    const activePhotoUrl =
      fields.ActivePhotoUrl ||
      adjustedPhotoUrl ||
      photoUrl ||
      originalPhotoUrl ||
      null;

    return Response.json(
      {
        photoId: data.id,
        photoUrl,
        originalPhotoUrl,
        adjustedPhotoUrl,
        activePhotoUrl,
        activePhotoSessionKey: activePhotoUrl || null,
        photoTransform,
        customerId: fields.CustomerId || null,
        firstName: fields.FirstName || null,
        lastName: fields.LastName || null,
        email: fields.Email || null,
        recordType: "customer_photo"
      },
      { status: 200, headers: corsHeaders }
    );
  } catch (error) {
    console.error("Get member photo by ID failed:", error);

    return Response.json(
      {
        error: "Server error",
        details: error.message
      },
      { status: 500, headers: corsHeaders }
    );
  }
}
