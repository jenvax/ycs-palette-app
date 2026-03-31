

function normalizeField(value) {
  if (Array.isArray(value)) return value[0] || "";
  return value || "";
}

function normalizeList(value) {
  if (Array.isArray(value)) return value;
  if (!value) return [];
  return [value];
}

function normalizeHex(value) {
  return String(value || "").trim().toLowerCase();
}

function escapeFormulaValue(value) {
  return String(value || "")
    .replace(/\\/g, "\\\\")
    .replace(/"/g, '\\"');
}

const PALETTE_TAGS = new Set([
  "CWL", "CWM", "CWD",
  "CCL", "CCM", "CCD",
  "SWL", "SWM", "SWD",
  "SCL", "SCM", "SCD",
  "LO", "MO", "DO",
  "CWLG", "CWMG", "CWDG",
  "SWLG", "SWMG", "SWDG",
  "SCLG", "SCMG", "SCDG"
]);



async function removeBackgroundImage({ imageBase64, apiKey }) {
  if (!imageBase64) {
    throw new Error("Missing imageBase64");
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
      "X-Api-Key": apiKey,
    },
    body: formData,
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(errorText || "Background removal failed");
  }

  const arrayBuffer = await response.arrayBuffer();
  const resultBase64 = Buffer.from(arrayBuffer).toString("base64");

  return `data:image/png;base64,${resultBase64}`;
}

async function airtableFetchJson(url, token, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data?.error?.message || "Airtable request failed");
  }

  return data;
}

async function fetchAllAirtableRecords({ baseId, tableName, token, sortField, formula }) {
  const params = new URLSearchParams();

  if (sortField) {
    params.set("sort[0][field]", sortField);
    params.set("sort[0][direction]", "asc");
  }

  if (formula) {
    params.set("filterByFormula", formula);
  }

  let allRecords = [];
  let offset = "";

  while (true) {
    const pageParams = new URLSearchParams(params);
    if (offset) {
      pageParams.set("offset", offset);
    }

    const pageUrl = `https://api.airtable.com/v0/${baseId}/${encodeURIComponent(
      tableName
    )}?${pageParams.toString()}`;

    const data = await airtableFetchJson(pageUrl, token);

    allRecords = allRecords.concat(data.records || []);

    if (!data.offset) break;
    offset = data.offset;
  }

  return allRecords;
}

async function createAirtableRecord({ baseId, tableName, token, fields }) {
  const url = `https://api.airtable.com/v0/${baseId}/${encodeURIComponent(tableName)}`;

  const data = await airtableFetchJson(url, token, {
    method: "POST",
    body: JSON.stringify({
      records: [{ fields }],
    }),
  });

  return data.records?.[0] || null;
}

async function deleteAirtableRecord({ baseId, tableName, token, recordId }) {
  const url = `https://api.airtable.com/v0/${baseId}/${encodeURIComponent(
    tableName
  )}/${recordId}`;

  return airtableFetchJson(url, token, {
    method: "DELETE",
  });
}

async function getFavorites({ customerId, paletteCode, baseId, tableName, token }) {
  const formula = `AND({CustomerId}="${escapeFormulaValue(
    customerId
  )}",{PaletteCode}="${escapeFormulaValue(paletteCode)}")`;

  const records = await fetchAllAirtableRecords({
    baseId,
    tableName,
    token,
    formula,
  });

  return records
    .map((record) => normalizeField(record.fields?.Hex))
    .filter(Boolean)
    .map(normalizeHex);
}

async function toggleFavorite({
  customerId,
  paletteCode,
  colorName,
  hex,
  baseId,
  tableName,
  token,
}) {
  const normalizedHex = normalizeHex(hex);
  const favoriteKey = `${customerId}__${paletteCode}__${normalizedHex}`;

  const formula = `{FavoriteKey}="${escapeFormulaValue(favoriteKey)}"`;

  const existing = await fetchAllAirtableRecords({
    baseId,
    tableName,
    token,
    formula,
  });

  if (existing.length > 0) {
    await deleteAirtableRecord({
      baseId,
      tableName,
      token,
      recordId: existing[0].id,
    });

    return { success: true, isFavorite: false };
  }

  await createAirtableRecord({
    baseId,
    tableName,
    token,
    fields: {
      CustomerId: String(customerId),
      PaletteCode: String(paletteCode),
      ColorName: String(colorName || ""),
      Hex: String(hex || ""),
      FavoriteKey: favoriteKey,
    },
  });

  return { success: true, isFavorite: true };
}



async function fetchCustomerPhotoMap({ baseId, token }) {
  const records = await fetchAllAirtableRecords({
    baseId,
    tableName: "CustomerPhotos",
    token
  });

  const photoMap = {};

  records.forEach((record) => {
    const customerId = String(record?.fields?.CustomerId || "").trim();
    const photoUrl = String(record?.fields?.PhotoUrl || "").trim();

    if (customerId) {
      photoMap[customerId] = photoUrl || null;
    }
  });

  return photoMap;
}

