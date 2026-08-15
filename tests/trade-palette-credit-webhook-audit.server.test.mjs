import assert from "node:assert/strict";
import test from "node:test";

import {
  listPaletteCreditWebhookAudits,
  recordPaletteCreditWebhookAudit,
  summarizeWebhookPayload
} from "../app/services/trade-palette-credit-webhook-audit.server.js";

function setupEnv() {
  process.env.AIRTABLE_BASE_ID = "app_test";
  process.env.AIRTABLE_TOKEN = "pat_test";
  process.env.AIRTABLE_SCHEMA_TOKEN = "pat_schema";
  process.env.AIRTABLE_TRADE_PALETTE_CREDIT_WEBHOOK_AUDIT_TABLE = "TradePaletteCreditWebhookAudit";
}

test("summarizes paid order webhook payload", () => {
  const summary = summarizeWebhookPayload({
    id: 123,
    name: "#23142",
    customer: {
      admin_graphql_api_id: "gid://shopify/Customer/6080454197472",
      email: "trade@example.com"
    },
    line_items: [
      {
        admin_graphql_api_id: "gid://shopify/LineItem/456",
        sku: "YCS-PALETTE-CREDITS-1",
        quantity: 1,
        title: "Color Palette Credits"
      }
    ]
  });

  assert.equal(summary.orderId, "123");
  assert.equal(summary.orderName, "#23142");
  assert.equal(summary.tradeCustomerId, "6080454197472");
  assert.equal(summary.lineItems[0].id, "456");
});

test("records webhook audit and creates missing table", async () => {
  setupEnv();
  const calls = [];
  const fetcher = async (url, options = {}) => {
    calls.push({ url, options });

    if (calls.length === 1) {
      return new Response(JSON.stringify({ error: { type: "TABLE_NOT_FOUND", message: "Missing" } }), { status: 404 });
    }

    if (String(url).includes("/meta/bases/")) {
      return Response.json({ id: "tbl_audit", name: "TradePaletteCreditWebhookAudit" });
    }

    return Response.json({
      records: [
        {
          id: "rec_audit",
          fields: {
            CreatedAt: "2026-08-15T18:30:00.000Z",
            Topic: "orders/paid",
            Shop: "yourcolorstyle.myshopify.com",
            WebhookId: "webhook_1",
            OrderId: "123",
            OrderName: "#23142",
            TradeCustomerId: "6080454197472",
            CustomerEmail: "trade@example.com",
            Status: "processed",
            Result: "{\"success\":true}",
            Error: ""
          }
        }
      ]
    });
  };

  const audit = await recordPaletteCreditWebhookAudit({
    topic: "orders/paid",
    shop: "yourcolorstyle.myshopify.com",
    webhookId: "webhook_1",
    payload: {
      id: 123,
      name: "#23142",
      customer: { id: 6080454197472, email: "trade@example.com" }
    },
    status: "processed",
    result: { success: true },
    fetcher
  });

  assert.equal(audit.id, "rec_audit");
  assert.equal(audit.status, "processed");
  assert.equal(calls.length, 3);
});

test("lists webhook audits newest first", async () => {
  setupEnv();
  const events = await listPaletteCreditWebhookAudits({
    fetcher: async () => Response.json({
      records: [
        {
          id: "old",
          fields: {
            CreatedAt: "2026-08-15T18:00:00.000Z",
            Status: "processed"
          }
        },
        {
          id: "new",
          fields: {
            CreatedAt: "2026-08-15T18:30:00.000Z",
            Status: "failed"
          }
        }
      ]
    })
  });

  assert.equal(events[0].id, "new");
  assert.equal(events[1].id, "old");
});
