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
    "Access-Control-Allow-Methods": "POST, OPTIONS",
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

  return new Response(null, {
    status: 204,
    headers: getCorsHeaders(origin)
  });
}

export async function action({ request }) {
  const origin = request.headers.get("Origin") || "";
  const corsHeaders = getCorsHeaders(origin);

  try {
    const {
      consultantId,
      clientRecordId,
      reportType = "signature_first_section",
      draft
    } = await request.json();

    const safeConsultantId = cleanString(consultantId);
    const safeClientRecordId = cleanString(clientRecordId);
    const safeReportType = cleanString(reportType) || "signature_first_section";

    if (!safeConsultantId || !safeClientRecordId) {
      return Response.json(
        { error: "Missing consultantId or clientRecordId" },
        { status: 400, headers: corsHeaders }
      );
    }

    if (!draft || typeof draft !== "object" || Array.isArray(draft)) {
      return Response.json(
        { error: "Missing report draft" },
        { status: 400, headers: corsHeaders }
      );
    }

    const report = await prisma.colorAnalysisReport.upsert({
      where: {
        consultantId_clientRecordId_reportType: {
          consultantId: safeConsultantId,
          clientRecordId: safeClientRecordId,
          reportType: safeReportType
        }
      },
      create: {
        consultantId: safeConsultantId,
        clientRecordId: safeClientRecordId,
        reportType: safeReportType,
        draftJson: JSON.stringify(draft)
      },
      update: {
        draftJson: JSON.stringify(draft)
      }
    });

    return Response.json(
      {
        success: true,
        report: {
          id: report.id,
          consultantId: report.consultantId,
          clientRecordId: report.clientRecordId,
          reportType: report.reportType,
          updatedAt: report.updatedAt
        }
      },
      { status: 200, headers: corsHeaders }
    );
  } catch (error) {
    console.error("Save color analysis report failed:", error);

    return Response.json(
      { error: error.message || "Unknown error" },
      { status: 500, headers: corsHeaders }
    );
  }
}
