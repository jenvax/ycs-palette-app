import { unauthenticated } from "../shopify.server";

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

async function shopifyAdminGraphQL({ shop, query, variables = {} }) {
  const { admin } = await unauthenticated.admin(shop);

  const response = await admin.graphql(query, { variables });
  const json = await response.json();

  if (json.errors) {
    throw new Error(json.errors?.[0]?.message || "Shopify request failed");
  }

  return json.data;
}

async function fetchShopifyCustomers({ shop }) {
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
      query,
      variables: { cursor }
    });

    const edges = data.customers.edges || [];

    edges.forEach((edge) => customers.push(edge.node));

    hasNextPage = data.customers.pageInfo.hasNextPage;
    cursor = hasNextPage ? edges[edges.length - 1]?.cursor : null;
  }

  return customers.map((customer) => {
    const customerId = normalizeCustomerId(customer.id);
    const tags = Array.isArray(customer.tags) ? customer.tags : [];
    const joinedDate = customer.metafield?.value
      ? String(customer.metafield.value).trim()
      : "";

    return {
      customerId,
      firstName: String(customer.firstName || "").trim(),
      lastName: String(customer.lastName || "").trim(),
      email: String(customer.email || "").trim(),
      tags,
      isVIP: tags.includes("VIP"),
      joinedDate
    };
  });
}

async function fetchAirtableRecords(baseId, table, token) {
  let records = [];
  let offset = "";

  while (true) {
    const url = new URL(`https://api.airtable.com/v0/${baseId}/${table}`);
    if (offset) url.searchParams.set("offset", offset);

    const res = await fetch(url.toString(), {
      headers: {
        Authorization: `Bearer ${token}`
      }
    });

    const data = await res.json();

    if (!res.ok) {
      throw new Error(data?.error?.message || "Failed to fetch Airtable records");
    }

    records = records.concat(data.records || []);

    if (!data.offset) break;
    offset = data.offset;
  }

  return records;
}

async function createRecord(baseId, table, token, fields) {
  const res = await fetch(`https://api.airtable.com/v0/${baseId}/${table}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ fields })
  });

  const data = await res.json();

  if (!res.ok) {
    throw new Error(data?.error?.message || "Failed to create Airtable record");
  }

  return data;
}

async function updateRecord(baseId, table, token, id, fields) {
  const res = await fetch(`https://api.airtable.com/v0/${baseId}/${table}/${id}`, {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ fields })
  });

  const data = await res.json();

  if (!res.ok) {
    throw new Error(data?.error?.message || "Failed to update Airtable record");
  }

  return data;
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
    const body = await request.json();
    const isAdmin = body?.isAdmin === true || String(body?.isAdmin || "") === "true";

    if (!isAdmin) {
      return Response.json(
        { error: "Admin access required" },
        { status: 403, headers: corsHeaders }
      );
    }

    const SHOP = process.env.SHOPIFY_SHOP;
    const AIRTABLE_BASE = process.env.AIRTABLE_BASE_ID;
    const AIRTABLE_TOKEN = process.env.AIRTABLE_TOKEN;

    if (!SHOP) {
      return Response.json(
        { error: "Missing SHOPIFY_SHOP" },
        { status: 500, headers: corsHeaders }
      );
    }

    if (!AIRTABLE_BASE || !AIRTABLE_TOKEN) {
      return Response.json(
        { error: "Missing Airtable configuration" },
        { status: 500, headers: corsHeaders }
      );
    }

    const shopifyCustomers = await fetchShopifyCustomers({ shop: SHOP });
    const airtableRecords = await fetchAirtableRecords(
      AIRTABLE_BASE,
      "CustomerDirectory",
      AIRTABLE_TOKEN
    );

    const airtableMap = {};
    airtableRecords.forEach((record) => {
      const customerId = normalizeCustomerId(record?.fields?.CustomerId);
      if (customerId) {
        airtableMap[customerId] = record;
      }
    });

    let created = 0;
    let updated = 0;
    let becameVIP = 0;
    let lostVIP = 0;
    let legacyVIP = 0;

    const now = new Date().toISOString();
    const seenCustomerIds = new Set();

    for (const customer of shopifyCustomers) {
      seenCustomerIds.add(customer.customerId);

      const existing = airtableMap[customer.customerId];
      const previousVIP = parseTruthy(existing?.fields?.IsVIP);

      let membershipStatus = "Inactive";
      if (customer.isVIP && customer.joinedDate) membershipStatus = "Active";
      else if (customer.isVIP) membershipStatus = "Legacy";

      if (membershipStatus === "Legacy") {
        legacyVIP += 1;
      }

      const fields = {
        CustomerId: customer.customerId,
        FirstName: customer.firstName,
        LastName: customer.lastName,
        Email: customer.email,
        ShopifyTags: customer.tags.join(", "),
        IsVIP: customer.isVIP,
        MembershipStatus: membershipStatus,
        LastSyncedAt: now
      };

      if (customer.joinedDate) {
        fields.JoinedDate = customer.joinedDate;
      }

      if (!existing) {
        fields.FirstSeenAt = now;

        if (customer.isVIP) {
          fields.BecameVIPAt = now;
        }

        await createRecord(AIRTABLE_BASE, "CustomerDirectory", AIRTABLE_TOKEN, fields);
        created += 1;
        continue;
      }

      if (!previousVIP && customer.isVIP) {
        fields.BecameVIPAt = existing.fields?.BecameVIPAt || now;
        fields.LostVIPAt = null;
        becameVIP += 1;
      }

      if (previousVIP && !customer.isVIP) {
        fields.LostVIPAt = now;
        lostVIP += 1;
      }

      await updateRecord(
        AIRTABLE_BASE,
        "CustomerDirectory",
        AIRTABLE_TOKEN,
        existing.id,
        fields
      );

      updated += 1;
    }

    for (const record of airtableRecords) {
      const customerId = normalizeCustomerId(record?.fields?.CustomerId);
      if (!customerId || seenCustomerIds.has(customerId)) continue;

      const wasVIP = parseTruthy(record?.fields?.IsVIP);

      if (wasVIP) {
        await updateRecord(
          AIRTABLE_BASE,
          "CustomerDirectory",
          AIRTABLE_TOKEN,
          record.id,
          {
            IsVIP: false,
            MembershipStatus: "Inactive",
            LostVIPAt: now,
            LastSyncedAt: now
          }
        );

        lostVIP += 1;
        updated += 1;
      }
    }

    return Response.json(
      {
        success: true,
        summary: {
          created,
          updated,
          becameVIP,
          lostVIP,
          legacyVIP
        }
      },
      { status: 200, headers: corsHeaders }
    );
  } catch (error) {
    console.error("SYNC ERROR:", error);

    return Response.json(
      { error: error.message || "Sync failed" },
      { status: 500, headers: corsHeaders }
    );
  }
}