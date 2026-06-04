import assert from "node:assert/strict";
import test from "node:test";
import {
  PHOTO_QUALITY_FEEDBACK_VALUES,
  PHOTO_QUALITY_HUMAN_STATUSES,
  PHOTO_QUALITY_ISSUE_TAGS,
  mapAiIssuesToTags
} from "../app/services/photo-quality-feedback.server.js";

test("feedback values include the required admin review choices", () => {
  assert.deepEqual(PHOTO_QUALITY_FEEDBACK_VALUES, [
    "correct",
    "too_strict",
    "too_lenient",
    "missed_issue",
    "wrong_issue",
    "unsure"
  ]);
});

test("human statuses preserve the AI status vocabulary", () => {
  assert.deepEqual(PHOTO_QUALITY_HUMAN_STATUSES, ["pass", "warning", "reject"]);
});

test("issue tags include required feedback labels", () => {
  [
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
  ].forEach((tag) => {
    assert.ok(PHOTO_QUALITY_ISSUE_TAGS.includes(tag));
  });
});

test("AI issues map to review issue tags", () => {
  const tags = mapAiIssuesToTags({
    issues: ["The photo appears underexposed."],
    checks: {
      color_cast: "warm",
      shadow_score: 50,
      face_centered: false,
      face_detected: true,
      face_height_ratio: 0.2,
      glasses_glare: true,
      background_score: 60
    }
  });

  assert.ok(tags.includes("too_dark"));
  assert.ok(tags.includes("warm_color_cast"));
  assert.ok(tags.includes("heavy_shadow"));
  assert.ok(tags.includes("face_not_centered"));
  assert.ok(tags.includes("face_too_small"));
  assert.ok(tags.includes("glasses_glare"));
  assert.ok(tags.includes("saturated_background"));
});
