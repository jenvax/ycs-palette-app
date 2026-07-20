import assert from "node:assert/strict";
import test from "node:test";
import sharp from "sharp";
import { PHOTO_QUALITY_SCHEMA } from "../app/schemas/photo-quality.js";
import { evaluatePhotoQuality } from "../app/services/photo-quality.server.js";

async function createTestImage({
  background = "#eeeeee",
  face = "#d79a7c",
  faceX = 120,
  faceY = 40,
  faceWidth = 160,
  faceHeight = 230,
  width = 360,
  height = 420,
  extras = ""
} = {}) {
  const svg = `
    <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
      <rect width="100%" height="100%" fill="${background}"/>
      <ellipse cx="${faceX + faceWidth / 2}" cy="${faceY + faceHeight / 2}" rx="${faceWidth / 2}" ry="${faceHeight / 2}" fill="${face}"/>
      <ellipse cx="${faceX + faceWidth * 0.35}" cy="${faceY + faceHeight * 0.38}" rx="12" ry="8" fill="#ffffff"/>
      <ellipse cx="${faceX + faceWidth * 0.65}" cy="${faceY + faceHeight * 0.38}" rx="12" ry="8" fill="#ffffff"/>
      ${extras}
    </svg>
  `;

  const buffer = await sharp(Buffer.from(svg)).png().toBuffer();
  return `data:image/png;base64,${buffer.toString("base64")}`;
}

async function evaluateTestImage(options) {
  const imageBase64 = await createTestImage(options);
  return evaluatePhotoQuality({ imageBase64 });
}

test("photo quality schema describes the public JSON contract", () => {
  assert.equal(PHOTO_QUALITY_SCHEMA.type, "object");
  assert.ok(PHOTO_QUALITY_SCHEMA.required.includes("status"));
  assert.ok(PHOTO_QUALITY_SCHEMA.properties.checks.required.includes("face_detected"));
});

test("passes a centered, evenly lit face photo", async () => {
  const imageBase64 = await createTestImage();
  const result = await evaluatePhotoQuality({ imageBase64 });

  assert.equal(result.status, "pass");
  assert.ok(result.score >= 75);
  assert.equal(result.checks.face_detected, true);
  assert.equal(result.checks.face_centered, true);
  assert.ok(result.checks.brightness >= 70);
});

test("warns or rejects an underexposed photo", async () => {
  const imageBase64 = await createTestImage({
    background: "#242424",
    face: "#4f342a"
  });
  const result = await evaluatePhotoQuality({ imageBase64 });

  assert.ok(["warning", "reject"].includes(result.status));
  assert.ok(result.score < 75);
  assert.ok(result.issues.some((issue) => issue.toLowerCase().includes("underexposed")));
});

test("rejects an image with no clear face", async () => {
  const imageBase64 = await createTestImage({
    background: "#0044ff",
    face: "#0044ff",
    extras: '<rect x="0" y="0" width="360" height="420" fill="#0044ff"/>'
  });
  const result = await evaluatePhotoQuality({ imageBase64 });

  assert.equal(result.status, "reject");
  assert.equal(result.checks.face_detected, false);
  assert.ok(result.issues.some((issue) => issue.toLowerCase().includes("face")));
});

test("flags a highly saturated background", async () => {
  const result = await evaluateTestImage({
    background: "#ff00cc"
  });

  assert.ok(result.checks.background_score < 80);
  assert.ok(result.issues.some((issue) => issue.toLowerCase().includes("background")));
});

test("does not reject saturated background when face lighting is usable", async () => {
  const result = await evaluateTestImage({
    background: "#ff00cc",
    face: "#d79a7c"
  });

  assert.notEqual(result.status, "reject");
  assert.ok(result.issues.some((issue) => issue.toLowerCase().includes("background")));
});

test("treats mild uneven face lighting as a small warning note", async () => {
  const result = await evaluateTestImage({
    extras: '<rect x="120" y="40" width="80" height="230" fill="#3a261f" opacity="0.42"/>'
  });

  assert.equal(result.status, "pass");
  assert.ok(result.checks.shadow_score >= 54);
  assert.ok(result.issues.some((issue) => issue.toLowerCase().includes("mild uneven lighting")));
});

test("softens borderline darkness without treating it as unusable", async () => {
  const result = await evaluateTestImage({
    background: "#777777",
    face: "#9b6d58"
  });

  assert.notEqual(result.status, "reject");
  assert.ok(result.score >= 70);
});

test("downgrades strong warm artificial-looking face color", async () => {
  const result = await evaluateTestImage({
    face: "#d98e55"
  });

  assert.equal(result.status, "warning");
  assert.ok(result.checks.color_cast === "warm");
  assert.ok(result.issues.some((issue) => issue.toLowerCase().includes("warm cast")));
});

test("does not call bright natural light overexposed without face clipping", async () => {
  const imageBase64 = await createTestImage({
    background: "#ffffff",
    face: "#efc8b0"
  });
  const result = await evaluatePhotoQuality({ imageBase64 });

  assert.equal(result.status, "pass");
  assert.ok(!result.issues.some((issue) => issue.toLowerCase().includes("overexposed")));
});

test("downgrades severe uneven lighting on the face", async () => {
  const imageBase64 = await createTestImage({
    extras: '<rect x="120" y="40" width="80" height="230" fill="#20140f" opacity="0.72"/>'
  });
  const result = await evaluatePhotoQuality({ imageBase64 });

  assert.ok(["warning", "reject"].includes(result.status));
  assert.ok(result.checks.shadow_score < 50);
  assert.ok(result.issues.some((issue) => issue.toLowerCase().includes("shadows")));
});
