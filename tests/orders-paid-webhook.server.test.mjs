import assert from "node:assert/strict";
import test from "node:test";
import {
  creditLineItemsFromOrder,
  recordCreditsForPaidOrder
} from "../app/services/palette-credit-orders.server.js";

test("detects palette credit SKUs and multiplies by line item quantity", () => {
  const items = creditLineItemsFromOrder({
    line_items: [
      {
        id: 111,
        sku: "YCS-PALETTE-CREDITS-5",
        quantity: 2,
        title: "5 Color Palette Credits"
      },
      {
        id: 222,
        sku: "OTHER-SKU",
        quantity: 1,
        title: "Something else"
      },
      {
        id: 333,
        sku: "YCS-PALETTE-CREDITS-20",
        quantity: 1,
        title: "20 Color Palette Credits"
      }
    ]
  });

  assert.deepEqual(items.map((item) => ({
    sku: item.sku,
    lineItemId: item.lineItemId,
    credits: item.credits
  })), [
    {
      sku: "YCS-PALETTE-CREDITS-5",
      lineItemId: "111",
      credits: 10
    },
    {
      sku: "YCS-PALETTE-CREDITS-20",
      lineItemId: "333",
      credits: 20
    }
  ]);
});

test("returns skipped result when paid order has no credit SKU", async () => {
  const result = await recordCreditsForPaidOrder({
    id: 1001,
    customer: { id: 6426707558624 },
    line_items: [{ id: 1, sku: "OTHER-SKU", quantity: 1 }]
  });

  assert.equal(result.skipped, true);
  assert.equal(result.reason, "no_credit_skus");
});
