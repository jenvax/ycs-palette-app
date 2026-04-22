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

function cleanString(value) {
  const stringValue = String(value || "").trim();
  return stringValue || null;
}

async function findSampleTrialRecord({ customerId, airtableBaseId, airtableToken, tableName }) {
  const formula = encodeURIComponent(`{CustomerID}='${customerId}'`);
  const url = `https://api.airtable.com/v0/${airtableBaseId}/${encodeURIComponent(tableName)}?filterByFormula=${formula}&maxRecords=1`;

  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${airtableToken}`
    }
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data?.error?.message || "Failed to look up sample trial.");
  }

  return data.records?.[0] || null;
}

async function createSampleTrialRecord({
  customerId,
  email,
  firstName,
  lastName,
  airtableBaseId,
  airtableToken,
  tableName
}) {
  const now = new Date().toISOString();

  const response = await fetch(`https://api.airtable.com/v0/${airtableBaseId}/${encodeURIComponent(tableName)}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${airtableToken}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      records: [
        {
          fields: {
            CustomerID: customerId,
            Email: email || "",
            FirstName: firstName || "",
            LastName: lastName || "",
            Status: "ACTIVE",
            CreatedAt: now,
            UpdatedAt: now
          }
        }
      ]
    })
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data?.error?.message || "Failed to create sample trial.");
  }

  return data.records?.[0] || null;
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

    const customerId = cleanString(url.searchParams.get("customerId"));
    const email = cleanString(url.searchParams.get("email"));
    const firstName = cleanString(url.searchParams.get("firstName"));
    const lastName = cleanString(url.searchParams.get("lastName"));
    const returnUrl =
      cleanString(url.searchParams.get("returnUrl")) ||
      "https://yourcolorstyle.com/pages/photo-draping";

    if (!customerId) {
      return new Response(
        JSON.stringify({ ok: false, error: "Missing customerId." }),
        {
          status: 400,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json"
          }
        }
      );
    }

    const airtableBaseId = process.env.AIRTABLE_BASE_ID;
    const airtableToken = process.env.AIRTABLE_TOKEN;
    const tableName = "SampleTrials";

    if (!airtableBaseId || !airtableToken) {
      return new Response(
        JSON.stringify({ ok: false, error: "Missing Airtable environment variables." }),
        {
          status: 500,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json"
          }
        }
      );
    }

    let existingRecord = await findSampleTrialRecord({
      customerId,
      airtableBaseId,
      airtableToken,
      tableName
    });

    if (!existingRecord) {
      existingRecord = await createSampleTrialRecord({
        customerId,
        email,
        firstName,
        lastName,
        airtableBaseId,
        airtableToken,
        tableName
      });
    }

    return Response.redirect(returnUrl, 302);
  } catch (error) {
    console.error("start-sample-trial error:", error);

    return new Response(
      JSON.stringify({
        ok: false,
        error: error?.message || "Something went wrong."
      }),
      {
        status: 500,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json"
        }
      }
    );
  }
}