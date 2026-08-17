import crypto from "node:crypto";

const TOKEN_TTL_SECONDS = 10 * 60;

function cleanString(value) {
  return String(value || "").trim();
}

function base64UrlEncodeJson(value) {
  return Buffer.from(JSON.stringify(value), "utf8").toString("base64url");
}

function base64UrlDecodeJson(value) {
  return JSON.parse(Buffer.from(value, "base64url").toString("utf8"));
}

function tokenSecret() {
  const secret = cleanString(process.env.TRADE_PALETTE_ACCESS_TOKEN_SECRET) ||
    cleanString(process.env.SHOPIFY_API_SECRET);

  if (!secret) {
    throw new Error("Missing palette access token secret");
  }

  return secret;
}

function signPayload(payload) {
  return crypto
    .createHmac("sha256", tokenSecret())
    .update(payload)
    .digest("base64url");
}

export function createTradePaletteAccessToken({ consultantId }) {
  const safeConsultantId = cleanString(consultantId);
  if (!safeConsultantId) {
    throw new Error("Missing consultantId");
  }

  const now = Math.floor(Date.now() / 1000);
  const payload = base64UrlEncodeJson({
    consultantId: safeConsultantId,
    iat: now,
    exp: now + TOKEN_TTL_SECONDS,
    purpose: "trade_palette_access"
  });
  const signature = signPayload(payload);

  return `${payload}.${signature}`;
}

export function verifyTradePaletteAccessToken(token) {
  const safeToken = cleanString(token);
  const [payload, signature] = safeToken.split(".");

  if (!payload || !signature) {
    const error = new Error("Invalid palette access token");
    error.status = 401;
    throw error;
  }

  const expectedSignature = signPayload(payload);
  const provided = Buffer.from(signature, "utf8");
  const expected = Buffer.from(expectedSignature, "utf8");

  if (provided.length !== expected.length || !crypto.timingSafeEqual(provided, expected)) {
    const error = new Error("Invalid palette access token");
    error.status = 401;
    throw error;
  }

  const data = base64UrlDecodeJson(payload);
  const now = Math.floor(Date.now() / 1000);

  if (data.purpose !== "trade_palette_access" || !data.consultantId || !data.exp || data.exp < now) {
    const error = new Error("Expired palette access token");
    error.status = 401;
    throw error;
  }

  return {
    consultantId: cleanString(data.consultantId)
  };
}
