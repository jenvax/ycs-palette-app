import { recordTradePaletteCreditEvent } from "./trade-palette-credits.server.js";

export const CREDIT_SKU_MAP = {
  "YCS-PALETTE-CREDITS-1": 1,
  "YCS-PALETTE-CREDITS-5": 5,
  "YCS-PALETTE-CREDITS-10": 10,
  "YCS-PALETTE-CREDITS-20": 20
};

function cleanString(value) {
  return String(value || "").trim();
}

function normalizeShopifyGid(value, resourceName) {
  return cleanString(value).replace(new RegExp(`^gid://shopify/${resourceName}/`), "");
}

function orderIdFromPayload(payload) {
  return normalizeShopifyGid(payload.admin_graphql_api_id, "Order") ||
    cleanString(payload.id);
}

function customerIdFromPayload(payload) {
  return normalizeShopifyGid(payload.customer?.admin_graphql_api_id, "Customer") ||
    cleanString(payload.customer?.id);
}

function lineItemIdFromPayload(lineItem) {
  return normalizeShopifyGid(lineItem.admin_graphql_api_id, "LineItem") ||
    cleanString(lineItem.id);
}

export function orderToPaidWebhookPayload(order) {
  if (!order) return null;

  return {
    id: cleanString(order.legacyResourceId) || normalizeShopifyGid(order.id, "Order"),
    admin_graphql_api_id: order.id,
    name: cleanString(order.name),
    customer: order.customer
      ? {
          id: cleanString(order.customer.legacyResourceId) || normalizeShopifyGid(order.customer.id, "Customer"),
          admin_graphql_api_id: order.customer.id,
          email: cleanString(order.customer.email),
          first_name: cleanString(order.customer.firstName),
          last_name: cleanString(order.customer.lastName)
        }
      : null,
    line_items: (order.lineItems?.nodes || []).map((lineItem) => ({
      id: normalizeShopifyGid(lineItem.id, "LineItem"),
      admin_graphql_api_id: lineItem.id,
      sku: cleanString(lineItem.sku || lineItem.variant?.sku),
      title: cleanString(lineItem.title),
      quantity: Number(lineItem.quantity) || 1
    }))
  };
}

export function creditLineItemsFromOrder(payload) {
  return (Array.isArray(payload.line_items) ? payload.line_items : [])
    .map((lineItem) => {
      const sku = cleanString(lineItem.sku).toUpperCase();
      const creditsPerUnit = CREDIT_SKU_MAP[sku] || 0;
      const quantity = Math.max(1, Number(lineItem.quantity) || 1);

      if (!creditsPerUnit) return null;

      return {
        sku,
        lineItemId: lineItemIdFromPayload(lineItem),
        title: cleanString(lineItem.title),
        quantity,
        credits: creditsPerUnit * quantity
      };
    })
    .filter(Boolean);
}

export async function recordCreditsForPaidOrder(payload) {
  const tradeCustomerId = customerIdFromPayload(payload);
  const orderId = orderIdFromPayload(payload);
  const orderName = cleanString(payload.name);
  const creditLineItems = creditLineItemsFromOrder(payload);

  if (!tradeCustomerId) {
    return {
      skipped: true,
      reason: "missing_customer_id",
      orderId,
      creditLineItems
    };
  }

  if (!orderId) {
    return {
      skipped: true,
      reason: "missing_order_id",
      tradeCustomerId,
      creditLineItems
    };
  }

  if (!creditLineItems.length) {
    return {
      skipped: true,
      reason: "no_credit_skus",
      tradeCustomerId,
      orderId
    };
  }

  const results = [];
  for (const item of creditLineItems) {
    const sourceLineItemId = item.lineItemId || item.sku;
    const result = await recordTradePaletteCreditEvent({
      tradeCustomerId,
      eventType: "purchase",
      quantity: item.credits,
      sourceType: "shopify_order",
      sourceId: orderId,
      sourceLineItemId,
      notes: `${orderName || orderId} - ${item.quantity} x ${item.sku}`,
      idempotencyKey: `${tradeCustomerId}__purchase__shopify_order__${orderId}__${sourceLineItemId}`
    });

    results.push({
      ...item,
      created: result.created,
      eventId: result.event?.id || ""
    });
  }

  return {
    success: true,
    tradeCustomerId,
    orderId,
    orderName,
    results
  };
}
