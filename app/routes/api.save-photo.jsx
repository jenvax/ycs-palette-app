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
    const { imageBase64, customerId, saveType } = await request.json();

    if (!imageBase64 || !customerId) {
      return Response.json(
        { error: "Missing imageBase64 or customerId" },
        { status: 400, headers: corsHeaders }
      );
    }

    const mode = String(saveType || "original").trim().toLowerCase();
    const isAdjusted = mode === "adjusted";

    const timestamp = Math.floor(Date.now() / 1000);
    const publicId = isAdjusted
      ? `customer-${customerId}-adjusted`
      : `customer-${customerId}`;

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
    const airtableTable = "CustomerPhotos";
    const airtableToken = process.env.AIRTABLE_TOKEN;

    const findRes = await fetch(
      `https://api.airtable.com/v0/${airtableBase}/${airtableTable}?filterByFormula=${encodeURIComponent(`{CustomerId}="${customerId}"`)}`,
      {
        headers: {
          Authorization: `Bearer ${airtableToken}`
        }
      }
    );

    const findData = await findRes.json();
    const existing = findData.records?.[0];
    const existingFields = existing?.fields || {};

    let fields;

    if (isAdjusted) {
      fields = {
        CustomerId: customerId,
        AdjustedPhotoUrl: imageUrl,
        ActivePhotoUrl: imageUrl,
        PhotoUrl: imageUrl,
        UpdatedAt: new Date().toISOString()
      };

      if (!existingFields.OriginalPhotoUrl && existingFields.PhotoUrl) {
        fields.OriginalPhotoUrl = existingFields.PhotoUrl;
      }
    } else {
      fields = {
        CustomerId: customerId,
        OriginalPhotoUrl: imageUrl,
        ActivePhotoUrl: imageUrl,
        PhotoUrl: imageUrl,
        PhotoKey: uploadData.public_id,
        UpdatedAt: new Date().toISOString()
      };
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

    return Response.json(
      {
        success: true,
        imageUrl,
        saveType: mode
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