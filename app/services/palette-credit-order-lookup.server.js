import { orderToPaidWebhookPayload, recordCreditsForPaidOrder } from "./palette-credit-orders.server.js";
import { shopifyAdminGraphQL } from "./shopify-admin.server.js";

function cleanString(value) {
  return String(value || "").trim();
}

function normalizeOrderName(value) {
  const orderName = cleanString(value);
  if (!orderName) return "";
  return orderName.startsWith("#") ? orderName : `#${orderName}`;
}

function isPaidOrder(order) {
  const status = cleanString(order?.displayFinancialStatus).toUpperCase();
  return status === "PAID" || status === "PARTIALLY_PAID";
}

export async function findPaidOrderForPaletteCredits({ orderName }) {
  const safeOrderName = normalizeOrderName(orderName);
  if (!safeOrderName) {
    throw new Error("Missing orderName");
  }

  const data = await shopifyAdminGraphQL({
    query: `
      query findOrder($query: String!) {
        orders(first: 1, query: $query) {
          nodes {
            id
            legacyResourceId
            name
            displayFinancialStatus
            customer {
              id
              legacyResourceId
              firstName
              lastName
              email
            }
            lineItems(first: 50) {
              nodes {
                id
                sku
                title
                quantity
                variant {
                  sku
                }
              }
            }
          }
        }
      }
    `,
    variables: { query: `name:${safeOrderName}` }
  });

  const order = data.orders?.nodes?.[0] || null;
  const payload = orderToPaidWebhookPayload(order);

  return {
    found: Boolean(order),
    paid: isPaidOrder(order),
    order,
    payload
  };
}

export async function backfillPaidOrderPaletteCredits({ orderName }) {
  const lookup = await findPaidOrderForPaletteCredits({ orderName });

  if (!lookup.found) {
    return {
      success: false,
      skipped: true,
      reason: "order_not_found"
    };
  }

  if (!lookup.paid) {
    return {
      success: false,
      skipped: true,
      reason: "order_not_paid",
      orderName: lookup.order.name,
      displayFinancialStatus: lookup.order.displayFinancialStatus
    };
  }

  const result = await recordCreditsForPaidOrder(lookup.payload);

  return {
    ...result,
    orderName: lookup.order.name,
    displayFinancialStatus: lookup.order.displayFinancialStatus
  };
}
