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
    const { imageBase64, customerId } = await request.json();

    if (!imageBase64 || !customerId) {
      return Response.json(
        { error: "Missing imageBase64 or customerId" },
        { status: 400, headers: corsHeaders }
      );
    }

    // 🔹 CLOUDINARY UPLOAD
    const timestamp = Math.floor(Date.now() / 1000);

    const paramsToSign = {
      folder: "ycs-drape-photos",
      public_id: `customer-${customerId}`,
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

    // 🔹 AIRTABLE SAVE (UPSERT)
    const airtableBase = process.env.AIRTABLE_BASE_ID;
    const airtableTable = "CustomerPhotos";
    const airtableToken = process.env.AIRTABLE_TOKEN;

    // Check if record exists
    const findRes = await fetch(
      `https://api.airtable.com/v0/${airtableBase}/${airtableTable}?filterByFormula={CustomerId}="${customerId}"`,
      {
        headers: {
          Authorization: `Bearer ${airtableToken}`
        }
      }
    );

    const findData = await findRes.json();
    const existing = findData.records?.[0];

    const payload = {
      fields: {
        CustomerId: customerId,
        PhotoUrl: imageUrl,
        PhotoKey: uploadData.public_id,
        UpdatedAt: new Date().toISOString()
      }
    };

    if (existing) {
      // UPDATE
      await fetch(
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
    } else {
      // CREATE
      await fetch(
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
    }

    return Response.json(
      { success: true, imageUrl },
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