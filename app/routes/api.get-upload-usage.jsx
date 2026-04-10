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
    const isAdmin = String(url.searchParams.get("isAdmin") || "").trim() === "true";
    const isSampleUser = String(url.searchParams.get("isSampleUser") || "").trim() === "true";

    if (!customerId) {
      return Response.json(
        { error: "Missing customerId" },
        { status: 400, headers: corsHeaders }
      );
    }

    if (isAdmin) {
      return Response.json(
        {
          isAdmin: true,
          isSampleUser: false,
          used: 0,
          remaining: null,
          limit: null
        },
        { status: 200, headers: corsHeaders }
      );
    }

    const airtableBase = process.env.AIRTABLE_BASE_ID;
    const airtableToken = process.env.AIRTABLE_TOKEN;
    const usageTable = "UploadUsage";

    if (!airtableBase || !airtableToken) {
      return Response.json(
        { error: "Missing Airtable configuration" },
        { status: 500, headers: corsHeaders }
      );
    }

    const now = new Date();
    const monthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    const usageKey = `${customerId}__${monthKey}`;

    const usageFormula = `{Key}="${usageKey}"`;

    const usageRes = await fetch(
      `https://api.airtable.com/v0/${airtableBase}/${encodeURIComponent(usageTable)}?filterByFormula=${encodeURIComponent(usageFormula)}`,
      {
        headers: {
          Authorization: `Bearer ${airtableToken}`
        }
      }
    );

    if (!usageRes.ok) {
      const errorText = await usageRes.text();
      return Response.json(
        {
          error: "Could not load upload usage",
          details: errorText
        },
        { status: 500, headers: corsHeaders }
      );
    }

    const usageData = await usageRes.json();
    const usageRecord = usageData.records?.[0] || null;
    const used = Number(usageRecord?.fields?.UploadCount || 0);

    const limit = isSampleUser ? 1 : 3;
    const remaining = Math.max(0, limit - used);

    return Response.json(
      {
        isAdmin: false,
        isSampleUser,
        used,
        remaining,
        limit
      },
      { status: 200, headers: corsHeaders }
    );
  } catch (error) {
    return Response.json(
      {
        error: "Server error",
        details: error.message
      },
      { status: 500, headers: corsHeaders }
    );
  }
}