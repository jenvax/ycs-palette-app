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
    const field = String(body.field || "").trim();
    const value = String(body.value || "").trim();

    if (!customerId || !field) {
      return Response.json(
        { error: "Missing customerId or field" },
        { status: 400, headers: corsHeaders }
      );
    }

    const allowedFields = new Set(["ColorType"]);
    if (!allowedFields.has(field)) {
      return Response.json(
        { error: "Field is not editable" },
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
      `https://api.airtable.com/v0/${baseId}/CustomerDirectory?filterByFormula=${encodeURIComponent(`{CustomerId}="${customerId}"`)}`,
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

    const record = lookupData.records?.[0];

    if (!record) {
      return Response.json(
        { error: "CustomerDirectory record not found" },
        { status: 404, headers: corsHeaders }
      );
    }

    const updateRes = await fetch(
      `https://api.airtable.com/v0/${baseId}/CustomerDirectory/${record.id}`,
      {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          fields: {
            [field]: value
          }
        })
      }
    );

    const updateData = await updateRes.json();

    if (!updateRes.ok) {
      return Response.json(
        { error: updateData?.error?.message || "Airtable update failed" },
        { status: 500, headers: corsHeaders }
      );
    }

    return Response.json(
      { success: true, record: updateData },
      { status: 200, headers: corsHeaders }
    );
  } catch (error) {
    return Response.json(
      { error: error.message || "Save failed" },
      { status: 500, headers: corsHeaders }
    );
  }
}