import test from "node:test";
import assert from "node:assert/strict";
import sharp from "sharp";
import { DIRECTORY_BIO_LIMIT, hasDirectoryAccess, normalizeDirectoryListing, validateDirectoryImageUpload, validateDirectoryListing } from "../app/services/color-analyst-directory.server.js";

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

test("bio validation rejects new or edited content over 180 characters without truncating it", () => {
  const bio = "A".repeat(DIRECTORY_BIO_LIMIT + 1);
  const listing = normalizeDirectoryListing({ bio });

  assert.equal(DIRECTORY_BIO_LIMIT, 180);
  assert.equal(listing.bio, bio);
  assert.equal(validateDirectoryListing(listing).bio, "Use 180 characters or fewer");
});

test("directory image validation requires the final 800 by 1000 crop", async () => {
  const validBuffer = await sharp({ create: { width: 800, height: 1000, channels: 3, background: "#ffffff" } }).jpeg().toBuffer();
  const valid = `data:image/jpeg;base64,${validBuffer.toString("base64")}`;
  await assert.doesNotReject(validateDirectoryImageUpload(valid));

  const wrongBuffer = await sharp({ create: { width: 1000, height: 800, channels: 3, background: "#ffffff" } }).jpeg().toBuffer();
  const wrong = `data:image/jpeg;base64,${wrongBuffer.toString("base64")}`;
  await assert.rejects(validateDirectoryImageUpload(wrong), /800 × 1000/);
  await assert.rejects(validateDirectoryImageUpload("data:image/gif;base64,AAAA"), /JPG, PNG, or WebP/);
});
