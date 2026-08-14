/* global process */

import { sessionStorage } from "../shopify.server";

const PALETTE_CODES = new Set([
  "CCL", "CCM", "CCD",
  "CWL", "CWM", "CWD",
  "SCL", "SCM", "SCD",
  "SWL", "SWM", "SWD",
  "CWLG", "CWMG", "CWDG",
  "SWLG", "SWMG", "SWDG",
  "LO", "MO", "DO"
]);

const PALETTE_NAMES = {
  CCL: "Clear Cool Light",
  CCM: "Clear Cool Medium",
  CCD: "Clear Cool Deep",
  CWL: "Clear Warm Light",
  CWM: "Clear Warm Medium",
  CWD: "Clear Warm Deep",
  SCL: "Soft Cool Light",
  SCM: "Soft Cool Medium",
  SCD: "Soft Cool Deep",
  SWL: "Soft Warm Light",
  SWM: "Soft Warm Medium",
  SWD: "Soft Warm Deep",
  CWLG: "Clear Warm Light for Gray Hair",
  CWMG: "Clear Warm Medium for Gray Hair",
  CWDG: "Clear Warm Deep for Gray Hair",
  SWLG: "Soft Warm Light for Gray Hair",
  SWMG: "Soft Warm Medium for Gray Hair",
  SWDG: "Soft Warm Deep for Gray Hair",
  LO: "Light Olive",
  MO: "Medium Olive",
  DO: "Deep Olive"
};

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
    "Access-Control-Allow-Headers": "Content-Type",
    "Vary": "Origin"
  };
}

function cleanString(value) {
  const stringValue = String(value || "").trim();
  return stringValue || null;
}

