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

function cleanString(value) {
  const stringValue = String(value || "").trim();
  return stringValue || null;
}

function toBool(value) {
  return value === true || String(value || "").trim().toLowerCase() === "true";
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

  try {
    const {
      imageBase64,
      customerId,
      clientRecordId,
      saveType,
      firstName,
      lastName,
      email,
      isAdmin,
      qualityImageBase64
    } = await request.json();

    const safeCustomerId = cleanString(customerId);
    const safeClientRecordId = cleanString(clientRecordId);

    if (!imageBase64 || (!safeCustomerId && !safeClientRecordId)) {
      return Response.json(
        { error: "Missing imageBase64 and record ID" },
        { status: 400, headers: corsHeaders }
      );
    }

    const isConsultantClient = !!safeClientRecordId;
    const recordId = safeClientRecordId || safeCustomerId;

    const mode = String(saveType || "original").trim().toLowerCase();
    const isAdjusted = mode === "adjusted";
    const shouldEvaluatePhotoQuality = toBool(isAdmin);

    const safeFirstName = cleanString(firstName);
    const safeLastName = cleanString(lastName);
    const safeEmail = cleanString(email);

    const timestamp = Math.floor(Date.now() / 1000);
    const publicId = isAdjusted
      ? `${isConsultantClient ? "consultant-client" : "customer"}-${recordId}-adjusted`
      : `${isConsultantClient ? "consultant-client" : "customer"}-${recordId}`;

    const paramsToSign = {
      folder: "ycs-drape-photos",
      public_id: publicId,
      overwrite: "true",
      timestamp: String(timestamp)
    };

    const signature = signCloudinaryParams(
      paramsToSign,
      process.env.CLOUDINARY_API_SECRET
    );

    const formData = new FormData();
    formData.append("file", imageBase64);
    formData.append("api_key", process.env.CLOUDINARY_API_KEY);
    formData.append("timestamp", String(timestamp));
    formData.append("signature", signature);
    formData.append("folder", paramsToSign.folder);
    formData.append("public_id", paramsToSign.public_id);
    formData.append("overwrite", "true");

    const uploadResponse = await fetch(
      `https://api.cloudinary.com/v1_1/${process.env.CLOUDINARY_CLOUD_NAME}/image/upload`,
      {
        method: "POST",
        body: formData
      }
    );

    const uploadData = await uploadResponse.json();

    if (!uploadResponse.ok || !uploadData.secure_url) {
      console.error("Cloudinary error:", uploadData);

      return Response.json(
        { error: "Cloudinary upload failed", details: uploadData },
        { status: 500, headers: corsHeaders }
      );
    }

    const imageUrl = uploadData.secure_url;

    const airtableBase = process.env.AIRTABLE_BASE_ID;
    const airtableToken = process.env.AIRTABLE_TOKEN;

    if (!airtableBase || !airtableToken) {
      return Response.json(
        { error: "Missing Airtable configuration" },
        { status: 500, headers: corsHeaders }
      );
    }

    const airtableTable = isConsultantClient ? "ConsultantClients" : "CustomerPhotos";
    const lookupField = isConsultantClient ? "ClientRecordId" : "CustomerId";

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
    const existingFields = existing?.fields || {};
    const fields = {};

   

    if (isConsultantClient) {
      fields.ClientRecordId = recordId;
    } else {
      fields.CustomerId = recordId;
    }

    fields.FirstName = safeFirstName || existingFields.FirstName || undefined;
    fields.LastName = safeLastName || existingFields.LastName || undefined;
    fields.Email = safeEmail || existingFields.Email || undefined;

    if (isAdjusted) {
      fields.AdjustedPhotoUrl = imageUrl;
      fields.ActivePhotoUrl = imageUrl;
      fields.PhotoUrl = imageUrl;

      if (!existingFields.OriginalPhotoUrl && existingFields.PhotoUrl) {
        fields.OriginalPhotoUrl = existingFields.PhotoUrl;
      }
    } else {
      fields.OriginalPhotoUrl = imageUrl;
      fields.ActivePhotoUrl = imageUrl;
      fields.PhotoUrl = imageUrl;
      if (!isConsultantClient) {
  fields.PhotoKey = uploadData.public_id;
}

      if (existingFields.AdjustedPhotoUrl) {
        fields.AdjustedPhotoUrl = existingFields.AdjustedPhotoUrl;
      }
    }

    Object.keys(fields).forEach((key) => {
      if (fields[key] === undefined) {
        delete fields[key];
      }
    });

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
        console.error("Airtable patch error:", patchData);
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
        console.error("Airtable create error:", createData);
        return Response.json(
          { error: "Airtable create failed", details: createData },
          { status: 500, headers: corsHeaders }
        );
      }
    }

    const photoQuality = await evaluateAdminPhotoQuality({
      isAdmin: shouldEvaluatePhotoQuality,
      isAdjusted,
      imageBase64: qualityImageBase64 || imageBase64,
      photoId: recordId,
      customerId: safeCustomerId,
      imageUrl
    });

    return Response.json(
      {
        success: true,
        imageUrl,
        saveType: mode,
        customerId: safeCustomerId,
        clientRecordId: safeClientRecordId,
        recordType: isConsultantClient ? "consultant_client" : "shopify_customer",
        firstName: fields.FirstName || null,
        lastName: fields.LastName || null,
        email: fields.Email || null,
        photoQuality
      },
      { status: 200, headers: corsHeaders }
    );
  } catch (error) {
    console.error("Save photo failed:", error);

    return Response.json(
      { error: error.message },
      { status: 500, headers: corsHeaders }
    );
  }
}
