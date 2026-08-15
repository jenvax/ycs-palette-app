import { recordCreditsForPaidOrder } from "../services/palette-credit-orders.server.js";
import { authenticate } from "../shopify.server";

export const action = async ({ request }) => {
  const { payload, topic, shop } = await authenticate.webhook(request);

  try {
    const result = await recordCreditsForPaidOrder(payload);
    console.log(`Received ${topic} webhook for ${shop}`, result);
  } catch (error) {
    console.error(`Failed to record palette credits from ${topic} webhook for ${shop}:`, error);
    return new Response("Palette credit webhook failed", { status: 500 });
  }

  return new Response();
};
