import assert from "node:assert/strict";
import test from "node:test";

import {
  getDrapingRecencyBucket,
  getDrapingRecencyBuckets,
  parseDrapingDate
} from "../app/services/draping-stats.server.js";

test("date-only draping values retain their written calendar date", () => {
  const date = parseDrapingDate("2026-07-01");

  assert.equal(date.getFullYear(), 2026);
  assert.equal(date.getMonth(), 6);
  assert.equal(date.getDate(), 1);
});

test("first-of-month drapes stay in the current month bucket", () => {
  const now = new Date(2026, 6, 6, 12);

  assert.equal(getDrapingRecencyBucket("2026-07-01", now), "thisMonth");
  assert.equal(getDrapingRecencyBucket("2026-06-30", now), "lastMonth");
});

test("recency buckets cover the preceding six calendar months", () => {
  const now = new Date(2026, 6, 6, 12);

  assert.equal(getDrapingRecencyBucket("2026-05-15", now), "twoMonthsAgo");
  assert.equal(getDrapingRecencyBucket("2026-01-15", now), "sixMonthsAgo");
  assert.equal(getDrapingRecencyBucket("2025-12-31", now), "older");
});

test("missing and invalid draping dates are never-draped", () => {
  const now = new Date(2026, 6, 6, 12);

  assert.equal(getDrapingRecencyBucket("", now), "never");
  assert.equal(getDrapingRecencyBucket("2026-02-31", now), "never");
  assert.equal(getDrapingRecencyBucket("not-a-date", now), "never");
});

test("a member is included in every month where they were draped", () => {
  const now = new Date(2026, 6, 6, 12);
  const history = [
    { drapedDate: "2026-06-10" },
    { drapedDate: "2026-03-22" },
    { drapedDate: "2026-03-08" }
  ];

  assert.deepEqual(
    getDrapingRecencyBuckets(history, now),
    ["lastMonth", "fourMonthsAgo"]
  );
});
