import { verifyTradePaletteAccessToken } from "../services/trade-palette-access-token.server.js";
import {
  getTradeClientPaletteAccess,
  giveTradeClientPaletteAccess,
  replaceTradeClientPaletteAccess
} from "../services/trade-palette-access.server.js";

function getCorsHeaders(origin) {
  const allowedOrigins = [
    "https://yourcolorstyle.com",
    "https://www.yourcolorstyle.com"
  ];

  const allowOrigin = allowedOrigins.includes(origin)
    ? origin
    : "https://yourcolorstyle.com";

  return {
    "Access-Control-Allow-Origin": allowOrigin,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Vary": "Origin"
  };
}

export async function loader({ request }) {
  const origin = request.headers.get("Origin") || "";

  return new Response(null, {
    status: 204,
    headers: getCorsHeaders(origin)
  });
}

export async function action({ request }) {
  const origin = request.headers.get("Origin") || "";
  const corsHeaders = getCorsHeaders(origin);

  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  if (request.method !== "POST") {
    return Response.json(
      { error: "Method not allowed" },
      { status: 405, headers: corsHeaders }
    );
  }

  try {
    const body = await request.json();
    const { consultantId } = verifyTradePaletteAccessToken(body.token);
    const mode = String(body.mode || "create").trim().toLowerCase();
    const result = mode === "get"
      ? await getTradeClientPaletteAccess({
          consultantId,
          clientRecordId: body.clientRecordId
        })
      : mode === "replace"
        ? await replaceTradeClientPaletteAccess({
            consultantId,
            clientRecordId: body.clientRecordId,
            paletteCode: body.paletteCode,
            paletteName: body.paletteName,
            updateClientPalette: body.updateClientPalette
          })
        : await giveTradeClientPaletteAccess({
            consultantId,
            clientRecordId: body.clientRecordId,
            paletteCode: body.paletteCode,
            paletteName: body.paletteName,
            updateClientPalette: body.updateClientPalette,
            verifyShopifyAccess: false
          });

    return Response.json(result, { headers: corsHeaders });
  } catch (error) {
    console.error("trade-client-palette-access failed:", error);
    return Response.json(
      {
        error: error.message || "Unable to create the client color palette",
        balance: error.balance
      },
      { status: error.status || 500, headers: corsHeaders }
    );
  }
}
