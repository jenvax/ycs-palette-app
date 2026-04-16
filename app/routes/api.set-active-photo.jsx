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

  if (request.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: corsHeaders
    });
  }

  try {
    const { customerId, clientRecordId, photoType } = await request.json();

    const safeCustomerId = cleanString(customerId);
    const safeClientRecordId = cleanString(clientRecordId);
    const safePhotoType = cleanString(photoType);

    if ((!safeCustomerId && !safeClientRecordId) || !safePhotoType) {
      return Response.json(
        { error: "Missing customerId/clientRecordId or photoType" },
        { status: 400, headers: corsHeaders }
      );
    }

    const isConsultantClient = !!safeClientRecordId;
    const recordId = safeClientRecordId || safeCustomerId;

    const airtableBase = process.env.AIRTABLE_BASE_ID;
    const airtableToken = process.env.AIRTABLE_TOKEN;
    const airtableTable = isConsultantClient ? "ConsultantClients" : "CustomerPhotos";
    const lookupField = isConsultantClient ? "ClientRecordId" : "CustomerId";

    if (!airtableBase || !airtableToken) {
      return Response.json(
        { error: "Missing Airtable configuration" },
        { status: 500, headers: corsHeaders }
      );
    }

    const findRes = await fetch(
      `https://api.airtable.com/v0/${airtableBase}/${airtableTable}?filterByFormula=${encodeURIComponent(`{${lookupField}}="${recordId}"`)}`,
      {
        headers: {
          Authorization: `Bearer ${airtableToken}`
        }
      }
    );

    const findData = await findRes.json();
    const existing = findData.records?.[0];
    const fields = existing?.fields || {};

    if (!existing) {
      return Response.json(
        { error: "Photo record not found" },
        { status: 404, headers: corsHeaders }
      );
    }

    let nextUrl = null;

    if (safePhotoType === "original") {
      nextUrl = fields.OriginalPhotoUrl || null;
    } else if (safePhotoType === "adjusted") {
      nextUrl = fields.AdjustedPhotoUrl || null;
    } else {
      return Response.json(
        { error: "Invalid photoType" },
        { status: 400, headers: corsHeaders }
      );
    }

    if (!nextUrl) {
      return Response.json(
        { error: `No ${safePhotoType} photo found` },
        { status: 400, headers: corsHeaders }
      );
    }

    const payload = {
  fields: {
    ActivePhotoUrl: nextUrl,
    PhotoUrl: nextUrl
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
        activePhotoUrl: nextUrl,
        customerId: safeCustomerId,
        clientRecordId: safeClientRecordId,
        recordType: isConsultantClient ? "consultant_client" : "shopify_customer"
      },
      { status: 200, headers: corsHeaders }
    );
  } catch (error) {
    console.error("Set active photo failed:", error);

    return Response.json(
      { error: error.message },
      { status: 500, headers: corsHeaders }
    );
  }
}