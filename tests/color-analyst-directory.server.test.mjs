import test from "node:test";
import assert from "node:assert/strict";
import { DIRECTORY_BIO_LIMIT, hasDirectoryAccess, normalizeDirectoryListing, validateDirectoryListing } from "../app/services/color-analyst-directory.server.js";

test("YCSMEMBER and TRADE have directory access", () => {
  assert.equal(hasDirectoryAccess(["YCSMEMBER"]), true);
  assert.equal(hasDirectoryAccess(["trade"]), true);
  assert.equal(hasDirectoryAccess(["YCS_ADMIN"]), true);
  assert.equal(hasDirectoryAccess(["FREEMEMBER"]), false);
});

test("publish validation requires complete valid fields", () => {
  const listing = normalizeDirectoryListing({ name:"Jen", city:"Richmond", stateProvince:"VA", country:"USA", services:"Virtual", websiteUrl:"https://example.com", contactEmail:"jen@example.com", imageUrl:"https://res.cloudinary.com/example/image.jpg", bio:"I help clients understand their best colors." });
  assert.deepEqual(validateDirectoryListing(listing), {});
  assert.ok(validateDirectoryListing(normalizeDirectoryListing({})).name);
  assert.ok(validateDirectoryListing({ ...listing, websiteUrl:"nope" }).websiteUrl);
});

test("bio validation rejects new or edited content over 300 characters without truncating it", () => {
  const bio = "A".repeat(DIRECTORY_BIO_LIMIT + 1);
  const listing = normalizeDirectoryListing({ bio });

  assert.equal(DIRECTORY_BIO_LIMIT, 300);
  assert.equal(listing.bio, bio);
  assert.equal(validateDirectoryListing(listing).bio, "Use 300 characters or fewer");
});
