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

function parseJson(value) {
  try {
    return value ? JSON.parse(value) : null;
  } catch (error) {
    return null;
  }
}

function getValidLipShapes(lipMask) {
  return Array.isArray(lipMask?.shapes)
    ? lipMask.shapes
        .filter(function (shape) {
          return Array.isArray(shape.points) && shape.points.length >= 3;
        })
        .slice(0, 2)
        .map(function (shape) {
          return {
            points: shape.points,
            closed: !!shape.closed
          };
        })
    : Array.isArray(lipMask?.points)
      ? [
          {
            points: lipMask.points,
            closed: !!lipMask.closed
          }
        ]
      : [];
}

function isUnknownAirtableFieldError(data, fieldName) {
  const message = String(data?.error?.message || data?.error || "");
  return (
    message.toLowerCase().includes("unknown field") &&
    message.includes(fieldName)
  );
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
    const {
  customerId,
  clientRecordId,
  photoId,
  photoSource,
  sourceTable,
  source,
  photoTransform,
  analysisState,
  lipMask
} = await request.json();

    const safeCustomerId = cleanString(customerId);
    const safeClientRecordId = cleanString(clientRecordId);

    if ((!safeCustomerId && !safeClientRecordId) || !photoTransform) {
      return Response.json(
        { error: "Missing customerId/clientRecordId or photoTransform" },
        { status: 400, headers: corsHeaders }
      );
    }

const safePhotoId = cleanString(photoId);
const safePhotoSource = cleanString(photoSource || sourceTable || source);

const isConsultantClient = !!safeClientRecordId;
const isSpecificCustomerPhoto = !!safePhotoId && !!safeCustomerId;

if (!isConsultantClient && safePhotoId?.startsWith("rec") && !safePhotoSource) {
  return Response.json(
    { error: "Missing photoSource for Airtable record ID" },
    { status: 400, headers: corsHeaders }
  );
}

const airtableTable = isConsultantClient
  ? "ConsultantClients"
  : isSpecificCustomerPhoto
    ? safePhotoSource === "CustomerPhotos"
      ? "CustomerPhotos"
      : "PersonalStudioPhotos"
    : "PersonalStudioPhotos";

let lookupFormula;

if (isConsultantClient) {
  lookupFormula = `{ClientRecordId}="${safeClientRecordId}"`;
} else if (isSpecificCustomerPhoto) {
  if (safePhotoId.startsWith("rec")) {
    // Airtable record ID → ONLY use RECORD_ID()
    lookupFormula = `RECORD_ID()="${safePhotoId}"`;
  } else {
    // PersonalStudioPhotos PhotoId
    lookupFormula = `AND({PhotoId}="${safePhotoId}", {CustomerId}="${safeCustomerId}")`;
  }
} else {
  lookupFormula = `{CustomerId}="${safeCustomerId}"`;
}

    const airtableBase = process.env.AIRTABLE_BASE_ID;
    const airtableToken = process.env.AIRTABLE_TOKEN;

    if (!airtableBase || !airtableToken) {
      return Response.json(
        { error: "Missing Airtable configuration" },
        { status: 500, headers: corsHeaders }
      );
    }

    const findRes = await fetch(
  `https://api.airtable.com/v0/${airtableBase}/${airtableTable}?filterByFormula=${encodeURIComponent(lookupFormula)}`,
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
        { error: "Photo record not found" },
        { status: 404, headers: corsHeaders }
      );
    }

const existingFields = existing.fields || {};
const existingTransform =
  parseJson(existingFields.PhotoTransform) ||
  parseJson(existingFields.PhotoTransformJson) ||
  null;
const existingLipMask =
  parseJson(existingFields.LipMaskJson) ||
  existingTransform?.lipMask ||
  null;

const incomingShapes = getValidLipShapes(lipMask);
const existingShapes = getValidLipShapes(existingLipMask);
const shapes = incomingShapes.length ? incomingShapes : existingShapes;

    const transformToSave = {
    ...(existingTransform && typeof existingTransform === "object" ? existingTransform : {}),
    x: Number.isFinite(Number(photoTransform.x)) ? Number(photoTransform.x) : 0,
    y: Number.isFinite(Number(photoTransform.y)) ? Number(photoTransform.y) : 0,
    scale: Number.isFinite(Number(photoTransform.scale)) ? Number(photoTransform.scale) : 1
  };

const safeAnalysisState =
  analysisState && typeof analysisState === "object" ? analysisState : {};

[
  "analysisDepthDecision",
  "analysisUndertoneDecision",
  "analysisChromaDecision",
  "analysisCompletedAt",
  "analysisCurrentStep"
].forEach((fieldName) => {
  if (Object.prototype.hasOwnProperty.call(safeAnalysisState, fieldName)) {
    transformToSave[fieldName] = cleanString(safeAnalysisState[fieldName]) || "";
  }
});

if (shapes.length) {
  transformToSave.lipMask = { shapes };
}

    const fields = {
  PhotoTransform: JSON.stringify(transformToSave)
};

if (shapes.length) {
  fields.LipMaskJson = JSON.stringify({ shapes });
}

const payload = { fields };
    let patchRes = await fetch(
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

    let patchData = await patchRes.json();

    if (!patchRes.ok && shapes.length && isUnknownAirtableFieldError(patchData, "LipMaskJson")) {
      const fallbackPayload = {
        fields: {
          PhotoTransform: fields.PhotoTransform
        }
      };

      patchRes = await fetch(
        `https://api.airtable.com/v0/${airtableBase}/${airtableTable}/${existing.id}`,
        {
          method: "PATCH",
          headers: {
            Authorization: `Bearer ${airtableToken}`,
            "Content-Type": "application/json"
          },
          body: JSON.stringify(fallbackPayload)
        }
      );

      patchData = await patchRes.json();

      if (patchRes.ok) {
        return Response.json(
          {
            success: true,
            lipMaskSaved: true,
            lipMaskStorage: "PhotoTransform"
          },
          { status: 200, headers: corsHeaders }
        );
      }
    }

    if (!patchRes.ok) {
      console.error("Airtable patch error:", patchData);

      return Response.json(
        { error: "Airtable update failed", details: patchData },
        { status: 500, headers: corsHeaders }
      );
    }

    return Response.json(
      { success: true },
      { status: 200, headers: corsHeaders }
    );
  } catch (error) {
    console.error("Save photo transform failed:", error);

    return Response.json(
      { error: error.message },
      { status: 500, headers: corsHeaders }
    );
  }
}
