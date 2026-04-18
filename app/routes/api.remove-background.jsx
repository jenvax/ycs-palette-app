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
    return new Response(null, {
      status: 204,
      headers: corsHeaders
    });
  }

  if (request.method !== "POST") {
    return Response.json(
      { error: "Method not allowed" },
      {
        status: 405,
        headers: corsHeaders
      }
    );
  }

  try {
    const {
  imageBase64,
  customerId,
  isAdmin,
  isTrade,
  isCatool,
  isCatoolGrowth
} = await request.json();

    if (!imageBase64 || !customerId) {
      return Response.json(
        { error: "Missing imageBase64 or customerId" },
        {
          status: 400,
          headers: corsHeaders
        }
      );
    }

    const airtableBase = process.env.AIRTABLE_BASE_ID;
    const airtableToken = process.env.AIRTABLE_TOKEN;
    const usageTable = "UploadUsage";

    if (!airtableBase || !airtableToken || !process.env.REMOVE_BG_API_KEY) {
      return Response.json(
        { error: "Missing server configuration" },
        {
          status: 500,
          headers: corsHeaders
        }
      );
    }

    // ===== HELPERS =====
function getMonthKey() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

function buildUsageKey(customerId, tool, monthKey) {
  return `${customerId}__${tool}__${monthKey}`;
}

function getPhotoPrepLimit({ isAdmin, isTrade, isCatool, isCatoolGrowth }) {
  if (isAdmin) return null;
  if (isTrade) return 10;
  if (isCatoolGrowth) return 15;
  if (isCatool) return 5;
  return 0;
}

// ===== USAGE CHECK =====
const limit = getPhotoPrepLimit({
  isAdmin,
  isTrade,
  isCatool,
  isCatoolGrowth
});

let usageRecord = null;
let currentCount = 0;

if (limit !== null) {
  const monthKey = getMonthKey();
  const usageKey = buildUsageKey(customerId, "photo-prep", monthKey);

  const usageFormula = `{Key}="${usageKey}"`;

  const usageRes = await fetch(
    `https://api.airtable.com/v0/${airtableBase}/${encodeURIComponent(usageTable)}?filterByFormula=${encodeURIComponent(usageFormula)}`,
    {
      headers: {
        Authorization: `Bearer ${airtableToken}`
      }
    }
  );

  const usageData = await usageRes.json();
  usageRecord = usageData.records?.[0] || null;
  currentCount = Number(usageRecord?.fields?.UploadCount || 0);

  if (currentCount >= limit) {
    return Response.json(
      {
        error: `You’ve used all ${limit} uploads for this month.`
      },
      {
        status: 403,
        headers: corsHeaders
      }
    );
  }
}

    const base64Data = imageBase64.replace(/^data:image\/\w+;base64,/, "");
    const imageBuffer = Buffer.from(base64Data, "base64");

    const formData = new FormData();
    const blob = new Blob([imageBuffer], { type: "image/png" });

    formData.append("image_file", blob, "upload.png");
    formData.append("size", "auto");

    const response = await fetch("https://api.remove.bg/v1.0/removebg", {
      method: "POST",
      headers: {
        "X-Api-Key": process.env.REMOVE_BG_API_KEY
      },
      body: formData
    });

    if (!response.ok) {
      const errorText = await response.text();

      return Response.json(
        {
          error: "Background removal failed",
          details: errorText
        },
        {
          status: response.status,
          headers: corsHeaders
        }
      );
    }

    const arrayBuffer = await response.arrayBuffer();
    const resultBase64 = Buffer.from(arrayBuffer).toString("base64");
    const dataUrl = `data:image/png;base64,${resultBase64}`;

    // Increment usage ONLY after success
    if (limit !== null) {
  const monthKey = getMonthKey();
const usageKey = buildUsageKey(customerId, "photo-prep", monthKey);

  if (usageRecord) {
    await fetch(
      `https://api.airtable.com/v0/${airtableBase}/${encodeURIComponent(usageTable)}/${usageRecord.id}`,
      {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${airtableToken}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          fields: {
            UploadCount: currentCount + 1
          }
        })
      }
    );
  } else {
    await fetch(
      `https://api.airtable.com/v0/${airtableBase}/${encodeURIComponent(usageTable)}`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${airtableToken}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          records: [
            {
              fields: {
  CustomerId: String(customerId),
  MonthKey: monthKey,
  UploadCount: 1,
  Key: usageKey
}
            }
          ]
        })
      }
    );
  }
}

    return Response.json(
      { image: dataUrl },
      {
        status: 200,
        headers: corsHeaders
      }
    );
  } catch (error) {
    return Response.json(
      {
        error: "Server error",
        details: error.message
      },
      {
        status: 500,
        headers: corsHeaders
      }
    );
  }
}