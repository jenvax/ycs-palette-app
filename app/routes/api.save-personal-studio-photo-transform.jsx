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
    const { photoId, photoTransform } = await request.json();

    const safePhotoId = cleanString(photoId);

    if (!safePhotoId || !photoTransform) {
      return Response.json(
        { error: "Missing photoId or photoTransform" },
        { status: 400, headers: corsHeaders }
      );
    }

    const airtableBase = process.env.AIRTABLE_BASE_ID;
    const airtableToken = process.env.AIRTABLE_TOKEN;
    const airtableTable = "PersonalStudioPhotos";

    if (!airtableBase || !airtableToken) {
      return Response.json(
        { error: "Missing Airtable configuration" },
        { status: 500, headers: corsHeaders }
      );
    }

    const findRes = await fetch(
      `https://api.airtable.com/v0/${airtableBase}/${airtableTable}?filterByFormula=${encodeURIComponent(`{PhotoId}="${safePhotoId}"`)}`,
      {
        headers: {
          Authorization: `Bearer ${airtableToken}`
        }
      }
    );

    const findData = await findRes.json();
    const existing = findData.records?.[0];

    if (!existing) {
      return Response.json(
        { error: "Photo record not found" },
        { status: 404, headers: corsHeaders }
      );
    }

    const payload = {
      fields: {
        PhotoTransform: JSON.stringify({
          x: Number.isFinite(Number(photoTransform.x)) ? Number(photoTransform.x) : 0,
          y: Number.isFinite(Number(photoTransform.y)) ? Number(photoTransform.y) : 0,
          scale: Number.isFinite(Number(photoTransform.scale)) ? Number(photoTransform.scale) : 1
        })
      }
    };

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
      return Response.json(
        { error: "Airtable update failed", details: patchData },
        { status: 500, headers: corsHeaders }
      );
    }

    return Response.json(
      { success: true },
      { status: 200, headers: corsHeaders }
    );
  } catch (error) {
    console.error("Save personal studio photo transform failed:", error);

    return Response.json(
      { error: error.message },
      { status: 500, headers: corsHeaders }
    );
  }
}