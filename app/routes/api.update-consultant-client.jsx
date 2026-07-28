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

const PALETTE_FIELD_CANDIDATES = [
  "PaletteCode",
  "AssignedPaletteCode",
  "ColorPaletteCode",
  "FinalPaletteCode",
  "YcsPaletteCode"
];

const NOTES_FIELD_CANDIDATES = [
  "Notes",
  "ClientNotes",
  "AnalysisNotes"
];

function uniqueValues(values) {
  return values.filter((value, index) => value && values.indexOf(value) === index);
}

function existingFieldName(fields, candidates) {
  return candidates.find((fieldName) => Object.prototype.hasOwnProperty.call(fields || {}, fieldName));
}

function isUnknownFieldError(data) {
  const type = String(data?.error?.type || "");
  const message = String(data?.error?.message || "").toLowerCase();
  return type === "UNKNOWN_FIELD_NAME" || message.includes("unknown field");
}

async function patchAirtableRecord({ airtableBase, airtableTable, airtableToken, recordId, fields }) {
  const response = await fetch(
    `https://api.airtable.com/v0/${airtableBase}/${airtableTable}/${recordId}`,
    {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${airtableToken}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ fields, typecast: true })
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

  try {
    const {
      clientRecordId,
      firstName,
      lastName,
      email,
      paletteCode,
      notes
    } = await request.json();

    const safeClientRecordId = cleanString(clientRecordId);
    const safeFirstName = cleanString(firstName);
    const safeLastName = cleanString(lastName);
    const safeEmail = cleanString(email);
    const safePaletteCode = cleanString(paletteCode);
    const safeNotes = cleanString(notes);

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

    const baseFields = {
      FirstName: safeFirstName,
      LastName: safeLastName,
      Email: safeEmail || null
    };

    const existingFields = existing.fields || {};
    const paletteFields = uniqueValues([
      existingFieldName(existingFields, PALETTE_FIELD_CANDIDATES),
      ...PALETTE_FIELD_CANDIDATES
    ]);
    const notesFields = uniqueValues([
      existingFieldName(existingFields, NOTES_FIELD_CANDIDATES),
      ...NOTES_FIELD_CANDIDATES
    ]);

    let patchRes = null;
    let patchData = null;
    let savedPaletteField = "";
    let savedNotesField = "";

    for (const paletteField of paletteFields) {
      for (const notesField of notesFields) {
        const fields = { ...baseFields };
        fields[paletteField] = safePaletteCode || null;
        fields[notesField] = safeNotes || null;

        const result = await patchAirtableRecord({
          airtableBase,
          airtableTable,
          airtableToken,
          recordId: existing.id,
          fields
        });

        patchRes = result.response;
        patchData = result.data;

        if (patchRes.ok) {
          savedPaletteField = paletteField;
          savedNotesField = notesField;
          break;
        }

        if (!isUnknownFieldError(patchData)) {
          break;
        }
      }

      if (patchRes?.ok || (patchRes && !isUnknownFieldError(patchData))) {
        break;
      }
    }

    if (!patchRes?.ok) {
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
        email: safeEmail,
        paletteCode: safePaletteCode || "",
        notes: safeNotes || "",
        savedPaletteField,
        savedNotesField
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
