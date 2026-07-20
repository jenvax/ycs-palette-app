import { evaluatePhotoQuality } from "../app/services/photo-quality.server.js";

const EVALUATIONS_TABLE = "PhotoQualityEvaluations";
const REVIEWS_TABLE = "PhotoQualityReviews";

function getAirtableConfig() {
  const baseId = process.env.AIRTABLE_BASE_ID;
  const token = process.env.AIRTABLE_TOKEN;

  if (!baseId || !token) {
    throw new Error("Set AIRTABLE_BASE_ID and AIRTABLE_TOKEN before running this report.");
  }

  return { baseId, token };
}

function airtableUrl(tableName, searchParams = {}) {
  const { baseId } = getAirtableConfig();
  const url = new URL(
    `https://api.airtable.com/v0/${baseId}/${encodeURIComponent(tableName)}`
  );

  Object.entries(searchParams).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") {
      url.searchParams.set(key, value);
    }
  });

  return url;
}

async function airtableFetchJson(tableName, searchParams = {}) {
  const { token } = getAirtableConfig();
  const response = await fetch(airtableUrl(tableName, searchParams), {
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json"
    }
  });
  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    const message = data?.error?.message || data?.error?.type || JSON.stringify(data);
    throw new Error(`${response.status} ${message}`);
  }

  return data;
}

async function fetchAllRecords(tableName) {
  const records = [];
  let offset;

  do {
    const data = await airtableFetchJson(tableName, {
      pageSize: "100",
      ...(offset ? { offset } : {})
    });
    records.push(...(data.records || []));
    offset = data.offset;
  } while (offset);

  return records;
}

function parseJson(value, fallback) {
  try {
    return value ? JSON.parse(value) : fallback;
  } catch (_error) {
    return fallback;
  }
}

function parseList(value) {
  const parsed = parseJson(value, null);
  if (Array.isArray(parsed)) return parsed;

  return String(value || "")
    .split(/\n|,/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function cleanText(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function markdownEscape(value) {
  return cleanText(value).replace(/\|/g, "\\|");
}

function truncate(value, max = 110) {
  const text = cleanText(value);
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

async function imageUrlToDataUrl(imageUrl) {
  const response = await fetch(imageUrl);
  if (!response.ok) {
    throw new Error(`Could not fetch image: ${response.status}`);
  }

  const contentType = response.headers.get("content-type") || "image/jpeg";
  const buffer = Buffer.from(await response.arrayBuffer());
  return `data:${contentType};base64,${buffer.toString("base64")}`;
}

function buildRows(evaluationRecords, reviewRecords) {
  const reviewsByEvaluationId = new Map(
    reviewRecords
      .filter((record) => record.fields?.EvaluationId)
      .map((record) => [record.fields.EvaluationId, record])
  );

  return evaluationRecords
    .map((record) => {
      const fields = record.fields || {};
      const evaluationId = fields.EvaluationId || record.id;
      const reviewFields = reviewsByEvaluationId.get(evaluationId)?.fields || {};

      return {
        evaluation_id: evaluationId,
        photo_id: fields.PhotoId || "",
        image_url: fields.ImageUrl || "",
        uploaded_at: fields.CreatedAt || record.createdTime || "",
        before_status: fields.AiStatus || "",
        before_score: fields.AiScore ?? "",
        before_issues: parseList(fields.DetectedIssues),
        human_status: reviewFields.HumanStatus || "",
        admin_feedback: reviewFields.AdminFeedback || "",
        admin_notes: reviewFields.AdminNotes || ""
      };
    })
    .filter((row) => row.image_url && (row.human_status || row.admin_feedback || row.admin_notes))
    .sort((a, b) => new Date(a.uploaded_at) - new Date(b.uploaded_at));
}

const [evaluationRecords, reviewRecords] = await Promise.all([
  fetchAllRecords(EVALUATIONS_TABLE),
  fetchAllRecords(REVIEWS_TABLE)
]);
const rows = buildRows(evaluationRecords, reviewRecords);

console.log("# Photo Quality Checker Before/After Report");
console.log("");
console.log(`Generated: ${new Date().toISOString()}`);
console.log(`Reviewed images compared: ${rows.length}`);
console.log("");
console.log("| # | Evaluation | Before | After | Manual | Before issues | After issues | Notes |");
console.log("|---:|---|---|---|---|---|---|---|");

for (const [index, row] of rows.entries()) {
  let after;

  try {
    const imageBase64 = await imageUrlToDataUrl(row.image_url);
    after = await evaluatePhotoQuality({ imageBase64 });
  } catch (error) {
    after = {
      status: "error",
      score: "",
      issues: [`Could not re-evaluate image: ${error.message}`]
    };
  }

  console.log(
    [
      index + 1,
      markdownEscape(row.evaluation_id),
      markdownEscape(`${row.before_status} (${row.before_score})`),
      markdownEscape(`${after.status} (${after.score})`),
      markdownEscape(row.human_status || row.admin_feedback || ""),
      markdownEscape(truncate(row.before_issues.join("; ") || "No issues")),
      markdownEscape(truncate((after.issues || []).join("; ") || "No issues")),
      markdownEscape(truncate(row.admin_notes, 120))
    ].join(" | ")
  );
}
