import crypto from "node:crypto";
import { PALETTE_NAMES, normalizePaletteCode } from "./palette-codes.server.js";

const DEFAULT_ACCESS_TABLE = "TradeClientPaletteAccess";
const ACCESS_TOKEN_BYTES = 32;

function cleanString(value) {
  return String(value || "").trim();
}

function escapeFormulaString(value) {
  return String(value || "").replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

function airtableConfig() {
  const baseId = process.env.AIRTABLE_BASE_ID;
  const token = process.env.AIRTABLE_TOKEN;
  const schemaToken = process.env.AIRTABLE_SCHEMA_TOKEN || token;
  const tableName = process.env.AIRTABLE_TRADE_CLIENT_PALETTE_ACCESS_TABLE || DEFAULT_ACCESS_TABLE;

  if (!baseId || !token) {
    throw new Error("Missing Airtable configuration");
  }

  return { baseId, token, schemaToken, tableName };
}

async function parseAirtableResponse(response) {
  const text = await response.text();
  if (!text) return {};

  try {
    return JSON.parse(text);
  } catch (_error) {
    return { raw: text };
  }
}

async function airtableRequest({
  method = "GET",
  recordId,
  searchParams,
  body,
  fetcher = fetch
}) {
  const { baseId, token, tableName } = airtableConfig();
  const url = new URL(`https://api.airtable.com/v0/${baseId}/${encodeURIComponent(tableName)}${recordId ? `/${recordId}` : ""}`);

  if (searchParams) {
    Object.entries(searchParams).forEach(([key, value]) => {
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
  const data = await parseAirtableResponse(response);

  if (!response.ok) {
    const error = new Error(data?.error?.message || data?.error || "Airtable request failed");
    error.status = response.status || 500;
    error.data = data;
    throw error;
  }

  return data;
}

function isMissingTableError(error) {
  const message = String(error?.message || "").toLowerCase();
  return error?.status === 404 ||
    ["TABLE_NOT_FOUND", "NOT_FOUND", "INVALID_PERMISSIONS_OR_MODEL_NOT_FOUND"].includes(error?.data?.error?.type) ||
    message.includes("requested model was not found");
}

async function ensureAccessTable({ fetcher = fetch } = {}) {
  const { baseId, schemaToken, tableName } = airtableConfig();
  if (!schemaToken) {
    throw new Error("Missing Airtable schema token");
  }

  const response = await fetcher(`https://api.airtable.com/v0/meta/bases/${baseId}/tables`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${schemaToken}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      name: tableName,
      description: "Secure palette access links for TRADE consultant clients.",
      fields: [
        { name: "TokenHash", type: "singleLineText" },
        { name: "TokenPrefix", type: "singleLineText" },
        { name: "ConsultantId", type: "singleLineText" },
        { name: "ClientRecordId", type: "singleLineText" },
        { name: "ClientEmail", type: "singleLineText" },
        { name: "ClientName", type: "singleLineText" },
        { name: "PaletteCode", type: "singleLineText" },
        { name: "PaletteName", type: "singleLineText" },
        { name: "AccessUrl", type: "url" },
        { name: "Status", type: "singleLineText" },
        { name: "CreatedAt", type: "singleLineText" },
        { name: "LastOpenedAt", type: "singleLineText" }
      ]
    })
  });
  const data = await parseAirtableResponse(response);

  if (!response.ok && data?.error?.type !== "DUPLICATE_TABLE_NAME") {
    const error = new Error(data?.error?.message || data?.error?.type || "Unable to create Airtable palette access table");
    error.status = response.status || 500;
    error.data = data;
    throw error;
  }
}

async function withAccessTableSetup(callback, { fetcher = fetch } = {}) {
  try {
    return await callback();
  } catch (error) {
    if (!isMissingTableError(error)) throw error;
    await ensureAccessTable({ fetcher });
    return callback();
  }
}

function tokenHash(token) {
  return crypto.createHash("sha256").update(cleanString(token), "utf8").digest("hex");
}

function newAccessToken() {
  return crypto.randomBytes(ACCESS_TOKEN_BYTES).toString("base64url");
}

function storefrontBaseUrl() {
  return cleanString(process.env.YCS_STOREFRONT_URL) || "https://yourcolorstyle.com";
}

function accessUrlForToken(token) {
  const url = new URL("/apps/palette-data", storefrontBaseUrl());
  url.searchParams.set("action", "clientPaletteView");
  url.searchParams.set("token", token);
  return url.toString();
}

function serializeAccessRecord(record) {
  const fields = record?.fields || {};
  if (!record) return null;

  return {
    id: record.id || "",
    consultantId: cleanString(fields.ConsultantId),
    clientRecordId: cleanString(fields.ClientRecordId),
    clientEmail: cleanString(fields.ClientEmail),
    clientName: cleanString(fields.ClientName),
    paletteCode: normalizePaletteCode(fields.PaletteCode),
    paletteName: cleanString(fields.PaletteName),
    accessUrl: cleanString(fields.AccessUrl),
    status: cleanString(fields.Status) || "active",
    createdAt: cleanString(fields.CreatedAt || record.createdTime),
    lastOpenedAt: cleanString(fields.LastOpenedAt)
  };
}

export async function findActiveClientPaletteAccess({
  consultantId,
  clientRecordId,
  paletteCode,
  fetcher = fetch
}) {
  const safeConsultantId = cleanString(consultantId);
  const safeClientRecordId = cleanString(clientRecordId);
  const safePaletteCode = normalizePaletteCode(paletteCode);
  if (!safeConsultantId || !safeClientRecordId || !safePaletteCode) return null;

  const formula = `AND({ConsultantId}="${escapeFormulaString(safeConsultantId)}",{ClientRecordId}="${escapeFormulaString(safeClientRecordId)}",{PaletteCode}="${escapeFormulaString(safePaletteCode)}",{Status}="active")`;
  const data = await withAccessTableSetup(() => airtableRequest({
    searchParams: {
      filterByFormula: formula,
      maxRecords: 1
    },
    fetcher
  }), { fetcher });

  return serializeAccessRecord(data.records?.[0]);
}

export async function findActiveClientPaletteAccessForClient({
  consultantId,
  clientRecordId,
  fetcher = fetch
}) {
  const records = await findActiveClientPaletteAccessRecordsForClient({
    consultantId,
    clientRecordId,
    maxRecords: 1,
    fetcher
  });

  return records[0] || null;
}

export async function findActiveClientPaletteAccessForClients({
  consultantId,
  clientRecordIds,
  fetcher = fetch
}) {
  const safeConsultantId = cleanString(consultantId);
  const safeClientRecordIds = Array.from(new Set((clientRecordIds || []).map(cleanString).filter(Boolean)));
  if (!safeConsultantId || !safeClientRecordIds.length) return new Map();

  const accessByClientRecordId = new Map();
  const chunkSize = 20;

  for (let index = 0; index < safeClientRecordIds.length; index += chunkSize) {
    const chunk = safeClientRecordIds.slice(index, index + chunkSize);
    const clientClauses = chunk
      .map((clientRecordId) => `{ClientRecordId}="${escapeFormulaString(clientRecordId)}"`)
      .join(",");
    const formula = `AND({ConsultantId}="${escapeFormulaString(safeConsultantId)}",{Status}="active",OR(${clientClauses}))`;
    const data = await withAccessTableSetup(() => airtableRequest({
      searchParams: {
        filterByFormula: formula,
        "sort[0][field]": "CreatedAt",
        "sort[0][direction]": "desc",
        maxRecords: 100
      },
      fetcher
    }), { fetcher });

    (data.records || []).map(serializeAccessRecord).filter(Boolean).forEach((access) => {
      if (!accessByClientRecordId.has(access.clientRecordId)) {
        accessByClientRecordId.set(access.clientRecordId, access);
      }
    });
  }

  return accessByClientRecordId;
}

async function findActiveClientPaletteAccessRecordsForClient({
  consultantId,
  clientRecordId,
  maxRecords = 100,
  fetcher = fetch
}) {
  const safeConsultantId = cleanString(consultantId);
  const safeClientRecordId = cleanString(clientRecordId);
  if (!safeConsultantId || !safeClientRecordId) return [];

  const formula = `AND({ConsultantId}="${escapeFormulaString(safeConsultantId)}",{ClientRecordId}="${escapeFormulaString(safeClientRecordId)}",{Status}="active")`;
  const data = await withAccessTableSetup(() => airtableRequest({
    searchParams: {
      filterByFormula: formula,
      "sort[0][field]": "CreatedAt",
      "sort[0][direction]": "desc",
      maxRecords
    },
    fetcher
  }), { fetcher });

  return (data.records || []).map(serializeAccessRecord).filter(Boolean);
}

export async function replaceClientPaletteAccess({
  consultantId,
  clientRecordId,
  clientEmail,
  clientName,
  paletteCode,
  paletteName,
  fetcher = fetch
}) {
  const safeConsultantId = cleanString(consultantId);
  const safeClientRecordId = cleanString(clientRecordId);
  const safePaletteCode = normalizePaletteCode(paletteCode);
  const safePaletteName = cleanString(paletteName) || PALETTE_NAMES[safePaletteCode] || safePaletteCode;

  if (!safeConsultantId || !safeClientRecordId || !safePaletteCode) {
    throw new Error("Missing palette replacement data");
  }

  const existingRecords = await findActiveClientPaletteAccessRecordsForClient({
    consultantId: safeConsultantId,
    clientRecordId: safeClientRecordId,
    fetcher
  });
  const existing = existingRecords[0];

  if (!existing?.id) {
    const error = new Error("No palette link was found for this client.");
    error.status = 404;
    throw error;
  }

  const fields = {
    ClientEmail: cleanString(clientEmail) || undefined,
    ClientName: cleanString(clientName) || undefined,
    PaletteCode: safePaletteCode,
    PaletteName: safePaletteName,
    Status: "active"
  };

  Object.keys(fields).forEach((fieldName) => {
    if (fields[fieldName] === undefined) delete fields[fieldName];
  });

  const record = await airtableRequest({
    method: "PATCH",
    recordId: existing.id,
    body: { fields },
    fetcher
  });

  await Promise.all(existingRecords.slice(1).map((staleRecord) => airtableRequest({
    method: "PATCH",
    recordId: staleRecord.id,
    body: { fields: { Status: "replaced" } },
    fetcher
  })));

  return serializeAccessRecord(record);
}

export async function createClientPaletteAccess({
  consultantId,
  clientRecordId,
  clientEmail,
  clientName,
  paletteCode,
  paletteName,
  fetcher = fetch
}) {
  const safeConsultantId = cleanString(consultantId);
  const safeClientRecordId = cleanString(clientRecordId);
  const safePaletteCode = normalizePaletteCode(paletteCode);
  const safePaletteName = cleanString(paletteName) || PALETTE_NAMES[safePaletteCode] || safePaletteCode;

  if (!safeConsultantId || !safeClientRecordId || !safePaletteCode) {
    throw new Error("Missing palette access link data");
  }

  const existingClientAccess = await findActiveClientPaletteAccessForClient({
    consultantId: safeConsultantId,
    clientRecordId: safeClientRecordId,
    fetcher
  });

  if (existingClientAccess?.accessUrl) {
    return {
      created: false,
      access: existingClientAccess,
      alreadyHadClientAccess: true
    };
  }

  const existing = await findActiveClientPaletteAccess({
    consultantId: safeConsultantId,
    clientRecordId: safeClientRecordId,
    paletteCode: safePaletteCode,
    fetcher
  });

  if (existing?.accessUrl) {
    return {
      created: false,
      access: existing
    };
  }

  const token = newAccessToken();
  const accessUrl = accessUrlForToken(token);
  const now = new Date().toISOString();
  const fields = {
    TokenHash: tokenHash(token),
    TokenPrefix: token.slice(0, 8),
    ConsultantId: safeConsultantId,
    ClientRecordId: safeClientRecordId,
    ClientEmail: cleanString(clientEmail) || undefined,
    ClientName: cleanString(clientName) || undefined,
    PaletteCode: safePaletteCode,
    PaletteName: safePaletteName,
    AccessUrl: accessUrl,
    Status: "active",
    CreatedAt: now
  };

  Object.keys(fields).forEach((fieldName) => {
    if (fields[fieldName] === undefined) delete fields[fieldName];
  });

  const record = await withAccessTableSetup(() => airtableRequest({
    method: "POST",
    body: { fields },
    fetcher
  }), { fetcher });

  return {
    created: true,
    access: {
      ...serializeAccessRecord(record),
      accessUrl
    }
  };
}

export async function validateClientPaletteAccessToken({ token, fetcher = fetch }) {
  const safeToken = cleanString(token);
  if (!safeToken) {
    const error = new Error("Missing access token");
    error.status = 400;
    throw error;
  }

  const hash = tokenHash(safeToken);
  const data = await withAccessTableSetup(() => airtableRequest({
    searchParams: {
      filterByFormula: `AND({TokenHash}="${escapeFormulaString(hash)}",{Status}="active")`,
      maxRecords: 1
    },
    fetcher
  }), { fetcher });

  const record = data.records?.[0];
  if (!record) {
    const error = new Error("This palette access link is not valid.");
    error.status = 404;
    throw error;
  }

  await airtableRequest({
    method: "PATCH",
    recordId: record.id,
    body: { fields: { LastOpenedAt: new Date().toISOString() } },
    fetcher
  });

  return serializeAccessRecord(record);
}
