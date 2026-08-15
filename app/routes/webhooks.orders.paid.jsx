import { recordCreditsForPaidOrder } from "../services/palette-credit-orders.server.js";
import { recordPaletteCreditWebhookAudit } from "../services/trade-palette-credit-webhook-audit.server.js";
import { authenticate } from "../shopify.server";

export const action = async ({ request }) => {
  let payload = null;
  let topic = request.headers.get("X-Shopify-Topic") || "";
  let shop = request.headers.get("X-Shopify-Shop-Domain") || "";
  const webhookId = request.headers.get("X-Shopify-Webhook-Id") || "";

  try {
    const authenticated = await authenticate.webhook(request);
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
    const result = await recordCreditsForPaidOrder(payload);
    console.log(`Received ${topic} webhook for ${shop}`, result);
    await recordWebhookAuditSafely({
      topic,
      shop,
      webhookId,
      payload,
      status: result?.skipped ? "skipped" : "processed",
      result
    });
  } catch (error) {
    console.error(`Failed to record palette credits from ${topic} webhook for ${shop}:`, error);
    await recordWebhookAuditSafely({
      topic,
      shop,
      webhookId,
      payload,
      status: "failed",
      error: error.message || "Palette credit webhook failed"
    });
    return new Response("Palette credit webhook failed", { status: 500 });
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
