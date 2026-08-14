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

function normalizeCustomerId(value) {
  return String(value || "").replace(/^gid:\/\/shopify\/Customer\//, "").trim();
}

function isUnknownAirtableFieldError(data) {
  const message = String(data?.error?.message || "").toLowerCase();
  return data?.error?.type === "UNKNOWN_FIELD_NAME" || message.includes("unknown field name");
}

function removeOptionalShopifyClientFields(fields) {
  const nextFields = { ...fields };
  delete nextFields.ShopifyCustomerId;
  delete nextFields.ShopifyCustomerGid;
  return nextFields;
}

async function patchAirtableRecord({ airtableBase, airtableTable, airtableToken, recordId, fields }) {
  const response = await fetch(
    `https://api.airtable.com/v0/${airtableBase}/${airtableTable}/${recordId}`,
    {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${airtableToken}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ fields, typecast: true })
    }
  );

  const data = await response.json();
  return { response, data };
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
    const body = await request.json();
    const {
      clientRecordId,
      firstName,
      lastName,
      email,
      paletteCode,
      paletteName,
      shopifyCustomerId,
      shopifyCustomerGid,
      notes
    } = body;
    const hasEmail = Object.prototype.hasOwnProperty.call(body, "email");
    const hasPaletteCode = Object.prototype.hasOwnProperty.call(body, "paletteCode");
    const hasPaletteName = Object.prototype.hasOwnProperty.call(body, "paletteName");
    const hasShopifyCustomerId = Object.prototype.hasOwnProperty.call(body, "shopifyCustomerId");
    const hasShopifyCustomerGid = Object.prototype.hasOwnProperty.call(body, "shopifyCustomerGid");
    const hasNotes = Object.prototype.hasOwnProperty.call(body, "notes");

    const safeClientRecordId = cleanString(clientRecordId);
    const safeFirstName = cleanString(firstName);
    const safeLastName = cleanString(lastName);
    const safeEmail = cleanString(email);
    const safePaletteCode = cleanString(paletteCode);
    const safePaletteName = cleanString(paletteName);
    const safeShopifyCustomerId = normalizeCustomerId(shopifyCustomerId);
    const safeShopifyCustomerGid = cleanString(shopifyCustomerGid);
    const safeNotes = cleanString(notes);

    if (!safeClientRecordId) {
      return Response.json(
        { error: "Missing clientRecordId" },
        { status: 400, headers: corsHeaders }
      );
    }

    if (!safeFirstName || !safeLastName) {
      return Response.json(
        { error: "Missing firstName or lastName" },
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

    const findRes = await fetch(
      `https://api.airtable.com/v0/${airtableBase}/${airtableTable}?filterByFormula=${encodeURIComponent(`{ClientRecordId}="${safeClientRecordId}"`)}`,
      {
        headers: {
          Authorization: `Bearer ${airtableToken}`
        }
      }
    );

    const findData = await findRes.json();
    const existing = findData.records?.[0];

    if (!existing) {
      return Response.json(
        { error: "Client record not found" },
        { status: 404, headers: corsHeaders }
      );
    }

    const baseFields = {
      FirstName: safeFirstName,
      LastName: safeLastName
    };
    if (hasEmail) baseFields.Email = safeEmail || null;
    if (hasPaletteCode) baseFields.AnalysisResultCode = safePaletteCode || null;
    if (hasPaletteName) baseFields.AnalysisResultLabel = safePaletteName || null;
    if (hasShopifyCustomerId) baseFields.ShopifyCustomerId = safeShopifyCustomerId || null;
    if (hasShopifyCustomerGid) baseFields.ShopifyCustomerGid = safeShopifyCustomerGid || null;
    if (hasNotes) baseFields.Notes = safeNotes || null;

    let { response: patchRes, data: patchData } = await patchAirtableRecord({
      airtableBase,
      airtableTable,
      airtableToken,
      recordId: existing.id,
      fields: baseFields
    });

    if (!patchRes?.ok && isUnknownAirtableFieldError(patchData)) {
      ({ response: patchRes, data: patchData } = await patchAirtableRecord({
        airtableBase,
        airtableTable,
        airtableToken,
        recordId: existing.id,
        fields: removeOptionalShopifyClientFields(baseFields)
      }));
    }

    if (!patchRes?.ok) {
      console.error("Airtable patch error:", patchData);

      return Response.json(
        { error: "Airtable update failed", details: patchData },
        { status: 500, headers: corsHeaders }
      );
    }

    return Response.json(
      {
        success: true,
        clientRecordId: safeClientRecordId,
        firstName: safeFirstName,
        lastName: safeLastName,
        email: safeEmail,
        shopifyCustomerId: safeShopifyCustomerId || "",
        shopifyCustomerGid: safeShopifyCustomerGid || "",
        paletteCode: safePaletteCode || "",
        paletteName: safePaletteName || "",
        notes: safeNotes || "",
        savedPaletteField: "AnalysisResultCode",
        savedNotesField: "Notes"
      },
      { status: 200, headers: corsHeaders }
    );
  } catch (error) {
    console.error("Update consultant client failed:", error);

    return Response.json(
      { error: error.message },
      { status: 500, headers: corsHeaders }
    );
  }
}
