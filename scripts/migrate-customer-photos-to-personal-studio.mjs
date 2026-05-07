function normalizeCustomerId(value) {
  return String(value || "")
    .replace("gid://shopify/Customer/", "")
    .trim();
}

function getActivePhotoUrl(fields) {
  return (
    fields.ActivePhotoUrl ||
    fields.AdjustedPhotoUrl ||
    fields.PhotoUrl ||
    fields.OriginalPhotoUrl ||
    null
  );
}

function buildPhotoId() {
  return `psp_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

async function airtableFetchJson(url, token, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...(options.headers || {})
    }
  });

  const data = await response.json();

  if (!response.ok) {
    const message = data?.error?.message || data?.error || JSON.stringify(data);
    throw new Error(`${response.status} ${message} (${url})`);
  }

  return data;
}

async function fetchAllRecords({ baseId, tableName, token }) {
  const records = [];
  let offset = "";

  do {
    const params = new URLSearchParams();
    if (offset) params.set("offset", offset);

    const data = await airtableFetchJson(
      `https://api.airtable.com/v0/${baseId}/${encodeURIComponent(tableName)}?${params.toString()}`,
      token
    );

    records.push(...(data.records || []));
    offset = data.offset || "";
  } while (offset);

  return records;
}

async function createPersonalStudioPhoto({ baseId, token, fields }) {
  const url = `https://api.airtable.com/v0/${baseId}/${encodeURIComponent("PersonalStudioPhotos")}`;
  const fieldsToWrite = { ...fields };
  let data;

  while (true) {
    try {
      data = await airtableFetchJson(url, token, {
        method: "POST",
        body: JSON.stringify({
          records: [{ fields: fieldsToWrite }]
        })
      });
      break;
    } catch (error) {
      const match = String(error.message || "").match(/Unknown field name: "([^"]+)"/);

      if (!match) {
        throw error;
      }

      const unknownField = match[1];
      delete fieldsToWrite[unknownField];
      console.warn(`Removed unknown PersonalStudioPhotos field and retrying: ${unknownField}`);
    }
  }

  return data.records?.[0] || null;
}

const shouldWrite = process.argv.includes("--write");
const baseId = process.env.AIRTABLE_BASE_ID;
const token = process.env.AIRTABLE_TOKEN;

if (!baseId || !token) {
  console.error("Missing AIRTABLE_BASE_ID or AIRTABLE_TOKEN.");
  process.exit(1);
}

let customerPhotos;
let personalPhotos;

try {
  customerPhotos = await fetchAllRecords({
    baseId,
    tableName: "CustomerPhotos",
    token
  });
} catch (error) {
  console.error("Could not read CustomerPhotos.");
  console.error(error.message);
  process.exit(1);
}

try {
  personalPhotos = await fetchAllRecords({
    baseId,
    tableName: "PersonalStudioPhotos",
    token
  });
} catch (error) {
  console.error("Could not read PersonalStudioPhotos.");
  console.error(error.message);
  process.exit(1);
}

let skippedNoCustomer = 0;
let skippedNoPhoto = 0;
let alreadyExists = 0;
let created = 0;
const pending = [];

for (const customerPhoto of customerPhotos) {
  const fields = customerPhoto.fields || {};
  const customerId = normalizeCustomerId(fields.CustomerId);
  const activePhotoUrl = getActivePhotoUrl(fields);

  if (!customerId) {
    skippedNoCustomer += 1;
    continue;
  }

  if (!activePhotoUrl) {
    skippedNoPhoto += 1;
    continue;
  }

  const exists = personalPhotos.some((record) => {
    const personalFields = record.fields || {};
    return (
      normalizeCustomerId(personalFields.CustomerId) === customerId &&
      String(getActivePhotoUrl(personalFields) || "") === String(activePhotoUrl || "")
    );
  });

  if (exists) {
    alreadyExists += 1;
    continue;
  }

  const nextFields = {
    CustomerId: customerId,
    PhotoId: buildPhotoId(),
    OriginalPhotoUrl: fields.OriginalPhotoUrl || fields.PhotoUrl || activePhotoUrl,
    AdjustedPhotoUrl: fields.AdjustedPhotoUrl || "",
    ActivePhotoUrl: activePhotoUrl
  };

  if (fields.PhotoTransform) nextFields.PhotoTransform = fields.PhotoTransform;
  if (fields.PhotoTransformJson) nextFields.PhotoTransformJson = fields.PhotoTransformJson;
  if (fields.LipMaskJson) nextFields.LipMaskJson = fields.LipMaskJson;

  pending.push({
    sourceRecordId: customerPhoto.id,
    customerId,
    activePhotoUrl,
    fields: nextFields
  });
}

console.log(`CustomerPhotos records: ${customerPhotos.length}`);
console.log(`PersonalStudioPhotos records: ${personalPhotos.length}`);
console.log(`Already migrated by matching photo URL: ${alreadyExists}`);
console.log(`Skipped without customer: ${skippedNoCustomer}`);
console.log(`Skipped without photo URL: ${skippedNoPhoto}`);
console.log(`Pending migration: ${pending.length}`);

if (!shouldWrite) {
  pending.slice(0, 20).forEach((item) => {
    console.log(`DRY RUN ${item.sourceRecordId} -> ${item.fields.PhotoId} customer=${item.customerId}`);
  });
  console.log("Dry run only. Re-run with --write to create PersonalStudioPhotos records.");
  process.exit(0);
}

for (const item of pending) {
  const record = await createPersonalStudioPhoto({
    baseId,
    token,
    fields: item.fields
  });

  created += 1;
  personalPhotos.push(record);
  console.log(`Created ${record.id} from ${item.sourceRecordId} customer=${item.customerId}`);
}

console.log(`Created records: ${created}`);
