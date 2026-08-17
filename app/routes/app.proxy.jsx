import {
  getDrapingRecencyBucket,
  getDrapingRecencyBuckets,
  isDueForDraping
} from "../services/draping-stats.server.js";
import { validateClientPaletteAccessToken } from "../services/trade-client-palette-links.server.js";
import { createTradePaletteAccessToken } from "../services/trade-palette-access-token.server.js";
import { giveTradeClientPaletteAccess } from "../services/trade-palette-access.server.js";
import { authenticate } from "../shopify.server";
import crypto from "node:crypto";

function normalizeField(value) {
  if (Array.isArray(value)) return value[0] || "";
  return value || "";
}

function normalizeList(value) {
  if (Array.isArray(value)) return value;
  if (!value) return [];
  return [value];
}

function normalizeHex(value) {
  return String(value || "").trim().toLowerCase();
}

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function escapeFormulaValue(value) {
  return String(value || "")
    .replace(/\\/g, "\\\\")
    .replace(/"/g, '\\"');
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

const PALETTE_TAGS = new Set([
  "CWL", "CWM", "CWD",
  "CCL", "CCM", "CCD",
  "SWL", "SWM", "SWD",
  "SCL", "SCM", "SCD",
  "LO", "MO", "DO",
  "CWLG", "CWMG", "CWDG",
  "SWLG", "SWMG", "SWDG"
]);

const CUSTOM_PALETTE_PREFIX = "CUSTOM_";
const STYLE_MASTERS_OWNER_ID = "STYLE_MASTERS";

function isCustomPaletteCode(value) {
  return String(value || "").trim().toUpperCase().startsWith(CUSTOM_PALETTE_PREFIX);
}

function customPaletteIdFromCode(value) {
  return String(value || "").trim().replace(/^CUSTOM_/i, "").toLowerCase();
}

async function removeBackgroundImage({ imageBase64, apiKey }) {
  if (!imageBase64) {
    throw new Error("Missing imageBase64");
  }

  const base64Data = imageBase64.replace(/^data:image\/\w+;base64,/, "");
  const imageBuffer = Buffer.from(base64Data, "base64");

  const formData = new FormData();
  const blob = new Blob([imageBuffer], { type: "image/png" });

  formData.append("image_file", blob, "upload.png");
  formData.append("size", "auto");

  const response = await fetch("https://api.remove.bg/v1.0/removebg", {
    method: "POST",
    headers: {
      "X-Api-Key": apiKey,
    },
    body: formData,
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(errorText || "Background removal failed");
  }

  const arrayBuffer = await response.arrayBuffer();
  const resultBase64 = Buffer.from(arrayBuffer).toString("base64");

  return `data:image/png;base64,${resultBase64}`;
}

async function airtableFetchJson(url, token, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data?.error?.message || "Airtable request failed");
  }

  return data;
}

async function fetchAllAirtableRecords({ baseId, tableName, token, sortField, formula }) {
  const params = new URLSearchParams();

  if (sortField) {
    params.set("sort[0][field]", sortField);
    params.set("sort[0][direction]", "asc");
  }

  if (formula) {
    params.set("filterByFormula", formula);
  }

  let allRecords = [];
  let offset = "";

  while (true) {
    const pageParams = new URLSearchParams(params);
    if (offset) {
      pageParams.set("offset", offset);
    }

    const pageUrl = `https://api.airtable.com/v0/${baseId}/${encodeURIComponent(
      tableName
    )}?${pageParams.toString()}`;

    const data = await airtableFetchJson(pageUrl, token);

    allRecords = allRecords.concat(data.records || []);

    if (!data.offset) break;
    offset = data.offset;
  }

  return allRecords;
}

async function fetchStyleMastersCustomPalette({ baseId, token, paletteId, includeHidden = false }) {
  const escapedPaletteId = escapeFormulaValue(paletteId);
  const ownerFilter = `{OwnerCustomerId}="${STYLE_MASTERS_OWNER_ID}"`;
  const paletteRecords = await fetchAllAirtableRecords({
    baseId,
    tableName: "CustomPalettes",
    token,
    formula: `AND(${ownerFilter}, {PaletteId}="${escapedPaletteId}")`
  });
  const paletteRecord = paletteRecords[0];

  if (!paletteRecord) {
    const error = new Error("Custom palette not found");
    error.status = 404;
    throw error;
  }

  const paletteFields = paletteRecord.fields || {};
  if (!includeHidden && !parseTruthy(paletteFields.VisibleToVip)) {
    const error = new Error("Custom palette not found");
    error.status = 404;
    throw error;
  }

  const [joinRecords, colorRecords] = await Promise.all([
    fetchAllAirtableRecords({
      baseId,
      tableName: "CustomPaletteColors",
      token,
      formula: `AND(${ownerFilter}, {PaletteId}="${escapedPaletteId}")`
    }),
    fetchAllAirtableRecords({
      baseId,
      tableName: "CustomColors",
      token,
      formula: ownerFilter
    })
  ]);
  const colorById = new Map(
    colorRecords.map((record) => [record.fields?.ColorId, record.fields || {}])
  );

  const colors = joinRecords
    .map((record) => {
      const fields = record.fields || {};
      const colorFields = colorById.get(fields.ColorId);
      if (!colorFields) return null;

      return {
        name: normalizeField(colorFields.Name),
        hex: normalizeField(colorFields.HexCode),
        sortOrder: Number(fields.DisplayOrder || 0) + 1,
        category: "Custom",
        categories: ["Custom"],
        paletteCodes: `CUSTOM_${paletteId}`,
        chroma: "",
        temperature: "",
        depth: "",
        isBest: false,
        isNeutral: false,
        neutralDepth: "",
        neutralFamily: ""
      };
    })
    .filter((color) => color && color.name && color.hex)
    .sort((a, b) => a.sortOrder - b.sortOrder);

  return {
    paletteName: normalizeField(paletteFields.Name) || "Style Masters Color Palette",
    colors
  };
}

async function fetchStyleMastersCustomPaletteList({ baseId, token, includeHidden = false }) {
  const ownerFilter = `{OwnerCustomerId}="${STYLE_MASTERS_OWNER_ID}"`;
  const paletteRecords = await fetchAllAirtableRecords({
    baseId,
    tableName: "CustomPalettes",
    token,
    formula: includeHidden
      ? ownerFilter
      : `AND(${ownerFilter}, {VisibleToVip}=TRUE())`
  });

  return paletteRecords
    .map((record) => {
      const fields = record.fields || {};
      const id = normalizeField(fields.PaletteId) || record.id;
      if (!id) return null;

      return {
        id,
        name: normalizeField(fields.Name) || "Style Masters Color Palette",
        visibleToVip: parseTruthy(fields.VisibleToVip)
      };
    })
    .filter(Boolean);
}

async function createAirtableRecord({ baseId, tableName, token, fields }) {
  const url = `https://api.airtable.com/v0/${baseId}/${encodeURIComponent(tableName)}`;

  const data = await airtableFetchJson(url, token, {
    method: "POST",
    body: JSON.stringify({
      records: [{ fields }],
    }),
  });

  return data.records?.[0] || null;
}

async function updateAirtableRecord({ baseId, tableName, token, recordId, fields }) {
  const url = `https://api.airtable.com/v0/${baseId}/${encodeURIComponent(tableName)}/${recordId}`;

  return airtableFetchJson(url, token, {
    method: "PATCH",
    body: JSON.stringify({ fields }),
  });
}

async function deleteAirtableRecord({ baseId, tableName, token, recordId }) {
  const url = `https://api.airtable.com/v0/${baseId}/${encodeURIComponent(
    tableName
  )}/${recordId}`;

  return airtableFetchJson(url, token, {
    method: "DELETE",
  });
}

async function getAirtableRecord({ baseId, tableName, token, recordId }) {
  const url = `https://api.airtable.com/v0/${baseId}/${encodeURIComponent(
    tableName
  )}/${recordId}`;

  return airtableFetchJson(url, token);
}

function normalizeAirtableIdList(value) {
  const list = Array.isArray(value) ? value : [value];
  return [...new Set(list.map((item) => String(item || "").trim()).filter(Boolean))];
}

function verifyAppProxySignature(url, sharedSecret) {
  if (!sharedSecret) return false;

  const providedSignature = String(url.searchParams.get("signature") || "").trim();
  const timestamp = Number(url.searchParams.get("timestamp") || 0);
  const now = Math.floor(Date.now() / 1000);

  if (!providedSignature || !timestamp || Math.abs(now - timestamp) > 600) {
    return false;
  }

  const paramsByKey = new Map();
  url.searchParams.forEach((value, key) => {
    if (key === "signature") return;
    const values = paramsByKey.get(key) || [];
    values.push(value);
    paramsByKey.set(key, values);
  });

  const message = Array.from(paramsByKey.entries())
    .map(([key, values]) => `${key}=${values.join(",")}`)
    .sort()
    .join("");

  const calculatedSignature = crypto
    .createHmac("sha256", sharedSecret)
    .update(message)
    .digest("hex");

  try {
    return crypto.timingSafeEqual(
      Buffer.from(providedSignature, "utf8"),
      Buffer.from(calculatedSignature, "utf8")
    );
  } catch {
    return false;
  }
}

function firstSavedDrapedField(fields, names) {
  for (const name of names) {
    const value = fields?.[name];
    if (value !== undefined && value !== null && String(value).trim() !== "") {
      return String(value).trim();
    }
  }

  return "";
}

async function getFavorites({ customerId, paletteCode, baseId, tableName, token }) {
  const formula = `AND({CustomerId}="${escapeFormulaValue(
    customerId
  )}",{PaletteCode}="${escapeFormulaValue(paletteCode)}")`;

  const records = await fetchAllAirtableRecords({
    baseId,
    tableName,
    token,
    formula,
  });

  return records
    .map((record) => normalizeField(record.fields?.Hex))
    .filter(Boolean)
    .map(normalizeHex);
}

async function toggleFavorite({
  customerId,
  paletteCode,
  colorName,
  hex,
  baseId,
  tableName,
  token,
}) {
  const normalizedHex = normalizeHex(hex);
  const favoriteKey = `${customerId}__${paletteCode}__${normalizedHex}`;

  const formula = `{FavoriteKey}="${escapeFormulaValue(favoriteKey)}"`;

  const existing = await fetchAllAirtableRecords({
    baseId,
    tableName,
    token,
    formula,
  });

  if (existing.length > 0) {
    await deleteAirtableRecord({
      baseId,
      tableName,
      token,
      recordId: existing[0].id,
    });

    return { success: true, isFavorite: false };
  }

  await createAirtableRecord({
    baseId,
    tableName,
    token,
    fields: {
      CustomerId: String(customerId),
      PaletteCode: String(paletteCode),
      ColorName: String(colorName || ""),
      Hex: String(hex || ""),
      FavoriteKey: favoriteKey,
    },
  });

  return { success: true, isFavorite: true };
}

async function fetchCustomerPhotoMap({ baseId, token }) {
  const records = await fetchAllAirtableRecords({
    baseId,
    tableName: "CustomerPhotos",
    token
  });

  const photoMap = {};

  records.forEach((record) => {
    const customerId = normalizeCustomerId(record?.fields?.CustomerId);
    const photoUrl = String(record?.fields?.PhotoUrl || "").trim();

    if (customerId) {
      photoMap[customerId] = photoUrl || null;
    }
  });

  return photoMap;
}
async function ensurePersonalPhotoFromCustomerPhoto({
  baseId,
  token,
  customerPhotoRecord,
  existingPersonalPhotos
}) {
  const f = customerPhotoRecord.fields || {};
  const customerId = normalizeCustomerId(f.CustomerId);

  if (!customerId) return null;

  const activePhotoUrl =
    f.ActivePhotoUrl ||
    f.AdjustedPhotoUrl ||
    f.PhotoUrl ||
    f.OriginalPhotoUrl ||
    null;

  if (!activePhotoUrl) return null;

  const existingPersonalRecord =
  existingPersonalPhotos.find((record) => {
    const pf = record.fields || {};
    const personalCustomerId = normalizeCustomerId(pf.CustomerId);

    const personalUrl =
      pf.ActivePhotoUrl ||
      pf.AdjustedPhotoUrl ||
      pf.PhotoUrl ||
      pf.OriginalPhotoUrl ||
      null;

    return (
      personalCustomerId === customerId &&
      String(personalUrl || "") === String(activePhotoUrl || "")
    );
  });

if (existingPersonalRecord) {
  const pf = existingPersonalRecord.fields || {};
  const fieldsToPatch = {};

  if (!pf.LipMaskJson && f.LipMaskJson) {
    fieldsToPatch.LipMaskJson = f.LipMaskJson;
  }

  if (!pf.PhotoTransform && f.PhotoTransform) {
    fieldsToPatch.PhotoTransform = f.PhotoTransform;
  }

  if (!pf.PhotoTransformJson && f.PhotoTransformJson) {
    fieldsToPatch.PhotoTransformJson = f.PhotoTransformJson;
  }

  if (Object.keys(fieldsToPatch).length) {
    await updateAirtableRecord({
      baseId,
      tableName: "PersonalStudioPhotos",
      token,
      recordId: existingPersonalRecord.id,
      fields: fieldsToPatch
    });

    Object.assign(existingPersonalRecord.fields, fieldsToPatch);
  }

  return null;
}

  const photoId = `psp_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

  const fields = {
    CustomerId: customerId,
    PhotoId: photoId,
    OriginalPhotoUrl: f.OriginalPhotoUrl || f.PhotoUrl || activePhotoUrl,
    AdjustedPhotoUrl: f.AdjustedPhotoUrl || "",
    ActivePhotoUrl: activePhotoUrl
  
  };

  if (f.PhotoTransform) fields.PhotoTransform = f.PhotoTransform;
  if (f.PhotoTransformJson) fields.PhotoTransformJson = f.PhotoTransformJson;
  if (f.LipMaskJson) fields.LipMaskJson = f.LipMaskJson;

  const created = await createAirtableRecord({
    baseId,
    tableName: "PersonalStudioPhotos",
    token,
    fields
  });

  return created;
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
    throw new Error(json.errors?.[0]?.message || "Shopify Admin GraphQL request failed");
  }

  return json.data;
}

async function fetchShopifyCustomersForDirectoryByQuery({ shop, accessToken, customerQuery }) {
  const query = `
    query getCustomers($cursor: String, $customerQuery: String!) {
      customers(first: 100, after: $cursor, query: $customerQuery) {
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
      variables: { cursor, customerQuery }
    });

    const edges = data.customers.edges || [];
    edges.forEach((edge) => customers.push(edge.node));

    hasNextPage = data.customers.pageInfo.hasNextPage;
    cursor = hasNextPage ? edges[edges.length - 1]?.cursor : null;
  }

  return customers;
}

