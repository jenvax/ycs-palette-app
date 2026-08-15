import {
  getTradePaletteCreditBalance,
  recordTradePaletteCreditEvent
} from "../services/trade-palette-credits.server.js";

function getCorsHeaders(origin) {
  const allowedOrigins = [
    "https://yourcolorstyle.com",
    "https://www.yourcolorstyle.com"
  ];

  const allowOrigin = allowedOrigins.includes(origin)
    ? origin
    : "https://yourcolorstyle.com";

  return {
    "Access-Control-Allow-Origin": allowOrigin,
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Authorization, Content-Type, X-YCS-Credit-Secret",
    "Vary": "Origin"
  };
}

function cleanString(value) {
  const stringValue = String(value || "").trim();
  return stringValue || "";
}

function getBearerToken(request) {
  const header = request.headers.get("Authorization") || "";
  const match = header.match(/^Bearer\s+(.+)$/i);
  return match ? match[1].trim() : "";
}

function requireCreditWriteSecret(request, body) {
  const configuredSecret = process.env.TRADE_PALETTE_CREDITS_API_SECRET;
  if (!configuredSecret) {
    const error = new Error("Missing TRADE_PALETTE_CREDITS_API_SECRET");
    error.status = 500;
    throw error;
  }

  const submittedSecret = cleanString(request.headers.get("X-YCS-Credit-Secret")) ||
    cleanString(getBearerToken(request)) ||
    cleanString(body?.secret);

  if (submittedSecret !== configuredSecret) {
    const error = new Error("Unauthorized");
    error.status = 401;
    throw error;
  }
}

export async function loader({ request }) {
  const origin = request.headers.get("Origin") || "";
  const corsHeaders = getCorsHeaders(origin);

  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  try {
    const url = new URL(request.url);
    const tradeCustomerId = cleanString(url.searchParams.get("tradeCustomerId") || url.searchParams.get("customerId"));

    if (!tradeCustomerId) {
      return Response.json(
        { error: "Missing tradeCustomerId" },
        { status: 400, headers: corsHeaders }
      );
    }

    const result = await getTradePaletteCreditBalance({ tradeCustomerId });

    return Response.json(
      {
        success: true,
        ...result
      },
      { headers: corsHeaders }
    );
  } catch (error) {
    return Response.json(
      { error: error.message || "Credit balance lookup failed" },
      { status: error.status || 500, headers: corsHeaders }
    );
  }
}

export async function action({ request }) {
  const origin = request.headers.get("Origin") || "";
  const corsHeaders = getCorsHeaders(origin);

  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  if (request.method !== "POST") {
    return Response.json(
      { error: "Method not allowed" },
      { status: 405, headers: corsHeaders }
    );
  }

  try {
    const body = await request.json();
    requireCreditWriteSecret(request, body);

    const result = await recordTradePaletteCreditEvent({
      tradeCustomerId: body.tradeCustomerId || body.customerId,
      eventType: body.eventType,
      quantity: body.quantity,
      sourceType: body.sourceType,
      sourceId: body.sourceId,
      sourceLineItemId: body.sourceLineItemId,
      clientRecordId: body.clientRecordId,
      clientEmail: body.clientEmail,
      paletteCode: body.paletteCode,
      notes: body.notes,
      idempotencyKey: body.idempotencyKey
    });
    const balance = await getTradePaletteCreditBalance({
      tradeCustomerId: body.tradeCustomerId || body.customerId
    });

    return Response.json(
      {
        success: true,
        ...result,
        balance: balance.balance
      },
      { headers: corsHeaders }
    );
  } catch (error) {
    return Response.json(
      { error: error.message || "Credit event write failed" },
      { status: error.status || 500, headers: corsHeaders }
    );
  }
}
