import { listPaletteCreditWebhookAudits } from "../services/trade-palette-credit-webhook-audit.server.js";

function cleanString(value) {
  return String(value || "").trim();
}

function requireSecret(request) {
  const configuredSecret = process.env.TRADE_PALETTE_CREDITS_API_SECRET;
  if (!configuredSecret) {
    const error = new Error("Missing TRADE_PALETTE_CREDITS_API_SECRET");
    error.status = 500;
    throw error;
  }

  const headerSecret = cleanString(request.headers.get("X-YCS-Credit-Secret"));
  const bearerMatch = cleanString(request.headers.get("Authorization")).match(/^Bearer\s+(.+)$/i);
  const submittedSecret = headerSecret || cleanString(bearerMatch?.[1]);

  if (submittedSecret !== configuredSecret) {
    const error = new Error("Unauthorized");
    error.status = 401;
    throw error;
  }
}

export async function loader({ request }) {
  try {
    requireSecret(request);
    const url = new URL(request.url);
    const events = await listPaletteCreditWebhookAudits({
      limit: url.searchParams.get("limit")
    });

    return Response.json({
      success: true,
      events
    });
  } catch (error) {
    return Response.json(
      { error: error.message || "Webhook audit lookup failed" },
      { status: error.status || 500 }
    );
  }
}
