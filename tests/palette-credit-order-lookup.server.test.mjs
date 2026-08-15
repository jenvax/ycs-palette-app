import test from "node:test";
import assert from "node:assert/strict";

import {
  creditLineItemsFromOrder,
  orderToPaidWebhookPayload
} from "../app/services/palette-credit-orders.server.js";

test("converts Shopify GraphQL order line items into credit webhook payload", () => {
  const payload = orderToPaidWebhookPayload({
    id: "gid://shopify/Order/123",
    legacyResourceId: "123",
    name: "#23141",
    displayFinancialStatus: "PAID",
    customer: {
      id: "gid://shopify/Customer/6080454197472",
      legacyResourceId: "6080454197472",
      email: "trade@example.com",
      firstName: "Trade",
      lastName: "User"
    },
    lineItems: {
      nodes: [
        {
          id: "gid://shopify/LineItem/456",
          sku: "",
          title: "1 Color Palette Credit",
          quantity: 2,
          variant: {
            sku: "YCS-PALETTE-CREDITS-1"
          }
        }
      ]
    }
  });

  assert.equal(payload.id, "123");
  assert.equal(payload.customer.id, "6080454197472");
  assert.equal(payload.line_items[0].sku, "YCS-PALETTE-CREDITS-1");
  assert.deepEqual(creditLineItemsFromOrder(payload), [
    {
      sku: "YCS-PALETTE-CREDITS-1",
      lineItemId: "456",
      title: "1 Color Palette Credit",
      quantity: 2,
      credits: 2
    }
  ]);
});
