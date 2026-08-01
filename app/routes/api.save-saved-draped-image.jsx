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

function safeSlug(value, fallback) {
  return String(value || fallback || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "") || fallback;
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
      clientRecordId,
      consultantId,
      sourceTool,
      panel,
      paletteCode,
      drapeColorName,
      lipColorName,
      lipColorHex,
      label,
      exportOptions
    } = await request.json();

    const safeImageBase64 = cleanString(imageBase64);
    const safeClientRecordId = cleanString(clientRecordId);

    if (!safeImageBase64 || !safeClientRecordId) {
      return Response.json(
        { error: "Missing imageBase64 or clientRecordId" },
        { status: 400, headers: corsHeaders }
      );
    }

    const airtableBase = process.env.AIRTABLE_BASE_ID;
    const airtableToken = process.env.AIRTABLE_TOKEN;
    const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
    const apiKey = process.env.CLOUDINARY_API_KEY;
    const apiSecret = process.env.CLOUDINARY_API_SECRET;

    if (!airtableBase || !airtableToken || !cloudName || !apiKey || !apiSecret) {
      return Response.json(
        { error: "Missing server configuration" },
        { status: 500, headers: corsHeaders }
      );
    }

    const now = new Date();
    const timestamp = Math.floor(now.getTime() / 1000);
    const publicId = [
      "saved-draped",
      safeSlug(safeClientRecordId, "client"),
      safeSlug(sourceTool, "tool"),
      safeSlug(panel, "view"),
      safeSlug(drapeColorName, "color"),
      timestamp
    ].join("-");

    const paramsToSign = {
      folder: "ycs-saved-draped-images",
      public_id: publicId,
      overwrite: "false",
      timestamp: String(timestamp)
    };

    const signature = signCloudinaryParams(paramsToSign, apiSecret);
    const formData = new FormData();
    formData.append("file", safeImageBase64);
    formData.append("api_key", apiKey);
    formData.append("timestamp", String(timestamp));
    formData.append("signature", signature);
    formData.append("folder", paramsToSign.folder);
    formData.append("public_id", paramsToSign.public_id);
    formData.append("overwrite", "false");

    const uploadResponse = await fetch(
      `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`,
      {
        method: "POST",
        body: formData
      }
    );

    const uploadData = await uploadResponse.json();

    if (!uploadResponse.ok || !uploadData.secure_url) {
      console.error("Saved draped image Cloudinary upload failed:", uploadData);

      return Response.json(
        { error: "Cloudinary upload failed", details: uploadData },
        { status: 500, headers: corsHeaders }
      );
    }

    const fields = {
      ClientRecordId: safeClientRecordId,
      ConsultantId: cleanString(consultantId) || undefined,
      ImageUrl: uploadData.secure_url,
      CloudinaryPublicId: uploadData.public_id || publicId,
      SourceTool: cleanString(sourceTool) || "color-analysis-tool",
      Panel: cleanString(panel) || undefined,
      PaletteCode: cleanString(paletteCode) || undefined,
      DrapeColorName: cleanString(drapeColorName) || undefined,
      LipColorName: cleanString(lipColorName) || undefined,
      LipColorHex: cleanString(lipColorHex) || undefined,
      Label: cleanString(label) || undefined,
      ExportOptionsJson: exportOptions ? JSON.stringify(exportOptions) : undefined,
      SavedAt: now.toISOString()
    };

    Object.keys(fields).forEach((key) => {
      if (fields[key] === undefined) delete fields[key];
    });

    const createRes = await fetch(
      `https://api.airtable.com/v0/${airtableBase}/${encodeURIComponent("SavedDrapedImages")}`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${airtableToken}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ records: [{ fields }] })
      }
    );

    const createData = await createRes.json();

    if (!createRes.ok) {
      console.error("Saved draped image Airtable create failed:", createData);

      return Response.json(
        { error: "Airtable create failed", details: createData },
        { status: 500, headers: corsHeaders }
      );
    }

    const record = createData.records?.[0] || null;

    return Response.json(
      {
        success: true,
        image: {
          id: record?.id || null,
          clientRecordId: safeClientRecordId,
          imageUrl: uploadData.secure_url,
          sourceTool: fields.SourceTool,
          panel: fields.Panel || "",
          paletteCode: fields.PaletteCode || "",
          drapeColorName: fields.DrapeColorName || "",
          lipColorName: fields.LipColorName || "",
          lipColorHex: fields.LipColorHex || "",
          label: fields.Label || "",
          savedAt: fields.SavedAt
        }
      },
      { status: 200, headers: corsHeaders }
    );
  } catch (error) {
    console.error("Save saved draped image failed:", error);

    return Response.json(
      { error: error.message || "Unknown error" },
      { status: 500, headers: corsHeaders }
    );
  }
}
