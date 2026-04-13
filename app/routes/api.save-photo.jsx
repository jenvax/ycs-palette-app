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

  try {
    const {
      imageBase64,
      customerId,
      saveType,
      firstName,
      lastName,
      email
    } = await request.json();

    if (!imageBase64 || !customerId) {
      return Response.json(
        { error: "Missing imageBase64 or customerId" },
        { status: 400, headers: corsHeaders }
      );
    }

    const mode = String(saveType || "original").trim().toLowerCase();
    const isAdjusted = mode === "adjusted";

    const safeCustomerId = String(customerId).trim();
    const safeFirstName = cleanString(firstName);
    const safeLastName = cleanString(lastName);
    const safeEmail = cleanString(email);

    const timestamp = Math.floor(Date.now() / 1000);
    const publicId = isAdjusted
      ? `customer-${safeCustomerId}-adjusted`
      : `customer-${safeCustomerId}`;

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

    if (!airtableBase || !airtableToken) {
      return Response.json(
        { error: "Missing Airtable configuration" },
        { status: 500, headers: corsHeaders }
      );
    }

    const findRes = await fetch(
      `https://api.airtable.com/v0/${airtableBase}/${airtableTable}?filterByFormula=${encodeURIComponent(`{CustomerId}="${safeCustomerId}"`)}`,
      {
        headers: {
          Authorization: `Bearer ${airtableToken}`
        }
      }
    );

    const findData = await findRes.json();
    const existing = findData.records?.[0];
    const existingFields = existing?.fields || {};

    const fields = {
      CustomerId: safeCustomerId,
      UpdatedAt: new Date().toISOString()
    };

    // Preserve existing identity values unless new ones were provided
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
      fields.PhotoKey = uploadData.public_id;

      // Optional: if there is already an adjusted photo, leave it alone
      if (existingFields.AdjustedPhotoUrl) {
        fields.AdjustedPhotoUrl = existingFields.AdjustedPhotoUrl;
      }
    }

    // Remove undefined keys so Airtable only gets real values
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

    return Response.json(
      {
        success: true,
        imageUrl,
        saveType: mode,
        firstName: fields.FirstName || null,
        lastName: fields.LastName || null,
        email: fields.Email || null
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