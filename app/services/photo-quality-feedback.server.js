import crypto from "node:crypto";

const EVALUATIONS_TABLE = "PhotoQualityEvaluations";
const REVIEWS_TABLE = "PhotoQualityReviews";

export const PHOTO_QUALITY_FEEDBACK_VALUES = [
  "correct",
  "too_strict",
  "too_lenient",
  "missed_issue",
  "wrong_issue",
  "unsure"
];

export const PHOTO_QUALITY_HUMAN_STATUSES = ["pass", "warning", "reject"];

export const PHOTO_QUALITY_ISSUE_TAGS = [
  "good_photo",
  "too_dark",
  "too_bright",
  "warm_color_cast",
  "cool_color_cast",
  "green_color_cast",
  "heavy_shadow",
  "uneven_lighting",
  "face_too_small",
  "face_not_centered",
  "face_rotated",
  "glasses_glare",
  "heavy_makeup",
  "filter_detected",
  "saturated_background",
  "colored_light_reflection",
  "hair_obstruction",
  "other"
];

function parseJson(value, fallback) {
  try {
    return value ? JSON.parse(value) : fallback;
  } catch (_error) {
    return fallback;
  }
}

function stringifyJson(value, fallback) {
  return JSON.stringify(value ?? fallback);
}

function cleanString(value) {
  const stringValue = String(value || "").trim();
  return stringValue || null;
}

function cleanNotes(value) {
  return String(value || "").trim().slice(0, 1000);
}

function normalizeIssueTags(value) {
  const values = Array.isArray(value) ? value : [value];
  const allowed = new Set(PHOTO_QUALITY_ISSUE_TAGS);

  return Array.from(
    new Set(
      values
        .flatMap((item) => String(item || "").split(","))
        .map((item) => item.trim())
        .filter((item) => allowed.has(item))
    )
  );
}

function normalizeFeedback(value) {
  const feedback = String(value || "").trim();
  return PHOTO_QUALITY_FEEDBACK_VALUES.includes(feedback) ? feedback : null;
}

function normalizeHumanStatus(value) {
  const status = String(value || "").trim();
  return PHOTO_QUALITY_HUMAN_STATUSES.includes(status) ? status : null;
}

function makeEvaluationId() {
  return `pqe_${Date.now()}_${crypto.randomBytes(4).toString("hex")}`;
}

function makeReviewId() {
  return `pqr_${Date.now()}_${crypto.randomBytes(4).toString("hex")}`;
}

function getAirtableConfig() {
  const baseId = process.env.AIRTABLE_BASE_ID;
  const token = process.env.AIRTABLE_TOKEN;

  if (!baseId || !token) {
    throw new Error("Missing Airtable configuration");
  }

  return { baseId, token };
}

function airtableUrl(tableName, searchParams) {
  const { baseId } = getAirtableConfig();
  const tablePath = String(tableName)
    .split("/")
    .map((part) => encodeURIComponent(part))
    .join("/");
  const url = new URL(`https://api.airtable.com/v0/${baseId}/${tablePath}`);

  if (searchParams) {
    Object.entries(searchParams).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== "") {
        url.searchParams.set(key, value);
      }
    });
  }

  return url;
}

async function airtableFetchJson(tableName, options = {}) {
  const { token } = getAirtableConfig();
  const url = airtableUrl(tableName, options.searchParams);
  const response = await fetch(url, {
    method: options.method || "GET",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...(options.headers || {})
    },
    body: options.body ? JSON.stringify(options.body) : undefined
  });
  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    const message = data?.error?.message || data?.error?.type || JSON.stringify(data);
    throw new Error(`${response.status} ${message}`);
  }

  return data;
}

async function fetchAllRecords(tableName, searchParams = {}) {
  const records = [];
  let offset;

  do {
    const data = await airtableFetchJson(tableName, {
      searchParams: {
        pageSize: "100",
        ...searchParams,
        ...(offset ? { offset } : {})
      }
    });

    records.push(...(data.records || []));
    offset = data.offset;
  } while (offset);

  return records;
}

