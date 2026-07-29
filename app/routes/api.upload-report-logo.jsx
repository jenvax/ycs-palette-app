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

function slugify(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
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
      fileName,
      clientRecordId,
      consultantId
    } = await request.json();

    if (!imageBase64) {
      return Response.json(
        { error: "Missing imageBase64" },
        { status: 400, headers: corsHeaders }
      );
    }

    const requiredEnv = [
      "CLOUDINARY_API_SECRET",
      "CLOUDINARY_API_KEY",
      "CLOUDINARY_CLOUD_NAME"
    ];
    const missingEnv = requiredEnv.filter((key) => !process.env[key]);

    if (missingEnv.length) {
      return Response.json(
        { error: "Missing server configuration", missing: missingEnv },
        { status: 500, headers: corsHeaders }
      );
    }

    const timestamp = Math.floor(Date.now() / 1000);
    const publicId = [
      "report-logo",
      slugify(consultantId) || "consultant",
      slugify(clientRecordId) || "client",
      slugify(fileName) || String(timestamp)
    ].join("-");

    const paramsToSign = {
      folder: "ycs-report-logos",
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
    formData.append("overwrite", paramsToSign.overwrite);

    const uploadResponse = await fetch(
      `https://api.cloudinary.com/v1_1/${process.env.CLOUDINARY_CLOUD_NAME}/image/upload`,
      {
        method: "POST",
        body: formData
      }
    );

    const uploadData = await uploadResponse.json();

    if (!uploadResponse.ok || !uploadData.secure_url) {
      console.error("Cloudinary report logo error:", uploadData);

      return Response.json(
        { error: "Cloudinary upload failed", details: uploadData },
        { status: 500, headers: corsHeaders }
      );
    }

    return Response.json(
      {
        success: true,
        imageUrl: uploadData.secure_url,
        publicId: uploadData.public_id,
        originalFilename: cleanString(uploadData.original_filename)
      },
      { status: 200, headers: corsHeaders }
    );
  } catch (error) {
    console.error("Report logo upload failed:", error);

    return Response.json(
      { error: error.message || "Report logo upload failed" },
      { status: 500, headers: corsHeaders }
    );
  }
}
