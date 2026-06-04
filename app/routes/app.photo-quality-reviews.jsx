import { Form, redirect, useLoaderData, useNavigation } from "react-router";
import { authenticate } from "../shopify.server.js";
import {
  PHOTO_QUALITY_FEEDBACK_VALUES,
  PHOTO_QUALITY_HUMAN_STATUSES,
  PHOTO_QUALITY_ISSUE_TAGS,
  listPhotoQualityEvaluations,
  savePhotoQualityReview
} from "../services/photo-quality-feedback.server.js";

const FEEDBACK_LABELS = {
  correct: "AI was correct",
  too_strict: "AI was too strict",
  too_lenient: "AI was too lenient",
  missed_issue: "AI missed an issue",
  wrong_issue: "AI flagged the wrong issue",
  unsure: "Unsure / needs review"
};

const ISSUE_LABELS = {
  good_photo: "Good photo",
  too_dark: "Too dark",
  too_bright: "Too bright",
  warm_color_cast: "Warm color cast",
  cool_color_cast: "Cool color cast",
  green_color_cast: "Green color cast",
  heavy_shadow: "Heavy shadow",
  uneven_lighting: "Uneven lighting",
  face_too_small: "Face too small",
  face_not_centered: "Face not centered",
  face_rotated: "Face rotated",
  glasses_glare: "Glasses glare",
  heavy_makeup: "Heavy makeup",
  filter_detected: "Filter detected",
  saturated_background: "Saturated background",
  colored_light_reflection: "Colored light reflection",
  hair_obstruction: "Hair obstruction",
  other: "Other"
};

function cleanFilter(value) {
  return String(value || "").trim();
}

function getReviewedBy(session) {
  return (
    session?.email ||
    session?.userId?.toString?.() ||
    session?.shop ||
    "shopify_admin"
  );
}

export async function loader({ request }) {
  await authenticate.admin(request);
  const url = new URL(request.url);
  const filters = {
    reviewState: cleanFilter(url.searchParams.get("reviewState")),
    aiStatus: cleanFilter(url.searchParams.get("aiStatus")),
    humanStatus: cleanFilter(url.searchParams.get("humanStatus")),
    issueTag: cleanFilter(url.searchParams.get("issueTag")),
    dateFrom: cleanFilter(url.searchParams.get("dateFrom")),
    dateTo: cleanFilter(url.searchParams.get("dateTo")),
    customerOrOrder: cleanFilter(url.searchParams.get("customerOrOrder"))
  };
  const reviewError = cleanFilter(url.searchParams.get("reviewError"));

  let evaluations = [];
  let loadError = "";

  try {
    evaluations = await listPhotoQualityEvaluations(filters);
  } catch (error) {
    console.error("Photo quality review evaluations failed to load:", error);
    loadError = error.message || "Could not load photo quality evaluations.";
  }

  return {
    evaluations,
    filters,
    loadError,
    reviewError,
    feedbackValues: PHOTO_QUALITY_FEEDBACK_VALUES,
    humanStatuses: PHOTO_QUALITY_HUMAN_STATUSES,
    issueTags: PHOTO_QUALITY_ISSUE_TAGS,
    feedbackLabels: FEEDBACK_LABELS,
    issueLabels: ISSUE_LABELS
  };
}

export async function action({ request }) {
  const { session } = await authenticate.admin(request);
  const formData = await request.formData();
  const returnTo = String(formData.get("return_to") || "/app/photo-quality-reviews");

  try {
    await savePhotoQualityReview({
      evaluationId: formData.get("evaluation_id"),
      humanStatus: formData.get("human_status"),
      adminFeedback: formData.get("admin_feedback"),
      humanIssueTags: formData.getAll("human_issue_tags"),
      adminNotes: formData.get("admin_notes"),
      reviewedBy: getReviewedBy(session)
    });
  } catch (error) {
    console.error("Photo quality review save failed:", error);
    const url = new URL(returnTo, "https://app.local");
    url.searchParams.set(
      "reviewError",
      error.message || "Could not save photo quality review."
    );
    return redirect(url.pathname + url.search);
  }

  return redirect(returnTo);
}

function StatusPill({ status }) {
  return <span className={`pq-pill pq-pill--${status || "empty"}`}>{status || "unreviewed"}</span>;
}

function RawChecks({ evaluation }) {
  const rows = [
    ["Brightness", evaluation.brightness_score],
    ["Color cast", evaluation.color_cast || "none"],
    ["Shadow", evaluation.shadow_score],
    ["Face detected", evaluation.face_detected ? "Yes" : "No"],
    ["Face centered", evaluation.face_centered ? "Yes" : "No"],
    ["Face size", evaluation.face_size_percent != null ? `${evaluation.face_size_percent}%` : "—"],
    ["Glare", evaluation.glare_detected ? "Yes" : "No"],
    ["Background", evaluation.background_score]
  ];

  return (
    <dl className="pq-checks">
      {rows.map(([label, value]) => (
        <div key={label}>
          <dt>{label}</dt>
          <dd>{value ?? "—"}</dd>
        </div>
      ))}
    </dl>
  );
}