export async function loader({ request }) {

  const url = new URL(request.url);
  const paletteCode = String(url.searchParams.get("palette") || "").toUpperCase().trim();
  const action = String(url.searchParams.get("action") || "").trim();
  const loggedInCustomerId = String(url.searchParams.get("logged_in_customer_id") || "").trim();

  const AIRTABLE_TOKEN = process.env.AIRTABLE_TOKEN;
  const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID;
  const AIRTABLE_TABLE_NAME = process.env.AIRTABLE_TABLE_NAME;
  const AIRTABLE_FAVORITES_TABLE =
    process.env.AIRTABLE_FAVORITES_TABLE || "PaletteFavorites";

  if (!AIRTABLE_TOKEN || !AIRTABLE_BASE_ID || !AIRTABLE_TABLE_NAME) {
    return Response.json(
      { error: "Missing Airtable server configuration" },
      { status: 500 }
    );
  }

  if (action === "getAdminMembers") {
  try {
    const isAdmin = String(url.searchParams.get("isAdmin") || "").trim() === "true";

    if (!loggedInCustomerId) {
      return Response.json(
        { error: "You must be signed in to use this tool" },
        { status: 401 }
      );
    }

    if (!isAdmin) {
      return Response.json(
        { error: "Admin access required" },
        { status: 403 }
      );
    }

    const [directoryRecords, customerPhotoRecords] = await Promise.all([
      fetchAllAirtableRecords({
        baseId: AIRTABLE_BASE_ID,
        tableName: "CustomerDirectory",
        token: AIRTABLE_TOKEN,
        sortField: "LastName"
      }),
      fetchAllAirtableRecords({
        baseId: AIRTABLE_BASE_ID,
        tableName: "CustomerPhotos",
        token: AIRTABLE_TOKEN,
        sortField: "UpdatedAt"
      })
    ]);

    const photoMap = {};

    customerPhotoRecords.forEach((record) => {
      const fields = record.fields || {};
      const customerId = String(fields.CustomerId || "").trim();
      const photoUrl = String(fields.PhotoUrl || "").trim() || null;

      if (customerId) {
        photoMap[customerId] = photoUrl;
      }
    });

    const members = directoryRecords
      .map((record) => {
        const fields = record.fields || {};
        const customerId = String(fields.CustomerId || "").trim();
        const email = String(fields.Email || "").trim();
        const firstName = String(fields.FirstName || "").trim();
        const lastName = String(fields.LastName || "").trim();

        const tags = String(fields.Tags || "")
          .split(",")
          .map((tag) => tag.trim())
          .filter(Boolean);

        const isVIP = tags.includes("VIP");

        const paletteTags = String(fields.PaletteTags || "")
          .split(",")
          .map((tag) => tag.trim())
          .filter(Boolean);

        const hasPaletteAccessRaw = fields.HasPaletteAccess;
        const hasPaletteAccess =
          hasPaletteAccessRaw === true ||
          hasPaletteAccessRaw === 1 ||
          String(hasPaletteAccessRaw || "").toLowerCase() === "true" ||
          String(hasPaletteAccessRaw || "") === "1" ||
          paletteTags.length > 0;

let name = "";

if (firstName || lastName) {
  name = `${firstName} ${lastName}`.trim();
} else if (email) {
  name = email.split("@")[0]; // cleaner fallback
} else {
  name = `Customer ${customerId}`;
}        const photoUrl = photoMap[customerId] || null;

        return {
          customerId,
          name,
          email,
          tags,
          isVIP,
          paletteTags,
          hasPaletteAccess,
          photoUrl,
          hasPhoto: Boolean(photoUrl)
        };
      })
      .filter((member) => member.customerId && member.isVIP)
      .sort((a, b) => a.name.localeCompare(b.name));

    return Response.json({ members });
  } catch (error) {
    console.error("getAdminMembers failed:", error);
    return Response.json(
      { error: error.message || "Failed to load admin members" },
      { status: 500 }
    );
  }
}

  if (action === "getFavorites") {
    const customerId = String(url.searchParams.get("customerId") || "").trim();

    if (!customerId || !paletteCode) {
      return Response.json(
        { error: "Missing customerId or palette" },
        { status: 400 }
      );
    }

    try {
      const favorites = await getFavorites({
        customerId,
        paletteCode,
        baseId: AIRTABLE_BASE_ID,
        tableName: AIRTABLE_FAVORITES_TABLE,
        token: AIRTABLE_TOKEN,
      });

      return Response.json({ favorites });
    } catch (error) {
      console.error(error);
      return Response.json(
        { error: error.message || "Failed to load favorites" },
        { status: 500 }
      );
    }
  }

  const isAdminPalette = paletteCode.startsWith("ADMIN_");

  if (!paletteCode) {
    return Response.json({ error: "Missing palette parameter" }, { status: 400 });
  }

  try {
    const allRecords = await fetchAllAirtableRecords({
      baseId: AIRTABLE_BASE_ID,
      tableName: AIRTABLE_TABLE_NAME,
      token: AIRTABLE_TOKEN,
      sortField: "SortOrder",
    });

    const colors = allRecords
      .map((record) => {
        const f = record.fields || {};

        const linkedPalettes = String(f["PaletteCodes_Final_Manual"] || "")
          .split(",")
          .map((p) => p.toUpperCase().trim())
          .filter(Boolean);

        const bestPalettes = normalizeList(f["BestPaletteCodes"]).map((p) =>
          String(p).toUpperCase().trim()
        );

        const adminPalettes = String(f["AdminPaletteCodes"] || "")
          .split(/\s+/)
          .map((p) => p.toUpperCase().trim())
          .filter(Boolean);

        const categories = normalizeList(f["CategoryNames"]);
        const category = normalizeField(f["CategoryNames"]);

        return {
          name: normalizeField(f["ColorName"]),
          hex: normalizeField(f["Hex"]),
          sortOrder: Number(normalizeField(f["SortOrder"])) || 999,
          category: category || categories[0] || "Other",

          paletteCodes: normalizeField(f["PaletteCodes_Final_Manual"]),
          chroma: normalizeField(f["Chroma"]),
          temperature: normalizeField(f["Temperature"]),
          depth: normalizeField(f["Depth"]),

          isBest: bestPalettes.includes(paletteCode),

          palettes: linkedPalettes,
          adminPalettes: adminPalettes,

          isNeutral:
            f["IsNeutral"] === true ||
            f["IsNeutral"] === 1 ||
            String(f["IsNeutral"]).toLowerCase() === "true",

          neutralDepth: normalizeField(f["NeutralDepth"]),
          neutralFamily: normalizeField(f["NeutralFamily"]),
        };
      })
      .filter((color) => color.name && color.hex)
      .filter((color) => {
        if (isAdminPalette) {
          return color.adminPalettes.includes(paletteCode);
        }
        return color.palettes.includes(paletteCode);
      })
      .map(({ palettes, adminPalettes, ...color }) => color);

    return Response.json({
      palette: paletteCode,
      colors,
      marker: "FAVORITES_LIVE",
    });
  } catch (error) {
    console.error(error);
    return Response.json(
      { error: error.message || "Failed to load palette colors" },
      { status: 500 }
    );
  }
}

