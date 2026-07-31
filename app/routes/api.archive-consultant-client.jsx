/* global process */

function getCorsHeaders(origin) {
  const allowedOrigins = [
    "https://yourcolorstyle.com",
    "https://www.yourcolorstyle.com",
    "https://yourcolorstyle.myshopify.com"
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

function cleanString(value) {
  const stringValue = String(value || "").trim();
  return stringValue || null;
}

function escapeFormulaValue(value) {
  return String(value || "").replace(/\\/g, "\\\\").replace(/"/g, '\\"');
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
    const { clientRecordId, consultantId } = await request.json();
    const safeClientRecordId = cleanString(clientRecordId);
    const safeConsultantId = cleanString(consultantId);

    if (!safeClientRecordId || !safeConsultantId) {
      return Response.json(
        { error: "Missing clientRecordId or consultantId" },
        { status: 400, headers: corsHeaders }
      );
    }

    const airtableBase = process.env.AIRTABLE_BASE_ID;
    const airtableToken = process.env.AIRTABLE_TOKEN;
    const airtableTable = "ConsultantClients";

    if (!airtableBase || !airtableToken) {
      return Response.json(
        { error: "Missing Airtable configuration" },
        { status: 500, headers: corsHeaders }
      );
    }

    const formula = `AND({ClientRecordId}="${escapeFormulaValue(
      safeClientRecordId
    )}", {ConsultantId}="${escapeFormulaValue(safeConsultantId)}")`;

    const findRes = await fetch(
      `https://api.airtable.com/v0/${airtableBase}/${airtableTable}?filterByFormula=${encodeURIComponent(formula)}`,
      {
        headers: {
          Authorization: `Bearer ${airtableToken}`
        }
      }
    );

    const findData = await findRes.json();

    if (!findRes.ok) {
      return Response.json(
        { error: "Airtable fetch failed", details: findData },
        { status: 500, headers: corsHeaders }
      );
    }

    const existing = findData.records?.[0];

    if (!existing) {
      return Response.json(
        { error: "Client record not found" },
        { status: 404, headers: corsHeaders }
      );
    }

    const patchRes = await fetch(
      `https://api.airtable.com/v0/${airtableBase}/${airtableTable}/${existing.id}`,
      {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${airtableToken}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          fields: {
            IsArchived: true
          }
        })
      }
    );

    const patchData = await patchRes.json();

    if (!patchRes.ok) {
      return Response.json(
        { error: "Airtable update failed", details: patchData },
        { status: 500, headers: corsHeaders }
      );
    }

    return Response.json(
      {
        success: true,
        clientRecordId: safeClientRecordId
      },
      { status: 200, headers: corsHeaders }
    );
  } catch (error) {
    console.error("Archive consultant client failed:", error);

    return Response.json(
      { error: "Server error", details: error.message },
      { status: 500, headers: corsHeaders }
    );
  }
}