function cleanDate(value) {
  const date = value instanceof Date ? value : new Date(value || Date.now());
  return Number.isNaN(date.getTime()) ? new Date().toISOString() : date.toISOString();
}

function cleanNumber(value) {
  return Number.isFinite(Number(value)) ? Number(value) : null;
}

function cleanBoolean(value) {
  return typeof value === "boolean" ? value : null;
}

function normalizeColorCast(value) {
  const colorCast = cleanString(value) || "none";
  return ["none", "warm", "cool", "green"].includes(colorCast) ? colorCast : "none";
}

function compactFields(fields) {
  return Object.fromEntries(
    Object.entries(fields).filter(([, value]) => value !== undefined && value !== null)
  );
}

function parseListText(value) {
  const parsed = parseJson(value, null);
  if (Array.isArray(parsed)) return parsed;

  return String(value || "")
    .split("\n")
    .map((item) => item.trim())
    .filter(Boolean);
}

function parseEvaluationRecord(record, reviewRecord = null) {
  const fields = record.fields || {};
  const reviewFields = reviewRecord?.fields || null;
  const checks = parseJson(fields.RawChecks, {});
  const issues = parseListText(fields.DetectedIssues);
  const review = reviewFields
    ? {
        evaluation_id: reviewFields.EvaluationId,
        photo_id: reviewFields.PhotoId,
        ai_status: reviewFields.AiStatus,
        human_status: reviewFields.HumanStatus || null,
        admin_feedback: reviewFields.AdminFeedback,
        ai_issue_tags: parseListText(reviewFields.AiIssueTags),
        human_issue_tags: parseListText(reviewFields.HumanIssueTags),
        admin_notes: reviewFields.AdminNotes || "",
        reviewed_by: reviewFields.ReviewedBy,
        reviewed_at: reviewFields.ReviewedAt
      }
    : null;

  return {
    evaluation_id: fields.EvaluationId || record.id,
    photo_id: fields.PhotoId || null,
    customer_id: fields.CustomerId || null,
    order_reference: fields.OrderReference || null,
    uploaded_at: fields.CreatedAt || record.createdTime || new Date().toISOString(),
    image_url: fields.ImageUrl || null,
    secure_file_reference: fields.SecureFileReference || null,
    ai_status: fields.AiStatus,
    ai_score: cleanNumber(fields.AiScore),
    detected_issues: issues,
    ai_recommendations: parseListText(fields.Recommendations),
    raw_checks: checks,
    brightness_score: cleanNumber(fields.BrightnessScore),
    color_cast: fields.ColorCast || null,
    shadow_score: cleanNumber(fields.ShadowScore),
    face_detected: cleanBoolean(fields.FaceDetected),
    face_centered: cleanBoolean(fields.FaceCentered),
    face_size_percent: cleanNumber(fields.FaceSizePercent),
    glare_detected: cleanBoolean(fields.GlareDetected),
    background_score: cleanNumber(fields.BackgroundScore),
    ai_issue_tags: mapAiIssuesToTags({ issues, checks }),
    human_status: review?.human_status || null,
    admin_feedback: review?.admin_feedback || null,
    human_issue_tags: review?.human_issue_tags || [],
    admin_notes: review?.admin_notes || "",
    reviewed_by: review?.reviewed_by || null,
    reviewed_at: review?.reviewed_at || null,
    reviewed: Boolean(review),
    review
  };
}

async function findRecordByEvaluationId(tableName, evaluationId) {
  const safeEvaluationId = cleanString(evaluationId);
  if (!safeEvaluationId) return null;

  const data = await airtableFetchJson(tableName, {
    searchParams: {
      maxRecords: "1",
      filterByFormula: `{EvaluationId}="${safeEvaluationId.replace(/"/g, '\\"')}"`
    }
  });

  return data.records?.[0] || null;
}

