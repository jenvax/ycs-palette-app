import crypto from "node:crypto";

export const DIRECTORY_TABLE = process.env.AIRTABLE_DIRECTORY_TABLE || "ColorAnalystDirectory";
export const DIRECTORY_BIO_LIMIT = 600;
export const DIRECTORY_MEMBER_TAGS = new Set(["YCSMEMBER", "TRADE", "YCS_ADMIN"]);

const clean = (value) => String(value || "").trim();
const customerId = (value) => clean(value).replace("gid://shopify/Customer/", "");
const escapeFormula = (value) => clean(value).replace(/\\/g, "\\\\").replace(/"/g, '\\"');

export function hasDirectoryAccess(tags = []) {
  return tags.some((tag) => DIRECTORY_MEMBER_TAGS.has(clean(tag).toUpperCase()));
}

export function normalizeDirectoryListing(input = {}) {
  return {
    name: clean(input.name).slice(0, 120),
    businessName: clean(input.businessName).slice(0, 160),
    city: clean(input.city).slice(0, 100),
    stateProvince: clean(input.stateProvince).slice(0, 100),
    country: clean(input.country).slice(0, 100),
    services: ["In-Person", "Virtual", "Both"].includes(input.services) ? input.services : "",
    websiteUrl: clean(input.websiteUrl).slice(0, 500),
    contactEmail: clean(input.contactEmail).slice(0, 254),
    socialUrl: clean(input.socialUrl).slice(0, 500),
    imageUrl: clean(input.imageUrl).slice(0, 1000),
    imagePublicId: clean(input.imagePublicId).slice(0, 300),
    bio: clean(input.bio).slice(0, DIRECTORY_BIO_LIMIT)
  };
}

function validUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

export function validateDirectoryListing(listing) {
  const errors = {};
  ["name", "city", "stateProvince", "country", "services", "websiteUrl", "contactEmail", "imageUrl", "bio"].forEach((field) => {
    if (!listing[field]) errors[field] = "Required";
  });
  if (listing.websiteUrl && !validUrl(listing.websiteUrl)) errors.websiteUrl = "Enter a complete website URL";
  if (listing.socialUrl && !validUrl(listing.socialUrl)) errors.socialUrl = "Enter a complete social media URL";
  if (listing.contactEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(listing.contactEmail)) errors.contactEmail = "Enter a valid email address";
  if (listing.bio.length > DIRECTORY_BIO_LIMIT) errors.bio = `Use ${DIRECTORY_BIO_LIMIT} characters or fewer`;
  return errors;
}

async function airtable(url, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: { Authorization: `Bearer ${process.env.AIRTABLE_TOKEN}`, "Content-Type": "application/json", ...(options.headers || {}) }
  });
  const data = await response.json();
  if (!response.ok) throw Object.assign(new Error(data?.error?.message || "Airtable request failed"), { status: response.status });
  return data;
}

function tableUrl() {
  return `https://api.airtable.com/v0/${process.env.AIRTABLE_BASE_ID}/${encodeURIComponent(DIRECTORY_TABLE)}`;
}

function serialize(record) {
  if (!record) return null;
  const f = record.fields || {};
  return { id: record.id, name: f.Name || "", businessName: f.BusinessName || "", city: f.City || "", stateProvince: f.StateProvince || "", country: f.Country || "", services: f.Services || "", websiteUrl: f.WebsiteUrl || "", contactEmail: f.ContactEmail || "", socialUrl: f.SocialUrl || "", imageUrl: f.ImageUrl || "", imagePublicId: f.ImagePublicId || "", bio: f.Bio || "", status: f.Status || "draft" };
}

async function findByCustomerId(id) {
  const params = new URLSearchParams({ filterByFormula: `{CustomerId}="${escapeFormula(id)}"`, maxRecords: "1" });
  const data = await airtable(`${tableUrl()}?${params}`);
  return data.records?.[0] || null;
}

export async function getOwnDirectoryListing(id) {
  return serialize(await findByCustomerId(customerId(id)));
}

export async function saveOwnDirectoryListing(id, input, { publish = false } = {}) {
  const owner = customerId(id);
  const listing = normalizeDirectoryListing(input);
  const errors = publish ? validateDirectoryListing(listing) : {};
  if (Object.keys(errors).length) throw Object.assign(new Error("Please complete the required fields"), { status: 422, errors });
  const existing = await findByCustomerId(owner);
  const now = new Date().toISOString();
  const fields = { CustomerId: owner, Name: listing.name, BusinessName: listing.businessName, City: listing.city, StateProvince: listing.stateProvince, Country: listing.country, Services: listing.services, WebsiteUrl: listing.websiteUrl, ContactEmail: listing.contactEmail, SocialUrl: listing.socialUrl, ImageUrl: listing.imageUrl, ImagePublicId: listing.imagePublicId, Bio: listing.bio, Status: publish ? "published" : (existing?.fields?.Status || "draft"), UpdatedAt: now };
  let record;
  if (existing) record = await airtable(`${tableUrl()}/${existing.id}`, { method: "PATCH", body: JSON.stringify({ fields }) });
  else record = (await airtable(tableUrl(), { method: "POST", body: JSON.stringify({ fields: { ...fields, CreatedAt: now } }) }));
  return serialize(record);
}

