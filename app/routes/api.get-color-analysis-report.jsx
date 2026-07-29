/* global process */

const REPORTS_TABLE = "ColorAnalysisReports";

class AirtableRequestError extends Error {
  constructor(message, details = {}) {
    super(message);
    this.name = "AirtableRequestError";
    this.status = details.status;
    this.type = details.type;
  }
}

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

function escapeFormulaValue(value) {
  return String(value || "").replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

function parseDraft(value) {
  if (!value || typeof value !== "string") return {};

  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
  } catch (error) {
    console.warn("Unable to parse color analysis report draft", error);
    return {};
  }
}

async function fetchReportRecord({ baseId, token, tableName, consultantId, clientRecordId, reportType }) {
  const params = new URLSearchParams({
    maxRecords: "1",
    filterByFormula: `AND({ConsultantId}="${escapeFormulaValue(consultantId)}",{ClientRecordId}="${escapeFormulaValue(clientRecordId)}",{ReportType}="${escapeFormulaValue(reportType)}")`
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
    throw new AirtableRequestError(
      data?.error?.message || data?.error?.type || "Airtable request failed",
      {
        status: response.status,
        type: data?.error?.type
      }
    );
  }

  return data.records?.[0] || null;
}

function isMissingReportsTable(error) {
  return error?.status === 404 || ["TABLE_NOT_FOUND", "NOT_FOUND"].includes(error?.type);
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
    const baseId = process.env.AIRTABLE_BASE_ID;
    const token = process.env.AIRTABLE_TOKEN;
    const tableName = process.env.AIRTABLE_COLOR_ANALYSIS_REPORTS_TABLE || REPORTS_TABLE;

    if (!consultantId || !clientRecordId) {
      return Response.json(
        { error: "Missing consultantId or clientRecordId" },
        { status: 400, headers: corsHeaders }
      );
    }

    if (!baseId || !token) {
      return Response.json(
        { error: "Airtable is not configured" },
        { status: 500, headers: corsHeaders }
      );
    }

    let report = null;
    try {
      report = await fetchReportRecord({
        baseId,
        token,
        tableName,
        consultantId,
        clientRecordId,
        reportType
      });
    } catch (error) {
      if (!isMissingReportsTable(error)) throw error;
    }
    const fields = report?.fields || {};

    return Response.json(
      {
        report: report
          ? {
              id: report.id,
              consultantId: fields.ConsultantId || consultantId,
              clientRecordId: fields.ClientRecordId || clientRecordId,
              reportType: fields.ReportType || reportType,
              draft: parseDraft(fields.DraftJson),
              createdAt: report.createdTime,
              updatedAt: fields.UpdatedAt || report.createdTime
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