function normalizeCustomerId(value) {
  return String(value || "").replace(/^gid:\/\/shopify\/Customer\//, "").trim();
}

function normalizePaletteCode(value) {
  const code = String(value || "").trim().toUpperCase();
  return PALETTE_CODES.has(code) ? code : "";
}

function escapeFormulaString(value) {
  return String(value || "").replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

function escapeShopifySearchValue(value) {
  return String(value || "").replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

function generateClientRecordId() {
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const dd = String(now.getDate()).padStart(2, "0");
  const random = Math.random().toString(36).slice(2, 8);

  return `cc_${yyyy}${mm}${dd}_${random}`;
}

function shopifyConfig() {
  let shop = String(process.env.SHOPIFY_SYNC_SHOP || process.env.SHOPIFY_SHOP || "")
    .trim()
    .replace(/^https?:\/\//, "")
    .replace(/\/.*$/, "");

  if (shop === "yourcolorstyle.com" || shop === "www.yourcolorstyle.com") {
    shop = "yourcolorstyle.myshopify.com";
  }

  if (!shop) {
    throw new Error("Missing Shopify Admin configuration");
  }

  return { shop };
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
    throw new Error(data.errors || data.error || "Failed to generate Shopify access token");
  }

  return data.access_token;
}

async function getStoredShopifyAccessToken(shop) {
  const session = await sessionStorage.loadSession(`offline_${shop}`).catch(() => null);
  return session?.accessToken || "";
}

async function getGeneratedShopifyAccessToken(shop) {
  const apiSecret = process.env.SHOPIFY_API_SECRET || process.env.SHOPIFY_API_TOKEN;

  if (!process.env.SHOPIFY_API_KEY || !apiSecret) {
    throw new Error("Missing Shopify API credentials");
  }

  return getShopifyAccessToken({
    shop,
    apiKey: process.env.SHOPIFY_API_KEY,
    apiSecret
  });
}

function getShopifyGraphQLError(response, json) {
  const graphQLError = json.errors?.[0];
  const userMessage = graphQLError?.message || json.error || "Shopify Admin GraphQL request failed";
  const error = new Error(userMessage);
  error.status = response.status || 500;
  return error;
}

async function shopifyAdminGraphQLWithToken({ shop, accessToken, query, variables = {} }) {
  const response = await fetch(`https://${shop}/admin/api/2026-04/graphql.json`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Shopify-Access-Token": accessToken
    },
    body: JSON.stringify({ query, variables })
  });

  const responseText = await response.text();
  let json = {};
  try {
    json = responseText ? JSON.parse(responseText) : {};
  } catch (_error) {
    json = {};
  }

  if (!response.ok || json.errors) {
    const error = getShopifyGraphQLError(response, json);
    if (!json.errors && responseText) {
      error.message = `${error.message} (${response.status})`;
    }
    throw error;
  }

  return json.data;
}

async function getShopifyAccessScopesWithToken({ shop, accessToken }) {
  const response = await fetch(`https://${shop}/admin/oauth/access_scopes.json`, {
    headers: {
      "X-Shopify-Access-Token": accessToken
    }
  });
  const responseText = await response.text();
  let json = {};

  try {
    json = responseText ? JSON.parse(responseText) : {};
  } catch (_error) {
    json = {};
  }

  if (!response.ok) {
    const error = new Error(json.errors || json.error || `Access scope lookup failed (${response.status})`);
    error.status = response.status;
    throw error;
  }

  return (json.access_scopes || [])
    .map((scope) => String(scope.handle || "").trim())
    .filter(Boolean);
}

async function shopifyAdminGraphQL({ query, variables = {} }) {
  const { shop } = shopifyConfig();
  const storedAccessToken = await getStoredShopifyAccessToken(shop);
  const staticAccessToken = process.env.SHOPIFY_ADMIN_ACCESS_TOKEN;
  let firstError = null;

  if (storedAccessToken) {
    try {
      return await shopifyAdminGraphQLWithToken({
        shop,
        accessToken: storedAccessToken,
        query,
        variables
      });
    } catch (error) {
      firstError = firstError || error;
      console.error("Stored Shopify Admin GraphQL session failed, trying static token:", error);
    }
  }

  if (staticAccessToken) {
    try {
      return await shopifyAdminGraphQLWithToken({
        shop,
        accessToken: staticAccessToken,
        query,
        variables
      });
    } catch (error) {
      firstError = firstError || error;
      console.error("Static Shopify Admin GraphQL token failed, trying generated app token:", error);
    }
  }

  try {
    const accessToken = await getGeneratedShopifyAccessToken(shop);
    return shopifyAdminGraphQLWithToken({
      shop,
      accessToken,
      query,
      variables
    });
  } catch (error) {
    throw firstError || error;
  }
}

function serializeCustomer(customer) {
  if (!customer) return null;

  return {
    id: normalizeCustomerId(customer.id),
    gid: customer.id,
    firstName: String(customer.firstName || "").trim(),
    lastName: String(customer.lastName || "").trim(),
    email: String(customer.email || "").trim(),
    state: String(customer.state || "").trim(),
    tags: Array.isArray(customer.tags) ? customer.tags : []
  };
}

async function getCustomerById(customerId) {
  const safeCustomerId = normalizeCustomerId(customerId);
  if (!safeCustomerId) return null;

  const data = await shopifyAdminGraphQL({
    query: `
      query getCustomer($id: ID!) {
        customer(id: $id) {
          id
          firstName
          lastName
          email
          state
          tags
        }
      }
    `,
    variables: { id: `gid://shopify/Customer/${safeCustomerId}` }
  });

  return serializeCustomer(data.customer);
}

async function findCustomerByEmail(email) {
  const safeEmail = cleanString(email);
  if (!safeEmail) return null;

  const data = await shopifyAdminGraphQL({
    query: `
      query findCustomer($query: String!) {
        customers(first: 5, query: $query) {
          edges {
            node {
              id
              firstName
              lastName
              email
              state
              tags
            }
          }
        }
      }
    `,
    variables: { query: `email:"${escapeShopifySearchValue(safeEmail)}"` }
  });

  const customers = (data.customers?.edges || [])
    .map((edge) => serializeCustomer(edge.node))
    .filter((customer) => customer?.email.toLowerCase() === safeEmail.toLowerCase());

  return customers[0] || null;
}

async function requireAdmin(viewerCustomerId) {
  const customer = await getCustomerById(viewerCustomerId);
  const tags = customer?.tags || [];

  if (!customer || !tags.some((tag) => String(tag || "").trim().toUpperCase() === "YCS_ADMIN")) {
    const error = new Error("YCS_ADMIN access is required");
    error.status = 403;
    throw error;
  }

  return customer;
}

function airtableConfig() {
  const baseId = process.env.AIRTABLE_BASE_ID;
  const token = process.env.AIRTABLE_TOKEN;

  if (!baseId || !token) {
    throw new Error("Missing Airtable configuration");
  }

  return { baseId, token, tableName: "ConsultantClients" };
}

async function airtableRequest({ method = "GET", recordId, params, body, tableName: tableNameOverride }) {
  const { baseId, token, tableName } = airtableConfig();
  const encodedTable = encodeURIComponent(tableNameOverride || tableName);
  const url = new URL(`https://api.airtable.com/v0/${baseId}/${encodedTable}${recordId ? `/${recordId}` : ""}`);

  if (params) {
    Object.entries(params).forEach(([key, value]) => url.searchParams.set(key, value));
  }

  const response = await fetch(url.toString(), {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json"
    },
    body: body ? JSON.stringify(body) : undefined
  });
  const data = await response.json().catch(() => ({}));

  return { response, data };
}

