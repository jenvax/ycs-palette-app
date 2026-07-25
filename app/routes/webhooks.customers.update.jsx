import { authenticate } from "../shopify.server";

const CUSTOMER_DIRECTORY_TABLE = "CustomerDirectory";
const PALETTE_TAGS = new Set([
  "CWL", "CWM", "CWD",
  "CCL", "CCM", "CCD",
  "SWL", "SWM", "SWD",
  "SCL", "SCM", "SCD",
  "LO", "MO", "DO",
  "CWLG", "CWMG", "CWDG",
  "SWLG", "SWMG", "SWDG",
  "SCLG", "SCMG", "SCDG"
]);

function normalizeCustomerId(value) {
  return String(value || "")
    .replace("gid://shopify/Customer/", "")
    .trim();
}

function parseTruthy(value) {
  return (
    value === true ||
    value === 1 ||
    String(value || "").toLowerCase() === "true" ||
    String(value || "") === "1"
  );
}

function normalizeTags(value) {
  if (Array.isArray(value)) {
    return value.map((tag) => String(tag || "").trim()).filter(Boolean);
  }

  return String(value || "")
    .split(",")
    .map((tag) => tag.trim())
    .filter(Boolean);
}

function getAirtableConfig() {
  const baseId = process.env.AIRTABLE_BASE_ID;
  const token = process.env.AIRTABLE_TOKEN;

  if (!baseId || !token) {
    throw new Error("Missing Airtable configuration");
  }

  return { baseId, token };
}

async function airtableRequest({ tableName, method = "GET", recordId, searchParams, body }) {
  const { baseId, token } = getAirtableConfig();
  const encodedTable = encodeURIComponent(tableName);
  const url = new URL(
    recordId
      ? `https://api.airtable.com/v0/${baseId}/${encodedTable}/${recordId}`
      : `https://api.airtable.com/v0/${baseId}/${encodedTable}`
  );

  Object.entries(searchParams || {}).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") {
      url.searchParams.set(key, value);
    }
  });

  const response = await fetch(url, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json"
    },
    body: body ? JSON.stringify(body) : undefined
  });
  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data?.error?.message || "Airtable request failed");
  }

  return data;
}

async function findCustomerDirectoryRecord(customerId) {
  const data = await airtableRequest({
    tableName: CUSTOMER_DIRECTORY_TABLE,
    searchParams: {
      maxRecords: "1",
      filterByFormula: `{CustomerId}="${customerId.replace(/"/g, '\\"')}"`
    }
  });

  return data.records?.[0] || null;
}

async function upsertCustomerDirectoryFromWebhook(payload) {
  const customerId = normalizeCustomerId(payload.admin_graphql_api_id || payload.id);
  if (!customerId) return { skipped: true, reason: "missing customer id" };

  const tags = normalizeTags(payload.tags);
  const upperTags = tags.map((tag) => tag.toUpperCase());
  const isVIP = upperTags.includes("VIP");
  const isAdmin = upperTags.includes("YCS_ADMIN");
  const paletteTags = tags.filter((tag) => PALETTE_TAGS.has(tag.toUpperCase()));
  const shouldTrack = isVIP || isAdmin || paletteTags.length > 0;
  const nowIso = new Date().toISOString();
  const existing = await findCustomerDirectoryRecord(customerId);
  const existingFields = existing?.fields || {};
  const previousIsVIP = parseTruthy(existingFields.IsVIP);
  const fields = {
    CustomerId: customerId,
    Email: String(payload.email || existingFields.Email || "").trim(),
    FirstName: String(payload.first_name || existingFields.FirstName || "").trim(),
    LastName: String(payload.last_name || existingFields.LastName || "").trim(),
    Tags: tags.join(", "),
    PaletteTags: paletteTags.join(", "),
    MembershipStatus: isVIP || isAdmin ? "Active" : "Inactive",
    LastSyncedAt: nowIso
  };

  if (!existing && !shouldTrack) {
    return { skipped: true, customerId, reason: "customer does not have tracked tags" };
  }

  if (!existing) {
    fields.FirstSeenAt = nowIso;
    if (isVIP) fields.BecameVIPAt = nowIso;

    await airtableRequest({
      tableName: CUSTOMER_DIRECTORY_TABLE,
      method: "POST",
      body: { records: [{ fields }] }
    });

    return { created: true, customerId, isVIP, isAdmin };
  }

  if (!previousIsVIP && isVIP) {
    fields.BecameVIPAt = existingFields.BecameVIPAt || nowIso;
    fields.LostVIPAt = null;
  }

  if (previousIsVIP && !isVIP) {
    fields.LostVIPAt = nowIso;
  }

  await airtableRequest({
    tableName: CUSTOMER_DIRECTORY_TABLE,
    recordId: existing.id,
    method: "PATCH",
    body: { fields }
  });

  return { updated: true, customerId, isVIP, isAdmin, lostVIP: previousIsVIP && !isVIP };
}

export const action = async ({ request }) => {
  const { payload, topic, shop } = await authenticate.webhook(request);

  try {
    const result = await upsertCustomerDirectoryFromWebhook(payload);
    console.log(`Received ${topic} webhook for ${shop}`, result);
  } catch (error) {
    console.error(`Failed to sync ${topic} webhook for ${shop}:`, error);
    return new Response("Customer directory sync failed", { status: 500 });
  }

  return new Response();
};