export function mapAiIssuesToTags({ issues = [], checks = {} }) {
  const tags = new Set();
  const issueText = issues.join(" ").toLowerCase();

  if (issueText.includes("underexposed") || issueText.includes("brightness is a little low")) {
    tags.add("too_dark");
  }
  if (issueText.includes("overexposed")) tags.add("too_bright");
  if (checks.color_cast === "warm") tags.add("warm_color_cast");
  if (checks.color_cast === "cool") tags.add("cool_color_cast");
  if (checks.color_cast === "green") tags.add("green_color_cast");
  if (checks.shadow_score < 65) tags.add("heavy_shadow");
  if (checks.face_detected && checks.face_centered === false) tags.add("face_not_centered");
  if (checks.face_height_ratio && checks.face_height_ratio < 0.25) tags.add("face_too_small");
  if (checks.face_rotation_degrees && checks.face_rotation_degrees > 15) tags.add("face_rotated");
  if (checks.glasses_glare) tags.add("glasses_glare");
  if (checks.background_score < 70) tags.add("saturated_background");
  if (!tags.size && issues.length === 0) tags.add("good_photo");

  return Array.from(tags);
}

export async function savePhotoQualityEvaluation({
  photoId,
  customerId,
  orderReference,
  imageUrl,
  secureFileReference,
  result,
  uploadedAt = new Date()
}) {
  const checks = result.checks || {};
  const evaluationId = makeEvaluationId();
  const fields = compactFields({
    EvaluationId: evaluationId,
    PhotoId: cleanString(photoId),
    CustomerId: cleanString(customerId),
    OrderReference: cleanString(orderReference),
    ImageUrl: cleanString(imageUrl),
    SecureFileReference: cleanString(secureFileReference),
    AiStatus: result.status,
    AiScore: result.score,
    DetectedIssues: stringifyJson(result.issues, []),
    Recommendations: stringifyJson(result.recommendations, []),
    RawChecks: stringifyJson(checks, {}),
    BrightnessScore: Number.isInteger(checks.brightness) ? checks.brightness : null,
    ColorCast: normalizeColorCast(checks.color_cast),
    ShadowScore: Number.isInteger(checks.shadow_score) ? checks.shadow_score : null,
    FaceDetected: typeof checks.face_detected === "boolean" ? checks.face_detected : null,
    FaceCentered: typeof checks.face_centered === "boolean" ? checks.face_centered : null,
    FaceSizePercent:
      typeof checks.face_height_ratio === "number"
        ? Number((checks.face_height_ratio * 100).toFixed(1))
        : null,
    GlareDetected: typeof checks.glasses_glare === "boolean" ? checks.glasses_glare : null,
    BackgroundScore: Number.isInteger(checks.background_score) ? checks.background_score : null,
    CreatedAt: cleanDate(uploadedAt)
  });

  const data = await airtableFetchJson(EVALUATIONS_TABLE, {
    method: "POST",
    body: { fields }
  });

  return parseEvaluationRecord(data);
}

export function serializeEvaluation(record) {
  return parseEvaluationRecord(record);
}

