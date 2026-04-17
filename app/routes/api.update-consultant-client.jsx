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

function cleanString(value) {
  const stringValue = String(value || "").trim();
  return stringValue || null;
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

  try {
    const {
      clientRecordId,
      firstName,
      lastName,
      email
    } = await request.json();

    const safeClientRecordId = cleanString(clientRecordId);
    const safeFirstName = cleanString(firstName);
    const safeLastName = cleanString(lastName);
    const safeEmail = cleanString(email);

    if (!safeClientRecordId) {
      return Response.json(
        { error: "Missing clientRecordId" },
        { status: 400, headers: corsHeaders }
      );
    }

    if (!safeFirstName || !safeLastName) {
      return Response.json(
        { error: "Missing firstName or lastName" },
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

    const findRes = await fetch(
      `https://api.airtable.com/v0/${airtableBase}/${airtableTable}?filterByFormula=${encodeURIComponent(`{ClientRecordId}="${safeClientRecordId}"`)}`,
      {
        headers: {
          Authorization: `Bearer ${airtableToken}`
        }
      }
    );

    const findData = await findRes.json();
    const existing = findData.records?.[0];

    if (!existing) {
      return Response.json(
        { error: "Client record not found" },
        { status: 404, headers: corsHeaders }
      );
    }

    const payload = {
      fields: {
        FirstName: safeFirstName,
        LastName: safeLastName,
        Email: safeEmail || null
      }
    };

    const patchRes = await fetch(
      `https://api.airtable.com/v0/${airtableBase}/${airtableTable}/${existing.id}`,
      {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${airtableToken}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify(payload)
      }
    );

    const patchData = await patchRes.json();

    if (!patchRes.ok) {
      console.error("Airtable patch error:", patchData);

      return Response.json(
        { error: "Airtable update failed", details: patchData },
        { status: 500, headers: corsHeaders }
      );
    }

    return Response.json(
      {
        success: true,
        clientRecordId: safeClientRecordId,
        firstName: safeFirstName,
        lastName: safeLastName,
        email: safeEmail
      },
      { status: 200, headers: corsHeaders }
    );
  } catch (error) {
    console.error("Update consultant client failed:", error);

    return Response.json(
      { error: error.message },
      { status: 500, headers: corsHeaders }
    );
  }
}