async function getAccessToken({ shop, apiKey, apiSecret }) {
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
    throw new Error("Failed to generate Shopify access token");
  }

  return data.access_token;
}
const CUSTOMER_DIRECTORY_TABLE = "CustomerDirectory";

const PALETTE_TAGS = new Set([
  "CWL", "CWM", "CWD",
  "CCL", "CCM", "CCD",
  "SWL", "SWM", "SWD",
  "SCL", "SCM", "SCD",
  "LO", "MO", "DO",
  "CWLG", "CWMG", "CWDG",
  "SWLG", "SWMG", "SWDG"
]);

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
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Vary": "Origin"
  };
}

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

async function shopifyAdminGraphQL({ shop, accessToken, query, variables = {} }) {
  const response = await fetch(`https://${shop}/admin/api/2026-04/graphql.json`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Shopify-Access-Token": accessToken
    },
    body: JSON.stringify({ query, variables })
  });

  const json = await response.json().catch(() => ({}));

  if (!response.ok || json.errors) {
    throw new Error(json.errors?.[0]?.message || "Shopify Admin GraphQL request failed");
  }

  return json.data;
}

async function fetchShopifyCustomers({ shop, accessToken }) {
  const query = `
    query getCustomers($cursor: String) {
      customers(
        first: 100,
        after: $cursor,
        query: "tag:VIP"
      ) {
        edges {
          cursor
          node {
            id
            firstName
            lastName
            email
            tags
            metafield(namespace: "membership", key: "style_masters_start") {
              value
            }
          }
        }
        pageInfo {
          hasNextPage
        }
      }
    }
  `;

  const customers = [];
  let cursor = null;
  let hasNextPage = true;

  while (hasNextPage) {
    const data = await shopifyAdminGraphQL({
      shop,
      accessToken,
      query,
      variables: { cursor }
    });

    const edges = data.customers?.edges || [];
    edges.forEach((edge) => customers.push(edge.node));

    hasNextPage = Boolean(data.customers?.pageInfo?.hasNextPage);
    cursor = hasNextPage ? edges[edges.length - 1]?.cursor : null;
  }

  return customers
  .map((customer) => {
    const customerId = normalizeCustomerId(customer.id);
    const tags = Array.isArray(customer.tags) ? customer.tags : [];
    const normalizedTags = tags.map((tag) => String(tag).trim());
    const upperTags = normalizedTags.map((tag) => tag.toUpperCase());

    // 🚫 EXCLUDE ADMINS
    if (upperTags.includes("YCS_ADMIN")) {
      return null;
    }

    const paletteTags = normalizedTags.filter((tag) =>
      PALETTE_TAGS.has(String(tag).toUpperCase())
    );

    const joinedDate = customer.metafield?.value
      ? String(customer.metafield.value).trim()
      : "";

    return {
      customerId,
      firstName: String(customer.firstName || "").trim(),
      lastName: String(customer.lastName || "").trim(),
      email: String(customer.email || "").trim(),
      tags: normalizedTags,
      paletteTags,
      isVIP: upperTags.includes("VIP"),
      joinedDate
    };
  })
  .filter(Boolean);
}

async function airtableRequest({ baseId, tableName, token, method = "GET", recordId, body }) {
  const encodedTable = encodeURIComponent(tableName);
  const url = recordId
    ? `https://api.airtable.com/v0/${baseId}/${encodedTable}/${recordId}`
    : `https://api.airtable.com/v0/${baseId}/${encodedTable}`;

  const response = await fetch(url, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json"
    },
    body: body ? JSON.stringify(body) : undefined
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data?.error?.message || "Airtable request failed");
  }

  return data;
}

