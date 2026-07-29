import prisma from "../db.server";

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
  const stringValue = String(value || "").trim();
  return stringValue || null;
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
    const consultantId = cleanString(url.searchParams.get("consultantId"));
    const clientRecordId = cleanString(url.searchParams.get("clientRecordId"));
    const reportType = cleanString(url.searchParams.get("reportType")) || "signature_first_section";

    if (!consultantId || !clientRecordId) {
      return Response.json(
        { error: "Missing consultantId or clientRecordId" },
        { status: 400, headers: corsHeaders }
      );
    }

    const report = await prisma.colorAnalysisReport.findUnique({
      where: {
        consultantId_clientRecordId_reportType: {
          consultantId,
          clientRecordId,
          reportType
        }
      }
    });

    return Response.json(
      {
        report: report
          ? {
              id: report.id,
              consultantId: report.consultantId,
              clientRecordId: report.clientRecordId,
              reportType: report.reportType,
              draft: JSON.parse(report.draftJson || "{}"),
              createdAt: report.createdAt,
              updatedAt: report.updatedAt
            }
          : null
      },
      { status: 200, headers: corsHeaders }
    );
  } catch (error) {
    console.error("Get color analysis report failed:", error);

    return Response.json(
      { error: error.message || "Unknown error" },
      { status: 500, headers: corsHeaders }
    );
  }
}
