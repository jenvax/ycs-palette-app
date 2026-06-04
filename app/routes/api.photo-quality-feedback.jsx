import { authenticate } from "../shopify.server.js";
import { savePhotoQualityReview } from "../services/photo-quality-feedback.server.js";

export async function action({ request }) {
  try {
    const { session } = await authenticate.admin(request);
    const body = await request.json();

    const review = await savePhotoQualityReview({
      evaluationId: body.evaluation_id || body.evaluationId,
      humanStatus: body.human_status || body.humanStatus,
      adminFeedback: body.admin_feedback || body.adminFeedback,
      humanIssueTags: body.human_issue_tags || body.humanIssueTags || [],
      adminNotes: body.admin_notes || body.adminNotes || "",
      reviewedBy:
        session?.email ||
        session?.userId?.toString?.() ||
        session?.shop ||
        "shopify_admin"
    });

    return Response.json({ success: true, review });
  } catch (error) {
    console.error("Photo quality feedback failed:", error);

    return Response.json(
      {
        error: "Photo quality feedback failed",
        details: error.message
      },
      { status: 400 }
    );
  }
}
