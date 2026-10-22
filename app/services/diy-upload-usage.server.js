const TABLE = "UploadUsage";
const TOOL = "photo-prep";
const LIMIT = 3;

function config() {
  const base = process.env.AIRTABLE_BASE_ID;
  const token = process.env.AIRTABLE_TOKEN;
  if (!base || !token) throw new Error("Missing Airtable configuration");
  return { base, token };
}

function keyFor(customerId) {
  return `${customerId}__${TOOL}__TOTAL`;
}

async function findRecord(customerId) {
  const { base, token } = config();
  const key = keyFor(customerId);
  const formula = `{Key}="${key}"`;
  const response = await fetch(
    `https://api.airtable.com/v0/${base}/${encodeURIComponent(TABLE)}?filterByFormula=${encodeURIComponent(formula)}`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  if (!response.ok) throw new Error("Could not load DIY upload usage");
  const data = await response.json();
  return { key, record: data.records?.[0] || null };
}

export async function getDiyUploadUsage(customerId) {
  const { key, record } = await findRecord(customerId);
  const used = Number(record?.fields?.UploadCount || 0);
  return {
    tool: TOOL,
    allowed: used < LIMIT,
    used,
    remaining: Math.max(0, LIMIT - used),
    limit: LIMIT,
    scope: "total",
    usageKey: key,
    monthKey: "TOTAL"
  };
}

export async function incrementDiyUploadUsage(customerId) {
  const { base, token } = config();
  const { key, record } = await findRecord(customerId);
  const used = Number(record?.fields?.UploadCount || 0);
  if (used >= LIMIT) return getDiyUploadUsage(customerId);

  const fields = {
    Key: key,
    CustomerId: String(customerId),
    MonthKey: "TOTAL",
    UploadCount: used + 1
  };
  const url = record
    ? `https://api.airtable.com/v0/${base}/${encodeURIComponent(TABLE)}/${record.id}`
    : `https://api.airtable.com/v0/${base}/${encodeURIComponent(TABLE)}`;
  const response = await fetch(url, {
    method: record ? "PATCH" : "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ fields })
  });
  if (!response.ok) throw new Error("Could not update DIY upload usage");
  return { ...fields, allowed: fields.UploadCount < LIMIT, remaining: LIMIT - fields.UploadCount, limit: LIMIT };
}
