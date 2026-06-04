import { PHOTO_QUALITY_SCHEMA } from "../schemas/photo-quality.js";
import { evaluatePhotoQuality } from "../services/photo-quality.server.js";
import { savePhotoQualityEvaluation } from "../services/photo-quality-feedback.server.js";
import { authenticate } from "../shopify.server.js";

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
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Vary": "Origin"
  };
}

function getReviewedBy(session) {
  return (
    session?.email ||
    session?.userId?.toString?.() ||
    session?.shop ||
    "shopify_admin"
  );
}

function logAdminPhotoQualityCheck({ body, result, evaluation }) {
  console.info(
    "YCS_ADMIN photo quality check",
    JSON.stringify({
      evaluationId: evaluation?.evaluation_id || null,
      customerId: body?.customerId || null,
      photoId: body?.photoId || null,
      status: result.status,
      score: result.score,
      issues: result.issues,
      checkedAt: new Date().toISOString()
    })
  );
}

export async function loader({ request }) {
  const origin = request.headers.get("Origin") || "";
  const corsHeaders = getCorsHeaders(origin);
  const url = new URL(request.url);

  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  if (url.searchParams.get("schema") === "true") {
    return Response.json(PHOTO_QUALITY_SCHEMA, { status: 200, headers: corsHeaders });
  }

  return Response.json(
    { error: "Use POST to evaluate photo quality." },
    { status: 405, headers: corsHeaders }
  );
}

export async function action({ request }) {
  const origin = request.headers.get("Origin") || "";
  const corsHeaders = getCorsHeaders(origin);

  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  try {
    const { session } = await authenticate.admin(request);
    const body = await request.json();

    if (!body?.imageBase64) {
      return Response.json(
        { error: "Missing imageBase64" },
        { status: 400, headers: corsHeaders }
      );
    }

    const result = await evaluatePhotoQuality({ imageBase64: body.imageBase64 });
    const evaluation = await savePhotoQualityEvaluation({
      photoId: body.photoId,
      customerId: body.customerId,
      orderReference: body.orderReference || body.orderId,
      imageUrl: body.imageUrl,
      secureFileReference: body.secureFileReference,
      result
    });

    logAdminPhotoQualityCheck({
      body: { ...body, imageBase64: undefined },
      result,
      evaluation,
      reviewedBy: getReviewedBy(session)
    });

    return Response.json(
      {
        ...result,
        evaluation_id: evaluation.evaluation_id
      },
      { status: 200, headers: corsHeaders }
    );
  } catch (error) {
    console.error("Photo quality check failed:", error);

    return Response.json(
      {
        error: "Photo quality check failed",
        details: error.message
      },
      { status: 500, headers: corsHeaders }
    );
  }
}
