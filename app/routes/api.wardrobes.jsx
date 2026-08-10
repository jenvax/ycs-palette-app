/* global process */

const ADMIN_TAG = "YCS_ADMIN";
const REPORTS_TABLE = "ColorAnalysisReports";
const WARDROBE_REPORT_TYPE = "wardrobe_builder";
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

function airtableConfig() {
  return {
    baseId: process.env.AIRTABLE_BASE_ID,
    token: process.env.AIRTABLE_TOKEN,
    reportsTable: process.env.AIRTABLE_COLOR_ANALYSIS_REPORTS_TABLE || REPORTS_TABLE
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

async function airtableRequest({ method = "GET", tableName, recordId, searchParams, fields }) {
  const { baseId, token } = airtableConfig();
  if (!baseId || !token) {
    throw new AirtableRequestError("Missing Airtable configuration", { status: 500 });
  }

  const url = new URL(`https://api.airtable.com/v0/${baseId}/${encodeURIComponent(tableName)}${recordId ? `/${recordId}` : ""}`);
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
        id: color.id || makeId("wcolor"),
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

function normalizeWardrobeState(value) {
  const state = value && typeof value === "object" && !Array.isArray(value) ? value : {};
  const wardrobes = Array.isArray(state.wardrobes) ? state.wardrobes : [];

  return {
    wardrobes: wardrobes.map((wardrobe) => ({
      id: String(wardrobe.id || makeId("wardrobe")),
      name: String(wardrobe.name || "Wardrobe"),
      items: Array.isArray(wardrobe.items)
        ? wardrobe.items.map((item) => ({
          id: String(item.id || makeId("witem")),
          description: String(item.description || ""),
          itemType: String(item.itemType || ""),
          colors: cleanColors(item.colors),
          wardrobeIds: Array.isArray(item.wardrobeIds) && item.wardrobeIds.length
            ? item.wardrobeIds.map(String)
            : [String(wardrobe.id || "")].filter(Boolean),
          createdAt: String(item.createdAt || new Date().toISOString()),
          updatedAt: String(item.updatedAt || new Date().toISOString())
        }))
        : [],
      createdAt: String(wardrobe.createdAt || new Date().toISOString()),
      updatedAt: String(wardrobe.updatedAt || new Date().toISOString())
    }))
  };
}

function serializeWardrobes(state) {
  return {
    wardrobes: state.wardrobes
      .map((wardrobe) => ({
        ...wardrobe,
        itemCount: wardrobe.items.length
      }))
      .sort((a, b) => String(b.updatedAt || "").localeCompare(String(a.updatedAt || "")))
  };
}

function findWardrobe(state, wardrobeId) {
  return state.wardrobes.find((wardrobe) => wardrobe.id === wardrobeId) || null;
}

function findItem(state, itemId) {
  for (const wardrobe of state.wardrobes) {
    const item = wardrobe.items.find((candidate) => candidate.id === itemId);
    if (item) return { wardrobe, item };
  }
  return null;
}

async function loadWardrobeState(ownerCustomerId) {
  const { reportsTable } = airtableConfig();
  const formula = `AND({ConsultantId}="${escapeFormulaValue(ownerCustomerId)}",{ClientRecordId}="${escapeFormulaValue(ownerCustomerId)}",{ReportType}="${escapeFormulaValue(WARDROBE_REPORT_TYPE)}")`;
  const records = await fetchAllAirtableRecords({ tableName: reportsTable, formula });
  const record = records[0] || null;
  let parsed = {};

  if (record?.fields?.DraftJson) {
    try {
      parsed = JSON.parse(String(record.fields.DraftJson || "{}"));
    } catch {
      parsed = {};
    }
  }

  return {
    record,
    state: normalizeWardrobeState(parsed)
  };
}

async function saveWardrobeState(ownerCustomerId, recordId, state) {
  const { reportsTable } = airtableConfig();
  const fields = {
    ConsultantId: ownerCustomerId,
    ClientRecordId: ownerCustomerId,
    ReportType: WARDROBE_REPORT_TYPE,
    DraftJson: JSON.stringify(state)
  };

  const record = recordId
    ? await airtableRequest({ method: "PATCH", tableName: reportsTable, recordId, fields })
    : await airtableRequest({ method: "POST", tableName: reportsTable, fields });

  return record;
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

    const { state } = await loadWardrobeState(auth.ownerCustomerId);
    return Response.json(serializeWardrobes(state), { headers: corsHeaders });
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
    const loaded = await loadWardrobeState(ownerCustomerId);
    const state = loaded.state;

    if (actionName === "createWardrobe") {
      const name = cleanString(body.name);
      if (!name) return Response.json({ error: "Wardrobe name is required" }, { status: 400, headers: corsHeaders });

      const now = new Date().toISOString();
      const wardrobe = {
        id: makeId("wardrobe"),
        name,
        items: [],
        createdAt: now,
        updatedAt: now
      };
      state.wardrobes.unshift(wardrobe);
      const record = await saveWardrobeState(ownerCustomerId, loaded.record?.id, state);

      return Response.json({ wardrobe: { ...wardrobe, itemCount: 0 }, recordId: record.id }, { headers: corsHeaders });
    }

    if (actionName === "renameWardrobe") {
      const wardrobeId = cleanString(body.wardrobeId);
      const name = cleanString(body.name);
      if (!wardrobeId) return Response.json({ error: "Missing wardrobeId" }, { status: 400, headers: corsHeaders });
      if (!name) return Response.json({ error: "Wardrobe name is required" }, { status: 400, headers: corsHeaders });

      const wardrobe = findWardrobe(state, wardrobeId);
      if (!wardrobe) return Response.json({ error: "Wardrobe not found" }, { status: 404, headers: corsHeaders });

      wardrobe.name = name;
      wardrobe.updatedAt = new Date().toISOString();
      await saveWardrobeState(ownerCustomerId, loaded.record?.id, state);

      return Response.json({ wardrobe: { ...wardrobe, itemCount: wardrobe.items.length } }, { headers: corsHeaders });
    }

    if (actionName === "deleteWardrobe") {
      const wardrobeId = cleanString(body.wardrobeId);
      if (!wardrobeId) return Response.json({ error: "Missing wardrobeId" }, { status: 400, headers: corsHeaders });

      state.wardrobes = state.wardrobes.filter((wardrobe) => wardrobe.id !== wardrobeId);
      await saveWardrobeState(ownerCustomerId, loaded.record?.id, state);

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

      const wardrobe = findWardrobe(state, wardrobeId);
      if (!wardrobe) return Response.json({ error: "Wardrobe not found" }, { status: 404, headers: corsHeaders });

      const now = new Date().toISOString();
      const item = {
        id: makeId("witem"),
        description,
        itemType,
        colors,
        wardrobeIds: [wardrobeId],
        createdAt: now,
        updatedAt: now
      };
      wardrobe.items.unshift(item);
      wardrobe.updatedAt = now;
      await saveWardrobeState(ownerCustomerId, loaded.record?.id, state);

      return Response.json({ item, wardrobe: { ...wardrobe, itemCount: wardrobe.items.length } }, { headers: corsHeaders });
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

      const wardrobe = findWardrobe(state, wardrobeId);
      const item = wardrobe?.items.find((candidate) => candidate.id === itemId);
      if (!wardrobe || !item) return Response.json({ error: "Wardrobe item not found" }, { status: 404, headers: corsHeaders });

      item.description = description;
      item.itemType = itemType;
      item.colors = colors;
      item.updatedAt = new Date().toISOString();
      wardrobe.updatedAt = item.updatedAt;
      await saveWardrobeState(ownerCustomerId, loaded.record?.id, state);

      return Response.json({ wardrobe: { ...wardrobe, itemCount: wardrobe.items.length } }, { headers: corsHeaders });
    }

    if (actionName === "removeFromWardrobe") {
      const wardrobeId = cleanString(body.wardrobeId);
      const itemId = cleanString(body.itemId);
      if (!wardrobeId) return Response.json({ error: "Missing wardrobeId" }, { status: 400, headers: corsHeaders });
      if (!itemId) return Response.json({ error: "Missing itemId" }, { status: 400, headers: corsHeaders });

      const wardrobe = findWardrobe(state, wardrobeId);
      if (!wardrobe) return Response.json({ error: "Wardrobe not found" }, { status: 404, headers: corsHeaders });

      wardrobe.items = wardrobe.items.filter((item) => item.id !== itemId);
      wardrobe.updatedAt = new Date().toISOString();
      await saveWardrobeState(ownerCustomerId, loaded.record?.id, state);

      return Response.json({ success: true, wardrobe: { ...wardrobe, itemCount: wardrobe.items.length } }, { headers: corsHeaders });
    }

    if (findItem(state, cleanString(body.itemId))) {
      return Response.json({ error: "Unknown wardrobe action" }, { status: 400, headers: corsHeaders });
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
