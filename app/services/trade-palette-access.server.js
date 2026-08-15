import { shopifyAdminGraphQL } from "./shopify-admin.server.js";
import { PALETTE_NAMES, normalizePaletteCode } from "./palette-codes.server.js";
import {
  getTradePaletteCreditBalance,
  recordTradePaletteCreditEvent
} from "./trade-palette-credits.server.js";

function cleanString(value) {
  return String(value || "").trim();
}

function normalizeCustomerId(value) {
  return cleanString(value).replace(/^gid:\/\/shopify\/Customer\//, "");
}

function escapeFormulaString(value) {
  return String(value || "").replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

function escapeShopifySearchValue(value) {
  return String(value || "").replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

function airtableConfig() {
  const baseId = process.env.AIRTABLE_BASE_ID;
  const token = process.env.AIRTABLE_TOKEN;
  const tableName = "ConsultantClients";

  if (!baseId || !token) {
    throw new Error("Missing Airtable configuration");
  }

  return { baseId, token, tableName };
}

async function airtableRequest({ method = "GET", recordId, params, body, fetcher = fetch }) {
  const { baseId, token, tableName } = airtableConfig();
  const url = new URL(`https://api.airtable.com/v0/${baseId}/${encodeURIComponent(tableName)}${recordId ? `/${recordId}` : ""}`);

  if (params) {
    Object.entries(params).forEach(([key, value]) => {
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
  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    const error = new Error(data?.error?.message || data?.error || "Airtable request failed");
    error.status = response.status || 500;
    error.data = data;
    throw error;
  }

  return data;
}

function isUnknownAirtableFieldError(error) {
  const message = String(error?.data?.error?.message || error?.message || "").toLowerCase();
  return error?.data?.error?.type === "UNKNOWN_FIELD_NAME" || message.includes("unknown field name");
}

function removeOptionalShopifyClientFields(fields) {
  const nextFields = { ...fields };
  delete nextFields.ShopifyCustomerId;
  delete nextFields.ShopifyCustomerGid;
  return nextFields;
}

function serializeClient(record) {
  const fields = record?.fields || {};
  if (!record) return null;

  return {
    airtableRecordId: record.id,
    clientRecordId: cleanString(fields.ClientRecordId),
    consultantId: cleanString(fields.ConsultantId),
    firstName: cleanString(fields.FirstName),
    lastName: cleanString(fields.LastName),
    email: cleanString(fields.Email),
    paletteCode: cleanString(fields.AnalysisResultCode).toUpperCase(),
    paletteName: cleanString(fields.AnalysisResultLabel),
    notes: cleanString(fields.Notes),
    shopifyCustomerId: cleanString(fields.ShopifyCustomerId || fields.ShopifyCustomerID || fields.CustomerId),
    shopifyCustomerGid: cleanString(fields.ShopifyCustomerGid)
  };
}

function serializeCustomer(customer) {
  if (!customer) return null;

  return {
    id: normalizeCustomerId(customer.id),
    gid: customer.id,
    firstName: cleanString(customer.firstName),
    lastName: cleanString(customer.lastName),
    email: cleanString(customer.email),
    state: cleanString(customer.state),
    tags: Array.isArray(customer.tags) ? customer.tags : []
  };
}

async function getShopifyCustomerById(customerId) {
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

async function requireTradePaletteAccess(consultantId) {
  const customer = await getShopifyCustomerById(consultantId);
  const tags = (customer?.tags || []).map((tag) => cleanString(tag).toUpperCase());
  const julyCohortExpiresAt = new Date("2026-08-25T04:00:00.000Z");
  const hasTradeAccess =
    tags.includes("YCS_ADMIN") ||
    tags.includes("TRADE") ||
    (tags.includes("TRADEJULYCOHORT") && Date.now() < julyCohortExpiresAt.getTime());

  if (!customer || !hasTradeAccess) {
    const error = new Error("TRADE access is required to give customer palette access.");
    error.status = 403;
    throw error;
  }

  return customer;
}

export async function findClientForTrade({ consultantId, clientRecordId, fetcher = fetch }) {
  const safeConsultantId = cleanString(consultantId);
  const safeClientRecordId = cleanString(clientRecordId);

  if (!safeConsultantId || !safeClientRecordId) {
    throw new Error("Missing consultantId or clientRecordId");
  }

  const data = await airtableRequest({
    fetcher,
    params: {
      filterByFormula: `AND({ClientRecordId}="${escapeFormulaString(safeClientRecordId)}",{ConsultantId}="${escapeFormulaString(safeConsultantId)}")`,
      maxRecords: 1
    }
  });

  return serializeClient(data.records?.[0]);
}

async function updateClientShopifyLink({
  client,
  customer,
  paletteCode,
  paletteName,
  updateClientPalette = true,
  fetcher = fetch
}) {
  const fields = {
    Email: client.email || customer.email,
    ShopifyCustomerId: customer.id,
    ShopifyCustomerGid: customer.gid
  };
  if (updateClientPalette) {
    fields.AnalysisResultCode = paletteCode;
    fields.AnalysisResultLabel = paletteName;
  }

  try {
    const data = await airtableRequest({
      method: "PATCH",
      recordId: client.airtableRecordId,
      body: { fields, typecast: true },
      fetcher
    });
    return serializeClient(data);
  } catch (error) {
    if (!isUnknownAirtableFieldError(error)) throw error;
    const data = await airtableRequest({
      method: "PATCH",
      recordId: client.airtableRecordId,
      body: { fields: removeOptionalShopifyClientFields(fields), typecast: true },
      fetcher
    });
    return serializeClient(data);
  }
}

export async function findShopifyCustomerByEmail(email) {
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

async function createShopifyCustomerForClient({ client, paletteCode }) {
  const email = cleanString(client.email);
  if (!email) {
    throw new Error("Add the client's email before giving color palette access.");
  }

  const data = await shopifyAdminGraphQL({
    query: `
      mutation createCustomer($input: CustomerInput!) {
        customerCreate(input: $input) {
          customer {
            id
            firstName
            lastName
            email
            state
            tags
          }
          userErrors {
            field
            message
          }
        }
      }
    `,
    variables: {
      input: {
        email,
        firstName: cleanString(client.firstName),
        lastName: cleanString(client.lastName),
        tags: [paletteCode]
      }
    }
  });

  const userErrors = data.customerCreate?.userErrors || [];
  if (userErrors.length) {
    throw new Error(userErrors[0].message || "Unable to create Shopify customer");
  }

  return serializeCustomer(data.customerCreate?.customer);
}

async function addPaletteTagToCustomer({ customer, paletteCode }) {
  if ((customer.tags || []).some((tag) => cleanString(tag).toUpperCase() === paletteCode)) {
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

function shouldSendLegacyAccountInvite(customer) {
  const state = cleanString(customer?.state).toUpperCase();
  return Boolean(customer?.gid && customer?.email && (state === "DISABLED" || state === "INVITED"));
}

async function sendLegacyAccountInviteEmail(customer) {
  if (!shouldSendLegacyAccountInvite(customer)) {
    return {
      sent: false,
      skipped: true,
      reason: customer?.state ? `account_${cleanString(customer.state).toLowerCase()}` : "missing_customer"
    };
  }

  try {
    const data = await shopifyAdminGraphQL({
      query: `
        mutation sendCustomerAccountInvite($customerId: ID!) {
          customerSendAccountInviteEmail(customerId: $customerId) {
            customer {
              id
              email
              state
            }
            userErrors {
              field
              message
            }
          }
        }
      `,
      variables: {
        customerId: customer.gid
      }
    });

    const userErrors = data.customerSendAccountInviteEmail?.userErrors || [];
    if (userErrors.length) {
      return {
        sent: false,
        skipped: false,
        reason: "shopify_user_error",
        message: userErrors[0].message || "Unable to send account invite"
      };
    }

    return {
      sent: true,
      customer: serializeCustomer(data.customerSendAccountInviteEmail?.customer) || customer
    };
  } catch (error) {
    return {
      sent: false,
      skipped: false,
      reason: "shopify_request_failed",
      message: error.message || "Unable to send account invite"
    };
  }
}

async function findOrCreateShopifyCustomerForClient({ client, paletteCode }) {
  const existing = await findShopifyCustomerByEmail(client.email);
  if (existing) {
    return {
      customer: existing,
      createdCustomer: false
    };
  }

  const customer = await createShopifyCustomerForClient({ client, paletteCode });
  return {
    customer,
    createdCustomer: true
  };
}

export async function giveTradeClientPaletteAccess({
  consultantId,
  clientRecordId,
  paletteCode,
  paletteName,
  updateClientPalette = true,
  fetcher = fetch
}) {
  const safeConsultantId = cleanString(consultantId);
  const safePaletteCode = normalizePaletteCode(paletteCode);
  const safePaletteName = cleanString(paletteName) || PALETTE_NAMES[safePaletteCode] || safePaletteCode;

  if (!safeConsultantId) {
    throw new Error("Missing consultantId");
  }

  if (!safePaletteCode) {
    throw new Error("Select a valid color palette before giving customer access.");
  }

  await requireTradePaletteAccess(safeConsultantId);

  const client = await findClientForTrade({
    consultantId: safeConsultantId,
    clientRecordId,
    fetcher
  });

  if (!client) {
    const error = new Error("Client record not found");
    error.status = 404;
    throw error;
  }

  if (!client.email) {
    throw new Error("Add the client's email before giving color palette access.");
  }

  const existingUsageKey = `${safeConsultantId}__usage__palette_access__${client.clientRecordId}__${safePaletteCode}`;
  const startingBalance = await getTradePaletteCreditBalance({
    tradeCustomerId: safeConsultantId,
    fetcher
  });
  const alreadyRecordedUsage = startingBalance.events.some((event) => event.key === existingUsageKey);

  if (!alreadyRecordedUsage && startingBalance.balance < 1) {
    const error = new Error("You need at least 1 color palette credit to give a customer palette access.");
    error.status = 402;
    error.balance = startingBalance.balance;
    throw error;
  }

  const customerResult = await findOrCreateShopifyCustomerForClient({
    client,
    paletteCode: safePaletteCode
  });
  const tagResult = customerResult.createdCustomer
    ? { alreadyHadAccess: false, customer: customerResult.customer }
    : await addPaletteTagToCustomer({
        customer: customerResult.customer,
        paletteCode: safePaletteCode
      });
  const accountInvite = await sendLegacyAccountInviteEmail(tagResult.customer || customerResult.customer);
  const updatedClient = await updateClientShopifyLink({
    client,
    customer: tagResult.customer || customerResult.customer,
    paletteCode: safePaletteCode,
    paletteName: safePaletteName,
    updateClientPalette,
    fetcher
  });

  let usageEvent = null;
  let creditEventCreated = false;
  if (!tagResult.alreadyHadAccess) {
    const usageResult = await recordTradePaletteCreditEvent({
      tradeCustomerId: safeConsultantId,
      eventType: "usage",
      quantity: -1,
      sourceType: "palette_access",
      sourceId: client.clientRecordId,
      clientRecordId: client.clientRecordId,
      clientEmail: client.email,
      paletteCode: safePaletteCode,
      notes: `${safePaletteName} access for ${client.email}`,
      idempotencyKey: existingUsageKey,
      fetcher
    });
    usageEvent = usageResult.event;
    creditEventCreated = usageResult.created === true;
  }

  const endingBalance = await getTradePaletteCreditBalance({
    tradeCustomerId: safeConsultantId,
    fetcher
  });

  return {
    success: true,
    client: updatedClient,
    customer: tagResult.customer || customerResult.customer,
    paletteCode: safePaletteCode,
    paletteName: safePaletteName,
    createdCustomer: customerResult.createdCustomer,
    alreadyHadAccess: tagResult.alreadyHadAccess,
    accountInvite,
    creditUsed: creditEventCreated,
    creditEvent: usageEvent,
    balance: endingBalance.balance
  };
}
