import { authenticate } from "../shopify.server.js";
import { listPhotoQualityEvaluations } from "../services/photo-quality-feedback.server.js";

export async function loader({ request }) {
  try {
    await authenticate.admin(request);
    const url = new URL(request.url);
    const evaluations = await listPhotoQualityEvaluations({
      reviewState: url.searchParams.get("reviewState") || "",
      aiStatus: url.searchParams.get("aiStatus") || "",
      humanStatus: url.searchParams.get("humanStatus") || "",
      issueTag: url.searchParams.get("issueTag") || "",
      dateFrom: url.searchParams.get("dateFrom") || "",
      dateTo: url.searchParams.get("dateTo") || "",
      customerOrOrder: url.searchParams.get("customerOrOrder") || ""
    });

    return Response.json({ evaluations });
  } catch (error) {
    console.error("Photo quality evaluations lookup failed:", error);

    return Response.json(
      {
        error: "Photo quality evaluations lookup failed",
        details: error.message
      },
      { status: 400 }
    );
  }
}
