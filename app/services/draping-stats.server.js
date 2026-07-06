export function parseDrapingDate(value) {
  const normalized = String(value || "").trim();
  if (!normalized) return null;

  const dateOnlyMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(normalized);
  if (dateOnlyMatch) {
    const year = Number(dateOnlyMatch[1]);
    const monthIndex = Number(dateOnlyMatch[2]) - 1;
    const day = Number(dateOnlyMatch[3]);
    const date = new Date(year, monthIndex, day);

    if (
      date.getFullYear() !== year ||
      date.getMonth() !== monthIndex ||
      date.getDate() !== day
    ) {
      return null;
    }

    return date;
  }

  const date = new Date(normalized);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function getDrapingRecencyBucket(dateValue, now = new Date()) {
  const date = parseDrapingDate(dateValue);
  if (!date || Number.isNaN(now.getTime())) return "never";

  const diffMonths =
    (now.getFullYear() - date.getFullYear()) * 12 +
    (now.getMonth() - date.getMonth());

  const buckets = [
    "thisMonth",
    "lastMonth",
    "twoMonthsAgo",
    "threeMonthsAgo",
    "fourMonthsAgo",
    "fiveMonthsAgo",
    "sixMonthsAgo"
  ];

  return buckets[diffMonths] || "older";
}

export function getDrapingRecencyBuckets(history, now = new Date()) {
  const buckets = new Set();

  for (const entry of Array.isArray(history) ? history : []) {
    const bucket = getDrapingRecencyBucket(entry?.drapedDate, now);
    if (bucket !== "never") buckets.add(bucket);
  }

  return [...buckets];
}

export function isDueForDraping(
  { membershipStatus, hasPhoto, lastDrapedDate },
  now = new Date()
) {
  const status = String(membershipStatus || "").trim().toLowerCase();
  if ((status !== "active" && status !== "legacy") || !hasPhoto) return false;

  const bucket = getDrapingRecencyBucket(lastDrapedDate, now);
  return [
    "fourMonthsAgo",
    "fiveMonthsAgo",
    "sixMonthsAgo",
    "older",
    "never"
  ].includes(bucket);
}
