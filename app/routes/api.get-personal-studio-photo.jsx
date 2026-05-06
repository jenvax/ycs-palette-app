//updated 5-6-2026
import crypto from "node:crypto";

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

function createPhotoId() {
  return `psp_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
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

async function findPersonalPhoto({ airtableBase, airtableToken, photoId, customerId }) {
  const table = "PersonalStudioPhotos";

  let formula;

  if (photoId && photoId.startsWith("rec")) {
    formula = `AND(RECORD_ID()="${photoId}", {CustomerId}="${customerId}")`;
  } else {
    formula = `AND({PhotoId}="${photoId}", {CustomerId}="${customerId}")`;
  }

  const url =
    `https://api.airtable.com/v0/${airtableBase}/${table}` +
    `?filterByFormula=${encodeURIComponent(formula)}`;

  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${airtableToken}`
    }
  });

  const data = await res.json();

  if (!res.ok) {
    throw new Error(data?.error?.message || "Airtable lookup failed");
  }

  return data.records?.[0] || null;
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
    const body = await request.json();

    const imageBase64 = body.imageBase64;
    const customerId = cleanString(body.customerId);
    const incomingPhotoId = cleanString(body.photoId);
    const saveType = cleanString(body.saveType) || "adjusted";

    const firstName = cleanString(body.firstName);
    const lastName = cleanString(body.lastName);
    const email = cleanString(body.email);

    if (!imageBase64 || !customerId) {
      return Response.json(
        { error: "Missing imageBase64 or customerId" },
        { status: 400, headers: corsHeaders }
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

    if (
      !process.env.CLOUDINARY_CLOUD_NAME ||
      !process.env.CLOUDINARY_API_KEY ||
      !process.env.CLOUDINARY_API_SECRET
    ) {
      return Response.json(
        { error: "Missing Cloudinary configuration" },
        { status: 500, headers: corsHeaders }
      );
    }

    const finalPhotoId = incomingPhotoId || createPhotoId();
    const mode = String(saveType).toLowerCase() === "original" ? "original" : "adjusted";

    const timestamp = Math.floor(Date.now() / 1000);

    const publicId =
      mode === "original"
        ? `personal-studio-${customerId}-${finalPhotoId}-original`
        : `personal-studio-${customerId}-${finalPhotoId}-adjusted`;

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

    const uploadRes = await fetch(
      `https://api.cloudinary.com/v1_1/${process.env.CLOUDINARY_CLOUD_NAME}/image/upload`,
      {
        method: "POST",
        body: formData
      }
    );

    const uploadData = await uploadRes.json();

    if (!uploadRes.ok || !uploadData.secure_url) {
      return Response.json(
        { error: "Cloudinary upload failed", details: uploadData },
        { status: 500, headers: corsHeaders }
      );
    }

    const imageUrl = uploadData.secure_url;

    const existing = incomingPhotoId
      ? await findPersonalPhoto({
          airtableBase,
          airtableToken,
          photoId: incomingPhotoId,
          customerId
        })
      : null;

    const fields = {
      CustomerId: customerId,
      PhotoId: finalPhotoId,
      ActivePhotoUrl: imageUrl
    };

    if (firstName) fields.FirstName = firstName;
    if (lastName) fields.LastName = lastName;
    if (email) fields.Email = email;

    if (mode === "original") {
      fields.OriginalPhotoUrl = imageUrl;
    } else {
      fields.AdjustedPhotoUrl = imageUrl;
    }

    const table = "PersonalStudioPhotos";

    if (existing) {
      const patchRes = await fetch(
        `https://api.airtable.com/v0/${airtableBase}/${table}/${existing.id}`,
        {
          method: "PATCH",
          headers: {
            Authorization: `Bearer ${airtableToken}`,
            "Content-Type": "application/json"
          },
          body: JSON.stringify({ fields })
        }
      );

      const patchData = await patchRes.json();

      if (!patchRes.ok) {
        return Response.json(
          { error: "Airtable update failed", details: patchData },
          { status: 500, headers: corsHeaders }
        );
      }
    } else {
      const createRes = await fetch(
        `https://api.airtable.com/v0/${airtableBase}/${table}`,
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
        return Response.json(
          { error: "Airtable create failed", details: createData },
          { status: 500, headers: corsHeaders }
        );
      }
    }

    return Response.json(
      {
        success: true,
        imageUrl,
        photoId: finalPhotoId,
        customerId,
        saveType: mode,
        activePhotoUrl: imageUrl,
        adjustedPhotoUrl: mode === "adjusted" ? imageUrl : null,
        originalPhotoUrl: mode === "original" ? imageUrl : null
      },
      { status: 200, headers: corsHeaders }
    );
  } catch (error) {
    console.error("Save personal studio photo failed:", error);

    return Response.json(
      {
        error: "Server error",
        details: error.message
      },
      { status: 500, headers: corsHeaders }
    );
  }
}