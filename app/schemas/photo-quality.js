export const PHOTO_QUALITY_STATUS = {
  PASS: "pass",
  WARNING: "warning",
  REJECT: "reject"
};

export const PHOTO_QUALITY_SCHEMA = {
  type: "object",
  required: ["status", "score", "checks", "issues", "recommendations"],
  properties: {
    status: {
      type: "string",
      enum: ["pass", "warning", "reject"]
    },
    score: {
      type: "integer",
      minimum: 0,
      maximum: 100
    },
    checks: {
      type: "object",
      required: [
        "face_detected",
        "face_centered",
        "face_height_ratio",
        "face_rotation_degrees",
        "brightness",
        "color_cast",
        "shadow_score",
        "background_score",
        "glasses_glare"
      ],
      properties: {
        face_detected: { type: "boolean" },
        face_centered: { type: "boolean" },
        face_height_ratio: { type: "number" },
        face_rotation_degrees: { type: "number" },
        brightness: { type: "integer", minimum: 0, maximum: 100 },
        color_cast: {
          type: "string",
          enum: ["none", "warm", "cool", "green", "unknown"]
        },
        shadow_score: { type: "integer", minimum: 0, maximum: 100 },
        background_score: { type: "integer", minimum: 0, maximum: 100 },
        glasses_glare: { type: "boolean" }
      }
    },
    issues: {
      type: "array",
      items: { type: "string" }
    },
    recommendations: {
      type: "array",
      items: { type: "string" }
    }
  }
};

export function getPhotoQualityStatus(score) {
  if (score < 60) return PHOTO_QUALITY_STATUS.REJECT;
  if (score < 75) return PHOTO_QUALITY_STATUS.WARNING;
  return PHOTO_QUALITY_STATUS.PASS;
}
