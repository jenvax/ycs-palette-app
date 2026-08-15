import assert from "node:assert/strict";
import crypto from "node:crypto";
import test from "node:test";

import { verifyShopifyWebhookHmac } from "../app/services/shopify-webhook-auth.server.js";

test("verifies Shopify webhook HMAC with raw body and API secret", () => {
  const rawBody = JSON.stringify({ id: 123, name: "#23143" });
  const secret = "shpss_test_secret";
  const hmac = crypto
    .createHmac("sha256", secret)
    .update(rawBody, "utf8")
    .digest("base64");

  assert.equal(verifyShopifyWebhookHmac({ rawBody, hmacHeader: hmac, secret }), true);
  assert.equal(verifyShopifyWebhookHmac({ rawBody, hmacHeader: "bad", secret }), false);
});
