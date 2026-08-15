import assert from "node:assert/strict";
import test from "node:test";
import {
  buildCreditEventKey,
  calculateCreditBalance,
  recordTradePaletteCreditEvent
} from "../app/services/trade-palette-credits.server.js";

function responseJson(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" }
  });
}

test("builds a stable credit event idempotency key", () => {
  assert.equal(
    buildCreditEventKey({
      tradeCustomerId: "6426707558624",
      eventType: "purchase",
      sourceType: "shopify_order",
      sourceId: "1001",
      sourceLineItemId: "2002",
      paletteCode: "ccl"
    }),
    "6426707558624__purchase__shopify_order__1001__2002____CCL"
  );
});

test("calculates balance from positive and negative ledger events", () => {
  assert.equal(
    calculateCreditBalance([
      { quantity: 5 },
      { quantity: -1 },
      { quantity: -1 },
      { quantity: 5 }
    ]),
    8
  );
});

test("recordTradePaletteCreditEvent creates a new event once per key", async () => {
  process.env.AIRTABLE_BASE_ID = "app_test";
  process.env.AIRTABLE_TOKEN = "pat_test";
  process.env.AIRTABLE_TRADE_PALETTE_CREDITS_TABLE = "TradePaletteCreditLedger";

  const calls = [];
  const fetcher = async (url, options = {}) => {
    calls.push({ url, options });

    if ((options.method || "GET") === "GET") {
      return responseJson({ records: [] });
    }

    return responseJson({
      id: "rec_credit_1",
      fields: JSON.parse(options.body).fields,
      createdTime: "2026-08-15T12:00:00.000Z"
    });
  };

  const result = await recordTradePaletteCreditEvent({
    tradeCustomerId: "6426707558624",
    eventType: "purchase",
    quantity: 5,
    sourceType: "shopify_order",
    sourceId: "1001",
    sourceLineItemId: "2002",
    fetcher
  });

  assert.equal(result.created, true);
  assert.equal(result.event.quantity, 5);
  assert.equal(calls.length, 2);
  assert.equal(calls[1].options.method, "POST");
});

test("recordTradePaletteCreditEvent returns existing event when key already exists", async () => {
  process.env.AIRTABLE_BASE_ID = "app_test";
  process.env.AIRTABLE_TOKEN = "pat_test";
  process.env.AIRTABLE_TRADE_PALETTE_CREDITS_TABLE = "TradePaletteCreditLedger";

  const calls = [];
  const fetcher = async (url, options = {}) => {
    calls.push({ url, options });
    return responseJson({
      records: [{
        id: "rec_existing",
        fields: {
          Key: "order-line-2002",
          TradeCustomerId: "6426707558624",
          EventType: "purchase",
          Quantity: 5,
          SourceType: "shopify_order",
          SourceId: "1001",
          SourceLineItemId: "2002"
        }
      }]
    });
  };

  const result = await recordTradePaletteCreditEvent({
    tradeCustomerId: "6426707558624",
    eventType: "purchase",
    quantity: 5,
    idempotencyKey: "order-line-2002",
    fetcher
  });

  assert.equal(result.created, false);
  assert.equal(result.event.id, "rec_existing");
  assert.equal(calls.length, 1);
}
);
