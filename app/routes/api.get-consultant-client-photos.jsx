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
  return String(value || "").trim() || null;
}

function escapeFormulaString(value) {
  return String(value || "").replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

function parsePhotoTransform(fields) {
  try {
    return fields.PhotoTransform
      ? JSON.parse(fields.PhotoTransform)
      : fields.PhotoTransformJson
        ? JSON.parse(fields.PhotoTransformJson)
        : null;
  } catch {
    return null;
  }
}

export async function loader({ request }) {
  const origin = request.headers.get("Origin") || "";
  const corsHeaders = getCorsHeaders(origin);

  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  try {
    const url = new URL(request.url);
    const clientRecordId = cleanString(url.searchParams.get("clientRecordId"));

    if (!clientRecordId) {
      return Response.json(
        { error: "Missing clientRecordId" },
        { status: 400, headers: corsHeaders }
      );
    }

    const baseId = process.env.AIRTABLE_BASE_ID;
    const token = process.env.AIRTABLE_TOKEN;
    if (!baseId || !token) {
      return Response.json(
        { error: "Missing Airtable configuration" },
        { status: 500, headers: corsHeaders }
      );
    }

    const clientFormula = clientRecordId.startsWith("rec")
      ? `RECORD_ID()="${escapeFormulaString(clientRecordId)}"`
      : `{ClientRecordId}="${escapeFormulaString(clientRecordId)}"`;
    const photoFormula = `AND({CustomerId}="${escapeFormulaString(clientRecordId)}", OR({IsArchived}=BLANK(), {IsArchived}=0, {IsArchived}=FALSE()))`;

    const [clientResponse, photosResponse] = await Promise.all([
      fetch(
        `https://api.airtable.com/v0/${baseId}/ConsultantClients?filterByFormula=${encodeURIComponent(clientFormula)}`,
        { headers: { Authorization: `Bearer ${token}` } }
      ),
      fetch(
        `https://api.airtable.com/v0/${baseId}/PersonalStudioPhotos?filterByFormula=${encodeURIComponent(photoFormula)}&sort[0][field]=UpdatedAt&sort[0][direction]=desc`,
        { headers: { Authorization: `Bearer ${token}` } }
      )
    ]);

    const [clientData, photosData] = await Promise.all([
      clientResponse.json(),
      photosResponse.json()
    ]);

    if (!clientResponse.ok || !photosResponse.ok) {
      return Response.json(
        {
          error: "Airtable lookup failed",
          details: !clientResponse.ok ? clientData : photosData
        },
        { status: 500, headers: corsHeaders }
      );
    }

    const clientFields = clientData.records?.[0]?.fields || {};
    const clientActiveUrl =
      clientFields.ActivePhotoUrl ||
      clientFields.AdjustedPhotoUrl ||
      clientFields.PhotoUrl ||
      clientFields.OriginalPhotoUrl ||
      null;

    const photos = (photosData.records || []).map((record) => {
      const fields = record.fields || {};
      const originalPhotoUrl = fields.OriginalPhotoUrl || null;
      const adjustedPhotoUrl = fields.AdjustedPhotoUrl || null;
      const activePhotoUrl = fields.ActivePhotoUrl || adjustedPhotoUrl || originalPhotoUrl;

      return {
        airtableRecordId: record.id,
        photoId: fields.PhotoId || record.id,
        clientRecordId,
        label: fields.Label || null,
        originalPhotoUrl,
        adjustedPhotoUrl,
        activePhotoUrl,
        photoTransform: parsePhotoTransform(fields),
        createdAt: fields.CreatedAt || record.createdTime || null,
        updatedAt: fields.UpdatedAt || record.createdTime || null,
        isActive: Boolean(clientActiveUrl && activePhotoUrl === clientActiveUrl)
      };
    });

    if (clientActiveUrl && !photos.some((photo) => photo.activePhotoUrl === clientActiveUrl)) {
      photos.unshift({
        airtableRecordId: null,
        photoId: "legacy-current",
        clientRecordId,
        label: "Current client photo",
        originalPhotoUrl: clientFields.OriginalPhotoUrl || clientFields.PhotoUrl || clientActiveUrl,
        adjustedPhotoUrl: clientFields.AdjustedPhotoUrl || null,
        activePhotoUrl: clientActiveUrl,
        photoTransform: null,
        createdAt: null,
        updatedAt: null,
        isActive: true,
        isLegacy: true
      });
    }

    return Response.json(
      { success: true, clientRecordId, activePhotoUrl: clientActiveUrl, photos },
      { status: 200, headers: corsHeaders }
    );
  } catch (error) {
    console.error("Get consultant client photos failed:", error);
    return Response.json(
      { error: error.message || "Server error" },
      { status: 500, headers: corsHeaders }
    );
  }
}