async function fetchShopifyCustomersForDirectory({ shop, accessToken }) {
  const customersById = new Map();
  const customerGroups = await Promise.all([
    fetchShopifyCustomersForDirectoryByQuery({ shop, accessToken, customerQuery: "tag:VIP" }),
    fetchShopifyCustomersForDirectoryByQuery({ shop, accessToken, customerQuery: "tag:YCS_ADMIN" })
  ]);

  customerGroups.flat().forEach((customer) => {
    const customerId = normalizeCustomerId(customer.id);
    if (customerId) customersById.set(customerId, customer);
  });

  return Array.from(customersById.values()).map((customer) => {
    const customerId = normalizeCustomerId(customer.id);
    const tags = Array.isArray(customer.tags) ? customer.tags : [];
    const joinedDate = customer.metafield?.value ? String(customer.metafield.value).trim() : "";

    const paletteTags = tags.filter((tag) => PALETTE_TAGS.has(String(tag).toUpperCase().trim()));
    const isVIP = tags.includes("VIP");
    const isAdmin = tags.some((tag) => String(tag).trim().toUpperCase() === "YCS_ADMIN");

    let name = `${customer.firstName || ""} ${customer.lastName || ""}`.trim();
    if (!name && customer.email) name = customer.email.split("@")[0];
    if (!name) name = `Customer ${customerId}`;

    return {
  customerId,
  firstName: String(customer.firstName || "").trim(),
  lastName: String(customer.lastName || "").trim(),
  name,
  email: String(customer.email || "").trim(),
  tags,
  paletteTags,
  isVIP,
  isAdmin,
  joinedDate
};
  });
}

