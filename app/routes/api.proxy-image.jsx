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

function isAllowedImageHost(hostname) {
  const safeHostname = String(hostname || "").toLowerCase();
  return (
    safeHostname === "res.cloudinary.com" ||
    safeHostname === "cdn.shopify.com" ||
    safeHostname.endsWith(".myshopify.com") ||
    safeHostname === "yourcolorstyle.com" ||
    safeHostname === "www.yourcolorstyle.com"
  );
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
    const requestUrl = new URL(request.url);
    const imageUrl = requestUrl.searchParams.get("url") || "";

    let parsedUrl;
    try {
      parsedUrl = new URL(imageUrl);
    } catch {
      return Response.json(
        { error: "Invalid image URL" },
        { status: 400, headers: corsHeaders }
      );
    }

    if (parsedUrl.protocol !== "https:" || !isAllowedImageHost(parsedUrl.hostname)) {
      return Response.json(
        { error: "Image host is not allowed" },
        { status: 400, headers: corsHeaders }
      );
    }

    const response = await fetch(parsedUrl.toString());
    const contentType = response.headers.get("content-type") || "";

    if (!response.ok || !contentType.toLowerCase().startsWith("image/")) {
      return Response.json(
        { error: "Image lookup failed" },
        { status: 502, headers: corsHeaders }
      );
    }

    const buffer = Buffer.from(await response.arrayBuffer());
    const imageBase64 = `data:${contentType.split(";")[0]};base64,${buffer.toString("base64")}`;

    return Response.json(
      { imageBase64 },
      { status: 200, headers: corsHeaders }
    );
  } catch (error) {
    console.error("Proxy image failed:", error);

    return Response.json(
      { error: error.message || "Image proxy failed" },
      { status: 500, headers: corsHeaders }
    );
  }
}
