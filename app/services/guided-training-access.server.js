import { shopifyAdminGraphQL } from "./shopify-admin.server.js";

export const GUIDED_TRAINING_SKU = "GUIDED_TRAINING";
export const GUIDED_TRAINING_HANDLE = "guided-color-analysis-training";
export const GUIDED_TAG = "GUIDED";
export const GUIDED_TOOL_EXPIRES_PREFIX = "GUIDED_TOOL_EXPIRES_";
export const GUIDED_TRAINING_EXPIRES_PREFIX = "GUIDED_TRAINING_EXPIRES_";

function cleanString(value) {
  return String(value || "").trim();
}

function normalizeCustomerId(value) {
  return cleanString(value).replace(/^gid:\/\/shopify\/Customer\//, "");
}

function normalizeOrderId(value) {
  return cleanString(value).replace(/^gid:\/\/shopify\/Order\//, "");
}

function orderDate(payload) {
  const rawDate = payload?.processed_at || payload?.created_at || payload?.updated_at || "";
  const parsedDate = rawDate ? new Date(rawDate) : null;
  return parsedDate && Number.isFinite(parsedDate.getTime()) ? parsedDate : new Date();
}

function addDays(date, days) {
  const nextDate = new Date(date.getTime());
  nextDate.setUTCDate(nextDate.getUTCDate() + days);
  return nextDate;
}

function formatDateTag(date) {
  return date.toISOString().slice(0, 10).replace(/-/g, "");
}

function customerIdFromPayload(payload) {
  return normalizeCustomerId(payload?.customer?.id || payload?.customer_id);
}

function orderIdFromPayload(payload) {
  return normalizeOrderId(payload?.admin_graphql_api_id || payload?.order_id || payload?.id);
}

function lineItemSku(lineItem) {
  return cleanString(lineItem?.sku || lineItem?.variant_sku || lineItem?.line_item?.sku).toUpperCase();
}

function lineItemHandle(lineItem) {
  return cleanString(
    lineItem?.product?.handle ||
    lineItem?.product_handle ||
    lineItem?.line_item?.product?.handle ||
    lineItem?.line_item?.product_handle
  ).toLowerCase();
}

function directLineItems(payload) {
  return Array.isArray(payload?.line_items) ? payload.line_items : [];
}

function refundLineItems(payload) {
  if (!Array.isArray(payload?.refund_line_items)) return [];
  return payload.refund_line_items
    .map((refundLineItem) => refundLineItem?.line_item || refundLineItem)
    .filter(Boolean);
}

function hasGuidedTrainingLineItem(payload) {
  const lineItems = [...directLineItems(payload), ...refundLineItems(payload)];
  return lineItems.some((lineItem) => {
    const sku = lineItemSku(lineItem);
    const handle = lineItemHandle(lineItem);
    return sku === GUIDED_TRAINING_SKU || handle === GUIDED_TRAINING_HANDLE;
  });
}

function expirationTagsFromPurchaseDate(purchaseDate) {
  return {
    toolTag: `${GUIDED_TOOL_EXPIRES_PREFIX}${formatDateTag(addDays(purchaseDate, 56))}`,
    trainingTag: `${GUIDED_TRAINING_EXPIRES_PREFIX}${formatDateTag(addDays(purchaseDate, 60))}`
  };
}

export function hasActiveGuidedAccess(tags, scope = "tool", now = new Date()) {
  const upperTags = (tags || []).map((tag) => cleanString(tag).toUpperCase());
  if (!upperTags.includes(GUIDED_TAG)) return false;

  const prefix = scope === "training" ? GUIDED_TRAINING_EXPIRES_PREFIX : GUIDED_TOOL_EXPIRES_PREFIX;
  const today = formatDateTag(now);
  return upperTags.some((tag) => {
    if (!tag.startsWith(prefix)) return false;
    const expiry = tag.slice(prefix.length);
    return /^\d{8}$/.test(expiry) && today <= expiry;
  });
}

async function getCustomerTags(customerId) {
  const safeCustomerId = normalizeCustomerId(customerId);
  if (!safeCustomerId) return [];

  const data = await shopifyAdminGraphQL({
    query: `
      query guidedCustomerTags($id: ID!) {
        customer(id: $id) {
          id
          tags
        }
      }
    `,
    variables: { id: `gid://shopify/Customer/${safeCustomerId}` }
  });

  return Array.isArray(data?.customer?.tags) ? data.customer.tags : [];
}

async function getOrderCustomerId(orderId) {
  const safeOrderId = normalizeOrderId(orderId);
  if (!safeOrderId) return "";

  const data = await shopifyAdminGraphQL({
    query: `
      query guidedOrderCustomer($id: ID!) {
        order(id: $id) {
          customer {
            id
          }
        }
      }
    `,
    variables: { id: `gid://shopify/Order/${safeOrderId}` }
  });

  return normalizeCustomerId(data?.order?.customer?.id);
}

async function replaceGuidedTags(customerId, tagsToAdd) {
  const safeCustomerId = normalizeCustomerId(customerId);
  if (!safeCustomerId) throw new Error("Missing Shopify customer id for GUIDED access");

  const existingTags = await getCustomerTags(safeCustomerId);
  const oldExpiryTags = existingTags.filter((tag) => {
    const upperTag = cleanString(tag).toUpperCase();
    return upperTag.startsWith(GUIDED_TOOL_EXPIRES_PREFIX) ||
      upperTag.startsWith(GUIDED_TRAINING_EXPIRES_PREFIX);
  });

  if (oldExpiryTags.length) {
    await removeCustomerTags(safeCustomerId, oldExpiryTags);
  }

  await addCustomerTags(safeCustomerId, tagsToAdd);
}

async function addCustomerTags(customerId, tags) {
  const safeCustomerId = normalizeCustomerId(customerId);
  const data = await shopifyAdminGraphQL({
    query: `
      mutation guidedTagsAdd($id: ID!, $tags: [String!]!) {
        tagsAdd(id: $id, tags: $tags) {
          userErrors {
            field
            message
          }
        }
      }
    `,
    variables: {
      id: `gid://shopify/Customer/${safeCustomerId}`,
      tags
    }
  });
  const userErrors = data?.tagsAdd?.userErrors || [];
  if (userErrors.length) {
    throw new Error(userErrors.map((error) => error.message).join("; "));
  }
}

async function removeCustomerTags(customerId, tags) {
  const safeCustomerId = normalizeCustomerId(customerId);
  if (!safeCustomerId || !tags.length) return;

  const data = await shopifyAdminGraphQL({
    query: `
      mutation guidedTagsRemove($id: ID!, $tags: [String!]!) {
        tagsRemove(id: $id, tags: $tags) {
          userErrors {
            field
            message
          }
        }
      }
    `,
    variables: {
      id: `gid://shopify/Customer/${safeCustomerId}`,
      tags
    }
  });
  const userErrors = data?.tagsRemove?.userErrors || [];
  if (userErrors.length) {
    throw new Error(userErrors.map((error) => error.message).join("; "));
  }
}

export async function applyGuidedAccessForPaidOrder(payload) {
  if (!hasGuidedTrainingLineItem(payload)) {
    return { skipped: true, reason: "no_guided_training_sku" };
  }

  const customerId = customerIdFromPayload(payload);
  if (!customerId) {
    return { skipped: true, reason: "missing_customer_id" };
  }

  const purchaseDate = orderDate(payload);
  const { toolTag, trainingTag } = expirationTagsFromPurchaseDate(purchaseDate);
  const tags = [GUIDED_TAG, toolTag, trainingTag];
  await replaceGuidedTags(customerId, tags);

  return {
    success: true,
    customerId,
    orderId: orderIdFromPayload(payload),
    orderName: cleanString(payload?.name || payload?.order_name),
    sku: GUIDED_TRAINING_SKU,
    tags
  };
}

export async function removeGuidedAccessForOrder(payload, reason = "removed") {
  if (!hasGuidedTrainingLineItem(payload)) {
    return { skipped: true, reason: "no_guided_training_sku" };
  }

  let customerId = customerIdFromPayload(payload);
  if (!customerId && payload?.order_id) {
    customerId = await getOrderCustomerId(payload.order_id);
  }
  if (!customerId) {
    return { skipped: true, reason: "missing_customer_id" };
  }

  const existingTags = await getCustomerTags(customerId);
  const tagsToRemove = existingTags.filter((tag) => {
    const upperTag = cleanString(tag).toUpperCase();
    return upperTag === GUIDED_TAG ||
      upperTag.startsWith(GUIDED_TOOL_EXPIRES_PREFIX) ||
      upperTag.startsWith(GUIDED_TRAINING_EXPIRES_PREFIX);
  });

  await removeCustomerTags(customerId, tagsToRemove);

  return {
    success: true,
    customerId,
    orderId: orderIdFromPayload(payload),
    orderName: cleanString(payload?.name || payload?.order_name),
    reason,
    removedTags: tagsToRemove
  };
}