async function syncCustomerDirectoryFromShopify({ shop, accessToken, baseId, token }) {
  const nowIso = new Date().toISOString();

  const [shopifyCustomers, directoryRecords] = await Promise.all([
    fetchShopifyCustomersForDirectory({ shop, accessToken }),
    fetchAllAirtableRecords({
      baseId,
      tableName: "CustomerDirectory",
      token,
      sortField: "LastName"
    })
  ]);

  const directoryByCustomerId = new Map();

  directoryRecords.forEach((record) => {
    const fields = record.fields || {};
    const customerId = normalizeCustomerId(fields.CustomerId);
    if (!customerId) return;
    directoryByCustomerId.set(customerId, record);
  });

  const seenIds = new Set();

  let created = 0;
  let updated = 0;
  let becameVIP = 0;
  let lostVIP = 0;
  let legacyVIP = 0;
  let unchanged = 0;

  for (const customer of shopifyCustomers) {
    seenIds.add(customer.customerId);

    const existing = directoryByCustomerId.get(customer.customerId);
    const existingFields = existing?.fields || {};

    const previousIsVIP = parseTruthy(existingFields.IsVIP);
    const currentIsVIP = customer.isVIP;

    const currentIsAdmin = Boolean(customer.isAdmin);
    let membershipStatus = "Unknown";
    if (currentIsAdmin) membershipStatus = "Active";
    else if (currentIsVIP && customer.joinedDate) membershipStatus = "Active";
    else if (currentIsVIP && !customer.joinedDate) membershipStatus = "Legacy";
    else membershipStatus = "Inactive";

    const fieldsToWrite = {
      CustomerId: customer.customerId,
      FirstName: customer.firstName,
      LastName: customer.lastName,
      Email: customer.email,
      ShopifyTags: customer.tags.join(", "),
      IsVIP: currentIsVIP,
      MembershipStatus: membershipStatus,
      LastSyncedAt: nowIso
    };

    if (customer.joinedDate) {
      fieldsToWrite.JoinedDate = customer.joinedDate;
    }

    if (!existing) {
      fieldsToWrite.FirstSeenAt = nowIso;

      if (currentIsVIP) {
        fieldsToWrite.BecameVIPAt = nowIso;
        if (!customer.joinedDate) legacyVIP += 1;
      }

      await createAirtableRecord({
        baseId,
        tableName: "CustomerDirectory",
        token,
        fields: fieldsToWrite
      });

      created += 1;
      continue;
    }

    let changed = false;

    const comparePairs = [
      [String(existingFields.FirstName || ""), fieldsToWrite.FirstName],
      [String(existingFields.LastName || ""), fieldsToWrite.LastName],
      [String(existingFields.Email || ""), fieldsToWrite.Email],
      [String(existingFields.ShopifyTags || ""), fieldsToWrite.ShopifyTags],
      [parseTruthy(existingFields.IsVIP), fieldsToWrite.IsVIP],
      [String(existingFields.MembershipStatus || ""), fieldsToWrite.MembershipStatus],
      [String(existingFields.JoinedDate || ""), String(fieldsToWrite.JoinedDate || "")]
    ];

    changed = comparePairs.some(([a, b]) => String(a) !== String(b));

    if (!previousIsVIP && currentIsVIP) {
      fieldsToWrite.BecameVIPAt = existingFields.BecameVIPAt || nowIso;
      fieldsToWrite.LostVIPAt = null;
      becameVIP += 1;
      changed = true;
    }

    if (previousIsVIP && !currentIsVIP) {
      fieldsToWrite.LostVIPAt = nowIso;
      lostVIP += 1;
      changed = true;
    }

    if (currentIsVIP && !customer.joinedDate) {
      legacyVIP += 1;
    }

    if (changed) {
      await updateAirtableRecord({
        baseId,
        tableName: "CustomerDirectory",
        token,
        recordId: existing.id,
        fields: fieldsToWrite
      });
      updated += 1;
    } else {
      unchanged += 1;

      await updateAirtableRecord({
        baseId,
        tableName: "CustomerDirectory",
        token,
        recordId: existing.id,
        fields: { LastSyncedAt: nowIso }
      });
    }
  }

  for (const record of directoryRecords) {
    const fields = record.fields || {};
    const customerId = normalizeCustomerId(fields.CustomerId);

    if (!customerId || seenIds.has(customerId)) continue;

    if (parseTruthy(fields.IsVIP)) {
      await updateAirtableRecord({
        baseId,
        tableName: "CustomerDirectory",
        token,
        recordId: record.id,
        fields: {
          IsVIP: false,
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
        tableName: "CustomerDirectory",
        token,
        recordId: record.id,
        fields: {
          MembershipStatus: String(fields.MembershipStatus || "").trim() || "Inactive",
          LastSyncedAt: nowIso
        }
      });
    }
  }

  return {
    created,
    updated,
    becameVIP,
    lostVIP,
    legacyVIP,
    unchanged
  };
}

function clientPaletteAccessHtml(access) {
  const paletteCode = access.paletteCode;
  const paletteName = access.paletteName || access.paletteCode;
  const clientName = access.clientName || "Your client";
  const logoUrl = "https://cdn.shopify.com/s/files/1/0623/6284/5408/files/YourColorStyle_Logo-120.png?v=1643287573";

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(paletteName)} Color Palette</title>
  <style>
    :root {
      color-scheme: light;
      --ink: #2f2a25;
      --muted: #6b625a;
      --line: #e8ded4;
      --paper: #fffaf6;
      --accent: #0b0b0b;
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      background: #fff;
      color: var(--ink);
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      line-height: 1.45;
    }
    .ycs-client-palette {
      max-width: 1180px;
      margin: 0 auto;
      padding: 32px 18px 48px;
    }
    .ycs-client-palette__header {
      border-bottom: 1px solid var(--line);
      margin-bottom: 28px;
      padding-bottom: 24px;
    }
    .ycs-client-palette__logo {
      display: block;
      width: 54px;
      height: auto;
      margin: 0 0 18px;
    }
    .ycs-client-palette__kicker {
      margin: 0 0 6px;
      color: #9a8d7f;
      font-size: 13px;
      font-weight: 700;
      letter-spacing: .08em;
      text-transform: uppercase;
    }
    h1 {
      margin: 0;
      font-size: clamp(34px, 6vw, 64px);
      font-weight: 400;
      letter-spacing: 0;
      line-height: 1.05;
    }
    .ycs-client-palette__prepared {
      margin: 10px 0 0;
      color: var(--ink);
      font-size: clamp(18px, 2.6vw, 24px);
      font-weight: 600;
    }
    .ycs-client-palette__status {
      margin: 20px 0;
      color: var(--muted);
      font-size: 16px;
    }
    .ycs-client-palette__sections {
      display: grid;
      gap: 34px;
    }
    .ycs-client-palette__section h2 {
      margin: 0 0 18px;
      color: #1f2933;
      font-size: 24px;
      font-weight: 800;
      text-transform: uppercase;
    }
    .ycs-client-palette__grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, 115px);
      column-gap: 6px;
      row-gap: 16px;
    }
    .ycs-client-swatch {
      min-width: 0;
    }
    .ycs-client-swatch__color {
      width: 100%;
      aspect-ratio: 1 / 1;
      border-radius: 8px;
      box-shadow: 4px 4px 0 rgba(0,0,0,.06);
    }
    .ycs-client-swatch__body {
      padding: 6px 2px 0;
      text-align: center;
    }
    .ycs-client-swatch__name {
      display: block;
      color: #111;
      font-size: 12px;
      font-weight: 600;
      line-height: 1.15;
    }
    .ycs-client-palette__footer {
      margin: 44px 0 0;
      border-top: 1px solid var(--line);
      padding-top: 18px;
      color: var(--muted);
      font-size: 13px;
      text-align: center;
    }
    @media (max-width: 640px) {
      .ycs-client-palette { padding-top: 24px; }
      .ycs-client-palette__logo {
        width: 46px;
        margin-bottom: 14px;
      }
      .ycs-client-palette__grid {
        grid-template-columns: repeat(4, 115px);
        column-gap: 6px;
        row-gap: 16px;
      }
    }
    @media (max-width: 500px) {
      .ycs-client-palette__grid {
        grid-template-columns: repeat(4, minmax(0, calc((100% - 18px) / 4)));
      }
    }
  </style>
