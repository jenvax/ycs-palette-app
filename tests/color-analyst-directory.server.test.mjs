import test from "node:test";
import assert from "node:assert/strict";
import { hasDirectoryAccess, normalizeDirectoryListing, validateDirectoryListing } from "../app/services/color-analyst-directory.server.js";

test("YCSMEMBER and TRADE have directory access", () => {
  assert.equal(hasDirectoryAccess(["YCSMEMBER"]), true);
  assert.equal(hasDirectoryAccess(["trade"]), true);
  assert.equal(hasDirectoryAccess(["FREEMEMBER"]), false);
});

test("publish validation requires complete valid fields", () => {
  const listing = normalizeDirectoryListing({ name:"Jen", city:"Richmond", stateProvince:"VA", country:"USA", services:"Virtual", websiteUrl:"https://example.com", contactEmail:"jen@example.com", imageUrl:"https://res.cloudinary.com/example/image.jpg", bio:"I help clients understand their best colors." });
  assert.deepEqual(validateDirectoryListing(listing), {});
  assert.ok(validateDirectoryListing(normalizeDirectoryListing({})).name);
  assert.ok(validateDirectoryListing({ ...listing, websiteUrl:"nope" }).websiteUrl);
});
