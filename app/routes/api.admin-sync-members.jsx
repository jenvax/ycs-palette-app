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
  const response = await fetch(`https://${shop}/admin/api/2026-01/graphql.json`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Shopify-Access-Token": accessToken
    },
    body: JSON.stringify({ query, variables })
  });

  const json = await response.json();

  if (!response.ok || json.errors) {
    throw new Error(json.errors?.[0]?.message || "Shopify request failed");
  }

  return json.data;
}

async function fetchShopifyCustomers({ shop, accessToken }) {
  const query = `
    query getCustomers($cursor: String) {
      customers(first: 100, after: $cursor, query: "tag:VIP") {
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

  let customers = [];
  let cursor = null;
  let hasNextPage = true;

  while (hasNextPage) {
    const data = await shopifyAdminGraphQL({
      shop,
      accessToken,
      query,
      variables: { cursor }
    });

    const edges = data.customers.edges || [];

    edges.forEach((edge) => customers.push(edge.node));

    hasNextPage = data.customers.pageInfo.hasNextPage;
    cursor = hasNextPage ? edges[edges.length - 1]?.cursor : null;
  }

  return customers.map((c) => {
    const id = normalizeCustomerId(c.id);
    const tags = Array.isArray(c.tags) ? c.tags : [];
    const joinedDate = c.metafield?.value || "";

    return {
      customerId: id,
      firstName: c.firstName || "",
      lastName: c.lastName || "",
      email: c.email || "",
      tags,
      isVIP: tags.includes("VIP"),
      joinedDate: joinedDate ? String(joinedDate).trim() : ""
    };
  });
}

async function fetchAirtableRecords(baseId, table, token) {
  const url = `https://api.airtable.com/v0/${baseId}/${table}`;

  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` }
  });

  const data = await res.json();
  return data.records || [];
}

async function createRecord(baseId, table, token, fields) {
  await fetch(`https://api.airtable.com/v0/${baseId}/${table}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ fields })
  });
}

async function updateRecord(baseId, table, token, id, fields) {
  await fetch(`https://api.airtable.com/v0/${baseId}/${table}/${id}`, {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ fields })
  });
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

  try {
    const SHOP = process.env.SHOPIFY_SHOP;
    const TOKEN = process.env.SHOPIFY_ADMIN_ACCESS_TOKEN;
    const AIRTABLE_BASE = process.env.AIRTABLE_BASE_ID;
    const AIRTABLE_TOKEN = process.env.AIRTABLE_TOKEN;

    if (!SHOP || !TOKEN) {
      throw new Error("Missing Shopify credentials");
    }

    const shopifyCustomers = await fetchShopifyCustomers({
      shop: SHOP,
      accessToken: TOKEN
    });

    const airtableRecords = await fetchAirtableRecords(
      AIRTABLE_BASE,
      "CustomerDirectory",
      AIRTABLE_TOKEN
    );

    const airtableMap = {};
    airtableRecords.forEach((r) => {
      const id = normalizeCustomerId(r.fields.CustomerId);
      if (id) airtableMap[id] = r;
    });

    let created = 0;
    let updated = 0;
    let becameVIP = 0;
    let lostVIP = 0;

    const now = new Date().toISOString();

    for (const customer of shopifyCustomers) {
      const existing = airtableMap[customer.customerId];
      const previousVIP = parseTruthy(existing?.fields?.IsVIP);

      let status = "Inactive";
      if (customer.isVIP && customer.joinedDate) status = "Active";
      else if (customer.isVIP) status = "Legacy";

      const fields = {
        CustomerId: customer.customerId,
        FirstName: customer.firstName,
        LastName: customer.lastName,
        Email: customer.email,
        ShopifyTags: customer.tags.join(", "),
        IsVIP: customer.isVIP,
        MembershipStatus: status,
        LastSyncedAt: now
      };

      if (customer.joinedDate) {
        fields.JoinedDate = customer.joinedDate;
      }

      if (!existing) {
        fields.FirstSeenAt = now;
        if (customer.isVIP) fields.BecameVIPAt = now;

        await createRecord(AIRTABLE_BASE, "CustomerDirectory", AIRTABLE_TOKEN, fields);
        created++;
      } else {
        if (!previousVIP && customer.isVIP) {
          fields.BecameVIPAt = existing.fields.BecameVIPAt || now;
          becameVIP++;
        }

        if (previousVIP && !customer.isVIP) {
          fields.LostVIPAt = now;
          lostVIP++;
        }

        await updateRecord(
          AIRTABLE_BASE,
          "CustomerDirectory",
          AIRTABLE_TOKEN,
          existing.id,
          fields
        );

        updated++;
      }
    }

    return Response.json(
      {
        success: true,
        summary: { created, updated, becameVIP, lostVIP }
      },
      { headers: corsHeaders }
    );

  } catch (error) {
    console.error("SYNC ERROR:", error);

    return Response.json(
      { error: error.message },
      { status: 500, headers: corsHeaders }
    );
  }
}