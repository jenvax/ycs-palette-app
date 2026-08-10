/* global process */

const ADMIN_TAG = "YCS_ADMIN";
const WARDROBE_TABLE = "WardrobeItems";
const ITEM_TYPES = new Set([
  "top",
  "bottom",
  "dress_jumpsuit",
  "outer_layer",
  "shoe",
  "bag"
]);

class AirtableRequestError extends Error {
  constructor(message, details = {}) {
    super(message);
    this.name = "AirtableRequestError";
    this.status = details.status;
    this.type = details.type;
  }
}

function getCorsHeaders(origin) {
  const allowedOrigins = [
    "https://yourcolorstyle.com",
    "https://www.yourcolorstyle.com"
  ];

  return {
    "Access-Control-Allow-Origin": allowedOrigins.includes(origin) ? origin : "https://yourcolorstyle.com",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Vary": "Origin"
  };
}

function cleanString(value) {
  const stringValue = String(value || "").trim();
  return stringValue || null;
}

function normalizeCustomerId(value) {
  return String(value || "")
    .replace("gid://shopify/Customer/", "")
    .trim();
}

function normalizeHex(value) {
  const raw = String(value || "").trim().replace(/^#/, "");
  if (!/^[0-9a-fA-F]{6}$/.test(raw)) return null;
  return `#${raw.toUpperCase()}`;
}

function escapeFormulaValue(value) {
  return String(value || "").replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

function makeId(prefix) {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function airtableConfig() {
  return {
    baseId: process.env.AIRTABLE_BASE_ID,
    token: process.env.AIRTABLE_TOKEN,
    tableName: process.env.AIRTABLE_WARDROBE_ITEMS_TABLE || WARDROBE_TABLE
  };
}

async function airtableRequest({ method = "GET", tableName, recordId, searchParams, fields }) {
  const { baseId, token, tableName: defaultTableName } = airtableConfig();
  if (!baseId || !token) {
    throw new AirtableRequestError("Missing Airtable configuration", { status: 500 });
  }

  const encodedTable = encodeURIComponent(tableName || defaultTableName);
  const url = new URL(`https://api.airtable.com/v0/${baseId}/${encodedTable}${recordId ? `/${recordId}` : ""}`);

  if (searchParams) {
    searchParams.forEach((value, key) => url.searchParams.set(key, value));
  }

  const response = await fetch(url.toString(), {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(fields ? { "Content-Type": "application/json" } : {})
    },
    ...(fields ? { body: JSON.stringify({ fields }) } : {})
  });
  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new AirtableRequestError(
      data?.error?.message || data?.error?.type || "Airtable request failed",
      {
        status: response.status,
        type: data?.error?.type
      }
    );
  }

  return data;
}

async function fetchAllAirtableRecords({ tableName, formula }) {
  const records = [];
  let offset = "";

  do {
    const searchParams = new URLSearchParams();
    if (formula) searchParams.set("filterByFormula", formula);
    if (offset) searchParams.set("offset", offset);

    const data = await airtableRequest({ tableName, searchParams });
    records.push(...(data.records || []));
    offset = data.offset || "";
  } while (offset);

  return records;
}

function isMissingTable(error) {
  return error?.status === 404 || ["TABLE_NOT_FOUND", "NOT_FOUND"].includes(error?.type);
}

async function ensureWardrobeTable() {
  const { baseId, token, tableName } = airtableConfig();
  if (!baseId || !token) {
    throw new AirtableRequestError("Missing Airtable configuration", { status: 500 });
  }

  const response = await fetch(`https://api.airtable.com/v0/meta/bases/${baseId}/tables`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      name: tableName,
      description: "Wardrobe Builder wardrobes and items.",
      fields: [
        { name: "RecordType", type: "singleLineText" },
        { name: "OwnerCustomerId", type: "singleLineText" },
        { name: "WardrobeId", type: "singleLineText" },
        { name: "WardrobeName", type: "singleLineText" },
        { name: "ItemId", type: "singleLineText" },
        { name: "Description", type: "singleLineText" },
        { name: "ItemType", type: "singleLineText" },
        { name: "ColorsJson", type: "multilineText" },
        { name: "CreatedAt", type: "singleLineText" },
        { name: "UpdatedAt", type: "singleLineText" }
      ]
    })
  });
  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new AirtableRequestError(
      data?.error?.message || data?.error?.type || "Unable to create Airtable wardrobe table",
      {
        status: response.status,
        type: data?.error?.type
      }
    );
  }
}