</head>
<body>
  <main class="ycs-client-palette" data-palette-code="${escapeHtml(paletteCode)}">
    <header class="ycs-client-palette__header">
      <img class="ycs-client-palette__logo" src="${escapeHtml(logoUrl)}" alt="Your Color Style">
      <p class="ycs-client-palette__kicker">Your Personal Color Palette</p>
      <h1>${escapeHtml(paletteName)}</h1>
      <p class="ycs-client-palette__prepared">Prepared for ${escapeHtml(clientName)}</p>
    </header>
    <p class="ycs-client-palette__status" data-status>Loading colors...</p>
    <div class="ycs-client-palette__sections" data-sections></div>
    <footer class="ycs-client-palette__footer">Powered by Your Color Style™</footer>
  </main>
  <script>
    const root = document.querySelector('[data-palette-code]');
    const statusEl = document.querySelector('[data-status]');
    const sectionsEl = document.querySelector('[data-sections]');
    const paletteCode = root.dataset.paletteCode;
    const categoryOrder = [
      'Best', 'Reds', 'Oranges', 'Golden Yellows', 'Yellows', 'Yellow Greens',
      'Greens', 'Aquas/Teals', 'Blues', 'Indigos', 'Purples', 'Plums',
      'Magentas', 'Pinks', 'Neutrals'
    ];

    function escapeHtml(value) {
      return String(value || '').replace(/[&<>"']/g, function (char) {
        return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char];
      });
    }

    function colorCategories(color) {
      const categories = Array.isArray(color.categories) && color.categories.length
        ? color.categories
        : [color.category || 'Other'];
      const next = color.isBest ? ['Best'].concat(categories) : categories;
      return next.filter(Boolean);
    }

    function render(colors) {
      const grouped = {};
      colors.forEach(function (color) {
        colorCategories(color).forEach(function (category) {
          if (!grouped[category]) grouped[category] = [];
          grouped[category].push(color);
        });
      });
      const ordered = categoryOrder.filter(function (category) { return grouped[category]?.length; })
        .concat(Object.keys(grouped).filter(function (category) { return categoryOrder.indexOf(category) === -1; }).sort());
      sectionsEl.innerHTML = ordered.map(function (category) {
        return '<section class="ycs-client-palette__section"><h2>' + escapeHtml(category) + '</h2><div class="ycs-client-palette__grid">' +
          grouped[category].map(function (color) {
            const hex = color.hex || color.color || '#ffffff';
            return '<article class="ycs-client-swatch"><div class="ycs-client-swatch__color" style="background:' + escapeHtml(hex) + '"></div><div class="ycs-client-swatch__body"><span class="ycs-client-swatch__name">' + escapeHtml(color.name) + '</span></div></article>';
          }).join('') +
        '</div></section>';
      }).join('');
      statusEl.textContent = '';
    }

    fetch('/apps/palette-data?palette=' + encodeURIComponent(paletteCode), { credentials: 'same-origin' })
      .then(function (response) { return response.json().then(function (data) {
        if (!response.ok || !Array.isArray(data.colors)) throw new Error(data.error || 'Unable to load palette colors.');
        if (!data.colors.length) throw new Error('No colors were found for this palette.');
        render(data.colors);
      }); })
      .catch(function (error) {
        statusEl.textContent = error.message || 'Unable to load this palette.';
      });
  </script>
