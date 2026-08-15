const DEFAULT_CREDIT_LEDGER_TABLE = "TradePaletteCreditLedger";

function cleanString(value) {
  const stringValue = String(value || "").trim();
  return stringValue || "";
}

function normalizeQuantity(value) {
  const quantity = Number(value);
  return Number.isFinite(quantity) ? Math.trunc(quantity) : 0;
}

function escapeFormulaString(value) {
  return String(value || "").replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

function airtableConfig() {
  const baseId = process.env.AIRTABLE_BASE_ID;
  const token = process.env.AIRTABLE_TOKEN;
  const tableName = process.env.AIRTABLE_TRADE_PALETTE_CREDITS_TABLE || DEFAULT_CREDIT_LEDGER_TABLE;

  if (!baseId || !token) {
    throw new Error("Missing Airtable configuration");
  }

  return { baseId, token, tableName };
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
  const encodedTable = encodeURIComponent(tableName);
  const url = new URL(`https://api.airtable.com/v0/${baseId}/${encodedTable}${recordId ? `/${recordId}` : ""}`);

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

async function fetchAllCreditEvents({ tradeCustomerId, fetcher = fetch }) {
  const safeTradeCustomerId = cleanString(tradeCustomerId);
  if (!safeTradeCustomerId) {
    throw new Error("Missing tradeCustomerId");
  }

  const records = [];
  let offset = "";

  do {
    const data = await airtableRequest({
      fetcher,
      searchParams: {
        filterByFormula: `{TradeCustomerId}="${escapeFormulaString(safeTradeCustomerId)}"`,
        pageSize: 100,
        offset
      }
    });

    records.push(...(data.records || []));
    offset = data.offset || "";
  } while (offset);

  return records.map(serializeCreditEvent);
}

async function findCreditEventByKey({ key, fetcher = fetch }) {
  const safeKey = cleanString(key);
  if (!safeKey) return null;

  const data = await airtableRequest({
    fetcher,
    searchParams: {
      filterByFormula: `{Key}="${escapeFormulaString(safeKey)}"`,
      maxRecords: 1
    }
  });

  const record = data.records?.[0];
  return record ? serializeCreditEvent(record) : null;
}

export function buildCreditEventKey({
  tradeCustomerId,
  eventType,
  sourceType,
  sourceId,
  sourceLineItemId,
  clientRecordId,
  paletteCode
}) {
  return [
    cleanString(tradeCustomerId),
    cleanString(eventType).toLowerCase(),
    cleanString(sourceType).toLowerCase(),
    cleanString(sourceId),
    cleanString(sourceLineItemId),
    cleanString(clientRecordId),
    cleanString(paletteCode).toUpperCase()
  ].join("__");
}

export function calculateCreditBalance(events) {
  return (Array.isArray(events) ? events : []).reduce((sum, event) => {
    return sum + normalizeQuantity(event.quantity ?? event.fields?.Quantity);
  }, 0);
}

export function serializeCreditEvent(record) {
  const fields = record?.fields || {};

  return {
    id: record?.id || "",
    key: cleanString(fields.Key),
    tradeCustomerId: cleanString(fields.TradeCustomerId),
    eventType: cleanString(fields.EventType),
    quantity: normalizeQuantity(fields.Quantity),
    sourceType: cleanString(fields.SourceType),
    sourceId: cleanString(fields.SourceId),
    sourceLineItemId: cleanString(fields.SourceLineItemId),
    clientRecordId: cleanString(fields.ClientRecordId),
    clientEmail: cleanString(fields.ClientEmail),
    paletteCode: cleanString(fields.PaletteCode).toUpperCase(),
    notes: cleanString(fields.Notes),
    createdAt: cleanString(fields.CreatedAt || record?.createdTime)
  };
}

export async function getTradePaletteCreditBalance({ tradeCustomerId, fetcher = fetch }) {
  const events = await fetchAllCreditEvents({ tradeCustomerId, fetcher });
  const balance = calculateCreditBalance(events);

  return {
    tradeCustomerId: cleanString(tradeCustomerId),
    balance,
    events
  };
}

export async function recordTradePaletteCreditEvent({
  tradeCustomerId,
  eventType,
  quantity,
  sourceType,
  sourceId,
  sourceLineItemId,
  clientRecordId,
  clientEmail,
  paletteCode,
  notes,
  idempotencyKey,
  fetcher = fetch
}) {
  const safeTradeCustomerId = cleanString(tradeCustomerId);
  const safeEventType = cleanString(eventType);
  const safeQuantity = normalizeQuantity(quantity);

  if (!safeTradeCustomerId) {
    throw new Error("Missing tradeCustomerId");
  }

  if (!safeEventType) {
    throw new Error("Missing eventType");
  }

  if (!safeQuantity) {
    throw new Error("Missing quantity");
  }

  const key = cleanString(idempotencyKey) || buildCreditEventKey({
    tradeCustomerId: safeTradeCustomerId,
    eventType: safeEventType,
    sourceType,
    sourceId,
    sourceLineItemId,
    clientRecordId,
    paletteCode
  });

  if (!key.replace(/_/g, "")) {
    throw new Error("Missing idempotency key data");
  }

  const existing = await findCreditEventByKey({ key, fetcher });
  if (existing) {
    return {
      created: false,
      event: existing
    };
  }

  const fields = {
    Key: key,
    TradeCustomerId: safeTradeCustomerId,
    EventType: safeEventType,
    Quantity: safeQuantity,
    SourceType: cleanString(sourceType) || undefined,
    SourceId: cleanString(sourceId) || undefined,
    SourceLineItemId: cleanString(sourceLineItemId) || undefined,
    ClientRecordId: cleanString(clientRecordId) || undefined,
    ClientEmail: cleanString(clientEmail) || undefined,
    PaletteCode: cleanString(paletteCode).toUpperCase() || undefined,
    Notes: cleanString(notes) || undefined,
    CreatedAt: new Date().toISOString()
  };

  Object.keys(fields).forEach((fieldName) => {
    if (fields[fieldName] === undefined) {
      delete fields[fieldName];
    }
  });

  const record = await airtableRequest({
    method: "POST",
    body: { fields },
    fetcher
  });

  return {
    created: true,
    event: serializeCreditEvent(record)
  };
}
