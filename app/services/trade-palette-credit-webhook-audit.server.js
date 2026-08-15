const DEFAULT_AUDIT_TABLE = "TradePaletteCreditWebhookAudit";

function cleanString(value) {
  return String(value || "").trim();
}

function stringify(value) {
  if (value === undefined || value === null || value === "") return "";
  if (typeof value === "string") return value;
  try {
    return JSON.stringify(value);
  } catch (_error) {
    return String(value);
  }
}

function normalizeShopifyGid(value, resourceName) {
  return cleanString(value).replace(new RegExp(`^gid://shopify/${resourceName}/`), "");
}

function auditConfig() {
  const baseId = process.env.AIRTABLE_BASE_ID;
  const token = process.env.AIRTABLE_TOKEN;
  const schemaToken = process.env.AIRTABLE_SCHEMA_TOKEN || token;
  const tableName = process.env.AIRTABLE_TRADE_PALETTE_CREDIT_WEBHOOK_AUDIT_TABLE || DEFAULT_AUDIT_TABLE;

  if (!baseId || !token) {
    throw new Error("Missing Airtable configuration");
  }

  return { baseId, token, schemaToken, tableName };
}

async function parseAirtableResponse(response) {
  const text = await response.text();
  if (!text) return {};

  try {
    return JSON.parse(text);
  } catch (_error) {
    return { raw: text };
  }
}

async function airtableRequest({
  method = "GET",
  searchParams,
  body,
  fetcher = fetch
}) {
  const { baseId, token, tableName } = auditConfig();
  const url = new URL(`https://api.airtable.com/v0/${baseId}/${encodeURIComponent(tableName)}`);

  if (searchParams) {
    Object.entries(searchParams).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== "") {
        url.searchParams.set(key, String(value));
      }
    });
  }

  const response = await fetcher(url.toString(), {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json"
    },
    body: body ? JSON.stringify(body) : undefined
  });
  const data = await parseAirtableResponse(response);

  if (!response.ok) {
    const error = new Error(data?.error?.message || data?.error || "Airtable request failed");
    error.status = response.status || 500;
    error.data = data;
    throw error;
  }

  return data;
}

function isMissingTableError(error) {
  const message = String(error?.message || "").toLowerCase();
  return error?.status === 404 ||
    ["TABLE_NOT_FOUND", "NOT_FOUND", "INVALID_PERMISSIONS_OR_MODEL_NOT_FOUND"].includes(error?.data?.error?.type) ||
    message.includes("requested model was not found");
}

async function ensureAuditTable({ fetcher = fetch } = {}) {
  const { baseId, schemaToken, tableName } = auditConfig();
  if (!schemaToken) {
    throw new Error("Missing Airtable schema token");
  }

  const response = await fetcher(`https://api.airtable.com/v0/meta/bases/${baseId}/tables`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${schemaToken}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      name: tableName,
      description: "Audit trail for Shopify paid-order webhooks that add TRADE palette credits.",
      fields: [
        { name: "CreatedAt", type: "singleLineText" },
        { name: "Topic", type: "singleLineText" },
        { name: "Shop", type: "singleLineText" },
        { name: "WebhookId", type: "singleLineText" },
        { name: "OrderId", type: "singleLineText" },
        { name: "OrderName", type: "singleLineText" },
        { name: "TradeCustomerId", type: "singleLineText" },
        { name: "CustomerEmail", type: "singleLineText" },
        { name: "Status", type: "singleLineText" },
        { name: "Result", type: "multilineText" },
        { name: "Error", type: "multilineText" }
      ]
    })
  });
  const data = await parseAirtableResponse(response);

  if (!response.ok && data?.error?.type !== "DUPLICATE_TABLE_NAME") {
    const error = new Error(data?.error?.message || data?.error?.type || "Unable to create Airtable webhook audit table");
    error.status = response.status || 500;
    error.data = data;
    throw error;
  }
}

async function withAuditTableSetup(callback, { fetcher = fetch } = {}) {
  try {
    return await callback();
  } catch (error) {
    if (!isMissingTableError(error)) throw error;
    await ensureAuditTable({ fetcher });
    return callback();
  }
}

export function summarizeWebhookPayload(payload) {
  const orderId = normalizeShopifyGid(payload?.admin_graphql_api_id, "Order") || cleanString(payload?.id);
  const tradeCustomerId = normalizeShopifyGid(payload?.customer?.admin_graphql_api_id, "Customer") ||
    cleanString(payload?.customer?.id);

  return {
    orderId,
    orderName: cleanString(payload?.name),
    tradeCustomerId,
    customerEmail: cleanString(payload?.customer?.email),
    lineItems: (Array.isArray(payload?.line_items) ? payload.line_items : []).map((lineItem) => ({
      id: normalizeShopifyGid(lineItem.admin_graphql_api_id, "LineItem") || cleanString(lineItem.id),
      sku: cleanString(lineItem.sku),
      quantity: Number(lineItem.quantity) || 1,
      title: cleanString(lineItem.title)
    }))
  };
}

export function serializeWebhookAuditRecord(record) {
  const fields = record?.fields || {};

  return {
    id: record?.id || "",
    createdAt: cleanString(fields.CreatedAt || record?.createdTime),
    topic: cleanString(fields.Topic),
    shop: cleanString(fields.Shop),
    webhookId: cleanString(fields.WebhookId),
    orderId: cleanString(fields.OrderId),
    orderName: cleanString(fields.OrderName),
    tradeCustomerId: cleanString(fields.TradeCustomerId),
    customerEmail: cleanString(fields.CustomerEmail),
    status: cleanString(fields.Status),
    result: cleanString(fields.Result),
    error: cleanString(fields.Error)
  };
}

export async function recordPaletteCreditWebhookAudit({
  topic,
  shop,
  webhookId,
  payload,
  status,
  result,
  error,
  fetcher = fetch
}) {
  const summary = summarizeWebhookPayload(payload);

  const data = await withAuditTableSetup(() => airtableRequest({
    method: "POST",
    fetcher,
    body: {
      records: [
        {
          fields: {
            CreatedAt: new Date().toISOString(),
            Topic: cleanString(topic),
            Shop: cleanString(shop),
            WebhookId: cleanString(webhookId),
            OrderId: summary.orderId,
            OrderName: summary.orderName,
            TradeCustomerId: summary.tradeCustomerId,
            CustomerEmail: summary.customerEmail,
            Status: cleanString(status),
            Result: stringify(result),
            Error: stringify(error)
          }
        }
      ]
    }
  }), { fetcher });

  return serializeWebhookAuditRecord(data.records?.[0]);
}

export async function listPaletteCreditWebhookAudits({ limit = 20, fetcher = fetch } = {}) {
  const safeLimit = Math.min(Math.max(Number(limit) || 20, 1), 50);
  const data = await withAuditTableSetup(() => airtableRequest({
    fetcher,
    searchParams: {
      pageSize: safeLimit
    }
  }), { fetcher });

  return (data.records || [])
    .map(serializeWebhookAuditRecord)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, safeLimit);
}
