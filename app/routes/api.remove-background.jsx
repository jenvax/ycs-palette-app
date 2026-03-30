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
    const { imageBase64 } = await request.json();

    if (!imageBase64) {
      return Response.json(
        { error: "Missing imageBase64" },
        {
          status: 400,
          headers: corsHeaders
        }
      );
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
        "X-Api-Key": process.env.REMOVE_BG_API_KEY,
      },
      body: formData,
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