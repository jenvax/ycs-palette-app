/* global process */

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

function isMissingIsArchivedError(data) {
  const message = String(data?.error?.message || "").toLowerCase();
  return (
    data?.error?.type === "UNKNOWN_FIELD_NAME" ||
    message.includes("unknown field") ||
    message.includes("isarchived")
  );
}

async function findClient({ airtableBase, airtableTable, airtableToken, clientRecordId, consultantId }) {
  const consultantClause = consultantId ? `, {ConsultantId}="${consultantId}"` : "";
  const formula = `AND({ClientRecordId}="${clientRecordId}"${consultantClause})`;
  const response = await fetch(
    `https://api.airtable.com/v0/${airtableBase}/${airtableTable}?filterByFormula=${encodeURIComponent(formula)}`,
    {
      headers: {
        Authorization: `Bearer ${airtableToken}`
      }
    }
  );

  const data = await response.json();
  return { response, data, record: data.records?.[0] || null };
}

async function archiveClient({ airtableBase, airtableTable, airtableToken, recordId }) {
  const response = await fetch(
    `https://api.airtable.com/v0/${airtableBase}/${airtableTable}/${recordId}`,
    {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${airtableToken}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        fields: {
          IsArchived: true,
          UpdatedAt: new Date().toISOString()
        },
        typecast: true
      })
    }
  );

  const data = await response.json();
  return { response, data };
}

async function deleteClient({ airtableBase, airtableTable, airtableToken, recordId }) {
  const response = await fetch(
    `https://api.airtable.com/v0/${airtableBase}/${airtableTable}/${recordId}`,
    {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${airtableToken}`
      }
    }
  );

  const data = await response.json();
  return { response, data };
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

    if (!safeClientRecordId) {
      return Response.json(
        { error: "Missing clientRecordId" },
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

    const { response: findRes, data: findData, record } = await findClient({
      airtableBase,
      airtableTable,
      airtableToken,
      clientRecordId: safeClientRecordId,
      consultantId: safeConsultantId
    });

    if (!findRes.ok) {
      return Response.json(
        { error: "Airtable fetch failed", details: findData },
        { status: 500, headers: corsHeaders }
      );
    }

    if (!record) {
      return Response.json(
        { error: "Client record not found" },
        { status: 404, headers: corsHeaders }
      );
    }

    let { response, data } = await archiveClient({
      airtableBase,
      airtableTable,
      airtableToken,
      recordId: record.id
    });
    let deletedBy = "archive";

    if (!response.ok && isMissingIsArchivedError(data)) {
      ({ response, data } = await deleteClient({
        airtableBase,
        airtableTable,
        airtableToken,
        recordId: record.id
      }));
      deletedBy = "delete";
    }

    if (!response.ok) {
      console.error("Airtable delete consultant client error:", data);

      return Response.json(
        { error: "Airtable delete failed", details: data },
        { status: 500, headers: corsHeaders }
      );
    }

    return Response.json(
      {
        success: true,
        clientRecordId: safeClientRecordId,
        deletedBy
      },
      { status: 200, headers: corsHeaders }
    );
  } catch (error) {
    console.error("Delete consultant client failed:", error);

    return Response.json(
      { error: error.message || "Unknown error" },
      { status: 500, headers: corsHeaders }
    );
  }
}
