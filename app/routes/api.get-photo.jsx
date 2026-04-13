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
    const customerId = String(url.searchParams.get("customerId") || "").trim();

    if (!customerId) {
      return Response.json(
        {
          photoUrl: null,
          originalPhotoUrl: null,
          adjustedPhotoUrl: null,
          activePhotoUrl: null,
          customerId: null,
          firstName: null,
          lastName: null,
          email: null
        },
        { status: 200, headers: corsHeaders }
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
      `https://api.airtable.com/v0/${airtableBase}/CustomerPhotos` +
      `?filterByFormula=${encodeURIComponent(`{CustomerId}="${customerId}"`)}`;

    const res = await fetch(airtableUrl, {
      headers: {
        Authorization: `Bearer ${airtableToken}`
      }
    });

    const data = await res.json();
    const record = data.records?.[0] || null;
    const fields = record?.fields || {};

    const originalPhotoUrl = fields.OriginalPhotoUrl || null;
    const adjustedPhotoUrl = fields.AdjustedPhotoUrl || null;
    const activePhotoUrl =
      fields.ActivePhotoUrl ||
      fields.PhotoUrl ||
      adjustedPhotoUrl ||
      originalPhotoUrl ||
      null;

    return Response.json(
      {
        photoUrl: activePhotoUrl,
        originalPhotoUrl,
        adjustedPhotoUrl,
        activePhotoUrl,
        customerId,
        firstName: fields.FirstName || null,
        lastName: fields.LastName || null,
        email: fields.Email || null
      },
      { status: 200, headers: corsHeaders }
    );
  } catch (error) {
    console.error("Get photo failed:", error);

    return Response.json(
      {
        error: "Server error",
        details: error.message
      },
      { status: 500, headers: corsHeaders }
    );
  }
}