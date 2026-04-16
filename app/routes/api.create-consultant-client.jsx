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

function generateClientRecordId() {
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const dd = String(now.getDate()).padStart(2, "0");
  const random = Math.random().toString(36).slice(2, 8);

  return `cc_${yyyy}${mm}${dd}_${random}`;
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
      consultantId,
      firstName,
      lastName,
      email
    } = await request.json();

    const safeConsultantId = cleanString(consultantId);
    const safeFirstName = cleanString(firstName);
    const safeLastName = cleanString(lastName);
    const safeEmail = cleanString(email);

    if (!safeConsultantId) {
      return Response.json(
        { error: "Missing consultantId" },
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

    const clientRecordId = generateClientRecordId();

    const fields = {
      ClientRecordId: clientRecordId,
      ConsultantId: safeConsultantId,
      FirstName: safeFirstName,
      LastName: safeLastName,
      Email: safeEmail || undefined,
      Status: "New",
      UpdatedAt: new Date().toISOString()
    };

    Object.keys(fields).forEach((key) => {
      if (fields[key] === undefined) {
        delete fields[key];
      }
    });

    const createRes = await fetch(
      `https://api.airtable.com/v0/${airtableBase}/${airtableTable}`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${airtableToken}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ fields })
      }
    );

    const createData = await createRes.json();

    if (!createRes.ok) {
      console.error("Airtable create consultant client error:", createData);

      return Response.json(
        { error: "Airtable create failed", details: createData },
        { status: 500, headers: corsHeaders }
      );
    }

    return Response.json(
      {
        success: true,
        clientRecordId,
        consultantId: safeConsultantId,
        firstName: safeFirstName,
        lastName: safeLastName,
        email: safeEmail
      },
      { status: 200, headers: corsHeaders }
    );
  } catch (error) {
    console.error("Create consultant client failed:", error);

    return Response.json(
      { error: error.message },
      { status: 500, headers: corsHeaders }
    );
  }
}