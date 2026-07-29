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
    "Access-Control-Allow-Methods": "POST, OPTIONS",
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

function airtableConfig() {
  return {
    baseId: process.env.AIRTABLE_BASE_ID,
    token: process.env.AIRTABLE_TOKEN,
    tableName: process.env.AIRTABLE_COLOR_ANALYSIS_REPORTS_TABLE || REPORTS_TABLE
  };
}

async function airtableRequest({ method = "GET", recordId, searchParams, fields }) {
  const { baseId, token, tableName } = airtableConfig();
  const encodedTable = encodeURIComponent(tableName);
  const url = new URL(`https://api.airtable.com/v0/${baseId}/${encodedTable}${recordId ? `/${recordId}` : ""}`);

  if (searchParams) {
    searchParams.forEach((value, key) => url.searchParams.set(key, value));
  }

  const response = await fetch(url.toString(), {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(fields ? { "Content-Type": "application/json" } : {})
    },
    ...(fields ? { body: JSON.stringify({ fields }) } : {})
  });
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

  return data;
}

async function findReportRecord({ consultantId, clientRecordId, reportType }) {
  const formula = `AND({ConsultantId}="${escapeFormulaValue(consultantId)}",{ClientRecordId}="${escapeFormulaValue(clientRecordId)}",{ReportType}="${escapeFormulaValue(reportType)}")`;
  const data = await airtableRequest({
    searchParams: new URLSearchParams({
      maxRecords: "1",
      filterByFormula: formula
    })
  });

  return data.records?.[0] || null;
}

function isMissingReportsTable(error) {
  return error?.status === 404 || ["TABLE_NOT_FOUND", "NOT_FOUND"].includes(error?.type);
}

async function ensureReportsTable() {
  const { baseId, token, tableName } = airtableConfig();
  const response = await fetch(`https://api.airtable.com/v0/meta/bases/${baseId}/tables`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      name: tableName,
      description: "Saved Color Analysis Report drafts.",
      fields: [
        { name: "ClientRecordId", type: "singleLineText" },
        { name: "ConsultantId", type: "singleLineText" },
        { name: "ReportType", type: "singleLineText" },
        { name: "DraftJson", type: "multilineText" }
      ]
    })
  });
  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new AirtableRequestError(
      data?.error?.message || data?.error?.type || "Unable to create Airtable report table",
      {
        status: response.status,
        type: data?.error?.type
      }
    );
  }

  return data;
}

async function findReportRecordWithTableSetup({ consultantId, clientRecordId, reportType }) {
  try {
    return await findReportRecord({ consultantId, clientRecordId, reportType });
  } catch (error) {
    if (!isMissingReportsTable(error)) throw error;
    await ensureReportsTable();
    return findReportRecord({ consultantId, clientRecordId, reportType });
  }
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
    const { baseId, token } = airtableConfig();
    if (!baseId || !token) {
      return Response.json(
        { error: "Airtable is not configured" },
        { status: 500, headers: corsHeaders }
      );
    }

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

    const fields = {
      ConsultantId: safeConsultantId,
      ClientRecordId: safeClientRecordId,
      ReportType: safeReportType,
      DraftJson: JSON.stringify(draft)
    };
    const existing = await findReportRecordWithTableSetup({
      consultantId: safeConsultantId,
      clientRecordId: safeClientRecordId,
      reportType: safeReportType
    });
    const report = existing
      ? await airtableRequest({ method: "PATCH", recordId: existing.id, fields })
      : await airtableRequest({ method: "POST", fields });

    return Response.json(
      {
        success: true,
        report: {
          id: report.id,
          consultantId: report.fields?.ConsultantId || safeConsultantId,
          clientRecordId: report.fields?.ClientRecordId || safeClientRecordId,
          reportType: report.fields?.ReportType || safeReportType,
          updatedAt: report.fields?.UpdatedAt || report.createdTime
        }
      },
      { status: 200, headers: corsHeaders }
    );
  } catch (error) {
    console.error("Save color analysis report failed:", error);

    const schemaPermissionMessage = error?.message?.toLowerCase().includes("invalid permissions")
      ? "Airtable could not create the ColorAnalysisReports table because the app token does not have schema permissions. Create the table manually or update the Airtable token scope, then try Save Draft again."
      : null;

    return Response.json(
      { error: schemaPermissionMessage || error.message || "Unknown error" },
      { status: 500, headers: corsHeaders }
    );
  }
}