async function withWardrobeTableSetup(callback) {
  try {
    return await callback();
  } catch (error) {
    if (!isMissingTable(error)) throw error;
    await ensureWardrobeTable();
    return callback();
  }
}

async function getShopifyAccessToken({ shop, apiKey, apiSecret }) {
  const response = await fetch(`https://${shop}/admin/oauth/access_token`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      client_id: apiKey,
      client_secret: apiSecret,
      grant_type: "client_credentials"
    })
  });
  const data = await response.json().catch(() => ({}));

  if (!response.ok || !data.access_token) {
    const error = new Error("Failed to generate Shopify access token");
    error.status = response.status || 500;
    throw error;
  }

  return data.access_token;
}

async function fetchCustomerTagsWithToken({ shop, accessToken, customerId }) {
  const response = await fetch(`https://${shop}/admin/api/2026-04/graphql.json`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Shopify-Access-Token": accessToken
    },
    body: JSON.stringify({
      query: `
        query getCustomerTags($id: ID!) {
          customer(id: $id) {
            tags
          }
        }
      `,
      variables: { id: `gid://shopify/Customer/${customerId}` }
    })
  });
  const json = await response.json().catch(() => ({}));

  if (!response.ok || json.errors) {
    const message = json.errors?.[0]?.message || json.error || "Shopify customer lookup failed";
    const error = new Error(message);
    error.status = response.status || 500;
    throw error;
  }

  return Array.isArray(json.data?.customer?.tags)
    ? json.data.customer.tags.map((tag) => String(tag).trim().toUpperCase())
    : [];
}