async function fetchAllAirtableRecords({ baseId, tableName, token }) {
  let records = [];
  let offset = "";

  while (true) {
    const params = new URLSearchParams();

    if (offset) {
      params.set("offset", offset);
    }

    const encodedTable = encodeURIComponent(tableName);
    const url = `https://api.airtable.com/v0/${baseId}/${encodedTable}?${params.toString()}`;

    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${token}`
      }
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data?.error?.message || "Failed to fetch Airtable records");
    }

    records = records.concat(data.records || []);

    if (!data.offset) break;
    offset = data.offset;
  }

  return records;
}

async function createAirtableRecord({ baseId, tableName, token, fields }) {
  const data = await airtableRequest({
    baseId,
    tableName,
    token,
    method: "POST",
    body: {
      records: [{ fields }]
    }
  });

  return data.records?.[0] || null;
}

async function updateAirtableRecord({ baseId, tableName, token, recordId, fields }) {
  return airtableRequest({
    baseId,
    tableName,
    token,
    recordId,
    method: "PATCH",
    body: { fields }
  });
}

async function syncCustomerDirectory({ shop, accessToken, baseId, token }) {
  const nowIso = new Date().toISOString();

  const [shopifyCustomers, airtableRecords] = await Promise.all([
    fetchShopifyCustomers({ shop, accessToken }),
    fetchAllAirtableRecords({
      baseId,
      tableName: CUSTOMER_DIRECTORY_TABLE,
      token
    })
  ]);

  const airtableByCustomerId = new Map();

  airtableRecords.forEach((record) => {
    const customerId = normalizeCustomerId(record?.fields?.CustomerId);
    if (customerId) {
      airtableByCustomerId.set(customerId, record);
    }
  });

  const seenCustomerIds = new Set();

  let created = 0;
  let updated = 0;
  let becameVIP = 0;
  let lostVIP = 0;
  let legacyVIP = 0;
  let unchanged = 0;

  for (const customer of shopifyCustomers) {
    seenCustomerIds.add(customer.customerId);

    const existing = airtableByCustomerId.get(customer.customerId);
    const existingFields = existing?.fields || {};

    const previousIsVIP = String(existingFields.IsVIP) === "1";
    const currentIsVIP = Boolean(customer.isVIP);

    let membershipStatus = currentIsVIP ? "Active" : "Inactive";

const fieldsToWrite = {
  CustomerId: customer.customerId,
  Email: customer.email,
  FirstName: customer.firstName,
  LastName: customer.lastName,
  Tags: customer.tags.join(", "),
  PaletteTags: customer.paletteTags.join(", "),
  MembershipStatus: membershipStatus,
  LastSyncedAt: nowIso
};

   if (customer.joinedDate) {
  const joinedDate = new Date(customer.joinedDate);

  if (!Number.isNaN(joinedDate.getTime())) {
    fieldsToWrite.JoinedDate = joinedDate.toISOString().split("T")[0];
  }
}


    if (!existing) {
      fieldsToWrite.FirstSeenAt = nowIso;

      if (currentIsVIP) {
        fieldsToWrite.BecameVIPAt = nowIso;
      }

      await createAirtableRecord({
        baseId,
        tableName: CUSTOMER_DIRECTORY_TABLE,
        token,
        fields: fieldsToWrite
      });

      created += 1;
      continue;
    }

    if (!previousIsVIP && currentIsVIP) {
      fieldsToWrite.BecameVIPAt = existingFields.BecameVIPAt || nowIso;
      fieldsToWrite.LostVIPAt = null;
      becameVIP += 1;
    }

    if (previousIsVIP && !currentIsVIP) {
      fieldsToWrite.LostVIPAt = nowIso;
      lostVIP += 1;
    }

    const comparison = [
      [String(existingFields.Email || ""), fieldsToWrite.Email],
      [String(existingFields.FirstName || ""), fieldsToWrite.FirstName],
      [String(existingFields.LastName || ""), fieldsToWrite.LastName],
      [String(existingFields.Tags || ""), fieldsToWrite.Tags],
      [String(existingFields.PaletteTags || ""), fieldsToWrite.PaletteTags],
      [parseTruthy(existingFields.HasPaletteAccess), fieldsToWrite.HasPaletteAccess],
      [String(existingFields.MembershipStatus || ""), fieldsToWrite.MembershipStatus],
      [String(existingFields.JoinedDate || ""), String(fieldsToWrite.JoinedDate || "")]
    ];

    const changed = comparison.some(([oldValue, newValue]) => String(oldValue) !== String(newValue));

    if (changed || (!previousIsVIP && currentIsVIP) || (previousIsVIP && !currentIsVIP)) {
      await updateAirtableRecord({
        baseId,
        tableName: CUSTOMER_DIRECTORY_TABLE,
        token,
        recordId: existing.id,
        fields: fieldsToWrite
      });

      updated += 1;
    } else {
  await updateAirtableRecord({
    baseId,
    tableName: CUSTOMER_DIRECTORY_TABLE,
    token,
    recordId: existing.id,
    fields: {
      LastSyncedAt: nowIso
    }
  });

  unchanged += 1;
}
  }

  for (const record of airtableRecords) {
    const fields = record.fields || {};
    const customerId = normalizeCustomerId(fields.CustomerId);

    if (!customerId || seenCustomerIds.has(customerId)) continue;

    const wasVIP = parseTruthy(fields.IsVIP);

    if (wasVIP) {
  const existingTags = String(fields.Tags || "")
    .split(",")
    .map((tag) => tag.trim())
    .filter(Boolean);

  const updatedTags = existingTags
    .filter((tag) => tag.toUpperCase() !== "VIP")
    .join(", ");

  await updateAirtableRecord({
    baseId,
    tableName: CUSTOMER_DIRECTORY_TABLE,
    token,
    recordId: record.id,
    fields: {
      Tags: updatedTags,
      MembershipStatus: "Inactive",
      LostVIPAt: nowIso,
      LastSyncedAt: nowIso
    }
  });

  lostVIP += 1;
  updated += 1;
} else {
  await updateAirtableRecord({
    baseId,
    tableName: CUSTOMER_DIRECTORY_TABLE,
    token,
    recordId: record.id,
    fields: {
      MembershipStatus: "Inactive",
      LastSyncedAt: nowIso
    }
  });

  unchanged += 1;
}
  }

  return {
    created,
    updated,
    becameVIP,
    lostVIP,
    legacyVIP,
    unchanged,
    totalShopifyCustomersFound: shopifyCustomers.length,
    totalAirtableRecordsChecked: airtableRecords.length
  };
}

export async function loader({ request }) {
  const origin = request.headers.get("Origin") || "";

  return new Response(null, {
    status: 204,
    headers: getCorsHeaders(origin)
  });
}

export async function action({ request }) {
  const origin = request.headers.get("Origin") || "";
  const corsHeaders = getCorsHeaders(origin);

  if (request.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: corsHeaders
    });
  }

  try {
    const body = await request.json();
    const isAdmin = body?.isAdmin === true || String(body?.isAdmin || "") === "true";

    if (!isAdmin) {
      return Response.json(
        { error: "Admin access required" },
        { status: 403, headers: corsHeaders }
      );
    }

    const SHOPIFY_SHOP = process.env.SHOPIFY_SYNC_SHOP || process.env.SHOPIFY_SHOP;
    const SHOPIFY_ADMIN_ACCESS_TOKEN = process.env.SHOPIFY_ADMIN_ACCESS_TOKEN;
    const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID;
    const AIRTABLE_TOKEN = process.env.AIRTABLE_TOKEN;

    if (!SHOPIFY_SHOP) {
      return Response.json(
        {
          error: "Missing Shopify shop configuration",
          missing: {
            SHOPIFY_SHOP: true
          }
        },
        { status: 500, headers: corsHeaders }
      );
    }

    if (!AIRTABLE_BASE_ID || !AIRTABLE_TOKEN) {
      return Response.json(
        {
          error: "Missing Airtable configuration",
          missing: {
            AIRTABLE_BASE_ID: !AIRTABLE_BASE_ID,
            AIRTABLE_TOKEN: !AIRTABLE_TOKEN
          }
        },
        { status: 500, headers: corsHeaders }
      );
    }

    let accessToken = SHOPIFY_ADMIN_ACCESS_TOKEN;

    if (!accessToken) {
      const apiSecret = process.env.SHOPIFY_API_SECRET || process.env.SHOPIFY_API_TOKEN;

      if (!process.env.SHOPIFY_API_KEY || !apiSecret) {
        return Response.json(
          {
            error: "Missing Shopify admin configuration",
            missing: {
              SHOPIFY_ADMIN_ACCESS_TOKEN: true,
              SHOPIFY_API_KEY: !process.env.SHOPIFY_API_KEY,
              SHOPIFY_API_SECRET_OR_TOKEN: !apiSecret
            }
          },
          { status: 500, headers: corsHeaders }
        );
      }

      accessToken = await getAccessToken({
        shop: SHOPIFY_SHOP,
        apiKey: process.env.SHOPIFY_API_KEY,
        apiSecret
      });
    }

    const summary = await syncCustomerDirectory({
      shop: SHOPIFY_SHOP,
      accessToken,
      baseId: AIRTABLE_BASE_ID,
      token: AIRTABLE_TOKEN
    });

    return Response.json(
      {
        success: true,
        summary
      },
      { status: 200, headers: corsHeaders }
    );
  } catch (error) {
    console.error("admin-sync-members failed:", error);

    return Response.json(
      {
        error: error.message || "Sync failed"
      },
      { status: 500, headers: corsHeaders }
    );
  }
}
