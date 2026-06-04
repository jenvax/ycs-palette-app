import sharp from "sharp";
import { getPhotoQualityStatus } from "../schemas/photo-quality.js";

const MAX_ANALYSIS_SIZE = 384;
const FACE_MIN_HEIGHT_RATIO = 0.25;
const FACE_CENTER_TOLERANCE = 0.2;
const FACE_ROTATION_LIMIT_DEGREES = 15;

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function roundScore(value) {
  return Math.round(clamp(value, 0, 100));
}

function normalizeDataUrl(imageBase64) {
  const value = String(imageBase64 || "").trim();
  if (!value) return "";

  return value.replace(/^data:image\/[a-zA-Z0-9.+-]+;base64,/, "");
}

function rgbToYcbcr(r, g, b) {
  return {
    y: 0.299 * r + 0.587 * g + 0.114 * b,
    cb: 128 - 0.168736 * r - 0.331264 * g + 0.5 * b,
    cr: 128 + 0.5 * r - 0.418688 * g - 0.081312 * b
  };
}

function rgbToHsl(r, g, b) {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const delta = max - min;
  const lightness = (max + min) / 2;

  if (delta === 0) {
    return { hue: 0, saturation: 0, lightness };
  }

  const saturation = delta / (1 - Math.abs(2 * lightness - 1));
  let hue;

  if (max === rn) hue = ((gn - bn) / delta) % 6;
  else if (max === gn) hue = (bn - rn) / delta + 2;
  else hue = (rn - gn) / delta + 4;

  hue *= 60;
  if (hue < 0) hue += 360;

  return { hue, saturation, lightness };
}

function isSkinLike(r, g, b) {
  const { y, cb, cr } = rgbToYcbcr(r, g, b);
  const { hue, saturation, lightness } = rgbToHsl(r, g, b);

  return (
    y > 45 &&
    y < 245 &&
    cb >= 70 &&
    cb <= 145 &&
    cr >= 120 &&
    cr <= 190 &&
    hue >= 0 &&
    hue <= 55 &&
    saturation >= 0.08 &&
    lightness >= 0.18 &&
    lightness <= 0.92 &&
    r >= b * 0.9
  );
}

function getPixel(raw, x, y) {
  const index = (y * raw.width + x) * raw.channels;
  return {
    r: raw.data[index],
    g: raw.data[index + 1],
    b: raw.data[index + 2]
  };
}

function luminance(pixel) {
  return 0.299 * pixel.r + 0.587 * pixel.g + 0.114 * pixel.b;
}

async function decodeImage(imageBase64) {
  const buffer = Buffer.from(normalizeDataUrl(imageBase64), "base64");
  if (!buffer.length) {
    throw new Error("Missing image data");
  }

  const image = sharp(buffer, { failOn: "none" }).rotate();
  const metadata = await image.metadata();

  const resized = await image
    .resize({
      width: MAX_ANALYSIS_SIZE,
      height: MAX_ANALYSIS_SIZE,
      fit: "inside",
      withoutEnlargement: true
    })
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  return {
    data: resized.data,
    width: resized.info.width,
    height: resized.info.height,
    channels: resized.info.channels,
    metadata
  };
}

function getSkinMask(raw) {
  const mask = new Uint8Array(raw.width * raw.height);

  for (let y = 0; y < raw.height; y += 1) {
    for (let x = 0; x < raw.width; x += 1) {
      const pixel = getPixel(raw, x, y);
      if (isSkinLike(pixel.r, pixel.g, pixel.b)) {
        mask[y * raw.width + x] = 1;
      }
    }
  }

  return mask;
}

