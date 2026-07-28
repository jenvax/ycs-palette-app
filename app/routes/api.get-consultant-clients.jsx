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
  const stringValue = String(value || "").trim();
  return stringValue || null;
}

function firstField(fields, fieldNames) {
  for (const fieldName of fieldNames) {
    const value = fields?.[fieldName];
    if (value !== undefined && value !== null && String(value).trim() !== "") {
      return value;
    }
  }

  return null;
}

function isMissingIsArchivedError(data) {
  const message = String(data?.error?.message || "").toLowerCase();
  return (
    data?.error?.type === "INVALID_FILTER_BY_FORMULA" &&
    message.includes("isarchived")
  );
}

async function fetchConsultantClients({ airtableBase, airtableTable, airtableToken, formula }) {
  const airtableUrl =
    `https://api.airtable.com/v0/${airtableBase}/${airtableTable}` +
    `?filterByFormula=${encodeURIComponent(formula)}` +
    `&sort[0][field]=CreatedAt` +
    `&sort[0][direction]=desc`;

  const response = await fetch(airtableUrl, {
    headers: {
      Authorization: `Bearer ${airtableToken}`
    }
  });

  const data = await response.json();
  return { response, data };
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

    if (!consultantId) {
      return Response.json(
        { error: "Missing consultantId" },
        { status: 400, headers: corsHeaders }
      );
    }

    const airtableBase = process.env.AIRTABLE_BASE_ID;
    const airtableToken = process.env.AIRTABLE_TOKEN;
    const airtableTable = "ConsultantClients";

    if (!airtableBase || !airtableToken) {
      return Response.json(
        { error: "Missing Airtable configuration" },
        { status: 500, headers: corsHeaders }
      );
    }

    const activeFormula = `AND({ConsultantId}="${consultantId}", OR({IsArchived}=BLANK(), {IsArchived}=0, {IsArchived}=FALSE()))`;
    const fallbackFormula = `{ConsultantId}="${consultantId}"`;

    let { response, data } = await fetchConsultantClients({
      airtableBase,
      airtableTable,
      airtableToken,
      formula: activeFormula
    });

    if (!response.ok && isMissingIsArchivedError(data)) {
      ({ response, data } = await fetchConsultantClients({
        airtableBase,
        airtableTable,
        airtableToken,
        formula: fallbackFormula
      }));
    }

    if (!response.ok) {
      console.error("Airtable get consultant clients error:", data);

      return Response.json(
        { error: "Airtable fetch failed", details: data },
        { status: 500, headers: corsHeaders }
      );
    }

    const clients = (data.records || []).map((record) => {
      const fields = record.fields || {};
      const originalPhotoUrl = firstField(fields, [
        "OriginalPhotoUrl",
        "OriginalImageUrl",
        "OriginalPhoto",
        "PhotoUrl"
      ]);
      const adjustedPhotoUrl = firstField(fields, [
        "AdjustedPhotoUrl",
        "PreparedPhotoUrl",
        "TransformedPhotoUrl"
      ]);
      const activePhotoUrl = firstField(fields, [
        "AdjustedPhotoUrl",
        "PreparedPhotoUrl",
        "PrimaryPhotoUrl",
        "ActivePhotoUrl",
        "PhotoUrl",
        "OriginalPhotoUrl"
      ]);
      const paletteCode = firstField(fields, [
        "AssignedPaletteCode",
        "PaletteCode",
        "ColorPaletteCode",
        "FinalPaletteCode",
        "YcsPaletteCode"
      ]);
      const paletteName = firstField(fields, [
        "AssignedPaletteName",
        "PaletteName",
        "ColorPaletteName",
        "FinalPaletteName",
        "YcsPaletteName"
      ]);
      const status = firstField(fields, [
        "AnalysisStatus",
        "Status",
        "ClientStatus"
      ]);
      const notes = firstField(fields, [
        "Notes",
        "ClientNotes",
        "AnalysisNotes"
      ]);

      return {
        clientRecordId: fields.ClientRecordId || "",
        firstName: fields.FirstName || "",
        lastName: fields.LastName || "",
        email: fields.Email || "",
        paletteCode: paletteCode || "",
        paletteName: paletteName || "",
        analysisStatus: status || "New",
        notes: notes || "",
        originalPhotoUrl: originalPhotoUrl || "",
        adjustedPhotoUrl: adjustedPhotoUrl || "",
        primaryPhotoUrl: adjustedPhotoUrl || activePhotoUrl || originalPhotoUrl || "",
        activePhotoUrl: activePhotoUrl || "",
        createdAt: firstField(fields, ["CreatedAt", "Created Date"]) || record.createdTime || "",
        updatedAt: firstField(fields, ["UpdatedAt", "LastUpdated", "ModifiedAt", "Last Modified"]) || record.createdTime || ""
      };
    });

    return Response.json(
      { clients },
      { status: 200, headers: corsHeaders }
    );
  } catch (error) {
    console.error("Get consultant clients failed:", error);

    return Response.json(
      { error: error.message || "Unknown error" },
      { status: 500, headers: corsHeaders }
    );
  }
}