async function fetchCustomerTags(customerId) {
  const safeCustomerId = normalizeCustomerId(customerId);
  if (!safeCustomerId) return [];

  const shop = String(process.env.SHOPIFY_SYNC_SHOP || process.env.SHOPIFY_SHOP || "")
    .replace(/^https?:\/\//, "")
    .replace(/\/.*$/, "");
  const staticAccessToken = process.env.SHOPIFY_ADMIN_ACCESS_TOKEN;

  if (!shop) {
    const error = new Error("Missing Shopify shop configuration");
    error.status = 500;
    throw error;
  }

  if (staticAccessToken) {
    try {
      return await fetchCustomerTagsWithToken({
        shop,
        accessToken: staticAccessToken,
        customerId: safeCustomerId
      });
    } catch (error) {
      console.error("Static Shopify customer lookup failed, trying generated app token:", error);
    }
  }

  const apiSecret = process.env.SHOPIFY_API_SECRET || process.env.SHOPIFY_API_TOKEN;

  if (!process.env.SHOPIFY_API_KEY || !apiSecret) {
    const error = new Error("Missing Shopify API credentials");
    error.status = 500;
    throw error;
  }

  const generatedAccessToken = await getShopifyAccessToken({
    shop,
    apiKey: process.env.SHOPIFY_API_KEY,
    apiSecret
  });

  return fetchCustomerTagsWithToken({
    shop,
    accessToken: generatedAccessToken,
    customerId: safeCustomerId
  });
}

async function fetchCustomerDirectoryTags(customerId) {
  const records = await fetchAllAirtableRecords({
    tableName: "CustomerDirectory",
    formula: `{CustomerId}="${escapeFormulaValue(customerId)}"`
  });

  const fields = records[0]?.fields || {};
  return String(fields.ShopifyTags || fields.Tags || "")
    .split(",")
    .map((tag) => tag.trim().toUpperCase())
    .filter(Boolean);
}

async function authorizeAdmin(customerId) {
  const ownerCustomerId = normalizeCustomerId(customerId);
  if (!ownerCustomerId) {
    return { ok: false, status: 401, error: "You must be signed in to use Wardrobe Builder" };
  }

  let tags = [];
  try {
    tags = await fetchCustomerTags(ownerCustomerId);
  } catch (error) {
    console.error("Shopify wardrobe authorization failed, trying CustomerDirectory:", error);
    tags = await fetchCustomerDirectoryTags(ownerCustomerId);
  }

  if (!tags.includes(ADMIN_TAG)) {
    return { ok: false, status: 403, error: "YCS_ADMIN access required" };
  }

  return { ok: true, ownerCustomerId };
}

function cleanColors(colors) {
  if (!Array.isArray(colors)) return [];

  const seen = new Set();
  return colors
    .map((color, index) => {
      const hexCode = normalizeHex(color.hexCode || color.hex);
      const colorName = cleanString(color.colorName || color.name) || hexCode;
      const paletteCode = cleanString(color.paletteCode) || "";
      if (!hexCode || !colorName) return null;
      const key = `${hexCode}:${colorName}`;
      if (seen.has(key)) return null;
      seen.add(key);
      return {
        id: makeId("wcolor"),
        name: colorName,
        colorName,
        hex: hexCode,
        hexCode,
        paletteCode,
        displayOrder: index
      };
    })
    .filter(Boolean);
}

function parseColors(value) {
  try {
    const parsed = JSON.parse(String(value || "[]"));
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function itemFromRecord(record) {
  const fields = record.fields || {};
  return {
    id: String(fields.ItemId || record.id),
    airtableRecordId: record.id,
    description: String(fields.Description || ""),
    itemType: String(fields.ItemType || ""),
    colors: parseColors(fields.ColorsJson),
    wardrobeIds: [String(fields.WardrobeId || "")].filter(Boolean),
    createdAt: String(fields.CreatedAt || record.createdTime || ""),
    updatedAt: String(fields.UpdatedAt || record.createdTime || "")
  };
}

function wardrobeFromRecord(record, items) {
  const fields = record.fields || {};
  const wardrobeId = String(fields.WardrobeId || record.id);
  const wardrobeItems = items
    .filter((item) => item.wardrobeIds.includes(wardrobeId))
    .sort((a, b) => String(b.updatedAt || "").localeCompare(String(a.updatedAt || "")));

  return {
    id: wardrobeId,
    airtableRecordId: record.id,
    name: String(fields.WardrobeName || "Wardrobe"),
    items: wardrobeItems,
    itemCount: wardrobeItems.length,
    createdAt: String(fields.CreatedAt || record.createdTime || ""),
    updatedAt: String(fields.UpdatedAt || record.createdTime || "")
  };
}

async function getOwnerRecords(ownerCustomerId) {
  return withWardrobeTableSetup(() => fetchAllAirtableRecords({
    formula: `{OwnerCustomerId}="${escapeFormulaValue(ownerCustomerId)}"`
  }));
}

async function listWardrobes(ownerCustomerId) {
  const records = await getOwnerRecords(ownerCustomerId);
  const wardrobeRecords = records.filter((record) => record.fields?.RecordType === "wardrobe");
  const itemRecords = records.filter((record) => record.fields?.RecordType === "item");
  const items = itemRecords.map(itemFromRecord);
  const wardrobes = wardrobeRecords
    .map((record) => wardrobeFromRecord(record, items))
    .sort((a, b) => String(b.updatedAt || "").localeCompare(String(a.updatedAt || "")));

  return { wardrobes };
}

async function findOwnedWardrobe(ownerCustomerId, wardrobeId) {
  const records = await withWardrobeTableSetup(() => fetchAllAirtableRecords({
    formula: `AND({RecordType}="wardrobe",{OwnerCustomerId}="${escapeFormulaValue(ownerCustomerId)}",{WardrobeId}="${escapeFormulaValue(wardrobeId)}")`
  }));
  return records[0] || null;
}

async function requireOwnedWardrobe(ownerCustomerId, wardrobeId) {
  const wardrobe = await findOwnedWardrobe(ownerCustomerId, wardrobeId);
  if (!wardrobe) {
    const error = new Error("Wardrobe not found");
    error.status = 404;
    throw error;
  }
  return wardrobe;
}

async function requireOwnedItem(ownerCustomerId, itemId) {
  const records = await withWardrobeTableSetup(() => fetchAllAirtableRecords({
    formula: `AND({RecordType}="item",{OwnerCustomerId}="${escapeFormulaValue(ownerCustomerId)}",{ItemId}="${escapeFormulaValue(itemId)}")`
  }));

  if (!records[0]) {
    const error = new Error("Wardrobe item not found");
    error.status = 404;
    throw error;
  }

  return records[0];
}

async function readWardrobe(ownerCustomerId, wardrobeId) {
  const [wardrobeRecord, records] = await Promise.all([
    requireOwnedWardrobe(ownerCustomerId, wardrobeId),
    getOwnerRecords(ownerCustomerId)
  ]);
  const items = records
    .filter((record) => record.fields?.RecordType === "item")
    .map(itemFromRecord);

  return wardrobeFromRecord(wardrobeRecord, items);
}

export async function loader({ request }) {
  const origin = request.headers.get("Origin") || "";
  const corsHeaders = getCorsHeaders(origin);

  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  try {
    const url = new URL(request.url);
    const auth = await authorizeAdmin(url.searchParams.get("customerId"));

    if (!auth.ok) {
      return Response.json({ error: auth.error }, { status: auth.status, headers: corsHeaders });
    }

    return Response.json(await listWardrobes(auth.ownerCustomerId), { headers: corsHeaders });
  } catch (error) {
    console.error("wardrobes loader failed:", error);
    return Response.json(
      { error: error.message || "Failed to load wardrobes" },
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

  try {
    const body = await request.json();
    const auth = await authorizeAdmin(body.customerId);

    if (!auth.ok) {
      return Response.json({ error: auth.error }, { status: auth.status, headers: corsHeaders });
    }

    const ownerCustomerId = auth.ownerCustomerId;
    const actionName = String(body.action || "").trim();

    if (actionName === "createWardrobe") {
      const name = cleanString(body.name);
      if (!name) return Response.json({ error: "Wardrobe name is required" }, { status: 400, headers: corsHeaders });

      const now = new Date().toISOString();
      const wardrobeId = makeId("wardrobe");
      const record = await withWardrobeTableSetup(() => airtableRequest({
        method: "POST",
        fields: {
          RecordType: "wardrobe",
          OwnerCustomerId: ownerCustomerId,
          WardrobeId: wardrobeId,
          WardrobeName: name,
          CreatedAt: now,
          UpdatedAt: now
        }
      }));

      return Response.json({ wardrobe: wardrobeFromRecord(record, []) }, { headers: corsHeaders });
    }

    if (actionName === "renameWardrobe") {
      const wardrobeId = cleanString(body.wardrobeId);
      const name = cleanString(body.name);
      if (!wardrobeId) return Response.json({ error: "Missing wardrobeId" }, { status: 400, headers: corsHeaders });
      if (!name) return Response.json({ error: "Wardrobe name is required" }, { status: 400, headers: corsHeaders });

      const wardrobe = await requireOwnedWardrobe(ownerCustomerId, wardrobeId);
      await airtableRequest({
        method: "PATCH",
        recordId: wardrobe.id,
        fields: {
          WardrobeName: name,
          UpdatedAt: new Date().toISOString()
        }
      });

      return Response.json({ wardrobe: await readWardrobe(ownerCustomerId, wardrobeId) }, { headers: corsHeaders });
    }

    if (actionName === "deleteWardrobe") {
      const wardrobeId = cleanString(body.wardrobeId);
      if (!wardrobeId) return Response.json({ error: "Missing wardrobeId" }, { status: 400, headers: corsHeaders });

      const records = await getOwnerRecords(ownerCustomerId);
      const recordsToDelete = records.filter((record) => {
        const fields = record.fields || {};
        return fields.WardrobeId === wardrobeId && ["wardrobe", "item"].includes(fields.RecordType);
      });

      await Promise.all(recordsToDelete.map((record) => airtableRequest({ method: "DELETE", recordId: record.id })));

      return Response.json({ success: true }, { headers: corsHeaders });
    }

    if (actionName === "createItem") {
      const wardrobeId = cleanString(body.wardrobeId);
      const description = cleanString(body.description);
      const itemType = cleanString(body.itemType);
      const colors = cleanColors(body.colors);

      if (!wardrobeId) return Response.json({ error: "Choose a wardrobe" }, { status: 400, headers: corsHeaders });
      if (!description) return Response.json({ error: "Description is required" }, { status: 400, headers: corsHeaders });
      if (!ITEM_TYPES.has(itemType)) return Response.json({ error: "Choose an item type" }, { status: 400, headers: corsHeaders });
      if (!colors.length) return Response.json({ error: "Select at least one color" }, { status: 400, headers: corsHeaders });

      const wardrobe = await requireOwnedWardrobe(ownerCustomerId, wardrobeId);
      const now = new Date().toISOString();
      const itemId = makeId("witem");
      const wardrobeName = String(wardrobe.fields?.WardrobeName || "");
      const itemRecord = await airtableRequest({
        method: "POST",
        fields: {
          RecordType: "item",
          OwnerCustomerId: ownerCustomerId,
          WardrobeId: wardrobeId,
          WardrobeName: wardrobeName,
          ItemId: itemId,
          Description: description,
          ItemType: itemType,
          ColorsJson: JSON.stringify(colors),
          CreatedAt: now,
          UpdatedAt: now
        }
      });
      await airtableRequest({
        method: "PATCH",
        recordId: wardrobe.id,
        fields: { UpdatedAt: now }
      });

      return Response.json(
        { item: itemFromRecord(itemRecord), wardrobe: await readWardrobe(ownerCustomerId, wardrobeId) },
        { headers: corsHeaders }
      );
    }

    if (actionName === "updateItem") {
      const wardrobeId = cleanString(body.wardrobeId);
      const itemId = cleanString(body.itemId);
      const description = cleanString(body.description);
      const itemType = cleanString(body.itemType);
      const colors = cleanColors(body.colors);

      if (!wardrobeId) return Response.json({ error: "Missing wardrobeId" }, { status: 400, headers: corsHeaders });
      if (!itemId) return Response.json({ error: "Missing itemId" }, { status: 400, headers: corsHeaders });
      if (!description) return Response.json({ error: "Description is required" }, { status: 400, headers: corsHeaders });
      if (!ITEM_TYPES.has(itemType)) return Response.json({ error: "Choose an item type" }, { status: 400, headers: corsHeaders });
      if (!colors.length) return Response.json({ error: "Select at least one color" }, { status: 400, headers: corsHeaders });

      await requireOwnedWardrobe(ownerCustomerId, wardrobeId);
      const item = await requireOwnedItem(ownerCustomerId, itemId);
      const now = new Date().toISOString();
      await airtableRequest({
        method: "PATCH",
        recordId: item.id,
        fields: {
          Description: description,
          ItemType: itemType,
          ColorsJson: JSON.stringify(colors),
          UpdatedAt: now
        }
      });

      return Response.json({ wardrobe: await readWardrobe(ownerCustomerId, wardrobeId) }, { headers: corsHeaders });
    }

    if (actionName === "removeFromWardrobe") {
      const wardrobeId = cleanString(body.wardrobeId);
      const itemId = cleanString(body.itemId);
      if (!wardrobeId) return Response.json({ error: "Missing wardrobeId" }, { status: 400, headers: corsHeaders });
      if (!itemId) return Response.json({ error: "Missing itemId" }, { status: 400, headers: corsHeaders });

      await requireOwnedWardrobe(ownerCustomerId, wardrobeId);
      const item = await requireOwnedItem(ownerCustomerId, itemId);
      await airtableRequest({ method: "DELETE", recordId: item.id });

      return Response.json({ success: true, wardrobe: await readWardrobe(ownerCustomerId, wardrobeId) }, { headers: corsHeaders });
    }

    return Response.json({ error: "Unknown wardrobe action" }, { status: 400, headers: corsHeaders });
  } catch (error) {
    console.error("wardrobes action failed:", error);
    return Response.json(
      { error: error.message || "Failed to update wardrobes" },
      { status: error.status || 500, headers: corsHeaders }
    );
  }
}