function findLargestComponent(mask, width, height) {
  const visited = new Uint8Array(mask.length);
  const queue = [];
  let best = null;

  for (let start = 0; start < mask.length; start += 1) {
    if (!mask[start] || visited[start]) continue;

    let count = 0;
    let sumX = 0;
    let sumY = 0;
    let minX = width;
    let minY = height;
    let maxX = 0;
    let maxY = 0;
    const points = [];

    queue.length = 0;
    queue.push(start);
    visited[start] = 1;

    while (queue.length) {
      const index = queue.pop();
      const x = index % width;
      const y = Math.floor(index / width);

      count += 1;
      sumX += x;
      sumY += y;
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);

      if (points.length < 4000) points.push([x, y]);

      const neighbors = [
        index - 1,
        index + 1,
        index - width,
        index + width
      ];

      for (const next of neighbors) {
        if (next < 0 || next >= mask.length || visited[next] || !mask[next]) continue;
        const nextX = next % width;
        if (Math.abs(nextX - x) > 1) continue;
        visited[next] = 1;
        queue.push(next);
      }
    }

    if (!best || count > best.count) {
      best = { count, sumX, sumY, minX, minY, maxX, maxY, points };
    }
  }

  return best;
}

function estimateRotationDegrees(component) {
  if (!component || component.points.length < 10) return 0;

  const cx = component.sumX / component.count;
  const cy = component.sumY / component.count;
  let xx = 0;
  let xy = 0;
  let yy = 0;

  component.points.forEach(([x, y]) => {
    const dx = x - cx;
    const dy = y - cy;
    xx += dx * dx;
    xy += dx * dy;
    yy += dy * dy;
  });

  const angle = 0.5 * Math.atan2(2 * xy, xx - yy);
  const angleFromVertical = Math.abs((angle * 180) / Math.PI - 90);

  return Math.round(Math.min(angleFromVertical, Math.abs(180 - angleFromVertical)));
}

function analyzeFace(raw, skinMask) {
  const component = findLargestComponent(skinMask, raw.width, raw.height);
  const minFacePixels = Math.max(80, raw.width * raw.height * 0.008);
  const faceDetected = !!component && component.count >= minFacePixels;

  if (!faceDetected) {
    return {
      faceDetected: false,
      faceCentered: false,
      faceHeightRatio: 0,
      rotationDegrees: 0,
      bbox: null,
      component: null
    };
  }

  const bbox = {
    x: component.minX,
    y: component.minY,
    width: component.maxX - component.minX + 1,
    height: component.maxY - component.minY + 1
  };
  const centerX = component.sumX / component.count;
  const centerY = component.sumY / component.count;
  const faceCentered =
    Math.abs(centerX / raw.width - 0.5) <= FACE_CENTER_TOLERANCE &&
    Math.abs(centerY / raw.height - 0.45) <= 0.3;

  return {
    faceDetected: true,
    faceCentered,
    faceHeightRatio: bbox.height / raw.height,
    rotationDegrees: estimateRotationDegrees(component),
    bbox,
    component
  };
}

function collectRegionStats(raw, predicate) {
  let count = 0;
  let r = 0;
  let g = 0;
  let b = 0;
  let lum = 0;
  let dark = 0;
  let bright = 0;
  let saturated = 0;

  for (let y = 0; y < raw.height; y += 1) {
    for (let x = 0; x < raw.width; x += 1) {
      if (!predicate(x, y)) continue;

      const pixel = getPixel(raw, x, y);
      const l = luminance(pixel);
      const hsl = rgbToHsl(pixel.r, pixel.g, pixel.b);

      count += 1;
      r += pixel.r;
      g += pixel.g;
      b += pixel.b;
      lum += l;
      if (l < 45) dark += 1;
      if (l > 248) bright += 1;
      if (hsl.saturation > 0.55 && hsl.lightness > 0.25 && hsl.lightness < 0.85) saturated += 1;
    }
  }

  if (!count) {
    return {
      count: 0,
      r: 0,
      g: 0,
      b: 0,
      luminance: 0,
      darkRatio: 0,
      brightRatio: 0,
      saturatedRatio: 0
    };
  }

  return {
    count,
    r: r / count,
    g: g / count,
    b: b / count,
    luminance: lum / count,
    darkRatio: dark / count,
    brightRatio: bright / count,
    saturatedRatio: saturated / count
  };
}

