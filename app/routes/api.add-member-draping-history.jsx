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

async function createAirtableRecord({ baseId, tableName, token, fields }) {
  const response = await fetch(
    `https://api.airtable.com/v0/${baseId}/${encodeURIComponent(tableName)}`,
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

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data?.error?.message || "Airtable create failed");
  }

  return data.records?.[0] || null;
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
    const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID;
    const AIRTABLE_TOKEN = process.env.AIRTABLE_TOKEN;

    if (!AIRTABLE_BASE_ID || !AIRTABLE_TOKEN) {
      return Response.json(
        { error: "Missing Airtable configuration" },
        { status: 500, headers: corsHeaders }
      );
    }

    const body = await request.json();

    const customerId = String(body.customerId || "").trim();
    const memberName = String(body.memberName || "").trim();
    const email = String(body.email || "").trim();
    const drapedDate = String(body.drapedDate || "").trim();
    const colorName = String(body.colorName || "").trim();
    const colorHex = String(body.colorHex || "").trim();
    const paletteCode = String(body.paletteCode || "").trim();
    const callTheme = String(body.callTheme || "").trim();
    const notes = String(body.notes || "").trim();

    if (!customerId || !drapedDate || !colorName) {
      return Response.json(
        { error: "Customer ID, draped date, and color name are required" },
        { status: 400, headers: corsHeaders }
      );
    }

    const created = await createAirtableRecord({
      baseId: AIRTABLE_BASE_ID,
      tableName: "MemberDrapingHistory",
      token: AIRTABLE_TOKEN,
      fields: {
        CustomerId: customerId,
        MemberName: memberName,
        Email: email,
        DrapedDate: drapedDate,
        ColorName: colorName,
        ColorHex: colorHex,
        PaletteCode: paletteCode,
        CallTheme: callTheme,
        Notes: notes,
        CreatedAt: new Date().toISOString()
      }
    });

    return Response.json(
      { success: true, record: created },
      { status: 200, headers: corsHeaders }
    );
  } catch (error) {
    console.error("add-member-draping-history failed:", error);

    return Response.json(
      { error: error.message || "Failed to save draping note" },
      { status: 500, headers: corsHeaders }
    );
  }
}