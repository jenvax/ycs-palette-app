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

function generateDrapedImageId() {
  const date = new Date();
  const stamp = date.toISOString().slice(0, 10).replace(/-/g, "");
  const random = Math.random().toString(36).slice(2, 8);
  return `di_${stamp}_${random}`;
}

function removeEmptyFields(fields) {
  Object.keys(fields).forEach((key) => {
    if (fields[key] === undefined || fields[key] === null || fields[key] === "") {
      delete fields[key];
    }
  });
  return fields;
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
      consultantId,
      paletteCode,
      panel,
      drapeColorName,
      drapeColorHex,
      lipColorName,
      lipColorHex,
      fileName,
      notes
    } = await request.json();

    const safeCustomerId = cleanString(customerId);
    const safeClientRecordId = cleanString(clientRecordId);
    const recordId = safeClientRecordId || safeCustomerId;

    if (!imageBase64 || !recordId) {
      return Response.json(
        { error: "Missing imageBase64 and record ID" },
        { status: 400, headers: corsHeaders }
      );
    }

    const requiredEnv = [
      "CLOUDINARY_API_SECRET",
      "CLOUDINARY_API_KEY",
      "CLOUDINARY_CLOUD_NAME",
      "AIRTABLE_BASE_ID",
      "AIRTABLE_TOKEN"
    ];
    const missingEnv = requiredEnv.filter((key) => !process.env[key]);

    if (missingEnv.length) {
      return Response.json(
        { error: "Missing server configuration", missing: missingEnv },
        { status: 500, headers: corsHeaders }
      );
    }

    const drapedImageId = generateDrapedImageId();
    const safePanel = cleanString(panel) || "drape";
    const safeFileName =
      slugify(fileName) ||
      [
        slugify(drapeColorName) || "color",
        "lip",
        slugify(lipColorName) || "none",
        drapedImageId
      ].join("-");

    const timestamp = Math.floor(Date.now() / 1000);
    const publicId = [
      safeClientRecordId ? "consultant-client" : "customer",
      slugify(recordId),
      safePanel,
      drapedImageId
    ]
      .filter(Boolean)
      .join("-");

    const paramsToSign = {
      folder: "ycs-saved-draped-images",
      public_id: publicId,
      overwrite: "false",
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
      console.error("Cloudinary draped image error:", uploadData);

      return Response.json(
        { error: "Cloudinary upload failed", details: uploadData },
        { status: 500, headers: corsHeaders }
      );
    }

    const fields = removeEmptyFields({
      DrapedImageId: drapedImageId,
      ClientRecordId: safeClientRecordId,
      CustomerId: safeClientRecordId ? null : safeCustomerId,
      ConsultantId: cleanString(consultantId),
      "Palette Code": cleanString(paletteCode)?.toUpperCase(),
      Panel: safePanel,
      "Drape Color Name": cleanString(drapeColorName),
      "Drape Color Hex": cleanString(drapeColorHex),
      "Lip Color Name": cleanString(lipColorName),
      "Lip Color Hex": cleanString(lipColorHex),
      "Image URL": uploadData.secure_url,
      "Cloudinary Public ID": uploadData.public_id,
      "File Name": safeFileName,
      "Created At": new Date().toISOString(),
      Notes: cleanString(notes)
    });

    const createResponse = await fetch(
      `https://api.airtable.com/v0/${process.env.AIRTABLE_BASE_ID}/SavedDrapedImages`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.AIRTABLE_TOKEN}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ fields })
      }
    );

    const createData = await createResponse.json();

    if (!createResponse.ok) {
      console.error("Airtable saved draped image error:", createData);

      return Response.json(
        { error: "Airtable create failed", details: createData },
        { status: 500, headers: corsHeaders }
      );
    }

    return Response.json(
      {
        success: true,
        image: {
          id: createData.id,
          drapedImageId,
          clientRecordId: safeClientRecordId,
          customerId: safeCustomerId,
          consultantId: fields.ConsultantId || null,
          paletteCode: fields["Palette Code"] || null,
          panel: fields.Panel || null,
          drapeColorName: fields["Drape Color Name"] || null,
          drapeColorHex: fields["Drape Color Hex"] || null,
          lipColorName: fields["Lip Color Name"] || null,
          lipColorHex: fields["Lip Color Hex"] || null,
          imageUrl: fields["Image URL"],
          fileName: fields["File Name"] || null,
          createdAt: fields["Created At"]
        }
      },
      { status: 200, headers: corsHeaders }
    );
  } catch (error) {
    console.error("Save draped image failed:", error);

    return Response.json(
      { error: error.message },
      { status: 500, headers: corsHeaders }
    );
  }
}