function getFacePredicate(raw, face) {
  if (!face.bbox) {
    return (x, y) =>
      x >= raw.width * 0.25 &&
      x <= raw.width * 0.75 &&
      y >= raw.height * 0.12 &&
      y <= raw.height * 0.78;
  }

  const padX = face.bbox.width * 0.1;
  const padY = face.bbox.height * 0.1;
  return (x, y) =>
    x >= face.bbox.x - padX &&
    x <= face.bbox.x + face.bbox.width + padX &&
    y >= face.bbox.y - padY &&
    y <= face.bbox.y + face.bbox.height + padY;
}

function scoreBrightness(stats) {
  const target = 170;
  const distancePenalty = Math.abs(stats.luminance - target) * 0.28;
  const clippingPenalty =
    (stats.luminance < 105 ? stats.darkRatio * 55 : 0) +
    (stats.luminance > 190 ? stats.brightRatio * 55 : 0);

  return roundScore(100 - distancePenalty - clippingPenalty);
}

function analyzeShadow(raw, facePredicate) {
  const leftStats = collectRegionStats(raw, (x, y) => facePredicate(x, y) && x < raw.width / 2);
  const rightStats = collectRegionStats(raw, (x, y) => facePredicate(x, y) && x >= raw.width / 2);
  const faceStats = collectRegionStats(raw, facePredicate);
  const sideDifference = Math.abs(leftStats.luminance - rightStats.luminance);
  const score = 100 - sideDifference * 1.4 - faceStats.darkRatio * 130;

  return {
    score: roundScore(score),
    sideDifference
  };
}

function analyzeColorCast(stats) {
  const rg = stats.r - stats.g;
  const rb = stats.r - stats.b;
  const gb = stats.g - stats.b;

  if (stats.g - Math.max(stats.r, stats.b) > 22) return "green";
  if (stats.b - Math.max(stats.r, stats.g) > 22) return "cool";
  if (rb > 52 && gb > 30) return "warm";
  if (rg > 42 && rb > 42) return "warm";

  return "none";
}

function analyzeGlare(raw, face) {
  if (!face.bbox) return false;

  const eyeYMin = face.bbox.y + face.bbox.height * 0.22;
  const eyeYMax = face.bbox.y + face.bbox.height * 0.48;
  const eyeXMin = face.bbox.x + face.bbox.width * 0.12;
  const eyeXMax = face.bbox.x + face.bbox.width * 0.88;
  const stats = collectRegionStats(
    raw,
    (x, y) => x >= eyeXMin && x <= eyeXMax && y >= eyeYMin && y <= eyeYMax
  );

  return stats.brightRatio > 0.12 && stats.luminance > 170;
}

function analyzeBackground(raw, face) {
  const facePredicate = getFacePredicate(raw, face);
  const backgroundStats = collectRegionStats(raw, (x, y) => !facePredicate(x, y));
  const faceStats = collectRegionStats(raw, facePredicate);
  const saturationPenalty = backgroundStats.saturatedRatio * 120;
  const colorGap =
    Math.abs(backgroundStats.r - faceStats.r) +
    Math.abs(backgroundStats.g - faceStats.g) +
    Math.abs(backgroundStats.b - faceStats.b);
  const contaminationPenalty = Math.max(0, colorGap - 95) * 0.35;

  return {
    score: roundScore(100 - saturationPenalty - contaminationPenalty),
    saturatedRatio: backgroundStats.saturatedRatio
  };
}

function addIssue(issues, recommendations, issue, recommendation) {
  issues.push(issue);
  if (recommendation) recommendations.push(recommendation);
}

