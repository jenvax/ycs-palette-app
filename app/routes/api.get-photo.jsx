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
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Vary": "Origin"
  };
}


function cleanString(value) {
  const stringValue = String(value || "").trim();
  return stringValue || null;
}
function isAirtableRecordId(value) {
  return String(value || "").startsWith("rec");
}
function parseJson(value) {
  try {
    return value ? JSON.parse(value) : null;
  } catch (error) {
    return null;
  }
}
function normalizePaletteCode(value) {
  return String(value || "").trim().toUpperCase();
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
    const photoId = cleanString(url.searchParams.get("photoId"));

    const customerId = cleanString(url.searchParams.get("customerId"));
    const clientRecordId = cleanString(url.searchParams.get("clientRecordId"));

    if (!customerId && !clientRecordId) {
      return Response.json(
        {
          photoUrl: null,
          originalPhotoUrl: null,
          adjustedPhotoUrl: null,
          activePhotoUrl: null,
          customerId: null,
          clientRecordId: null,
          firstName: null,
          lastName: null,
          email: null,
          customerPaletteCode: null
        },
        { status: 200, headers: corsHeaders }
      );
    }

    const airtableBase = process.env.AIRTABLE_BASE_ID;
    const airtableToken = process.env.AIRTABLE_TOKEN;

    if (!airtableBase || !airtableToken) {
      return Response.json(
        { error: "Missing Airtable configuration" },
        { status: 500, headers: corsHeaders }
      );
    }

    const isConsultantClient = !!clientRecordId;
const isSpecificPhoto = !!photoId && !!customerId;
const photoSource =
  cleanString(url.searchParams.get("source")) ||
  cleanString(url.searchParams.get("sourceTable")) ||
  cleanString(url.searchParams.get("photoSource"));

let tableName;
let filterFormula;
const notArchivedFormula =
  "OR({IsArchived}=BLANK(), {IsArchived}=0, {IsArchived}=FALSE())";

if (isConsultantClient) {
  tableName = "ConsultantClients";
  filterFormula = isAirtableRecordId(clientRecordId)
    ? `RECORD_ID()="${clientRecordId}"`
    : `{ClientRecordId}="${clientRecordId}"`;
} else if (isSpecificPhoto) {
  if (photoId.startsWith("rec") && !photoSource) {
    return Response.json(
      { error: "Missing photoSource for Airtable record ID" },
      { status: 400, headers: corsHeaders }
    );
  }

  tableName =
    photoSource === "CustomerPhotos"
      ? "CustomerPhotos"
      : "PersonalStudioPhotos";

  if (photoId.startsWith("rec")) {
  filterFormula = tableName === "PersonalStudioPhotos"
    ? `AND(RECORD_ID()="${photoId}", ${notArchivedFormula})`
    : `RECORD_ID()="${photoId}"`;
} else {
  filterFormula = tableName === "PersonalStudioPhotos"
    ? `AND({PhotoId}="${photoId}", {CustomerId}="${customerId}", ${notArchivedFormula})`
    : `AND({PhotoId}="${photoId}", {CustomerId}="${customerId}")`;
}
} else {
  tableName = "PersonalStudioPhotos";
  filterFormula = `AND({CustomerId}="${customerId}", ${notArchivedFormula})`;
}

const airtableUrl =
  `https://api.airtable.com/v0/${airtableBase}/${tableName}` +
  `?filterByFormula=${encodeURIComponent(filterFormula)}`;

    const res = await fetch(airtableUrl, {
      headers: {
        Authorization: `Bearer ${airtableToken}`
      }
    });

    const data = await res.json();

    if (!res.ok) {
      return Response.json(
        {
          error: "Airtable lookup failed",
          details: data
        },
        { status: 500, headers: corsHeaders }
      );
    }

    let record = data.records?.[0] || null;

if (!record && tableName === "PersonalStudioPhotos" && customerId && !clientRecordId) {
  const customerPhotosFormula = `AND({CustomerId}="${customerId}")`;
  const customerPhotosUrl =
    `https://api.airtable.com/v0/${airtableBase}/CustomerPhotos` +
    `?filterByFormula=${encodeURIComponent(customerPhotosFormula)}`;

  const customerPhotosRes = await fetch(customerPhotosUrl, {
    headers: {
      Authorization: `Bearer ${airtableToken}`
    }
  });

  const customerPhotosData = await customerPhotosRes.json();

  if (!customerPhotosRes.ok) {
    return Response.json(
      {
        error: "Airtable fallback lookup failed",
        details: customerPhotosData
      },
      { status: 500, headers: corsHeaders }
    );
  }

  record = customerPhotosData.records?.[0] || null;
  if (record) {
    tableName = "CustomerPhotos";
  }
}

if (!record) {
  return Response.json(
    {
      error: "Photo not found",
      photoId,
      customerId,
      clientRecordId,
      photoSource,
      tableName
    },
    { status: 404, headers: corsHeaders }
  );
}

const fields = record.fields || {};


    const photoTransform =
  parseJson(fields.PhotoTransform) ||
  parseJson(fields.PhotoTransformJson) ||
  null;

const lipMask =
  parseJson(fields.LipMaskJson) ||
  photoTransform?.lipMask ||
  null;

    const originalPhotoUrl = fields.OriginalPhotoUrl || null;
const adjustedPhotoUrl = fields.AdjustedPhotoUrl || null;
const photoUrl = fields.PhotoUrl || null;

const activePhotoUrl =
  fields.ActivePhotoUrl ||
  adjustedPhotoUrl ||
  photoUrl ||
  originalPhotoUrl ||
  null;

const activePhotoSessionKey =
  activePhotoUrl ||
  null;
const customerPaletteCode =
  normalizePaletteCode(
    fields.AnalysisResultCode ||
    fields.PaletteCode ||
    fields.CustomerPaletteCode ||
    ""
  ) || null;

    return Response.json(
      {
        photoUrl,
    originalPhotoUrl,
    adjustedPhotoUrl,
    activePhotoUrl,
    activePhotoSessionKey,
      photoTransform,
      lipMask,
      photoId: photoId || fields.PhotoId || null,
      photoSource: tableName,
        customerId: customerId || null,
        clientRecordId: clientRecordId || null,
        firstName: fields.FirstName || null,
        lastName: fields.LastName || null,
        email: fields.Email || null,
        customerPaletteCode,
        recordType: isConsultantClient ? "consultant_client" : "shopify_customer"
      },
      { status: 200, headers: corsHeaders }
    );
  } catch (error) {
    console.error("Get photo failed:", error);

    return Response.json(
      {
        error: "Server error",
        details: error.message
      },
      { status: 500, headers: corsHeaders }
    );
  }
}