async function requireAdminForDiagnostics(viewerCustomerId) {
  try {
    return await requireAdmin(viewerCustomerId);
  } catch (shopifyError) {
    const safeCustomerId = normalizeCustomerId(viewerCustomerId);
    if (!safeCustomerId) throw shopifyError;

    const { response, data } = await airtableRequest({
      tableName: "CustomerDirectory",
      params: {
        filterByFormula: `{CustomerId}="${escapeFormulaString(safeCustomerId)}"`,
        maxRecords: "1"
      }
    });

    if (!response.ok) throw shopifyError;

    const fields = data.records?.[0]?.fields || {};
    const tags = String(fields.ShopifyTags || fields.Tags || "")
      .split(",")
      .map((tag) => tag.trim().toUpperCase())
      .filter(Boolean);
    const isAdmin =
      tags.includes("YCS_ADMIN") ||
      fields.IsAdmin === true ||
      String(fields.IsAdmin || "").toLowerCase() === "true";

    if (!isAdmin) throw shopifyError;

    return {
      id: safeCustomerId,
      tags
    };
  }
}

function serializeClient(record) {
  const fields = record?.fields || {};
  if (!record) return null;

  return {
    airtableRecordId: record.id,
    clientRecordId: fields.ClientRecordId || "",
    consultantId: fields.ConsultantId || "",
    firstName: fields.FirstName || "",
    lastName: fields.LastName || "",
    email: fields.Email || "",
    paletteCode: fields.AnalysisResultCode || "",
    paletteName: fields.AnalysisResultLabel || "",
    shopifyCustomerId: fields.ShopifyCustomerId || fields.ShopifyCustomerID || fields.CustomerId || "",
    shopifyCustomerGid: fields.ShopifyCustomerGid || ""
  };
}

async function findClientByEmail({ consultantId, email }) {
  const safeConsultantId = cleanString(consultantId);
  const safeEmail = cleanString(email);
  if (!safeConsultantId || !safeEmail) return null;

  const formula =
    `AND({ConsultantId}="${escapeFormulaString(safeConsultantId)}",LOWER({Email})="${escapeFormulaString(safeEmail.toLowerCase())}")`;
  const { response, data } = await airtableRequest({
    params: {
      filterByFormula: formula,
      maxRecords: "1"
    }
  });

  if (!response.ok) {
    console.warn("Airtable client email lookup failed:", data);
    return null;
  }

  return serializeClient(data.records?.[0]);
}

