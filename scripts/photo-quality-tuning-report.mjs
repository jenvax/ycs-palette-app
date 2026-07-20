const EVALUATIONS_TABLE = "PhotoQualityEvaluations";
const REVIEWS_TABLE = "PhotoQualityReviews";

const STATUS_WEIGHT = {
  pass: 0,
  warning: 1,
  reject: 2
};

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
  const tablePath = tableName
    .split("/")
    .map((part) => encodeURIComponent(part))
    .join("/");
  const url = new URL(`https://api.airtable.com/v0/${baseId}/${tablePath}`);

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

function cleanStatus(value) {
  const status = String(value || "").trim().toLowerCase();
  return Object.prototype.hasOwnProperty.call(STATUS_WEIGHT, status) ? status : null;
}

function cleanText(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function markdownEscape(value) {
  return cleanText(value).replace(/\|/g, "\\|");
}

function truncate(value, max = 140) {
  const text = cleanText(value);
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

function makeIssueTags({ issues, checks }) {
  const tags = new Set();
  const issueText = issues.join(" ").toLowerCase();

  if (issueText.includes("underexposed") || issueText.includes("brightness is a little low")) {
    tags.add("too_dark");
  }
  if (issueText.includes("overexposed")) tags.add("too_bright");
  if (checks.color_cast === "warm") tags.add("warm_color_cast");
  if (checks.color_cast === "cool") tags.add("cool_color_cast");
  if (checks.color_cast === "green") tags.add("green_color_cast");
  if (Number(checks.shadow_score) < 65) tags.add("heavy_shadow");
  if (checks.face_detected && checks.face_centered === false) tags.add("face_not_centered");
  if (Number(checks.face_height_ratio) > 0 && Number(checks.face_height_ratio) < 0.25) {
    tags.add("face_too_small");
  }
  if (Number(checks.face_rotation_degrees) > 15) tags.add("face_rotated");
  if (checks.glasses_glare) tags.add("glasses_glare");
  if (Number(checks.background_score) < 70) tags.add("saturated_background");
  if (!tags.size && issues.length === 0) tags.add("good_photo");

  return Array.from(tags);
}

function compareStatuses(aiStatus, humanStatus) {
  if (!humanStatus) return "unreviewed";
  if (aiStatus === humanStatus) return "matched";
  if (STATUS_WEIGHT[aiStatus] > STATUS_WEIGHT[humanStatus]) return "too strict";
  return "too lenient";
}

function countBy(items, getKey) {
  const counts = new Map();
  items.forEach((item) => {
    const keys = getKey(item);
    const values = Array.isArray(keys) ? keys : [keys];
    values.filter(Boolean).forEach((key) => {
      counts.set(key, (counts.get(key) || 0) + 1);
    });
  });

  return [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
}

function formatCounts(counts) {
  if (!counts.length) return "None yet.";
  return counts.map(([key, count]) => `- ${key}: ${count}`).join("\n");
}

function statusLabel(row) {
  return `${row.ai_status || "n/a"} ${row.ai_score == null ? "" : `(${row.ai_score})`}`.trim();
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
      const issues = parseList(fields.DetectedIssues);
      const checks = parseJson(fields.RawChecks, {});
      const aiStatus = cleanStatus(fields.AiStatus);
      const humanStatus = cleanStatus(reviewFields.HumanStatus);
      const aiIssueTags = parseList(reviewFields.AiIssueTags);
      const inferredAiIssueTags = aiIssueTags.length ? aiIssueTags : makeIssueTags({ issues, checks });
      const humanIssueTags = parseList(reviewFields.HumanIssueTags);

      return {
        evaluation_id: evaluationId,
        photo_id: fields.PhotoId || "",
        customer_id: fields.CustomerId || "",
        uploaded_at: fields.CreatedAt || record.createdTime || "",
        ai_status: aiStatus,
        ai_score: Number.isFinite(Number(fields.AiScore)) ? Number(fields.AiScore) : null,
        detected_issues: issues,
        ai_issue_tags: inferredAiIssueTags,
        checks,
        human_status: humanStatus,
        admin_feedback: reviewFields.AdminFeedback || "",
        human_issue_tags: humanIssueTags,
        admin_notes: reviewFields.AdminNotes || "",
        reviewed_at: reviewFields.ReviewedAt || "",
        comparison: compareStatuses(aiStatus, humanStatus)
      };
    })
    .filter((row) => row.human_status || row.admin_feedback || row.admin_notes)
    .sort((a, b) => new Date(a.uploaded_at) - new Date(b.uploaded_at));
}

function buildRecommendations({ rows, tooStrict, tooLenient }) {
  const recommendations = [];
  const strictIssueCounts = countBy(tooStrict, (row) => row.ai_issue_tags);
  const lenientHumanIssueCounts = countBy(tooLenient, (row) => row.human_issue_tags);
  const strictTop = new Set(strictIssueCounts.slice(0, 4).map(([key]) => key));
  const lenientTop = new Set(lenientHumanIssueCounts.slice(0, 4).map(([key]) => key));
  const warningPasses = rows.filter((row) => row.ai_status === "warning" && row.human_status === "pass");
  const rejectPassOrWarning = rows.filter(
    (row) => row.ai_status === "reject" && ["pass", "warning"].includes(row.human_status)
  );

  if (warningPasses.length) {
    recommendations.push(
      `Reduce warning sensitivity slightly: ${warningPasses.length} AI warning result(s) were manually rated pass. Start by softening the penalties attached to the most common false-warning tags below rather than changing the pass/warning threshold globally.`
    );
  }

  if (rejectPassOrWarning.length) {
    recommendations.push(
      `Reduce reject severity for borderline cases: ${rejectPassOrWarning.length} AI reject result(s) were manually rated pass/warning. Prefer capping single-issue penalties so one mild issue cannot force a reject by itself.`
    );
  }

  if (strictTop.has("warm_color_cast") || strictTop.has("cool_color_cast") || strictTop.has("green_color_cast")) {
    recommendations.push(
      "Color cast appears in false strict results. Raise the color-cast trigger margin or lower its penalty unless it appears together with poor face lighting."
    );
  }

  if (strictTop.has("saturated_background")) {
    recommendations.push(
      "Background saturation appears in false strict results. Lower background penalty when face lighting/brightness is acceptable, because background color alone should usually be a warning note, not a rejection driver."
    );
  }

  if (strictTop.has("too_dark") || strictTop.has("too_bright")) {
    recommendations.push(
      "Brightness penalties appear in false strict results. Widen the acceptable brightness band a little, then keep stronger penalties only for clearly clipped highlights or muddy shadows."
    );
  }

  if (strictTop.has("heavy_shadow")) {
    recommendations.push(
      "Shadow penalties appear in false strict results. Consider distinguishing mild unevenness from heavy face shadows; only the latter should push toward reject."
    );
  }

  if (lenientTop.size) {
    recommendations.push(
      `For missed issues, strengthen penalties or detection for: ${Array.from(lenientTop).join(", ")}. Apply these carefully only where your human issue tags confirm the problem.`
    );
  }

  if (!recommendations.length) {
    recommendations.push(
      "The reviewed sample is mostly aligned. Keep thresholds stable until more reviewed examples accumulate."
    );
  }

  return recommendations;
}

function buildReport(rows) {
  const reviewed = rows.filter((row) => row.human_status);
  const matched = reviewed.filter((row) => row.comparison === "matched");
  const tooStrict = reviewed.filter((row) => row.comparison === "too strict");
  const tooLenient = reviewed.filter((row) => row.comparison === "too lenient");
  const falseWarningsOrRejections = reviewed.filter(
    (row) => STATUS_WEIGHT[row.ai_status] > STATUS_WEIGHT[row.human_status]
  );
  const feedbackCounts = countBy(reviewed, (row) => row.admin_feedback || "not_set");
  const aiStatusCounts = countBy(reviewed, (row) => row.ai_status || "not_set");
  const humanStatusCounts = countBy(reviewed, (row) => row.human_status || "not_set");
  const strictIssueCounts = countBy(falseWarningsOrRejections, (row) => row.ai_issue_tags);
  const lenientHumanIssueCounts = countBy(tooLenient, (row) => row.human_issue_tags);
  const recommendations = buildRecommendations({ rows: reviewed, tooStrict, tooLenient });

  const lines = [];
  lines.push("# YCS Photo Quality Checker Tuning Report");
  lines.push("");
  lines.push(`Generated: ${new Date().toISOString()}`);
  lines.push(`Reviewed evaluations: ${reviewed.length}`);
  lines.push("");
  lines.push("## Summary");
  lines.push("");
  lines.push(`- Matches: ${matched.length}`);
  lines.push(`- Too strict: ${tooStrict.length}`);
  lines.push(`- Too lenient: ${tooLenient.length}`);
  lines.push(`- Unmatched/reviewed without human status: ${rows.length - reviewed.length}`);
  lines.push("");
  lines.push("### Checker Status Mix");
  lines.push(formatCounts(aiStatusCounts));
  lines.push("");
  lines.push("### Manual Rating Mix");
  lines.push(formatCounts(humanStatusCounts));
  lines.push("");
  lines.push("### Admin Feedback Mix");
  lines.push(formatCounts(feedbackCounts));
  lines.push("");
  lines.push("## Evaluation Comparison");
  lines.push("");
  lines.push("| # | Evaluation | Uploaded | Checker | Detected issues | Manual rating | Feedback | Notes | Result |");
  lines.push("|---:|---|---|---|---|---|---|---|---|");
  reviewed.forEach((row, index) => {
    lines.push(
      [
        index + 1,
        markdownEscape(row.evaluation_id),
        markdownEscape(row.uploaded_at ? new Date(row.uploaded_at).toLocaleDateString("en-US") : ""),
        markdownEscape(statusLabel(row)),
        markdownEscape(truncate(row.detected_issues.join("; ") || row.ai_issue_tags.join(", ") || "No issues")),
        markdownEscape(row.human_status || ""),
        markdownEscape(row.admin_feedback || ""),
        markdownEscape(truncate(row.admin_notes || "", 170)),
        markdownEscape(row.comparison)
      ].join(" | ")
    );
  });
  lines.push("");
  lines.push("## 1. Where The Checker Matched Your Judgment");
  lines.push("");
  if (matched.length) {
    lines.push(`The checker matched your manual status on ${matched.length} reviewed photo(s).`);
    lines.push("");
    lines.push(formatCounts(countBy(matched, (row) => row.ai_issue_tags)));
  } else {
    lines.push("No exact status matches in the reviewed set yet.");
  }
  lines.push("");
  lines.push("## 2. Where It Was Too Strict");
  lines.push("");
  if (tooStrict.length) {
    lines.push(`The checker was stricter than your manual rating on ${tooStrict.length} photo(s).`);
    lines.push("");
    lines.push(formatCounts(countBy(tooStrict, (row) => row.ai_issue_tags)));
  } else {
    lines.push("No too-strict reviewed cases found.");
  }
  lines.push("");
  lines.push("## 3. Where It Was Too Lenient");
  lines.push("");
  if (tooLenient.length) {
    lines.push(`The checker was more lenient than your manual rating on ${tooLenient.length} photo(s).`);
    lines.push("");
    lines.push(formatCounts(lenientHumanIssueCounts));
  } else {
    lines.push("No too-lenient reviewed cases found.");
  }
  lines.push("");
  lines.push("## 4. Checks Causing The Most False Warnings/Rejections");
  lines.push("");
  if (strictIssueCounts.length) {
    lines.push(formatCounts(strictIssueCounts));
  } else {
    lines.push("No false warnings/rejections found in the reviewed set.");
  }
  lines.push("");
  lines.push("## 5. Recommended Threshold/Penalty Changes");
  lines.push("");
  recommendations.forEach((recommendation) => {
    lines.push(`- ${recommendation}`);
  });
  lines.push("");
  lines.push("## Notes");
  lines.push("");
  lines.push("- This report does not change scoring logic.");
  lines.push("- `too strict` means the checker status was harsher than the manual rating.");
  lines.push("- `too lenient` means the checker status was softer than the manual rating.");
  lines.push("- Issue counts use saved AI issue tags when present, otherwise they are inferred from detected issues/raw checks.");
  lines.push("");

  return lines.join("\n");
}

const [evaluationRecords, reviewRecords] = await Promise.all([
  fetchAllRecords(EVALUATIONS_TABLE),
  fetchAllRecords(REVIEWS_TABLE)
]);
const rows = buildRows(evaluationRecords, reviewRecords);
const report = buildReport(rows);

console.log(report);
