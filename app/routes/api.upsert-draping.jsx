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
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Vary": "Origin"
  };
}

export async function loader({ request }) {
  const origin = request.headers.get("Origin") || "";

  return new Response(null, {
    status: 204,
    headers: getCorsHeaders(origin)
  });
}

export async function action({ request }) {
  const origin = request.headers.get("Origin") || "";
  const corsHeaders = getCorsHeaders(origin);

  if (request.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: corsHeaders
    });
  }

  try {
    const body = await request.json();

    const customerId = String(body.customerId || "").trim();
    const colorName = String(body.colorName || "").trim();
    const drapedDate = String(body.drapedDate || "").trim();

    if (!customerId) {
      return Response.json(
        { error: "Missing customerId" },
        { status: 400, headers: corsHeaders }
      );
    }

    if (!colorName && !drapedDate) {
      return Response.json(
        { error: "Nothing to save" },
        { status: 400, headers: corsHeaders }
      );
    }

    const baseId = process.env.AIRTABLE_BASE_ID;
    const token = process.env.AIRTABLE_TOKEN;

    if (!baseId || !token) {
      return Response.json(
        { error: "Missing Airtable configuration" },
        { status: 500, headers: corsHeaders }
      );
    }

    const lookupRes = await fetch(
      `https://api.airtable.com/v0/${baseId}/MemberDrapingHistory?filterByFormula=${encodeURIComponent(`{CustomerId}="${customerId}"`)}`,
      {
        headers: {
          Authorization: `Bearer ${token}`
        }
      }
    );

    const lookupData = await lookupRes.json();

    if (!lookupRes.ok) {
      return Response.json(
        { error: lookupData?.error?.message || "Airtable lookup failed" },
        { status: 500, headers: corsHeaders }
      );
    }

    const records = lookupData.records || [];

    const latest = records.length
      ? records.sort(
          (a, b) =>
            new Date(b.fields?.DrapedDate || 0) -
            new Date(a.fields?.DrapedDate || 0)
        )[0]
      : null;

    const fields = {
      CustomerId: customerId
    };

    if (colorName) fields.ColorName = colorName;
    if (drapedDate) fields.DrapedDate = drapedDate;

    let saveRes;

    if (latest) {
      saveRes = await fetch(
        `https://api.airtable.com/v0/${baseId}/MemberDrapingHistory/${latest.id}`,
        {
          method: "PATCH",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json"
          },
          body: JSON.stringify({ fields })
        }
      );
    } else {
      saveRes = await fetch(
        `https://api.airtable.com/v0/${baseId}/MemberDrapingHistory`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            records: [{ fields }]
          })
        }
      );
    }

    const saveData = await saveRes.json();

    if (!saveRes.ok) {
      return Response.json(
        { error: saveData?.error?.message || "Airtable save failed" },
        { status: 500, headers: corsHeaders }
      );
    }

    return Response.json(
      { success: true, record: saveData },
      { status: 200, headers: corsHeaders }
    );
  } catch (error) {
    return Response.json(
      { error: error.message || "Save failed" },
      { status: 500, headers: corsHeaders }
    );
  }
}