export async function listPhotoQualityEvaluations(filters = {}) {
  const [evaluationRecords, reviewRecords] = await Promise.all([
    fetchAllRecords(EVALUATIONS_TABLE),
    fetchAllRecords(REVIEWS_TABLE)
  ]);

  const reviewsByEvaluationId = new Map(
    reviewRecords
      .filter((record) => record.fields?.EvaluationId)
      .map((record) => [record.fields.EvaluationId, record])
  );

  let serialized = evaluationRecords.map((record) => {
    const evaluationId = record.fields?.EvaluationId || record.id;
    return parseEvaluationRecord(record, reviewsByEvaluationId.get(evaluationId));
  });

  if (filters.reviewState === "reviewed") {
    serialized = serialized.filter((item) => item.reviewed);
  } else if (filters.reviewState === "unreviewed") {
    serialized = serialized.filter((item) => !item.reviewed);
  }

  if (filters.aiStatus) {
    serialized = serialized.filter((item) => item.ai_status === filters.aiStatus);
  }

  if (filters.humanStatus) {
    serialized = serialized.filter((item) => item.human_status === filters.humanStatus);
  }

  if (filters.customerOrOrder) {
    const needle = String(filters.customerOrOrder || "").trim().toLowerCase();
    serialized = serialized.filter((item) =>
      [item.customer_id, item.order_reference, item.photo_id, item.evaluation_id]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(needle))
    );
  }

  if (filters.dateFrom) {
    const from = new Date(`${filters.dateFrom}T00:00:00.000`);
    serialized = serialized.filter((item) => new Date(item.uploaded_at) >= from);
  }

  if (filters.dateTo) {
    const to = new Date(`${filters.dateTo}T23:59:59.999`);
    serialized = serialized.filter((item) => new Date(item.uploaded_at) <= to);
  }

  if (filters.issueTag) {
    serialized = serialized.filter((item) => {
      const allTags = new Set([...(item.ai_issue_tags || []), ...(item.human_issue_tags || [])]);
      return allTags.has(filters.issueTag);
    });
  }

  serialized.sort((a, b) => new Date(b.uploaded_at) - new Date(a.uploaded_at));

  return serialized.slice(0, 100);
}

export async function savePhotoQualityReview({
  evaluationId,
  humanStatus,
  adminFeedback,
  humanIssueTags,
  adminNotes,
  reviewedBy
}) {
  const evaluation = await findRecordByEvaluationId(EVALUATIONS_TABLE, evaluationId);

  if (!evaluation) {
    throw new Error("Photo quality evaluation not found");
  }

  const normalizedFeedback = normalizeFeedback(adminFeedback);
  if (!normalizedFeedback) {
    throw new Error("Invalid admin feedback value");
  }

  const normalizedHumanStatus = normalizeHumanStatus(humanStatus);
  const evaluationFields = evaluation.fields || {};
  const checks = parseJson(evaluationFields.RawChecks, {});
  const issues = parseListText(evaluationFields.DetectedIssues);
  const aiIssueTags = mapAiIssuesToTags({ issues, checks });
  const reviewFields = compactFields({
    EvaluationId: evaluationFields.EvaluationId || evaluationId,
    PhotoId: evaluationFields.PhotoId || null,
    AiStatus: evaluationFields.AiStatus,
    AdminFeedback: normalizedFeedback,
    AiIssueTags: stringifyJson(aiIssueTags, []),
    HumanIssueTags: stringifyJson(normalizeIssueTags(humanIssueTags), []),
    AdminNotes: cleanNotes(adminNotes),
    ReviewedBy: cleanString(reviewedBy) || "shopify_admin",
    ReviewedAt: new Date().toISOString()
  });
  const existingReview = await findRecordByEvaluationId(REVIEWS_TABLE, evaluationId);

  if (existingReview || normalizedHumanStatus) {
    reviewFields.HumanStatus = normalizedHumanStatus;
  }

  const review = existingReview
    ? await airtableFetchJson(`${REVIEWS_TABLE}/${existingReview.id}`, {
        method: "PATCH",
        body: { fields: reviewFields }
      })
    : await airtableFetchJson(REVIEWS_TABLE, {
        method: "POST",
        body: { fields: { ...reviewFields, CreatedAt: new Date().toISOString() } }
      });

  const fields = review.fields || {};

  return {
    evaluation_id: fields.EvaluationId,
    photo_id: fields.PhotoId,
    ai_status: fields.AiStatus,
    human_status: fields.HumanStatus || null,
    admin_feedback: fields.AdminFeedback,
    ai_issue_tags: parseListText(fields.AiIssueTags),
    human_issue_tags: parseListText(fields.HumanIssueTags),
    admin_notes: fields.AdminNotes || "",
    reviewed_by: fields.ReviewedBy,
    reviewed_at: fields.ReviewedAt
  };
}
