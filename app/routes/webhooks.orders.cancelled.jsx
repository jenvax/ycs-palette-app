import { removeGuidedAccessForOrder } from "../services/guided-training-access.server.js";
import { verifyShopifyWebhookHmac } from "../services/shopify-webhook-auth.server.js";
import { recordPaletteCreditWebhookAudit } from "../services/trade-palette-credit-webhook-audit.server.js";

async function authenticateWebhook(request) {
  const rawBody = await request.text();
  const topic = request.headers.get("X-Shopify-Topic") || "";
  const shop = request.headers.get("X-Shopify-Shop-Domain") || "";
  const webhookId = request.headers.get("X-Shopify-Webhook-Id") || "";
  const hmacHeader = request.headers.get("X-Shopify-Hmac-SHA256") || "";
  const apiSecret = process.env.SHOPIFY_API_SECRET || process.env.SHOPIFY_API_TOKEN || "";

  if (!verifyShopifyWebhookHmac({ rawBody, hmacHeader, secret: apiSecret })) {
    const error = new Error("Webhook HMAC validation failed");
    error.status = 401;
    error.topic = topic;
    error.shop = shop;
    error.webhookId = webhookId;
    throw error;
  }

  let payload = {};
  try {
    payload = JSON.parse(rawBody);
  } catch (_error) {
    const error = new Error("Webhook payload was not valid JSON");
    error.status = 400;
    error.topic = topic;
    error.shop = shop;
    error.webhookId = webhookId;
    throw error;
  }

  return { payload, topic, shop, webhookId };
}

export const action = async ({ request }) => {
  let payload = null;
  let topic = request.headers.get("X-Shopify-Topic") || "";
  let shop = request.headers.get("X-Shopify-Shop-Domain") || "";
  const webhookId = request.headers.get("X-Shopify-Webhook-Id") || "";

  try {
    const authenticated = await authenticateWebhook(request);
    payload = authenticated.payload;
    topic = authenticated.topic || topic;
    shop = authenticated.shop || shop;
  } catch (error) {
    console.error(`Failed to authenticate ${topic} webhook for ${shop}:`, error);
    await recordWebhookAuditSafely({
      topic,
      shop,
      webhookId,
      payload,
      status: "auth_failed",
      error: error.message || "Webhook authentication failed"
    });
    return new Response("Webhook authentication failed", { status: 401 });
  }

  try {
    const result = await removeGuidedAccessForOrder(payload, "order_cancelled");
    await recordWebhookAuditSafely({
      topic,
      shop,
      webhookId,
      payload,
      status: result?.skipped ? "skipped" : "processed",
      result
    });
  } catch (error) {
    console.error(`Failed to remove GUIDED access from ${topic} webhook for ${shop}:`, error);
    await recordWebhookAuditSafely({
      topic,
      shop,
      webhookId,
      payload,
      status: "failed",
      error: error.message || "GUIDED access removal webhook failed"
    });
    return new Response("GUIDED access removal webhook failed", { status: 500 });
  }

  return new Response();
};

async function recordWebhookAuditSafely(fields) {
  try {
    await recordPaletteCreditWebhookAudit(fields);
  } catch (error) {
    console.error("Failed to write palette credit webhook audit:", error);
  }
}
