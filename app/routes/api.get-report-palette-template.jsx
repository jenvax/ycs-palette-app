/* global process */

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
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Vary": "Origin"
  };
}

function cleanString(value) {
  return String(value || "").trim();
}

function escapeFormulaValue(value) {
  return String(value || "").replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

function firstString(fields, fieldName) {
  const value = fields?.[fieldName];
  return typeof value === "string" ? value.trim() : "";
}

async function fetchAirtableTemplate({ baseId, token, tableName, paletteCode }) {
  const params = new URLSearchParams({
    maxRecords: "1",
    filterByFormula: `{Palette Code}="${escapeFormulaValue(paletteCode)}"`
  });
  const response = await fetch(
    `https://api.airtable.com/v0/${baseId}/${encodeURIComponent(tableName)}?${params.toString()}`,
    {
      headers: {
        Authorization: `Bearer ${token}`
      }
    }
  );
  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    const message = data?.error?.message || data?.error?.type || "Airtable request failed";
    throw new Error(`${response.status} ${message}`);
  }

  return data.records?.[0] || null;
}

export async function loader({ request }) {
  const origin = request.headers.get("Origin") || "";
  const corsHeaders = getCorsHeaders(origin);

  if (request.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: corsHeaders
    });
  }

  try {
    const url = new URL(request.url);
    const paletteCode = cleanString(url.searchParams.get("paletteCode")).toUpperCase();
    const baseId = process.env.AIRTABLE_BASE_ID;
    const token = process.env.AIRTABLE_TOKEN;
    const tableName = process.env.AIRTABLE_REPORT_PALETTE_TEMPLATES_TABLE || "Report Palette Templates";

    if (!paletteCode) {
      return Response.json(
        { error: "Missing paletteCode" },
        { status: 400, headers: corsHeaders }
      );
    }

    if (!baseId || !token) {
      return Response.json(
        { error: "Airtable is not configured" },
        { status: 500, headers: corsHeaders }
      );
    }

    const record = await fetchAirtableTemplate({ baseId, token, tableName, paletteCode });
    const fields = record?.fields || {};

    return Response.json(
      {
        template: record
          ? {
              id: record.id,
              paletteCode: firstString(fields, "Palette Code").toUpperCase(),
              colorFanImageUrl: firstString(fields, "Color Fan Image URL"),
              colorWheelImageUrl: firstString(fields, "Color Wheel Image URL"),
              copy: {
                intro: firstString(fields, "Intro Copy"),
                howItWorks: firstString(fields, "How It Works Copy"),
                colorWheel: firstString(fields, "Color Wheel Copy"),
                depth: firstString(fields, "Default Depth"),
                undertone: firstString(fields, "Default Undertone"),
                chroma: firstString(fields, "Default Chroma"),
                paletteType: firstString(fields, "Palette Type Copy")
              }
            }
          : null
      },
      { status: 200, headers: corsHeaders }
    );
  } catch (error) {
    console.error("Get report palette template failed:", error);

    return Response.json(
      { error: error.message || "Unknown error" },
      { status: 500, headers: corsHeaders }
    );
  }
}
