import crypto from "node:crypto";

export function verifyShopifyWebhookHmac({ rawBody, hmacHeader, secret }) {
  const safeHmac = String(hmacHeader || "").trim();
  const safeSecret = String(secret || "").trim();

  if (!rawBody || !safeHmac || !safeSecret) return false;

  const calculated = crypto
    .createHmac("sha256", safeSecret)
    .update(rawBody, "utf8")
    .digest("base64");

  try {
    return crypto.timingSafeEqual(
      Buffer.from(safeHmac, "utf8"),
      Buffer.from(calculated, "utf8")
    );
  } catch (_error) {
    return false;
  }
}
