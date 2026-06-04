import { savePhotoQualityReview } from "../services/photo-quality-feedback.server.js";

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

function isTruthy(value) {
  return value === true || String(value || "").trim().toLowerCase() === "true";
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

    // Photo Prep runs from the Shopify Liquid storefront, so this endpoint
    // follows the current Liquid-page admin flag pattern used by upload checks.
    if (!isTruthy(body.isAdmin)) {
      return Response.json(
        { error: "Admin access required" },
        { status: 403, headers: corsHeaders }
      );
    }

    const review = await savePhotoQualityReview({
      evaluationId: body.evaluation_id || body.evaluationId,
      humanStatus: body.human_status || body.humanStatus,
      adminFeedback: body.admin_feedback || body.adminFeedback,
      humanIssueTags: body.human_issue_tags || body.humanIssueTags || [],
      adminNotes: body.admin_notes || body.adminNotes || "",
      reviewedBy: body.reviewed_by || body.reviewedBy || "shopify_storefront_admin"
    });

    return Response.json({ success: true, review }, { headers: corsHeaders });
  } catch (error) {
    console.error("Photo quality feedback failed:", error);

    return Response.json(
      {
        error: "Photo quality feedback failed",
        details: error.message
      },
      { status: 400, headers: corsHeaders }
    );
  }
}
