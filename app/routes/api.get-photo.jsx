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
        { photoUrl: null },
        { status: 200, headers: corsHeaders }
      );
    }

    const airtableBase = process.env.AIRTABLE_BASE_ID;
    const airtableToken = process.env.AIRTABLE_API_KEY;

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
    const photoUrl = record?.fields?.PhotoUrl || null;

    return Response.json(
      { photoUrl },
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