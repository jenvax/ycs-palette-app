import { sessionStorage } from "../shopify.server.js";

function cleanString(value) {
  return String(value || "").trim();
}

export function normalizeShopifyNumericId(value, resourceName) {
  return cleanString(value).replace(new RegExp(`^gid://shopify/${resourceName}/`), "");
}

function shopifyConfig() {
  let shop = cleanString(process.env.SHOPIFY_SYNC_SHOP || process.env.SHOPIFY_SHOP)
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

function graphqlError(response, json) {
  const graphQLError = json.errors?.[0];
  const error = new Error(graphQLError?.message || json.error || "Shopify Admin GraphQL request failed");
  error.status = response.status || 500;
  error.shopifyErrors = json.errors || [];
  error.shopifyResponse = json;
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
  const json = await response.json().catch(() => ({}));

  if (!response.ok || json.errors) {
    throw graphqlError(response, json);
  }

  return json.data;
}

export async function shopifyAdminGraphQL({ query, variables = {} }) {
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
    const generatedAccessToken = await getGeneratedShopifyAccessToken(shop);
    return shopifyAdminGraphQLWithToken({
      shop,
      accessToken: generatedAccessToken,
      query,
      variables
    });
  } catch (error) {
    throw firstError || error;
  }
}