async function findClientByRecordId(clientRecordId) {
  const safeClientRecordId = cleanString(clientRecordId);
  if (!safeClientRecordId) return null;

  const { response, data } = await airtableRequest({
    params: {
      filterByFormula: `{ClientRecordId}="${escapeFormulaString(safeClientRecordId)}"`,
      maxRecords: "1"
    }
  });

  if (!response.ok) {
    throw new Error(data.error?.message || "Client lookup failed");
  }

  return serializeClient(data.records?.[0]);
}

function isUnknownAirtableFieldError(data) {
  const message = String(data?.error?.message || "").toLowerCase();
  return data?.error?.type === "UNKNOWN_FIELD_NAME" || message.includes("unknown field name");
}

function removeOptionalShopifyClientFields(fields) {
  const nextFields = { ...fields };
  delete nextFields.ShopifyCustomerId;
  delete nextFields.ShopifyCustomerGid;
  return nextFields;
}

async function createClientRecord({ consultantId, customer, paletteCode, paletteName }) {
  const clientRecordId = generateClientRecordId();
  const fields = {
    ClientRecordId: clientRecordId,
    ConsultantId: consultantId,
    FirstName: customer.firstName || customer.email.split("@")[0],
    LastName: customer.lastName || "Customer",
    Email: customer.email,
    AnalysisResultCode: paletteCode || undefined,
    AnalysisResultLabel: paletteName || undefined,
    ShopifyCustomerId: customer.id,
    ShopifyCustomerGid: customer.gid
  };

  Object.keys(fields).forEach((key) => {
    if (fields[key] === undefined || fields[key] === "") delete fields[key];
  });

  let result = await airtableRequest({
    method: "POST",
    body: { fields, typecast: true }
  });

  if (!result.response.ok && isUnknownAirtableFieldError(result.data)) {
    result = await airtableRequest({
      method: "POST",
      body: { fields: removeOptionalShopifyClientFields(fields), typecast: true }
    });
  }

  if (!result.response.ok) {
    throw new Error(result.data.error?.message || "Client create failed");
  }

  return serializeClient(result.data);
}

async function updateClientRecord({ client, fields }) {
  const optionalFields = {
    ...fields
  };

  let result = await airtableRequest({
    method: "PATCH",
    recordId: client.airtableRecordId,
    body: { fields: optionalFields, typecast: true }
  });

  if (!result.response.ok && isUnknownAirtableFieldError(result.data)) {
    result = await airtableRequest({
      method: "PATCH",
      recordId: client.airtableRecordId,
      body: { fields: removeOptionalShopifyClientFields(optionalFields), typecast: true }
    });
  }

  if (!result.response.ok) {
    throw new Error(result.data.error?.message || "Client update failed");
  }

  return serializeClient(result.data);
}

async function addPaletteTagToCustomer({ customer, paletteCode }) {
  if ((customer.tags || []).some((tag) => String(tag || "").trim().toUpperCase() === paletteCode)) {
    return { alreadyHadAccess: true, customer };
  }

  const data = await shopifyAdminGraphQL({
    query: `
      mutation addPaletteTag($id: ID!, $tags: [String!]!) {
        tagsAdd(id: $id, tags: $tags) {
          node {
            ... on Customer {
              id
              firstName
              lastName
              email
              state
              tags
            }
          }
          userErrors {
            field
            message
          }
        }
      }
    `,
    variables: {
      id: customer.gid,
      tags: [paletteCode]
    }
  });

  const userErrors = data.tagsAdd?.userErrors || [];
  if (userErrors.length) {
    throw new Error(userErrors[0].message || "Unable to tag Shopify customer");
  }

  return {
    alreadyHadAccess: false,
    customer: serializeCustomer(data.tagsAdd?.node)
  };
}

