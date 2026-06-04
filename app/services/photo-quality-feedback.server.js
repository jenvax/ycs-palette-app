import crypto from "node:crypto";
import db from "../db.server.js";

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
  const evaluation = await db.photoQualityEvaluation.create({
    data: {
      id: makeEvaluationId(),
      photoId: cleanString(photoId),
      customerId: cleanString(customerId),
      orderReference: cleanString(orderReference),
      imageUrl: cleanString(imageUrl),
      secureFileReference: cleanString(secureFileReference),
      uploadedAt,
      aiStatus: result.status,
      aiScore: result.score,
      detectedIssuesJson: stringifyJson(result.issues, []),
      recommendationsJson: stringifyJson(result.recommendations, []),
      rawChecksJson: stringifyJson(checks, {}),
      brightnessScore: Number.isInteger(checks.brightness) ? checks.brightness : null,
      colorCast: cleanString(checks.color_cast),
      shadowScore: Number.isInteger(checks.shadow_score) ? checks.shadow_score : null,
      faceDetected: typeof checks.face_detected === "boolean" ? checks.face_detected : null,
      faceCentered: typeof checks.face_centered === "boolean" ? checks.face_centered : null,
      faceSizePercent:
        typeof checks.face_height_ratio === "number"
          ? Number((checks.face_height_ratio * 100).toFixed(1))
          : null,
      glareDetected: typeof checks.glasses_glare === "boolean" ? checks.glasses_glare : null,
      backgroundScore: Number.isInteger(checks.background_score) ? checks.background_score : null
    },
    include: { review: true }
  });

  return serializeEvaluation(evaluation);
}

export function serializeEvaluation(record) {
  const review = record.review
    ? {
        evaluation_id: record.review.evaluationId,
        photo_id: record.review.photoId,
        ai_status: record.review.aiStatus,
        human_status: record.review.humanStatus,
        admin_feedback: record.review.adminFeedback,
        ai_issue_tags: parseJson(record.review.aiIssueTagsJson, []),
        human_issue_tags: parseJson(record.review.humanIssueTagsJson, []),
        admin_notes: record.review.adminNotes || "",
        reviewed_by: record.review.reviewedBy,
        reviewed_at: record.review.reviewedAt.toISOString()
      }
    : null;

  const checks = parseJson(record.rawChecksJson, {});
  const issues = parseJson(record.detectedIssuesJson, []);

  return {
    evaluation_id: record.id,
    photo_id: record.photoId,
    customer_id: record.customerId,
    order_reference: record.orderReference,
    uploaded_at: record.uploadedAt.toISOString(),
    image_url: record.imageUrl,
    secure_file_reference: record.secureFileReference,
    ai_status: record.aiStatus,
    ai_score: record.aiScore,
    detected_issues: issues,
    ai_recommendations: parseJson(record.recommendationsJson, []),
    raw_checks: checks,
    brightness_score: record.brightnessScore,
    color_cast: record.colorCast,
    shadow_score: record.shadowScore,
    face_detected: record.faceDetected,
    face_centered: record.faceCentered,
    face_size_percent: record.faceSizePercent,
    glare_detected: record.glareDetected,
    background_score: record.backgroundScore,
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

export async function listPhotoQualityEvaluations(filters = {}) {
  const where = {};

  if (filters.reviewState === "reviewed") {
    where.review = { isNot: null };
  } else if (filters.reviewState === "unreviewed") {
    where.review = null;
  }

  if (filters.aiStatus) where.aiStatus = filters.aiStatus;
  if (filters.customerOrOrder) {
    where.OR = [
      { customerId: { contains: filters.customerOrOrder } },
      { orderReference: { contains: filters.customerOrOrder } },
      { photoId: { contains: filters.customerOrOrder } }
    ];
  }

  if (filters.dateFrom || filters.dateTo) {
    where.uploadedAt = {};
    if (filters.dateFrom) where.uploadedAt.gte = new Date(filters.dateFrom);
    if (filters.dateTo) where.uploadedAt.lte = new Date(`${filters.dateTo}T23:59:59.999Z`);
  }

  if (filters.humanStatus) {
    where.review = {
      ...(where.review && typeof where.review === "object" ? where.review : {}),
      is: { humanStatus: filters.humanStatus }
    };
  }

  const records = await db.photoQualityEvaluation.findMany({
    where,
    include: { review: true },
    orderBy: { uploadedAt: "desc" },
    take: 100
  });

  let serialized = records.map(serializeEvaluation);

  if (filters.issueTag) {
    serialized = serialized.filter((item) => {
      const allTags = new Set([...(item.ai_issue_tags || []), ...(item.human_issue_tags || [])]);
      return allTags.has(filters.issueTag);
    });
  }

  return serialized;
}

export async function savePhotoQualityReview({
  evaluationId,
  humanStatus,
  adminFeedback,
  humanIssueTags,
  adminNotes,
  reviewedBy
}) {
  const evaluation = await db.photoQualityEvaluation.findUnique({
    where: { id: evaluationId },
    include: { review: true }
  });

  if (!evaluation) {
    throw new Error("Photo quality evaluation not found");
  }

  const normalizedFeedback = normalizeFeedback(adminFeedback);
  if (!normalizedFeedback) {
    throw new Error("Invalid admin feedback value");
  }

  const normalizedHumanStatus = normalizeHumanStatus(humanStatus);
  const checks = parseJson(evaluation.rawChecksJson, {});
  const issues = parseJson(evaluation.detectedIssuesJson, []);
  const aiIssueTags = mapAiIssuesToTags({ issues, checks });

  const review = await db.photoQualityReview.upsert({
    where: { evaluationId },
    create: {
      id: makeReviewId(),
      evaluationId,
      photoId: evaluation.photoId,
      aiStatus: evaluation.aiStatus,
      humanStatus: normalizedHumanStatus,
      adminFeedback: normalizedFeedback,
      aiIssueTagsJson: stringifyJson(aiIssueTags, []),
      humanIssueTagsJson: stringifyJson(normalizeIssueTags(humanIssueTags), []),
      adminNotes: cleanNotes(adminNotes),
      reviewedBy: cleanString(reviewedBy) || "shopify_admin",
      reviewedAt: new Date()
    },
    update: {
      humanStatus: normalizedHumanStatus,
      adminFeedback: normalizedFeedback,
      aiIssueTagsJson: stringifyJson(aiIssueTags, []),
      humanIssueTagsJson: stringifyJson(normalizeIssueTags(humanIssueTags), []),
      adminNotes: cleanNotes(adminNotes),
      reviewedBy: cleanString(reviewedBy) || "shopify_admin",
      reviewedAt: new Date()
    }
  });

  return {
    evaluation_id: review.evaluationId,
    photo_id: review.photoId,
    ai_status: review.aiStatus,
    human_status: review.humanStatus,
    admin_feedback: review.adminFeedback,
    ai_issue_tags: parseJson(review.aiIssueTagsJson, []),
    human_issue_tags: parseJson(review.humanIssueTagsJson, []),
    admin_notes: review.adminNotes,
    reviewed_by: review.reviewedBy,
    reviewed_at: review.reviewedAt.toISOString()
  };
}