export async function setOwnDirectoryStatus(id, status) {
  const existing = await findByCustomerId(customerId(id));
  if (!existing) throw Object.assign(new Error("Listing not found"), { status: 404 });
  const record = await airtable(`${tableUrl()}/${existing.id}`, { method: "PATCH", body: JSON.stringify({ fields: { Status: status, UpdatedAt: new Date().toISOString() } }) });
  return serialize(record);
}

export async function deleteOwnDirectoryListing(id) {
  const existing = await findByCustomerId(customerId(id));
  if (!existing) return;
  await airtable(`${tableUrl()}/${existing.id}`, { method: "DELETE" });
}

async function shopify(query, variables) {
  const response = await fetch(`https://${process.env.SHOPIFY_SHOP}/admin/api/2026-01/graphql.json`, { method: "POST", headers: { "Content-Type": "application/json", "X-Shopify-Access-Token": process.env.SHOPIFY_ADMIN_ACCESS_TOKEN }, body: JSON.stringify({ query, variables }) });
  const json = await response.json();
  if (!response.ok || json.errors) throw new Error(json.errors?.[0]?.message || "Shopify request failed");
  return json.data;
}

export async function getCustomerDirectoryEligibility(id) {
  try {
    const data = await shopify(`query($id: ID!) { customer(id: $id) { tags } }`, { id: `gid://shopify/Customer/${customerId(id)}` });
    return hasDirectoryAccess(data.customer?.tags || []);
  } catch (error) {
    console.warn("Shopify directory eligibility lookup failed; using synced Airtable tags", error.message);
    const params = new URLSearchParams({ filterByFormula: `{CustomerId}="${escapeFormula(customerId(id))}"`, maxRecords: "1" });
    const data = await airtable(`https://api.airtable.com/v0/${process.env.AIRTABLE_BASE_ID}/${encodeURIComponent("CustomerDirectory")}?${params}`);
    const tags = String(data.records?.[0]?.fields?.Tags || "").split(",");
    return hasDirectoryAccess(tags);
  }
}

export async function getPublishedDirectoryListings() {
  const params = new URLSearchParams({ filterByFormula: `{Status}="published"` });
  const data = await airtable(`${tableUrl()}?${params}`);
  const records = data.records || [];
  if (!records.length) return [];
  const ids = records.map((record) => `gid://shopify/Customer/${customerId(record.fields?.CustomerId)}`);
  let eligible;
  try {
    const result = await shopify(`query($ids: [ID!]!) { nodes(ids: $ids) { ... on Customer { id tags } } }`, { ids });
    eligible = new Set((result.nodes || []).filter((node) => node && hasDirectoryAccess(node.tags)).map((node) => customerId(node.id)));
  } catch (error) {
    console.warn("Shopify public directory eligibility lookup failed; using synced Airtable tags", error.message);
    const clauses = records.map((record) => `{CustomerId}="${escapeFormula(customerId(record.fields?.CustomerId))}"`).join(",");
    const params = new URLSearchParams({ filterByFormula: `OR(${clauses})` });
    const customers = await airtable(`https://api.airtable.com/v0/${process.env.AIRTABLE_BASE_ID}/${encodeURIComponent("CustomerDirectory")}?${params}`);
    eligible = new Set((customers.records || []).filter((record) => hasDirectoryAccess(String(record.fields?.Tags || "").split(","))).map((record) => customerId(record.fields?.CustomerId)));
  }
  return records.filter((record) => eligible.has(customerId(record.fields?.CustomerId))).map(serialize);
}

export async function uploadDirectoryImage(imageBase64, ownerId) {
  const match = clean(imageBase64).match(/^data:(image\/(?:jpeg|png|webp));base64,(.+)$/);
  if (!match || Buffer.byteLength(match[2], "base64") > 5 * 1024 * 1024) throw Object.assign(new Error("Upload a JPG, PNG, or WebP image up to 5 MB"), { status: 400 });
  const timestamp = Math.floor(Date.now() / 1000);
  const folder = `ycs-directory/${customerId(ownerId)}`;
  const signature = crypto.createHash("sha1").update(`folder=${folder}&timestamp=${timestamp}${process.env.CLOUDINARY_API_SECRET}`).digest("hex");
  const form = new FormData();
  form.append("file", imageBase64); form.append("api_key", process.env.CLOUDINARY_API_KEY); form.append("timestamp", String(timestamp)); form.append("folder", folder); form.append("signature", signature);
  const response = await fetch(`https://api.cloudinary.com/v1_1/${process.env.CLOUDINARY_CLOUD_NAME}/image/upload`, { method: "POST", body: form });
  const data = await response.json();
  if (!response.ok) throw new Error(data?.error?.message || "Image upload failed");
  return { imageUrl: data.secure_url, imagePublicId: data.public_id };
}