export async function action({ request }) {
  const url = new URL(request.url);
  const actionName = String(url.searchParams.get("action") || "").trim();

  const AIRTABLE_TOKEN = process.env.AIRTABLE_TOKEN;
  const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID;
  const AIRTABLE_FAVORITES_TABLE =
    process.env.AIRTABLE_FAVORITES_TABLE || "PaletteFavorites";
  const REMOVE_BG_API_KEY = process.env.REMOVE_BG_API_KEY;

  if (request.method !== "POST") {
    return Response.json({ error: "Method not allowed" }, { status: 405 });
  }

  if (actionName === "removeBackground") {
    if (!REMOVE_BG_API_KEY) {
      return Response.json(
        { error: "Missing remove.bg configuration" },
        { status: 500 }
      );
    }

    try {
      const body = await request.json();
      const imageBase64 = String(body.imageBase64 || "").trim();

      if (!imageBase64) {
        return Response.json(
          { error: "Missing imageBase64" },
          { status: 400 }
        );
      }

      const image = await removeBackgroundImage({
        imageBase64,
        apiKey: REMOVE_BG_API_KEY,
      });

      return Response.json({ image });
    } catch (error) {
      console.error(error);
      return Response.json(
        { error: error.message || "Failed to remove background" },
        { status: 500 }
      );
    }
  }

  if (!AIRTABLE_TOKEN || !AIRTABLE_BASE_ID) {
    return Response.json(
      { error: "Missing Airtable server configuration" },
      { status: 500 }
    );
  }

  if (actionName !== "toggleFavorite") {
    return Response.json({ error: "Unknown action" }, { status: 400 });
  }

  try {
    const body = await request.json();

    const customerId = String(body.customerId || "").trim();
    const paletteCode = String(body.paletteCode || "").toUpperCase().trim();
    const colorName = String(body.colorName || "").trim();
    const hex = String(body.hex || "").trim();

    if (!customerId || !paletteCode || !hex) {
      return Response.json(
        { error: "Missing customerId, paletteCode, or hex" },
        { status: 400 }
      );
    }

    const result = await toggleFavorite({
      customerId,
      paletteCode,
      colorName,
      hex,
      baseId: AIRTABLE_BASE_ID,
      tableName: AIRTABLE_FAVORITES_TABLE,
      token: AIRTABLE_TOKEN,
    });

    return Response.json(result);
  } catch (error) {
    console.error(error);
    return Response.json(
      { error: error.message || "Failed to toggle favorite" },
      { status: 500 }
    );
  }
}