</body>
</html>`;
}

export async function loader({ request }) {
  const url = new URL(request.url);
  const rawPaletteCode = String(url.searchParams.get("palette") || "").trim();
  const paletteCode = isCustomPaletteCode(rawPaletteCode)
    ? rawPaletteCode
    : rawPaletteCode.toUpperCase();
  const action = String(url.searchParams.get("action") || "").trim();
  const loggedInCustomerId = String(url.searchParams.get("logged_in_customer_id") || "").trim();

  const AIRTABLE_TOKEN = process.env.AIRTABLE_TOKEN;
  const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID;
  const AIRTABLE_TABLE_NAME = process.env.AIRTABLE_TABLE_NAME;
  const AIRTABLE_FAVORITES_TABLE =
    process.env.AIRTABLE_FAVORITES_TABLE || "PaletteFavorites";

  if (!AIRTABLE_TOKEN || !AIRTABLE_BASE_ID || !AIRTABLE_TABLE_NAME) {
    return Response.json(
      { error: "Missing Airtable server configuration" },
      { status: 500 }
    );
  }

  if (action === "tradePaletteAccessToken") {
    try {
      try {
        await authenticate.public.appProxy(request);
      } catch (authError) {
        const hasValidProxySignature = verifyAppProxySignature(url, process.env.SHOPIFY_API_SECRET);
        if (!hasValidProxySignature) {
          console.error("tradePaletteAccessToken proxy authentication failed:", authError);
          return Response.json(
            { error: "Signed storefront request required to create palette access token" },
            { status: 401 }
          );
        }
      }

      const safeLoggedInCustomerId = normalizeCustomerId(loggedInCustomerId);
      if (!safeLoggedInCustomerId) {
        return Response.json(
          { error: "You must be signed in to create the client color palette" },
          { status: 401 }
        );
      }

      return Response.json({
        success: true,
        token: createTradePaletteAccessToken({ consultantId: safeLoggedInCustomerId })
      });
    } catch (error) {
      console.error("tradePaletteAccessToken failed:", error);
      return Response.json(
        { error: error.message || "Unable to prepare the client color palette" },
        { status: error.status || 500 }
      );
    }
  }

  if (action === "tradeClientPaletteAccess") {
    try {
      try {
        await authenticate.public.appProxy(request);
      } catch (authError) {
        const hasValidProxySignature = verifyAppProxySignature(url, process.env.SHOPIFY_API_SECRET);
        if (!hasValidProxySignature) {
          console.error("tradeClientPaletteAccess loader proxy authentication failed:", authError);
          return Response.json(
            { error: "Signed storefront request required to create the client color palette" },
            { status: 401 }
          );
        }
      }

      const safeLoggedInCustomerId = normalizeCustomerId(loggedInCustomerId);
      if (!safeLoggedInCustomerId) {
        return Response.json(
          { error: "You must be signed in to create the client color palette" },
          { status: 401 }
        );
      }

      const result = await giveTradeClientPaletteAccess({
        consultantId: safeLoggedInCustomerId,
        clientRecordId: url.searchParams.get("clientRecordId"),
        paletteCode: url.searchParams.get("paletteCode"),
        paletteName: url.searchParams.get("paletteName"),
        updateClientPalette: parseTruthy(url.searchParams.get("updateClientPalette"))
      });

      return Response.json(result);
    } catch (error) {
      if (error instanceof Response) throw error;
      console.error("tradeClientPaletteAccess loader failed:", error);
      return Response.json(
        {
          error: error.message || "Unable to create the client color palette",
          balance: error.balance
        },
        { status: error.status || 500 }
      );
    }
  }

  if (action === "clientPaletteView") {
    try {
      const access = await validateClientPaletteAccessToken({
        token: url.searchParams.get("token")
      });

      return new Response(clientPaletteAccessHtml(access), {
        status: 200,
        headers: {
          "Content-Type": "text/html; charset=utf-8",
          "Cache-Control": "no-store"
        }
      });
    } catch (error) {
      return new Response(`<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Palette Link Unavailable</title>
  <style>
    body { margin: 0; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; color: #2f2a25; background: #fffaf6; }
    main { max-width: 620px; margin: 0 auto; padding: 72px 20px; }
    h1 { margin: 0 0 12px; font-size: 42px; font-weight: 400; letter-spacing: 0; }
    p { margin: 0; color: #625c55; font-size: 18px; line-height: 1.45; }
  </style>
</head>
<body>
  <main>
    <h1>Palette link unavailable</h1>
    <p>${escapeHtml(error.message || "This palette access link is not valid.")}</p>
  </main>
</body>
</html>`, {
        status: error.status || 404,
        headers: {
          "Content-Type": "text/html; charset=utf-8",
          "Cache-Control": "no-store"
        }
      });
    }
  }

  if (action === "getSignatureLipColors") {
    if (!paletteCode) {
      return Response.json(
        { error: "Missing palette parameter" },
        { status: 400 }
      );
    }

    try {
      const records = await fetchAllAirtableRecords({
        baseId: AIRTABLE_BASE_ID,
        tableName: "PaletteLipColors",
        token: AIRTABLE_TOKEN
      });

      const lipColors = records
        .map((record) => {
          const f = record.fields || {};

          const paletteCodes = String(f.PaletteCode || "")
            .split(",")
            .map((code) => code.toUpperCase().trim())
            .filter(Boolean);

          return {
            name: normalizeField(f.ColorName),
            hex: normalizeField(f.Hex),
            category: normalizeField(f.Category),
            paletteCodes
          };
        })
        .filter((color) => color.name && color.hex)
        .filter((color) => color.paletteCodes.includes(paletteCode))
        .map(({ paletteCodes, ...color }) => color);

      return Response.json({
        palette: paletteCode,
        lipColors
      });
    } catch (error) {
      console.error("getSignatureLipColors failed:", error);

      return Response.json(
        { error: error.message || "Failed to load lip colors" },
        { status: 500 }
      );
    }
  }

  if (action === "getStyleMastersPalettes") {
    try {
      const isAdmin = String(url.searchParams.get("isAdmin") || "").trim() === "true";

      if (!loggedInCustomerId && !isAdmin) {
        return Response.json(
          { error: "You must be signed in to use this tool" },
          { status: 401 }
        );
      }

      if (!isAdmin) {
        return Response.json(
          { error: "Admin access required" },
          { status: 403 }
        );
      }

      const palettes = await fetchStyleMastersCustomPaletteList({
        baseId: AIRTABLE_BASE_ID,
        token: AIRTABLE_TOKEN,
        includeHidden: true
      });

      return Response.json({ palettes });
    } catch (error) {
      console.error("getStyleMastersPalettes failed:", error);

      return Response.json(
        { error: error.message || "Failed to load Style Masters palettes" },
        { status: 500 }
      );
    }
  }

  if (action === "syncCustomerDirectory") {
    try {
      const isAdmin = String(url.searchParams.get("isAdmin") || "").trim() === "true";

      if (!loggedInCustomerId) {
        return Response.json(
          { error: "You must be signed in to use this tool" },
          { status: 401 }
        );
      }

      if (!isAdmin) {
        return Response.json(
          { error: "Admin access required" },
          { status: 403 }
        );
      }

      const SHOPIFY_SHOP = process.env.SHOPIFY_SHOP;
      const SHOPIFY_ADMIN_ACCESS_TOKEN = process.env.SHOPIFY_ADMIN_ACCESS_TOKEN;

      if (!SHOPIFY_SHOP || !SHOPIFY_ADMIN_ACCESS_TOKEN) {
        return Response.json(
          { error: "Missing Shopify admin configuration" },
          { status: 500 }
        );
      }

      const result = await syncCustomerDirectoryFromShopify({
        shop: SHOPIFY_SHOP,
        accessToken: SHOPIFY_ADMIN_ACCESS_TOKEN,
        baseId: AIRTABLE_BASE_ID,
        token: AIRTABLE_TOKEN
      });

      return Response.json({ success: true, summary: result });
    } catch (error) {
      console.error("syncCustomerDirectory failed:", error);

      return Response.json(
        { error: error.message || "Failed to sync customer directory" },
        { status: 500 }
      );
    }
  }

  if (action === "getAdminMembers") {
    try {
      const isAdmin = String(url.searchParams.get("isAdmin") || "").trim() === "true";

      if (!loggedInCustomerId) {
        return Response.json(
          { error: "You must be signed in to use this tool" },
          { status: 401 }
        );
      }

      if (!isAdmin) {
        return Response.json(
          { error: "Admin access required" },
          { status: 403 }
        );
      }

      const [
  directoryRecords,
  customerPhotoRecords,
  initialPersonalPhotoRecords,
  drapingHistoryMap
] = await Promise.all([
        fetchAllAirtableRecords({
          baseId: AIRTABLE_BASE_ID,
          tableName: "CustomerDirectory",
          token: AIRTABLE_TOKEN,
          sortField: "LastName"
        }),
        fetchAllAirtableRecords({
          baseId: AIRTABLE_BASE_ID,
          tableName: "CustomerPhotos",
          token: AIRTABLE_TOKEN
        }),
        fetchAllAirtableRecords({
          baseId: AIRTABLE_BASE_ID,
          tableName: "PersonalStudioPhotos",
          token: AIRTABLE_TOKEN,
          sortField: "UpdatedAt",
          formula: "OR({IsArchived}=BLANK(), {IsArchived}=0, {IsArchived}=FALSE())"
        }),
        fetchMemberDrapingHistoryMap({
          baseId: AIRTABLE_BASE_ID,
          token: AIRTABLE_TOKEN
        })
      ]);
const personalPhotoRecords = initialPersonalPhotoRecords.slice();

for (const customerPhotoRecord of customerPhotoRecords) {
  try {
    const created = await ensurePersonalPhotoFromCustomerPhoto({
      baseId: AIRTABLE_BASE_ID,
      token: AIRTABLE_TOKEN,
      customerPhotoRecord,
      existingPersonalPhotos: personalPhotoRecords
    });

    if (created) {
      personalPhotoRecords.push(created);
    }
  } catch (migrationError) {
    console.error("CustomerPhotos migration failed:", migrationError);
  }
}
      const photoMap = {};

      function addPhoto(customerId, photo) {
        if (!customerId) return;

        if (!photoMap[customerId]) {
          photoMap[customerId] = [];
        }

        photoMap[customerId].push(photo);
      }

      personalPhotoRecords.forEach((record) => {
        const f = record.fields || {};
        const customerId = normalizeCustomerId(f.CustomerId);

        const activePhotoUrl =
          f.ActivePhotoUrl ||
          f.AdjustedPhotoUrl ||
          f.PhotoUrl ||
          f.OriginalPhotoUrl ||
          null;

        addPhoto(customerId, {
  photoId: f.PhotoId || record.id,
  airtableRecordId: record.id,
  sourceTable: "PersonalStudioPhotos",
  photoSource: "PersonalStudioPhotos",
  photoUrl: activePhotoUrl,
  originalPhotoUrl: f.OriginalPhotoUrl || null,
  adjustedPhotoUrl: f.AdjustedPhotoUrl || null,
  activePhotoUrl,
  updatedAt: f.UpdatedAt || ""
});
      });

      Object.keys(photoMap).forEach((customerId) => {
        photoMap[customerId].sort((a, b) => {
          const aTime = Date.parse(a.updatedAt || "") || 0;
          const bTime = Date.parse(b.updatedAt || "") || 0;
          return bTime - aTime;
        });
      });

      // Do not add CustomerPhotos directly.
// They are migrated into PersonalStudioPhotos above.
// PersonalStudioPhotos is now the source of truth for Member Photos.

      const startDate = new Date();
      startDate.setDate(startDate.getDate() - 30);
      startDate.setHours(0, 0, 0, 0);

      function isOnOrAfterStartDate(value) {
        if (!value) return false;

        const date = new Date(value);
        return !Number.isNaN(date.getTime()) && date >= startDate;
      }

      const members = directoryRecords
        .map((record) => {
          const fields = record.fields || {};

          const customerId = normalizeCustomerId(fields.CustomerId);
          if (!customerId) return null;

          const email = String(fields.Email || "").trim();
          const firstName = String(fields.FirstName || "").trim();
          const lastName = String(fields.LastName || "").trim();
          const membershipStatus = String(fields.MembershipStatus || "Inactive").trim();

          const tags = String(fields.ShopifyTags || "")
            .split(",")
            .map((tag) => String(tag).trim())
            .filter(Boolean);

          const isVIP =
            tags.includes("VIP") ||
            parseTruthy(fields.IsVIP);

          const paletteTags = String(fields.PaletteTags || "")
            .split(",")
            .map((tag) => tag.trim())
            .filter(Boolean);

          const hasPaletteAccess =
            parseTruthy(fields.HasPaletteAccess) || paletteTags.length > 0;

          let name = `${firstName} ${lastName}`.trim();
          if (!name && email) name = email.split("@")[0];
          if (!name) name = `Customer ${customerId}`;

          const photos = photoMap[customerId] || [];

          const drapingHistory = drapingHistoryMap[customerId] || [];
          const lastDraping = drapingHistory[0] || null;

          return {
            customerId,
            name,
            firstName,
            lastName,
            email,
            colorType: String(fields.ColorType || "").trim(),
            permissionToUse: parseTruthy(fields.PermissionToUse),
            joinedDate: fields.JoinedDate ? String(fields.JoinedDate).trim() : "",
            membershipStatus,
            becameVIPAt: fields.BecameVIPAt || "",
            lostVIPAt: fields.LostVIPAt || "",
            isNewThisMonth: isOnOrAfterStartDate(fields.BecameVIPAt),
            isLostThisMonth: isOnOrAfterStartDate(fields.LostVIPAt),
            paletteTags,
            hasPaletteAccess,
            photos,
            photoCount: photos.length,
            photoUrl: photos[0]?.photoUrl || null,
            hasPhoto: photos.length > 0,
            drapingHistory,
            drapedCount: drapingHistory.length,
            lastDrapedDate: lastDraping?.drapedDate || "",
            lastDrapedMonthYear: lastDraping?.drapedMonthYear || "",
            lastDrapedColor: lastDraping?.colorName || "",
            lastDrapedHex: lastDraping?.colorHex || "",
            drapingRecency: getDrapingRecencyBucket(lastDraping?.drapedDate || ""),
            drapingRecencyBuckets: getDrapingRecencyBuckets(drapingHistory),
            isDueForDraping: isDueForDraping({
              membershipStatus,
              hasPhoto: photos.length > 0,
              lastDrapedDate: lastDraping?.drapedDate || ""
            })
          };
        })
        .filter(Boolean)
        .sort((a, b) => a.name.localeCompare(b.name));

      const BASELINE_ACTIVE_MEMBER_COUNT = 114;

      const stats = {
        active: 0,
        inactive: 0,
        newLast30Days: 0,
        lostLast30Days: 0,
        netChangeLast30Days: 0,
        totalNetChangeSinceTracking: 0
      };

      members.forEach((member) => {
        const status = String(member.membershipStatus || "").toLowerCase();

        if (status === "active" || status === "legacy") {
          stats.active += 1;
        } else {
          stats.inactive += 1;
        }

        if (member.isNewThisMonth) {
          stats.newLast30Days += 1;
        }

        if (member.isLostThisMonth) {
          stats.lostLast30Days += 1;
        }
      });

      stats.netChangeLast30Days = stats.newLast30Days - stats.lostLast30Days;
      stats.totalNetChangeSinceTracking = stats.active - BASELINE_ACTIVE_MEMBER_COUNT;

      return Response.json({ members, stats });
    } catch (error) {
      console.error("getAdminMembers failed:", error);
      return Response.json(
        { error: error.message || "Failed to load admin members" },
        { status: 500 }
      );
    }
  }

  if (action === "getFavorites") {
    const customerId = String(url.searchParams.get("customerId") || "").trim();

    if (!customerId || !paletteCode) {
      return Response.json(
        { error: "Missing customerId or palette" },
        { status: 400 }
      );
    }

    try {
      const favorites = await getFavorites({
        customerId,
        paletteCode,
        baseId: AIRTABLE_BASE_ID,
        tableName: AIRTABLE_FAVORITES_TABLE,
        token: AIRTABLE_TOKEN,
      });

      return Response.json({ favorites });
    } catch (error) {
      console.error(error);
      return Response.json(
        { error: error.message || "Failed to load favorites" },
        { status: 500 }
      );
    }
  }

  const isAdminPalette = paletteCode.startsWith("ADMIN_");

  if (!paletteCode) {
    return Response.json({ error: "Missing palette parameter" }, { status: 400 });
  }

  if (isCustomPaletteCode(paletteCode)) {
    try {
      const paletteId = customPaletteIdFromCode(paletteCode);
      if (!paletteId) {
        return Response.json({ error: "Missing custom palette id" }, { status: 400 });
      }

      const customPalette = await fetchStyleMastersCustomPalette({
        baseId: AIRTABLE_BASE_ID,
        token: AIRTABLE_TOKEN,
        paletteId,
        includeHidden: String(url.searchParams.get("isAdmin") || "").trim() === "true"
      });

      return Response.json({
        palette: `CUSTOM_${paletteId}`,
        paletteName: customPalette.paletteName,
        colors: customPalette.colors,
        marker: "CUSTOM_PALETTE_LIVE"
      });
    } catch (error) {
      console.error(error);
      return Response.json(
        { error: error.message || "Failed to load custom palette colors" },
        { status: error.status || 500 }
      );
    }
  }

  try {
    const allRecords = await fetchAllAirtableRecords({
      baseId: AIRTABLE_BASE_ID,
      tableName: AIRTABLE_TABLE_NAME,
      token: AIRTABLE_TOKEN,
      sortField: "SortOrder",
    });

    const colors = allRecords
      .map((record) => {
        const f = record.fields || {};

        const linkedPalettes = String(f["PaletteCodes_Final_Manual"] || "")
          .split(",")
          .map((p) => p.toUpperCase().trim())
          .filter(Boolean);

        const bestPalettes = normalizeList(f["BestPaletteCodes"]).map((p) =>
          String(p).toUpperCase().trim()
        );

        const adminPalettes = String(f["AdminPaletteCodes"] || "")
          .split(/\s+/)
          .map((p) => p.toUpperCase().trim())
          .filter(Boolean);

        const categories = normalizeList(f["CategoryNames"]).map((item) =>
          String(item || "").trim()
        ).filter(Boolean);

        const category = normalizeField(f["CategoryNames"]);

        return {
          name: normalizeField(f["ColorName"]),
          hex: normalizeField(f["Hex"]),
          sortOrder: Number(normalizeField(f["SortOrder"])) || 999,
          category: category || categories[0] || "Other",
          categories: categories,
          paletteCodes: normalizeField(f["PaletteCodes_Final_Manual"]),
          chroma: normalizeField(f["Chroma"]),
          temperature: normalizeField(f["Temperature"]),
          depth: normalizeField(f["Depth"]),
          isBest: bestPalettes.includes(paletteCode),
          palettes: linkedPalettes,
          adminPalettes: adminPalettes,
          isNeutral:
            f["IsNeutral"] === true ||
            f["IsNeutral"] === 1 ||
            String(f["IsNeutral"]).toLowerCase() === "true",
          neutralDepth: normalizeField(f["NeutralDepth"]),
          neutralFamily: normalizeField(f["NeutralFamily"]),
        };
      })
      .filter((color) => color.name && color.hex)
      .filter((color) => {
        if (isAdminPalette) {
          return color.adminPalettes.includes(paletteCode);
        }
        return color.palettes.includes(paletteCode);
      })
      .map(({ palettes, adminPalettes, ...color }) => color);

    return Response.json({
      palette: paletteCode,
      colors,
      marker: "FAVORITES_LIVE",
    });
  } catch (error) {
    console.error(error);
    return Response.json(
      { error: error.message || "Failed to load palette colors" },
      { status: 500 }
    );
  }
}

async function fetchMemberDrapingHistoryMap({ baseId, token }) {
  const records = await fetchAllAirtableRecords({
    baseId,
    tableName: "MemberDrapingHistory",
    token
  });

  const historyMap = {};

  records.forEach((record) => {
    const fields = record.fields || {};
    const customerId = normalizeCustomerId(fields.CustomerId);
    if (!customerId) return;

    if (!historyMap[customerId]) historyMap[customerId] = [];

    historyMap[customerId].push({
      recordId: record.id,
      drapedDate: fields.DrapedDate ? String(fields.DrapedDate) : "",
      drapedMonthYear: fields.DrapedMonthYear ? String(fields.DrapedMonthYear) : "",
      colorName: fields.ColorName ? String(fields.ColorName) : "",
      colorHex: fields.ColorHex ? String(fields.ColorHex) : "",
      paletteCode: fields.PaletteCode ? String(fields.PaletteCode) : "",
      callTheme: fields.CallTheme ? String(fields.CallTheme) : "",
      notes: fields.Notes ? String(fields.Notes) : ""
    });
  });

  Object.keys(historyMap).forEach((customerId) => {
    historyMap[customerId].sort((a, b) => {
      return new Date(b.drapedDate || 0) - new Date(a.drapedDate || 0);
    });
  });

  return historyMap;
}

export async function action({ request }) {
  const url = new URL(request.url);
  const actionName = String(url.searchParams.get("action") || "").trim();

  const AIRTABLE_TOKEN = process.env.AIRTABLE_TOKEN;
  const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID;
  const AIRTABLE_FAVORITES_TABLE =
    process.env.AIRTABLE_FAVORITES_TABLE || "PaletteFavorites";
  const REMOVE_BG_API_KEY = process.env.REMOVE_BG_API_KEY;

  if (request.method !== "POST") {
    return Response.json({ error: "Method not allowed" }, { status: 405 });
  }

  if (actionName === "removeBackground") {
    if (!REMOVE_BG_API_KEY) {
      return Response.json(
        { error: "Missing remove.bg configuration" },
        { status: 500 }
      );
    }

    try {
      const body = await request.json();
      const imageBase64 = String(body.imageBase64 || "").trim();

      if (!imageBase64) {
        return Response.json(
          { error: "Missing imageBase64" },
          { status: 400 }
        );
      }

      const image = await removeBackgroundImage({
        imageBase64,
        apiKey: REMOVE_BG_API_KEY,
      });

      return Response.json({ image });
    } catch (error) {
      console.error(error);
      return Response.json(
        { error: error.message || "Failed to remove background" },
        { status: 500 }
      );
    }
  }

  if (!AIRTABLE_TOKEN || !AIRTABLE_BASE_ID) {
    return Response.json(
      { error: "Missing Airtable server configuration" },
      { status: 500 }
    );
  }

  if (actionName === "tradeClientPaletteAccess") {
    try {
      try {
        await authenticate.public.appProxy(request);
      } catch (authError) {
        const hasValidProxySignature = verifyAppProxySignature(url, process.env.SHOPIFY_API_SECRET);
        if (!hasValidProxySignature) {
          console.error("tradeClientPaletteAccess proxy authentication failed:", authError);
          return Response.json(
            { error: "Signed storefront request required to give palette access" },
            { status: 401 }
          );
        }
      }

      const loggedInCustomerId = normalizeCustomerId(url.searchParams.get("logged_in_customer_id"));
      const body = await request.json();

      if (!loggedInCustomerId) {
        return Response.json(
          { error: "You must be signed in to give customer palette access" },
          { status: 401 }
        );
      }

      const result = await giveTradeClientPaletteAccess({
        consultantId: loggedInCustomerId,
        clientRecordId: body.clientRecordId,
        paletteCode: body.paletteCode,
        paletteName: body.paletteName,
        updateClientPalette: body.updateClientPalette
      });

      return Response.json(result);
    } catch (error) {
      if (error instanceof Response) throw error;
      console.error("tradeClientPaletteAccess failed:", error);
      return Response.json(
        {
          error: error.message || "Unable to give customer palette access",
          balance: error.balance
        },
        { status: error.status || 500 }
      );
    }
  }

  if (actionName === "deleteSavedDrapedImages") {
    try {
      try {
        await authenticate.public.appProxy(request);
      } catch (authError) {
        const hasValidProxySignature = verifyAppProxySignature(url, process.env.SHOPIFY_API_SECRET);
        if (!hasValidProxySignature) {
          console.error("deleteSavedDrapedImages proxy authentication failed:", authError);
          return Response.json(
            { error: "Signed storefront request required to delete saved photos" },
            { status: 401 }
          );
        }
      }

      const loggedInCustomerId = normalizeCustomerId(url.searchParams.get("logged_in_customer_id"));
      const body = await request.json();
      const clientRecordId = String(body.clientRecordId || "").trim();
      const imageIds = normalizeAirtableIdList(body.imageIds || body.imageId);

      if (!loggedInCustomerId) {
        return Response.json(
          { error: "You must be signed in to manage client photos" },
          { status: 401 }
        );
      }

      if (!clientRecordId || !imageIds.length) {
        return Response.json(
          { error: "Missing clientRecordId or imageIds" },
          { status: 400 }
        );
      }

      const matchingClients = await fetchAllAirtableRecords({
        baseId: AIRTABLE_BASE_ID,
        tableName: "ConsultantClients",
        token: AIRTABLE_TOKEN,
        formula: `AND({ClientRecordId}="${escapeFormulaValue(clientRecordId)}", {ConsultantId}="${escapeFormulaValue(loggedInCustomerId)}")`
      });

      if (!matchingClients.length) {
        return Response.json(
          { error: "Client record not found for this account" },
          { status: 404 }
        );
      }

      const records = [];

      for (const recordId of imageIds) {
        const record = await getAirtableRecord({
          baseId: AIRTABLE_BASE_ID,
          tableName: "SavedDrapedImages",
          token: AIRTABLE_TOKEN,
          recordId
        });
        const fields = record?.fields || {};
        const savedClientRecordId = firstSavedDrapedField(fields, ["ClientRecordId", "Client Record ID"]);
        const savedConsultantId = firstSavedDrapedField(fields, ["ConsultantId", "Consultant ID"]);

        if (
          savedClientRecordId !== clientRecordId ||
          (savedConsultantId && savedConsultantId !== loggedInCustomerId)
        ) {
          return Response.json(
            { error: "Saved draped photo does not belong to this client" },
            { status: 403 }
          );
        }

        records.push(record);
      }

      const deletedIds = [];

      for (const record of records) {
        await deleteAirtableRecord({
          baseId: AIRTABLE_BASE_ID,
          tableName: "SavedDrapedImages",
          token: AIRTABLE_TOKEN,
          recordId: record.id
        });
        deletedIds.push(record.id);
      }

      return Response.json({
        success: true,
        deletedIds
      });
    } catch (error) {
      if (error instanceof Response) throw error;
      console.error("deleteSavedDrapedImages failed:", error);
      return Response.json(
        { error: error.message || "Failed to delete saved draped photos" },
        { status: 500 }
      );
    }
  }

  if (actionName === "syncCustomerDirectory") {
    try {
      const body = await request.json();
      const isAdmin = body?.isAdmin === true || String(body?.isAdmin || "") === "true";

      if (!isAdmin) {
        return Response.json({ error: "Admin access required" }, { status: 403 });
      }

      const SHOPIFY_SHOP = process.env.SHOPIFY_SHOP;
      const SHOPIFY_ADMIN_ACCESS_TOKEN = process.env.SHOPIFY_ADMIN_ACCESS_TOKEN;

      if (!SHOPIFY_SHOP || !SHOPIFY_ADMIN_ACCESS_TOKEN) {
        return Response.json(
          { error: "Missing Shopify admin configuration" },
          { status: 500 }
        );
      }

      const result = await syncCustomerDirectoryFromShopify({
        shop: SHOPIFY_SHOP,
        accessToken: SHOPIFY_ADMIN_ACCESS_TOKEN,
        baseId: AIRTABLE_BASE_ID,
        token: AIRTABLE_TOKEN
      });

      return Response.json({ success: true, summary: result });
    } catch (error) {
      console.error("syncCustomerDirectory failed:", error);
      return Response.json(
        { error: error.message || "Failed to sync customer directory" },
        { status: 500 }
      );
    }
  }
  if (actionName === "addMemberDrapingHistory") {
  try {
    const body = await request.json();

    const customerId = String(body.customerId || "").trim();
    const memberName = String(body.memberName || "").trim();
    const email = String(body.email || "").trim();
    const drapedDate = String(body.drapedDate || "").trim();
    const colorName = String(body.colorName || "").trim();
    const colorHex = String(body.colorHex || "").trim();
    const paletteCode = String(body.paletteCode || "").trim();
    const callTheme = String(body.callTheme || "").trim();
    const notes = String(body.notes || "").trim();

    if (!customerId || !drapedDate || !colorName) {
      return Response.json(
        { error: "Missing customerId, drapedDate, or colorName" },
        { status: 400 }
      );
    }

    const created = await createAirtableRecord({
      baseId: AIRTABLE_BASE_ID,
      tableName: "MemberDrapingHistory",
      token: AIRTABLE_TOKEN,
      fields: {
        CustomerId: customerId,
        MemberName: memberName,
        Email: email,
        DrapedDate: drapedDate,
        ColorName: colorName,
        ColorHex: colorHex,
        PaletteCode: paletteCode,
        CallTheme: callTheme,
        Notes: notes,
        CreatedAt: new Date().toISOString()
      }
    });

    return Response.json({ success: true, record: created });
  } catch (error) {
    console.error("addMemberDrapingHistory failed:", error);
    return Response.json(
      { error: error.message || "Failed to save draping history" },
      { status: 500 }
    );
  }
}
  if (actionName !== "toggleFavorite") {
    return Response.json({ error: "Unknown action" }, { status: 400 });
  }

  try {
    const body = await request.json();

    const customerId = String(body.customerId || "").trim();
    const paletteCode = String(body.paletteCode || "").toUpperCase().trim();
    const colorName = String(body.colorName || "").trim();
    const hex = String(body.hex || "").trim();

    if (!customerId || !paletteCode || !hex) {
      return Response.json(
        { error: "Missing customerId, paletteCode, or hex" },
        { status: 400 }
      );
    }

    const result = await toggleFavorite({
      customerId,
      paletteCode,
      colorName,
      hex,
      baseId: AIRTABLE_BASE_ID,
      tableName: AIRTABLE_FAVORITES_TABLE,
      token: AIRTABLE_TOKEN,
    });

    return Response.json(result);
  } catch (error) {
    console.error(error);
    return Response.json(
      { error: error.message || "Failed to toggle favorite" },
      { status: 500 }
    );
  }
}