async function sendPaletteNotification({ customer, paletteCode, paletteName }) {
  const webhookUrl = cleanString(process.env.PALETTE_ACCESS_NOTIFICATION_WEBHOOK_URL);
  if (!webhookUrl) {
    return {
      sent: false,
      reason: "notification_webhook_not_configured"
    };
  }

  const response = await fetch(webhookUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      event: "palette_access_granted",
      customer,
      paletteCode,
      paletteName,
      accountUrl: "https://yourcolorstyle.com/account",
      palettesUrl: "https://yourcolorstyle.com/pages/my-palettes"
    })
  });

  if (!response.ok) {
    return {
      sent: false,
      reason: "notification_webhook_failed",
      status: response.status
    };
  }

  return { sent: true };
}

async function handleLookup({ request, corsHeaders }) {
  const url = new URL(request.url);
  const viewerCustomerId = cleanString(url.searchParams.get("viewerCustomerId"));
  const consultantId = cleanString(url.searchParams.get("consultantId")) || viewerCustomerId;
  const email = cleanString(url.searchParams.get("email"));

  await requireAdmin(viewerCustomerId);

  if (!email) {
    return Response.json(
      { error: "Missing email" },
      { status: 400, headers: corsHeaders }
    );
  }

  const customer = await findCustomerByEmail(email);
  const client = await findClientByEmail({ consultantId, email });

  return Response.json(
    {
      customer,
      client,
      foundCustomer: Boolean(customer),
      foundClient: Boolean(client)
    },
    { headers: corsHeaders }
  );
}

async function handleDiagnostics({ request, corsHeaders }) {
  const url = new URL(request.url);
  const viewerCustomerId = cleanString(url.searchParams.get("viewerCustomerId"));

  await requireAdminForDiagnostics(viewerCustomerId);

  const { shop } = shopifyConfig();
  const diagnostics = {
    shop,
    env: {
      hasShopifyAdminAccessToken: Boolean(process.env.SHOPIFY_ADMIN_ACCESS_TOKEN),
      hasShopifyApiKey: Boolean(process.env.SHOPIFY_API_KEY),
      hasShopifyApiSecret: Boolean(process.env.SHOPIFY_API_SECRET || process.env.SHOPIFY_API_TOKEN)
    },
    storedSession: {
      configured: false,
      ok: false,
      scopes: [],
      error: ""
    },
    staticToken: {
      configured: Boolean(process.env.SHOPIFY_ADMIN_ACCESS_TOKEN),
      ok: false,
      scopes: [],
      error: ""
    },
    generatedToken: {
      configured: Boolean(process.env.SHOPIFY_API_KEY && (process.env.SHOPIFY_API_SECRET || process.env.SHOPIFY_API_TOKEN)),
      ok: false,
      scopes: [],
      error: ""
    }
  };

  const storedAccessToken = await getStoredShopifyAccessToken(shop);
  diagnostics.storedSession.configured = Boolean(storedAccessToken);
  if (storedAccessToken) {
    try {
      diagnostics.storedSession.scopes = await getShopifyAccessScopesWithToken({
        shop,
        accessToken: storedAccessToken
      });
      diagnostics.storedSession.ok = true;
    } catch (error) {
      diagnostics.storedSession.error = error.message || "Stored session failed";
    }
  }

  if (process.env.SHOPIFY_ADMIN_ACCESS_TOKEN) {
    try {
      diagnostics.staticToken.scopes = await getShopifyAccessScopesWithToken({
        shop,
        accessToken: process.env.SHOPIFY_ADMIN_ACCESS_TOKEN
      });
      diagnostics.staticToken.ok = true;
    } catch (error) {
      diagnostics.staticToken.error = error.message || "Static token failed";
    }
  }

  if (diagnostics.generatedToken.configured) {
    try {
      const generatedAccessToken = await getGeneratedShopifyAccessToken(shop);
      diagnostics.generatedToken.scopes = await getShopifyAccessScopesWithToken({
        shop,
        accessToken: generatedAccessToken
      });
      diagnostics.generatedToken.ok = true;
    } catch (error) {
      diagnostics.generatedToken.error = error.message || "Generated token failed";
    }
  }

  return Response.json(diagnostics, { headers: corsHeaders });
}

