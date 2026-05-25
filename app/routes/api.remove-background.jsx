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
  clientRecordId,
  tool,
  mode,
  isAdmin,
  isTrade,
  isCatool,
  isCatoolGrowth,
  isCatoolFree,
  isVip,
  hasDrapingStudio,
  hasDrapingStudioStarter,
  hasDrapingStudioFull,
  isSampleUser
} = await request.json();

const usageCustomerId = String(customerId || "").trim();

    if (!imageBase64 || !usageCustomerId) {
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

function buildUsageKey({ customerId, tool, scope, monthKey }) {
  if (scope === "total") {
    return `${customerId}__${tool}__TOTAL`;
  }

  return `${customerId}__${tool}__${monthKey}`;
}

function getUsageConfig(params) {
  const {
    tool,
    isAdmin,
    isTrade,
    isCatool,
    isCatoolGrowth,
    isCatoolFree,
    isVip,
    hasDrapingStudio,
    hasDrapingStudioStarter,
    hasDrapingStudioFull,
    isSampleUser,
    mode
  } = params;

  if (isAdmin) {
    return {
      allowed: true,
      scope: "unlimited",
      limit: null
    };
  }

  if (mode === "trade") {
    if (isTrade) {
      return { allowed: true, scope: "monthly", limit: 10 };
    }

    if (isCatoolGrowth) {
      return { allowed: true, scope: "monthly", limit: 15 };
    }

    if (isCatool) {
      return { allowed: true, scope: "monthly", limit: 5 };
    }

    return { allowed: false, scope: "monthly", limit: 0 };
  }

  if (mode === "personal") {
    if (isVip) {
      return { allowed: true, scope: "monthly", limit: 5 };
    }

    if (hasDrapingStudioFull) {
      return { allowed: true, scope: "total", limit: 5 };
    }

    if (hasDrapingStudioStarter || hasDrapingStudio) {
      return { allowed: true, scope: "total", limit: 2 };
    }

    if (isSampleUser) {
      return { allowed: true, scope: "total", limit: 1 };
    }

    return { allowed: false, scope: "monthly", limit: 0 };
  }

  if (tool === "photo-prep") {
    if (isTrade) {
      return { allowed: true, scope: "monthly", limit: 10 };
    }

    if (isCatoolGrowth) {
      return { allowed: true, scope: "monthly", limit: 15 };
    }

    if (isCatool) {
      return { allowed: true, scope: "monthly", limit: 5 };
    }

    return { allowed: false, scope: "monthly", limit: 0 };
  }

  if (tool === "photo-draping") {
    if (isVip) {
      return { allowed: true, scope: "monthly", limit: 5 };
    }

    if (hasDrapingStudioFull) {
      return { allowed: true, scope: "total", limit: 5 };
    }

    if (hasDrapingStudioStarter || hasDrapingStudio) {
      return { allowed: true, scope: "total", limit: 2 };
    }

    if (isSampleUser) {
      return { allowed: true, scope: "total", limit: 1 };
    }

    return { allowed: false, scope: "monthly", limit: 0 };
  }

  return { allowed: false, scope: "monthly", limit: 0 };
}

const usageConfig = getUsageConfig({
  tool,
  mode,
  isAdmin,
  isTrade,
  isCatool,
  isCatoolGrowth,
  isCatoolFree,
  isVip,
  hasDrapingStudio,
  hasDrapingStudioStarter,
  hasDrapingStudioFull,
  isSampleUser
});

let usageRecord = null;
let currentCount = 0;

if (usageConfig.scope !== "unlimited") {
  if (!usageConfig.allowed) {
    return Response.json(
      { error: "This tool is not available for your account." },
      {
        status: 403,
        headers: corsHeaders
      }
    );
  }

  const monthKey = usageConfig.scope === "monthly" ? getMonthKey() : "TOTAL";
  const usageKey = buildUsageKey({
  customerId: usageCustomerId,
  tool: tool || "photo-draping",
  scope: usageConfig.scope,
  monthKey
});

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

  if (currentCount >= usageConfig.limit) {
    const message =
      usageConfig.scope === "total"
        ? `You’ve used all ${usageConfig.limit} available uploads.`
        : `You’ve used all ${usageConfig.limit} uploads for this month.`;

    return Response.json(
      { error: message },
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
if (usageConfig.scope !== "unlimited") {
  const monthKey = usageConfig.scope === "monthly" ? getMonthKey() : "TOTAL";
  const usageKey = buildUsageKey({
  customerId: usageCustomerId,
  tool: tool || "photo-draping",
  scope: usageConfig.scope,
  monthKey
});

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
  CustomerId: usageCustomerId,
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
