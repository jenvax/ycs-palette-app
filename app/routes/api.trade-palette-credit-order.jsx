import {
  backfillPaidOrderPaletteCredits,
  findPaidOrderForPaletteCredits
} from "../services/palette-credit-order-lookup.server.js";
import { creditLineItemsFromOrder } from "../services/palette-credit-orders.server.js";

function cleanString(value) {
  return String(value || "").trim();
}

function requireSecret(request, body = {}) {
  const configuredSecret = process.env.TRADE_PALETTE_CREDITS_API_SECRET;
  if (!configuredSecret) {
    const error = new Error("Missing TRADE_PALETTE_CREDITS_API_SECRET");
    error.status = 500;
    throw error;
  }

  const headerSecret = cleanString(request.headers.get("X-YCS-Credit-Secret"));
  const bearerMatch = cleanString(request.headers.get("Authorization")).match(/^Bearer\s+(.+)$/i);
  const submittedSecret = headerSecret || cleanString(bearerMatch?.[1]) || cleanString(body.secret);

  if (submittedSecret !== configuredSecret) {
    const error = new Error("Unauthorized");
    error.status = 401;
    throw error;
  }
}

function publicOrderSummary(lookup) {
  const payload = lookup.payload;

  return {
    found: lookup.found,
    paid: lookup.paid,
    orderName: cleanString(lookup.order?.name),
    displayFinancialStatus: cleanString(lookup.order?.displayFinancialStatus),
    tradeCustomerId: cleanString(payload?.customer?.id),
    customerEmail: cleanString(payload?.customer?.email),
    lineItems: (payload?.line_items || []).map((item) => ({
      id: cleanString(item.id),
      title: cleanString(item.title),
      sku: cleanString(item.sku),
      quantity: Number(item.quantity) || 1
    })),
    creditLineItems: payload ? creditLineItemsFromOrder(payload) : []
  };
}

export async function loader({ request }) {
  try {
    requireSecret(request);

    const url = new URL(request.url);
    const orderName = cleanString(url.searchParams.get("orderName") || url.searchParams.get("orderNumber"));
    const lookup = await findPaidOrderForPaletteCredits({ orderName });

    return Response.json({
      success: true,
      ...publicOrderSummary(lookup)
    });
  } catch (error) {
    return Response.json(
      {
        error: error.message || "Order credit lookup failed",
        shopifyErrors: error.shopifyErrors || undefined
      },
      { status: error.status || 500 }
    );
  }
}

export async function action({ request }) {
  try {
    const body = await request.json();
    requireSecret(request, body);

    const orderName = cleanString(body.orderName || body.orderNumber);
    const result = await backfillPaidOrderPaletteCredits({ orderName });

    return Response.json({
      success: !result.skipped,
      ...result
    });
  } catch (error) {
    return Response.json(
      {
        error: error.message || "Order credit backfill failed",
        shopifyErrors: error.shopifyErrors || undefined
      },
      { status: error.status || 500 }
    );
  }
}