async function handleGrant({ request, corsHeaders }) {
  const body = await request.json();
  const viewerCustomerId = cleanString(body.viewerCustomerId);
  const consultantId = cleanString(body.consultantId) || viewerCustomerId;
  const paletteCode = normalizePaletteCode(body.paletteCode);
  const paletteName = cleanString(body.paletteName) || PALETTE_NAMES[paletteCode] || paletteCode;
  const shouldCreateClient = body.createClient === true;

  await requireAdmin(viewerCustomerId);

  if (!paletteCode) {
    return Response.json(
      { error: "Select a valid palette code" },
      { status: 400, headers: corsHeaders }
    );
  }

  let customer = body.customerId
    ? await getCustomerById(body.customerId)
    : await findCustomerByEmail(body.email);

  if (!customer && cleanString(body.email)) {
    customer = await findCustomerByEmail(body.email);
  }

  if (!customer) {
    return Response.json(
      { error: "Shopify customer not found" },
      { status: 404, headers: corsHeaders }
    );
  }

  let client = body.clientRecordId
    ? await findClientByRecordId(body.clientRecordId)
    : await findClientByEmail({ consultantId, email: customer.email });

  if (!client && shouldCreateClient) {
    client = await createClientRecord({
      consultantId,
      customer,
      paletteCode,
      paletteName
    });
  } else if (client) {
    client = await updateClientRecord({
      client,
      fields: {
        AnalysisResultCode: paletteCode,
        AnalysisResultLabel: paletteName,
        Email: client.email || customer.email,
        ShopifyCustomerId: customer.id,
        ShopifyCustomerGid: customer.gid
      }
    });
  }

  const tagResult = await addPaletteTagToCustomer({ customer, paletteCode });
  const notification = await sendPaletteNotification({
    customer: tagResult.customer || customer,
    paletteCode,
    paletteName
  });

  return Response.json(
    {
      success: true,
      customer: tagResult.customer || customer,
      client,
      paletteCode,
      paletteName,
      alreadyHadAccess: tagResult.alreadyHadAccess,
      notification
    },
    { headers: corsHeaders }
  );
}

export async function loader({ request }) {
  const origin = request.headers.get("Origin") || "";
  const corsHeaders = getCorsHeaders(origin);

  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  try {
    const action = new URL(request.url).searchParams.get("action");

    if (action === "lookup") {
      return await handleLookup({ request, corsHeaders });
    }

    if (action === "diagnostics") {
      return await handleDiagnostics({ request, corsHeaders });
    }

    return Response.json(
      { error: "Unknown action" },
      { status: 400, headers: corsHeaders }
    );
  } catch (error) {
    return Response.json(
      { error: error.message || "Request failed" },
      { status: error.status || 500, headers: corsHeaders }
    );
  }
}

export async function action({ request }) {
  const origin = request.headers.get("Origin") || "";
  const corsHeaders = getCorsHeaders(origin);

  try {
    const url = new URL(request.url);
    const actionName = url.searchParams.get("action") || "grantPaletteAccess";

    if (actionName === "grantPaletteAccess") {
      return await handleGrant({ request, corsHeaders });
    }

    return Response.json(
      { error: "Unknown action" },
      { status: 400, headers: corsHeaders }
    );
  } catch (error) {
    return Response.json(
      { error: error.message || "Request failed" },
      { status: error.status || 500, headers: corsHeaders }
    );
  }
}
