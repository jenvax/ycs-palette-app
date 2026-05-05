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
    const memberName = String(body.memberName || "").trim();
    const email = String(body.email || "").trim();
    const colorName = String(body.colorName || "").trim();
    const drapedDate = String(body.drapedDate || "").trim();

    if (!customerId) {
      return Response.json({ error: "Missing customerId" }, { status: 400, headers: corsHeaders });
    }

    if (!colorName || !drapedDate) {
      return Response.json({ error: "Draped date and color are required" }, { status: 400, headers: corsHeaders });
    }

    const baseId = process.env.AIRTABLE_BASE_ID;
    const token = process.env.AIRTABLE_TOKEN;

    if (!baseId || !token) {
      return Response.json({ error: "Missing Airtable configuration" }, { status: 500, headers: corsHeaders });
    }

    const createRes = await fetch(
      `https://api.airtable.com/v0/${baseId}/MemberDrapingHistory`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          records: [
            {
              fields: {
                CustomerId: customerId,
                MemberName: memberName,
                Email: email,
                DrapedDate: drapedDate,
                ColorName: colorName
              }
            }
          ]
        })
      }
    );

    const createData = await createRes.json();

    if (!createRes.ok) {
      return Response.json(
        { error: createData?.error?.message || "Airtable create failed" },
        { status: 500, headers: corsHeaders }
      );
    }

    return Response.json(
      { success: true, record: createData },
      { status: 200, headers: corsHeaders }
    );
  } catch (error) {
    return Response.json(
      { error: error.message || "Save failed" },
      { status: 500, headers: corsHeaders }
    );
  }
}