export default function PhotoQualityReviews() {
  const {
    evaluations,
    filters,
    loadError,
    reviewError,
    feedbackValues,
    humanStatuses,
    issueTags,
    feedbackLabels,
    issueLabels
  } = useLoaderData();
  const navigation = useNavigation();
  const isSubmitting = navigation.state === "submitting";
  const currentPath =
    typeof window === "undefined"
      ? "/app/photo-quality-reviews"
      : window.location.pathname + window.location.search;

  return (
    <s-page heading="Photo Quality Reviews">
      {loadError || reviewError ? (
        <s-section>
          {loadError ? (
            <s-paragraph>
              Could not load Airtable photo quality records: {loadError}
            </s-paragraph>
          ) : null}
          {reviewError ? (
            <s-paragraph>
              Could not save admin feedback: {reviewError}
            </s-paragraph>
          ) : null}
        </s-section>
      ) : null}

      <s-section>
        <Form method="get" className="pq-filters">
          <label>
            Review
            <select name="reviewState" defaultValue={filters.reviewState}>
              <option value="">All</option>
              <option value="unreviewed">Unreviewed</option>
              <option value="reviewed">Reviewed</option>
            </select>
          </label>

          <label>
            AI status
            <select name="aiStatus" defaultValue={filters.aiStatus}>
              <option value="">All</option>
              <option value="pass">Pass</option>
              <option value="warning">Warning</option>
              <option value="reject">Reject</option>
            </select>
          </label>

          <label>
            Human status
            <select name="humanStatus" defaultValue={filters.humanStatus}>
              <option value="">All</option>
              {humanStatuses.map((status) => (
                <option key={status} value={status}>{status}</option>
              ))}
            </select>
          </label>

          <label>
            Issue
            <select name="issueTag" defaultValue={filters.issueTag}>
              <option value="">All</option>
              {issueTags.map((tag) => (
                <option key={tag} value={tag}>{issueLabels[tag]}</option>
              ))}
            </select>
          </label>

          <label>
            From
            <input type="date" name="dateFrom" defaultValue={filters.dateFrom} />
          </label>

          <label>
            To
            <input type="date" name="dateTo" defaultValue={filters.dateTo} />
          </label>

          <label className="pq-search">
            Customer / order / photo
            <input type="search" name="customerOrOrder" defaultValue={filters.customerOrOrder} />
          </label>

          <button type="submit">Filter</button>
        </Form>
      </s-section>

      <div className="pq-list">
        {evaluations.length === 0 ? (
          <s-section>
            <s-paragraph>No photo quality evaluations match these filters.</s-paragraph>
          </s-section>
        ) : null}

        {evaluations.map((evaluation) => (
          <article className="pq-card" key={evaluation.evaluation_id}>
            <div className="pq-image">
              {evaluation.image_url ? (
                <img src={evaluation.image_url} alt="Uploaded evaluation" />
              ) : (
                <div className="pq-image-empty">No image reference saved</div>
              )}
            </div>

            <div className="pq-body">
              <div className="pq-head">
                <div>
                  <h2>{evaluation.photo_id || evaluation.evaluation_id}</h2>
                  <p>
                    {new Date(evaluation.uploaded_at).toLocaleString()} · Customer{" "}
                    {evaluation.customer_id || "—"} · Order {evaluation.order_reference || "—"}
                  </p>
                </div>
                <div className="pq-statuses">
                  <span>AI <StatusPill status={evaluation.ai_status} /></span>
                  <span>Human <StatusPill status={evaluation.human_status} /></span>
                </div>
              </div>

              <div className="pq-score">AI score: <strong>{evaluation.ai_score}</strong></div>

              <div className="pq-columns">
                <section>
                  <h3>Detected Issues</h3>
                  {evaluation.detected_issues.length ? (
                    <ul>
                      {evaluation.detected_issues.map((issue) => (
                        <li key={issue}>{issue}</li>
                      ))}
                    </ul>
                  ) : (
                    <p>No issues detected.</p>
                  )}

                  <h3>Recommendations</h3>
                  <ul>
                    {evaluation.ai_recommendations.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                </section>

                <section>
                  <h3>Raw Checks</h3>
                  <RawChecks evaluation={evaluation} />
                </section>
              </div>

              <Form method="post" className="pq-review-form">
                <input type="hidden" name="evaluation_id" value={evaluation.evaluation_id} />
                <input type="hidden" name="return_to" value={currentPath} />

                <label>
                  Admin feedback
                  <select
                    name="admin_feedback"
                    defaultValue={evaluation.admin_feedback || "unsure"}
                    required
                  >
                    {feedbackValues.map((feedback) => (
                      <option key={feedback} value={feedback}>{feedbackLabels[feedback]}</option>
                    ))}
                  </select>
                </label>

                <label>
                  Human final status
                  <select name="human_status" defaultValue={evaluation.human_status || ""}>
                    <option value="">No override</option>
                    {humanStatuses.map((status) => (
                      <option key={status} value={status}>{status}</option>
                    ))}
                  </select>
                </label>

                <fieldset>
                  <legend>Issue tags</legend>
                  <div className="pq-tags">
                    {issueTags.map((tag) => (
                      <label key={tag}>
                        <input
                          type="checkbox"
                          name="human_issue_tags"
                          value={tag}
                          defaultChecked={(evaluation.human_issue_tags || []).includes(tag)}
                        />
                        {issueLabels[tag]}
                      </label>
                    ))}
                  </div>
                </fieldset>

                <label className="pq-notes">
                  Admin notes
                  <textarea
                    name="admin_notes"
                    rows="3"
                    maxLength="1000"
                    defaultValue={evaluation.admin_notes || ""}
                    placeholder="Short explanation"
                  />
                </label>

                <button type="submit" disabled={isSubmitting}>
                  {evaluation.reviewed ? "Update Review" : "Save Review"}
                </button>
              </Form>
            </div>
          </article>
        ))}
      </div>

      <style>{`
        .pq-filters,
        .pq-review-form {
          display: grid;
          gap: 12px;
        }
        .pq-filters {
          grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
          align-items: end;
        }
        .pq-filters label,
        .pq-review-form label {
          display: grid;
          gap: 5px;
          font-size: 13px;
          font-weight: 650;
        }
        .pq-filters input,
        .pq-filters select,
        .pq-review-form input,
        .pq-review-form select,
        .pq-review-form textarea {
          border: 1px solid #d8d2ca;
          border-radius: 6px;
          font: inherit;
          padding: 9px 10px;
        }
        .pq-filters button,
        .pq-review-form button {
          align-self: end;
          background: #111;
          border: 0;
          border-radius: 6px;
          color: #fff;
          cursor: pointer;
          font-weight: 700;
          padding: 10px 16px;
        }
        .pq-list {
          display: grid;
          gap: 18px;
          margin-top: 18px;
        }
        .pq-card {
          background: #fff;
          border: 1px solid #e3ddd5;
          border-radius: 8px;
          display: grid;
          gap: 18px;
          grid-template-columns: 220px minmax(0, 1fr);
          padding: 16px;
        }
        .pq-image img,
        .pq-image-empty {
          aspect-ratio: 3 / 4;
          border: 1px solid #ece7df;
          border-radius: 6px;
          object-fit: cover;
          width: 100%;
        }
        .pq-image-empty {
          align-items: center;
          color: #746d64;
          display: flex;
          justify-content: center;
          padding: 14px;
          text-align: center;
        }
        .pq-head {
          display: flex;
          gap: 16px;
          justify-content: space-between;
        }
        .pq-head h2 {
          font-size: 18px;
          margin: 0 0 5px;
        }
        .pq-head p,
        .pq-score,
        .pq-card li,
        .pq-card p,
        .pq-checks {
          color: #5f574f;
          font-size: 13px;
        }
        .pq-statuses {
          display: flex;
          flex-wrap: wrap;
          gap: 10px;
        }
        .pq-pill {
          border: 1px solid #d8d2ca;
          border-radius: 999px;
          display: inline-block;
          font-size: 12px;
          font-weight: 700;
          padding: 4px 8px;
        }
        .pq-pill--pass { background: #e8f5ed; color: #23613a; }
        .pq-pill--warning { background: #fff7df; color: #755600; }
        .pq-pill--reject { background: #fde9e7; color: #8a231c; }
        .pq-pill--empty { background: #f7f4ef; color: #665f57; }
        .pq-columns {
          display: grid;
          gap: 18px;
          grid-template-columns: minmax(0, 1fr) minmax(220px, 0.75fr);
          margin: 14px 0;
        }
        .pq-columns h3 {
          font-size: 13px;
          margin: 0 0 8px;
          text-transform: uppercase;
        }
        .pq-checks {
          display: grid;
          gap: 7px;
          grid-template-columns: repeat(2, minmax(0, 1fr));
        }
        .pq-checks div {
          border-bottom: 1px solid #eee8df;
          display: flex;
          justify-content: space-between;
          gap: 10px;
          padding-bottom: 5px;
        }
        .pq-checks dt {
          font-weight: 700;
        }
        .pq-checks dd {
          margin: 0;
        }
        .pq-tags {
          display: grid;
          gap: 8px;
          grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
        }
        .pq-tags label {
          align-items: center;
          display: flex;
          flex-direction: row;
          font-weight: 500;
        }
        .pq-notes {
          grid-column: 1 / -1;
        }
        @media (max-width: 760px) {
          .pq-card,
          .pq-columns {
            grid-template-columns: 1fr;
          }
          .pq-head {
            display: grid;
          }
        }
      `}</style>
    </s-page>
  );
}
