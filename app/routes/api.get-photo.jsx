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
function parseJson(value) {
  try {
    return value ? JSON.parse(value) : null;
  } catch (error) {
    return null;
  }
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
          email: null
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
const isPersonalPhoto = !!photoId && !!customerId;

let tableName;
let filterFormula;

if (isConsultantClient) {
  tableName = "ConsultantClients";
  filterFormula = `{ClientRecordId}="${clientRecordId}"`;
} else if (isPersonalPhoto) {
  tableName = "PersonalStudioPhotos";
  filterFormula = `AND({PhotoId}="${photoId}", {CustomerId}="${customerId}")`;
} else {
  tableName = "CustomerPhotos";
  filterFormula = `{CustomerId}="${customerId}"`;
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

    const record = data.records?.[0] || null;
    const fields = record?.fields || {};

    const photoTransform =
  parseJson(fields.PhotoTransformJson) ||
  parseJson(fields.PhotoTransform) ||
  null;

const lipMask =
  parseJson(fields.LipMaskJson) ||
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
        customerId: customerId || null,
        clientRecordId: clientRecordId || null,
        firstName: fields.FirstName || null,
        lastName: fields.LastName || null,
        email: fields.Email || null,
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