function buildScoreAndGuidance({ face, brightness, shadow, colorCast, glare, background }) {
  const issues = [];
  const recommendations = [];
  let score = 100;

  if (!face.faceDetected) {
    score -= 45;
    addIssue(
      issues,
      recommendations,
      "No clear face was detected.",
      "Use a front-facing photo with the face clearly visible."
    );
  } else {
    if (!face.faceCentered) {
      score -= 12;
      addIssue(
        issues,
        recommendations,
        "The face is not centered.",
        "Center the face in the frame before uploading."
      );
    }

    if (face.faceHeightRatio < FACE_MIN_HEIGHT_RATIO) {
      score -= 18;
      addIssue(
        issues,
        recommendations,
        "The face is too small in the photo.",
        "Use a closer photo where the face takes up at least one quarter of the image height."
      );
    }

    if (face.rotationDegrees > FACE_ROTATION_LIMIT_DEGREES) {
      score -= 15;
      addIssue(
        issues,
        recommendations,
        "The face appears tilted.",
        "Use a straight-on photo with the head upright."
      );
    }
  }

  if (brightness < 55) {
    score -= 18;
    addIssue(
      issues,
      recommendations,
      "The photo appears underexposed.",
      "Retake the photo in brighter, even natural light."
    );
  } else if (brightness < 70) {
    score -= 8;
    addIssue(
      issues,
      recommendations,
      "The brightness is a little low.",
      "Increase overall light without using harsh direct sunlight."
    );
  }

  if (brightness > 96) {
    score -= 16;
    addIssue(
      issues,
      recommendations,
      "The photo appears overexposed.",
      "Reduce harsh light and avoid blown-out highlights on the face."
    );
  }

  if (shadow.score < 65) {
    score -= 15;
    addIssue(
      issues,
      recommendations,
      "There are heavy or uneven shadows on the face.",
      "Face a window or soft light source so both sides of the face are evenly lit."
    );
  }

  if (colorCast !== "none") {
    score -= 10;
    const castCopy = {
      warm: "The photo has a strong yellow/warm cast.",
      cool: "The photo has a strong blue/cool cast.",
      green: "The photo has a strong green cast."
    };
    addIssue(
      issues,
      recommendations,
      castCopy[colorCast] || "The photo has a strong color cast.",
      "Use neutral daylight and avoid colored bulbs, colored walls, or tinted windows."
    );
  }

  if (glare) {
    score -= 12;
    addIssue(
      issues,
      recommendations,
      "Bright glare appears near the eye area.",
      "Remove glasses if possible or adjust lighting to avoid reflections over the eyes."
    );
  }

  if (background.score < 70) {
    score -= 10;
    addIssue(
      issues,
      recommendations,
      "The background may be too colorful or reflective.",
      "Use a plain neutral background to avoid color contamination."
    );
  }

  const finalScore = roundScore(score);

  if (!recommendations.length) {
    recommendations.push("This photo looks suitable for color analysis.");
  }

  return {
    status: getPhotoQualityStatus(finalScore),
    score: finalScore,
    issues,
    recommendations
  };
}

export async function evaluatePhotoQuality({ imageBase64 }) {
  const raw = await decodeImage(imageBase64);
  const skinMask = getSkinMask(raw);
  const face = analyzeFace(raw, skinMask);
  const facePredicate = getFacePredicate(raw, face);
  const faceStats = collectRegionStats(raw, facePredicate);
  const wholeImageStats = collectRegionStats(raw, () => true);
  const brightness = scoreBrightness(wholeImageStats);
  const shadow = analyzeShadow(raw, facePredicate);
  const colorCast = analyzeColorCast(face.faceDetected ? faceStats : wholeImageStats);
  const glare = analyzeGlare(raw, face);
  const background = analyzeBackground(raw, face);
  const summary = buildScoreAndGuidance({
    face,
    brightness,
    shadow,
    colorCast,
    glare,
    background
  });

  return {
    status: summary.status,
    score: summary.score,
    checks: {
      face_detected: face.faceDetected,
      face_centered: face.faceCentered,
      face_height_ratio: Number(face.faceHeightRatio.toFixed(3)),
      face_rotation_degrees: face.rotationDegrees,
      brightness,
      color_cast: colorCast || "unknown",
      shadow_score: shadow.score,
      background_score: background.score,
      glasses_glare: glare
    },
    issues: summary.issues,
    recommendations: summary.recommendations
  };
}
