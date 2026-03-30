import crypto from "node:crypto";
import { authenticate } from "../shopify.server";

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

  if (request.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: corsHeaders
    });
  }

  if (request.method !== "POST") {
    return Response.json(
      { error: "Method not allowed" },
      {
        status: 405,
        headers: corsHeaders
      }
    );
  }

  try {
    const { imageBase64, customerId } = await request.json();

    if (!imageBase64 || !customerId) {
      return Response.json(
        { error: "Missing imageBase64 or customerId" },
        {
          status: 400,
          headers: corsHeaders
        }
      );
    }

    const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
    const apiKey = process.env.CLOUDINARY_API_KEY;
    const apiSecret = process.env.CLOUDINARY_API_SECRET;

    if (!cloudName || !apiKey || !apiSecret) {
      return Response.json(
        { error: "Missing Cloudinary configuration" },
        {
          status: 500,
          headers: corsHeaders
        }
      );
    }

    const timestamp = Math.floor(Date.now() / 1000);

    const cloudinaryParams = {
      folder: "ycs-drape-photos",
      overwrite: "true",
      public_id: `customer-${customerId}`,
      timestamp: String(timestamp)
    };

    const signature = signCloudinaryParams(cloudinaryParams, apiSecret);

    const formData = new FormData();
    formData.append("file", imageBase64);
    formData.append("api_key", apiKey);
    formData.append("timestamp", String(timestamp));
    formData.append("signature", signature);
    formData.append("folder", cloudinaryParams.folder);
    formData.append("public_id", cloudinaryParams.public_id);
    formData.append("overwrite", cloudinaryParams.overwrite);

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
        {
          error: "Cloudinary upload failed",
          details: uploadData
        },
        {
          status: 500,
          headers: corsHeaders
        }
      );
    }

    const imageUrl = uploadData.secure_url;

    const { admin } = await authenticate.admin(request);
    const customerGid = `gid://shopify/Customer/${customerId}`;

    const metafieldMutation = `
      mutation SetCustomerPhoto($metafields: [MetafieldsSetInput!]!) {
        metafieldsSet(metafields: $metafields) {
          metafields {
            id
            namespace
            key
            value
          }
          userErrors {
            field
            message
          }
        }
      }
    `;

    const metafieldResponse = await admin.graphql(metafieldMutation, {
      variables: {
        metafields: [
          {
            ownerId: customerGid,
            namespace: "ycs",
            key: "drape_photo_url",
            type: "single_line_text_field",
            value: imageUrl
          }
        ]
      }
    });

    const metafieldData = await metafieldResponse.json();
    const userErrors = metafieldData?.data?.metafieldsSet?.userErrors || [];

    if (userErrors.length > 0) {
      console.error("Shopify metafield save failed:", userErrors);

      return Response.json(
        {
          error: "Failed to save photo URL to Shopify metafield",
          details: userErrors
        },
        {
          status: 500,
          headers: corsHeaders
        }
      );
    }

    return Response.json(
      {
        success: true,
        imageUrl,
        publicId: uploadData.public_id
      },
      {
        status: 200,
        headers: corsHeaders
      }
    );
  } catch (error) {
    console.error("Save photo route failed:", error);

    return Response.json(
      {
        error: "Server error",
        details: error.message
      },
      {
        status: 500,
        headers: corsHeaders
      }
    );
  }
}