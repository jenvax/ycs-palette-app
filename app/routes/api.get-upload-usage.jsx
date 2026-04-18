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

function toBool(value) {
  return String(value || "").trim().toLowerCase() === "true";
}

function cleanString(value) {
  const stringValue = String(value || "").trim();
  return stringValue || null;
}

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
    isVip,
    hasDrapingStudio,
    isSampleUser
  } = params;

  // Admin = unlimited everywhere
  if (isAdmin) {
    return {
      allowed: true,
      scope: "unlimited",
      limit: null
    };
  }

  // PHOTO PREP
  if (tool === "photo-prep") {
    if (isTrade) {
      return {
        allowed: true,
        scope: "monthly",
        limit: 10
      };
    }

    if (isCatoolGrowth) {
      return {
        allowed: true,
        scope: "monthly",
        limit: 15
      };
    }

    if (isCatool) {
      return {
        allowed: true,
        scope: "monthly",
        limit: 5
      };
    }

    return {
      allowed: false,
      scope: "monthly",
      limit: 0
    };
  }

  // PHOTO DRAPING
  if (tool === "photo-draping") {
    if (isVip) {
      return {
        allowed: true,
        scope: "monthly",
        limit: 3
      };
    }

    if (hasDrapingStudio) {
      return {
        allowed: true,
        scope: "total",
        limit: 2
      };
    }

    if (isSampleUser) {
      return {
        allowed: true,
        scope: "total",
        limit: 1
      };
    }

    return {
      allowed: false,
      scope: "monthly",
      limit: 0
    };
  }

  return {
    allowed: false,
    scope: "monthly",
    limit: 0
  };
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

    const customerId = cleanString(url.searchParams.get("customerId"));
    const tool = cleanString(url.searchParams.get("tool")) || "photo-draping";

    const isAdmin = toBool(url.searchParams.get("isAdmin"));
    const isTrade = toBool(url.searchParams.get("isTrade"));
    const isCatool = toBool(url.searchParams.get("isCatool"));
    const isCatoolGrowth = toBool(url.searchParams.get("isCatoolGrowth"));
    const isVip = toBool(url.searchParams.get("isVip"));
    const hasDrapingStudio = toBool(url.searchParams.get("hasDrapingStudio"));
    const isSampleUser = toBool(url.searchParams.get("isSampleUser"));

    if (!customerId) {
      return Response.json(
        { error: "Missing customerId" },
        { status: 400, headers: corsHeaders }
      );
    }

    const usageConfig = getUsageConfig({
      tool,
      isAdmin,
      isTrade,
      isCatool,
      isCatoolGrowth,
      isVip,
      hasDrapingStudio,
      isSampleUser
    });

    if (usageConfig.scope === "unlimited") {
      return Response.json(
        {
          tool,
          allowed: true,
          isAdmin: true,
          used: 0,
          remaining: null,
          limit: null,
          scope: "unlimited",
          usageKey: null,
          monthKey: null
        },
        { status: 200, headers: corsHeaders }
      );
    }

    if (!usageConfig.allowed) {
      return Response.json(
        {
          tool,
          allowed: false,
          isAdmin: false,
          used: 0,
          remaining: 0,
          limit: 0,
          scope: usageConfig.scope,
          usageKey: null,
          monthKey: usageConfig.scope === "monthly" ? getMonthKey() : "TOTAL"
        },
        { status: 200, headers: corsHeaders }
      );
    }

    const airtableBase = process.env.AIRTABLE_BASE_ID;
    const airtableToken = process.env.AIRTABLE_TOKEN;
    const usageTable = "UploadUsage";

    if (!airtableBase || !airtableToken) {
      return Response.json(
        { error: "Missing Airtable configuration" },
        { status: 500, headers: corsHeaders }
      );
    }

    const monthKey = usageConfig.scope === "monthly" ? getMonthKey() : "TOTAL";
    const usageKey = buildUsageKey({
      customerId,
      tool,
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

    if (!usageRes.ok) {
      const errorText = await usageRes.text();
      return Response.json(
        {
          error: "Could not load upload usage",
          details: errorText
        },
        { status: 500, headers: corsHeaders }
      );
    }

    const usageData = await usageRes.json();
    const usageRecord = usageData.records?.[0] || null;
    const used = Number(usageRecord?.fields?.UploadCount || 0);
    const limit = usageConfig.limit;
    const remaining = Math.max(0, limit - used);

    return Response.json(
      {
        tool,
        allowed: true,
        isAdmin: false,
        used,
        remaining,
        limit,
        scope: usageConfig.scope,
        usageKey,
        monthKey
      },
      { status: 200, headers: corsHeaders }
    );
  } catch (error) {
    return Response.json(
      {
        error: "Server error",
        details: error.message
      },
      { status: 500, headers: corsHeaders }
    );
  }
}