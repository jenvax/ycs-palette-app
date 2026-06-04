import crypto from "node:crypto";
import { evaluatePhotoQuality } from "../services/photo-quality.server.js";
import { savePhotoQualityEvaluation } from "../services/photo-quality-feedback.server.js";

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

function toBool(value) {
  return value === true || String(value || "").trim().toLowerCase() === "true";
}

function signCloudinaryParams(params, apiSecret) {
  const stringToSign = Object.keys(params)
    .sort()
    .map((key) => `${key}=${params[key]}`)
    .join("&");

  return crypto
    .createHash("sha1")
    .update(stringToSign + apiSecret)
    .digest("hex");
}

function buildPhotoId() {
  return `psp_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

async function evaluateAdminPhotoQuality({
  isAdmin,
  isAdjusted,
  imageBase64,
  photoId,
  customerId,
  imageUrl
}) {
  if (!isAdmin || isAdjusted || !imageBase64) return null;

  try {
    const result = await evaluatePhotoQuality({ imageBase64 });
    let evaluation = null;
    let evaluationSaveError = null;

    try {
      evaluation = await savePhotoQualityEvaluation({
        photoId,
        customerId,
        imageUrl,
        result
      });
    } catch (error) {
      evaluationSaveError = error;
      console.error("Upload photo quality result was not saved:", error);
    }

    console.info(
      "YCS_ADMIN upload photo quality evaluated",
      JSON.stringify({
        evaluationId: evaluation?.evaluation_id || null,
        photoId,
        customerId,
        status: result.status,
        score: result.score,
        saved: Boolean(evaluation),
        checkedAt: new Date().toISOString()
      })
    );

    return {
      ...result,
      evaluation_id: evaluation?.evaluation_id || null,
      evaluation_saved: Boolean(evaluation),
      evaluation_save_error: evaluationSaveError
        ? "Photo quality result was evaluated but could not be saved."
        : null
    };
  } catch (error) {
    console.error("Upload photo quality evaluation failed:", error);
    return {
      error: "Photo quality evaluation failed",
      details: error.message || "Unknown error"
    };
  }
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
      imageBase64,
      customerId,
      photoId,
      saveType,
      photoTransform,
      label,
      isAdmin,
      qualityImageBase64
    } = await request.json();

    const safeCustomerId = cleanString(customerId);
    const safePhotoId = cleanString(photoId) || buildPhotoId();
    const safeLabel = cleanString(label);
    const mode = String(saveType || "original").trim().toLowerCase();
    const isAdjusted = mode === "adjusted";
    const shouldEvaluatePhotoQuality = toBool(isAdmin);

    if (!imageBase64 || !safeCustomerId) {
      return Response.json(
        { error: "Missing imageBase64 or customerId" },
        { status: 400, headers: corsHeaders }
      );
    }

    const airtableBase = process.env.AIRTABLE_BASE_ID;
    const airtableToken = process.env.AIRTABLE_TOKEN;
    const airtableTable = "PersonalStudioPhotos";

    const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
    const apiKey = process.env.CLOUDINARY_API_KEY;
    const apiSecret = process.env.CLOUDINARY_API_SECRET;

    if (!airtableBase || !airtableToken || !cloudName || !apiKey || !apiSecret) {
      return Response.json(
        { error: "Missing server configuration" },
        { status: 500, headers: corsHeaders }
      );
    }

    const timestamp = Math.floor(Date.now() / 1000);
    const publicId = isAdjusted
      ? `personal-${safeCustomerId}-${safePhotoId}-adjusted`
      : `personal-${safeCustomerId}-${safePhotoId}`;

    const paramsToSign = {
      folder: "ycs-drape-photos",
      public_id: publicId,
      overwrite: "true",
      timestamp: String(timestamp)
    };

    const signature = signCloudinaryParams(paramsToSign, apiSecret);

    const formData = new FormData();
    formData.append("file", imageBase64);
    formData.append("api_key", apiKey);
    formData.append("timestamp", String(timestamp));
    formData.append("signature", signature);
    formData.append("folder", paramsToSign.folder);
    formData.append("public_id", paramsToSign.public_id);
    formData.append("overwrite", "true");

    const uploadResponse = await fetch(
      `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`,
      {
        method: "POST",
        body: formData
      }
    );

    const uploadData = await uploadResponse.json();

    if (!uploadResponse.ok || !uploadData.secure_url) {
      console.error("Cloudinary upload failed:", uploadData);

      return Response.json(
        { error: "Cloudinary upload failed", details: uploadData },
        { status: 500, headers: corsHeaders }
      );
    }

    const imageUrl = uploadData.secure_url;

    const lookupFormula = safePhotoId.startsWith("rec")
      ? `RECORD_ID()="${safePhotoId}"`
      : `AND({PhotoId}="${safePhotoId}", {CustomerId}="${safeCustomerId}")`;

    const findRes = await fetch(
      `https://api.airtable.com/v0/${airtableBase}/${airtableTable}?filterByFormula=${encodeURIComponent(lookupFormula)}`,
      {
        headers: {
          Authorization: `Bearer ${airtableToken}`
        }
      }
    );

    const findData = await findRes.json();
    const existing = findData.records?.[0] || null;

    if (safePhotoId.startsWith("rec") && !existing) {
      return Response.json(
        { error: "PersonalStudioPhotos record not found" },
        { status: 404, headers: corsHeaders }
      );
    }

    const existingFields = existing?.fields || {};
    const nowIso = new Date().toISOString();

    const fields = {
      CustomerId: safeCustomerId,
      UpdatedAt: nowIso
    };

    if (!safePhotoId.startsWith("rec")) {
      fields.PhotoId = safePhotoId;
    }

    if (!existing) {
      fields.CreatedAt = nowIso;
    }

    if (safeLabel) {
      fields.Label = safeLabel;
    }

    if (photoTransform) {
      fields.PhotoTransform = JSON.stringify({
        x: Number.isFinite(Number(photoTransform.x)) ? Number(photoTransform.x) : 0,
        y: Number.isFinite(Number(photoTransform.y)) ? Number(photoTransform.y) : 0,
        scale: Number.isFinite(Number(photoTransform.scale)) ? Number(photoTransform.scale) : 1
      });
    }

    if (isAdjusted) {
      fields.AdjustedPhotoUrl = imageUrl;
      fields.ActivePhotoUrl = imageUrl;

      if (!existingFields.OriginalPhotoUrl && existingFields.ActivePhotoUrl) {
        fields.OriginalPhotoUrl = existingFields.ActivePhotoUrl;
      }
    } else {
      fields.OriginalPhotoUrl = imageUrl;
      fields.ActivePhotoUrl = imageUrl;

      if (existingFields.AdjustedPhotoUrl) {
        fields.AdjustedPhotoUrl = existingFields.AdjustedPhotoUrl;
      }
    }

    const payload = { fields };

    if (existing) {
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
        console.error("Airtable patch failed:", patchData);

        return Response.json(
          { error: "Airtable update failed", details: patchData },
          { status: 500, headers: corsHeaders }
        );
      }
    } else {
      const createRes = await fetch(
        `https://api.airtable.com/v0/${airtableBase}/${airtableTable}`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${airtableToken}`,
            "Content-Type": "application/json"
          },
          body: JSON.stringify(payload)
        }
      );

      const createData = await createRes.json();

      if (!createRes.ok) {
        console.error("Airtable create failed:", createData);

        return Response.json(
          { error: "Airtable create failed", details: createData },
          { status: 500, headers: corsHeaders }
        );
      }
    }

    const responsePhotoId = existingFields.PhotoId || safePhotoId;
    const photoQuality = await evaluateAdminPhotoQuality({
      isAdmin: shouldEvaluatePhotoQuality,
      isAdjusted,
      imageBase64: qualityImageBase64 || imageBase64,
      photoId: responsePhotoId,
      customerId: safeCustomerId,
      imageUrl
    });

    return Response.json(
      {
        success: true,
        photoId: responsePhotoId,
        photoSource: "PersonalStudioPhotos",
        imageUrl,
        saveType: mode,
        photoQuality
      },
      { status: 200, headers: corsHeaders }
    );
  } catch (error) {
    console.error("Save personal studio photo failed:", error);

    return Response.json(
      { error: error.message || "Unknown error" },
      { status: 500, headers: corsHeaders }
    );
  }
}
