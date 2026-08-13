(function () {
  const root = document.querySelector(".ycs-clients[data-can-manage-clients='true']");
  if (!root) return;

  const apiBase = (root.dataset.appBaseUrl || "").replace(/\/$/, "");
  const consultantId = root.dataset.customerId || "";
  const canCreateReports = root.dataset.canCreateReports === "true";
  const gridEl = root.querySelector("[data-ycs-client-grid]");
  const detailEl = root.querySelector("[data-ycs-client-detail]");
  const statusEl = root.querySelector("[data-ycs-client-status]");
  const controlsEl = root.querySelector("[data-ycs-client-list-controls]");
  const searchEl = root.querySelector("[data-ycs-client-search]");
  const paletteFilterEl = root.querySelector("[data-ycs-client-palette-filter]");
  const sortEl = root.querySelector("[data-ycs-client-sort]");
  const pageBackLinkEl = root.querySelector("[data-ycs-clients-back-link]");
  const addClientEl = root.querySelector("[data-ycs-add-client]");
  const selectedClientNavLink = root.querySelector("[data-ycs-clients-nav-selected]");
  const photoPrepNavLink = root.querySelector("[data-ycs-clients-nav-photo-prep]");
  const structuredNavLink = root.querySelector("[data-ycs-clients-nav-structured]");
  const lipNavLink = root.querySelector("[data-ycs-clients-nav-lip]");

  const YCS_PALETTE_OPTIONS = [
    ["CCL", "Clear Cool Light"],
    ["CCM", "Clear Cool Medium"],
    ["CCD", "Clear Cool Deep"],
    ["CWL", "Clear Warm Light"],
    ["CWM", "Clear Warm Medium"],
    ["CWD", "Clear Warm Deep"],
    ["SCL", "Soft Cool Light"],
    ["SCM", "Soft Cool Medium"],
    ["SCD", "Soft Cool Deep"],
    ["SWL", "Soft Warm Light"],
    ["SWM", "Soft Warm Medium"],
    ["SWD", "Soft Warm Deep"],
    ["CWLG", "Clear Warm Light for Gray Hair"],
    ["CWMG", "Clear Warm Medium for Gray Hair"],
    ["CWDG", "Clear Warm Deep for Gray Hair"],
    ["SWLG", "Soft Warm Light for Gray Hair"],
    ["SWMG", "Soft Warm Medium for Gray Hair"],
    ["SWDG", "Soft Warm Deep for Gray Hair"],
    ["LO", "Light Olive"],
    ["MO", "Medium Olive"],
    ["DO", "Deep Olive"]
  ];

  let clients = [];
  let activeReportDraft = null;
  let activeReportClientId = "";
  let activeReportPage = 1;
  let activeReportTemplateRequest = 0;
  let reportPageRailDrag = null;
  let activeSavedDrapedImages = [];
  let activeSavedDrapedImagesClientId = "";
  let coverPhotoDrag = null;
  const reportTemplateCache = new Map();
  const reportFanTemplatePaletteCodeMap = {
    CWLG: "CWL",
    CWMG: "CWM",
    CWDG: "CWD",
    SWLG: "SWL",
    SWMG: "SWM",
    SWDG: "SWD"
  };
  const reportColorWheelImageUrlMap = {
    CWLG: "https://cdn.shopify.com/s/files/1/0623/6284/5408/files/cropped_CWLG.png?v=1785779014",
    CWMG: "https://cdn.shopify.com/s/files/1/0623/6284/5408/files/cropped_CWMG.png?v=1785779014",
    CWDG: "https://cdn.shopify.com/s/files/1/0623/6284/5408/files/cropped_CWDG.png?v=1785779014",
    SWLG: "https://cdn.shopify.com/s/files/1/0623/6284/5408/files/cropped_SWLG.png?v=1785779014",
    SWMG: "https://cdn.shopify.com/s/files/1/0623/6284/5408/files/cropped_SWMG.png?v=1785779014",
    SWDG: "https://cdn.shopify.com/s/files/1/0623/6284/5408/files/cropped_SWDG.png?v=1785779014"
  };

  const REPORT_TYPE = "signature_first_section";
  const BASE_REPORT_PAGE_COUNT = 7;
  const LOCKED_REPORT_PAGE_COUNT = 3;
  const MOVABLE_BUILT_IN_REPORT_PAGES = ["depth", "temperature", "chroma", "palette"];
  const YCS_REPORT_LOGO_URL = "https://cdn.shopify.com/s/files/1/0623/6284/5408/files/YourColorStyle_Logo-120.png?v=1643287573";
  const REPORT_CHECKMARK_URL = "https://cdn.shopify.com/s/files/1/0623/6284/5408/files/green-check-mark.png?v=1740232016";
  const paletteNames = {
    CCL: "Clear Cool Light",
    CCM: "Clear Cool Medium",
    CCD: "Clear Cool Deep",
    CWL: "Clear Warm Light",
    CWM: "Clear Warm Medium",
    CWD: "Clear Warm Deep",
    SCL: "Soft Cool Light",
    SCM: "Soft Cool Medium",
    SCD: "Soft Cool Deep",
    SWL: "Soft Warm Light",
    SWM: "Soft Warm Medium",
    SWD: "Soft Warm Deep",
    CWLG: "Clear Warm Light for Gray Hair",
    CWMG: "Clear Warm Medium for Gray Hair",
    CWDG: "Clear Warm Deep for Gray Hair",
    SWLG: "Soft Warm Light for Gray Hair",
    SWMG: "Soft Warm Medium for Gray Hair",
    SWDG: "Soft Warm Deep for Gray Hair",
    LO: "Light Olive",
    MO: "Medium Olive",
    DO: "Deep Olive"
  };

  const colorTypeOptions = Object.entries(paletteNames);

  function escapeHtml(value) {
    return String(value || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function normalize(value) {
    return String(value || "").trim().toLowerCase();
  }

  function normalizeStatus(value) {
    const status = normalize(value);
    if (!status) return "";
    if (status.includes("complete") || status === "done") return "complete";
    if (status.includes("progress")) return "in-progress";
    return "new";
  }

  function displayStatus(value) {
    const key = normalizeStatus(value);
    if (key === "complete") return "Complete";
    if (key === "in-progress") return "In Progress";
    return "";
  }

  function displayName(client) {
    const name = [client.firstName, client.lastName].filter(Boolean).join(" ").trim();
    return name || "Unnamed Client";
  }

  function formatDate(value) {
    if (!value) return "";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "";
    return date.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
  }

  function getPhotoUrl(client) {
    const photos = Array.isArray(client.photos) ? client.photos : [];
    const latestAdjustedPhoto = photos.find((photo) => photo && photo.adjustedPhotoUrl);
    const latestPhoto = photos.find((photo) => photo && (photo.photoUrl || photo.activePhotoUrl || photo.originalPhotoUrl));

    return client.adjustedPhotoUrl ||
      latestAdjustedPhoto?.adjustedPhotoUrl ||
      client.primaryPhotoUrl ||
      client.activePhotoUrl ||
      client.photoUrl ||
      latestPhoto?.adjustedPhotoUrl ||
      latestPhoto?.activePhotoUrl ||
      latestPhoto?.photoUrl ||
      client.originalPhotoUrl ||
      latestPhoto?.originalPhotoUrl ||
      "";
  }

  function clientHasPhoto(client) {
    return !!getPhotoUrl(client);
  }

  function getAdjustedPhotoUrl(client) {
    const photos = Array.isArray(client.photos) ? client.photos : [];
    const latestAdjustedPhoto = photos.find((photo) => photo && photo.adjustedPhotoUrl);

    return client.adjustedPhotoUrl ||
      latestAdjustedPhoto?.adjustedPhotoUrl ||
      client.primaryPhotoUrl ||
      "";
  }

  function paletteLabel(client) {
    const code = String(client.paletteCode || "").trim();
    const name = String(client.paletteName || "").trim();
    if (code && name) return `${name} (${code})`;
    return name || code || "";
  }

  function paletteNameForCode(code) {
    const normalizedCode = String(code || "").trim().toUpperCase();
    const option = YCS_PALETTE_OPTIONS.find(([optionCode]) => optionCode === normalizedCode);
    return option ? option[1] : "";
  }

  function getPaletteName(code) {
    return paletteNames[String(code || "").trim().toUpperCase()] || String(code || "").trim();
  }

  function getDepthFromPalette(code) {
    const upperCode = String(code || "").trim().toUpperCase();
    if (upperCode.endsWith("L") || upperCode.endsWith("LG") || upperCode === "LO") return "Light";
    if (upperCode.endsWith("D") || upperCode.endsWith("DG") || upperCode === "DO") return "Deep";
    return "Medium";
  }

  function getTemperatureFromPalette(code) {
    const upperCode = String(code || "").trim().toUpperCase();
    if (upperCode.endsWith("O")) return "Olive";
    if (upperCode.charAt(1) === "W") return "Warm";
    if (upperCode.charAt(1) === "C") return "Cool";
    if (upperCode.includes("COOL")) return "Cool";
    return "Cool";
  }

  function getChromaFromPalette(code) {
    const upperCode = String(code || "").trim().toUpperCase();
    if (upperCode.startsWith("C")) return "Clear";
    if (upperCode.startsWith("S")) return "Soft";
    return "Balanced";
  }

  function firstNameForCopy(client) {
    return String(client.firstName || "").trim() || "your client";
  }

  function choiceKey(value) {
    return String(value || "").trim().toLowerCase();
  }

  function selectedAttr(value, selected) {
    return choiceKey(value) === choiceKey(selected) ? " selected" : "";
  }

  function renderDecisionOptions(options, selected) {
    return [
      `<option value=""${selectedAttr("", selected)}>No check mark</option>`,
      ...options.map((option) => (
        `<option value="${escapeHtml(option.value)}"${selectedAttr(option.value, selected)}>${escapeHtml(option.label)}</option>`
      ))
    ].join("");
  }

  function choiceLabel(value, fallback) {
    const rawValue = String(value || fallback || "").trim();
    if (!rawValue) return "";
    return rawValue.charAt(0).toUpperCase() + rawValue.slice(1).toLowerCase();
  }

  function makeCustomReportPageId() {
    return `custom_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
  }

  function makeReportOrderId(prefix = "page") {
    return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
  }

  function reportCustomPages(draft) {
    return Array.isArray(draft?.customPages) ? draft.customPages : [];
  }

  function builtInReportPageLabel(key) {
    return {
      depth: "Depth",
      temperature: "Temperature",
      chroma: "Chroma",
      palette: "Palette Type"
    }[key] || "Report Page";
  }

  function reportPageEntryLabel(draft, entry) {
    if (entry?.type === "custom") return customPageById(draft, entry.key)?.title || "Custom Page";
    const label = builtInReportPageLabel(entry?.key);
    return entry?.duplicateOf ? `${label} Copy` : label;
  }

  function customPageById(draft, id) {
    return reportCustomPages(draft).find((page) => page.id === id) || null;
  }

  function reportPageCopies(draft) {
    return draft?.pageCopies && typeof draft.pageCopies === "object" && !Array.isArray(draft.pageCopies)
      ? draft.pageCopies
      : {};
  }

  function builtInReportImageFields(key) {
    return {
      depth: [
        ["depthLightImageUrl", "depthImageUrl"],
        ["depthMediumImageUrl", ""],
        ["depthDeepImageUrl", ""]
      ],
      temperature: [
        ["undertoneWarmImageUrl", "undertoneImageUrl"],
        ["undertoneCoolImageUrl", ""],
        ["undertoneOliveImageUrl", ""]
      ],
      chroma: [
        ["chromaSoftImageUrl", "chromaImageUrl"],
        ["chromaClearImageUrl", ""]
      ]
    }[key] || [];
  }

  function builtInReportImageValue(draft, entry, fieldName, fallbackFieldName = "") {
    if (entry?.duplicateOf) {
      const copy = reportPageCopies(draft)[entry.id] || {};
      const copyValue = String(copy[fieldName] || "").trim();
      if (copyValue) return copyValue;
    }
    return String(draft?.[fieldName] || (fallbackFieldName ? draft?.[fallbackFieldName] : "") || "");
  }

  function builtInReportImageFieldName(entry, fieldName) {
    return entry?.duplicateOf ? `pageCopies.${entry.id}.${fieldName}` : fieldName;
  }

  function copyBuiltInReportImages(draft, entry) {
    return builtInReportImageFields(entry?.key).reduce((copy, fieldPair) => {
      const [fieldName, fallbackFieldName] = fieldPair;
      copy[fieldName] = builtInReportImageValue(draft, entry, fieldName, fallbackFieldName);
      return copy;
    }, {});
  }

  function normalizeReportPageOrder(draft) {
    const customIds = new Set(reportCustomPages(draft).map((page) => page.id));
    const usedSingleBuiltIns = new Set();
    const rawEntries = Array.isArray(draft?.reportPageOrder) ? draft.reportPageOrder : [];
    const entries = rawEntries.map((entry) => {
      const type = String(entry?.type || "").trim();
      const key = String(entry?.key || "").trim();
      if (type === "builtIn" && MOVABLE_BUILT_IN_REPORT_PAGES.includes(key)) {
        if (usedSingleBuiltIns.has(key) && !entry.duplicateOf) return null;
        if (!entry.duplicateOf) usedSingleBuiltIns.add(key);
        return {
          id: String(entry.id || makeReportOrderId(key)),
          type: "builtIn",
          key,
          duplicateOf: entry.duplicateOf ? String(entry.duplicateOf) : ""
        };
      }
      if (type === "custom" && customIds.has(key)) {
        return {
          id: String(entry.id || makeReportOrderId("custom")),
          type: "custom",
          key
        };
      }
      return null;
    }).filter(Boolean);

    MOVABLE_BUILT_IN_REPORT_PAGES.forEach((key) => {
      if (!usedSingleBuiltIns.has(key)) {
        entries.push({ id: key, type: "builtIn", key, duplicateOf: "" });
      }
    });

    reportCustomPages(draft).forEach((page) => {
      if (!entries.some((entry) => entry.type === "custom" && entry.key === page.id)) {
        entries.push({ id: page.id, type: "custom", key: page.id });
      }
    });

    return entries;
  }

  function totalReportPages(draft) {
    return LOCKED_REPORT_PAGE_COUNT + normalizeReportPageOrder(draft).length;
  }

  function customReportPageInsertIndex(draft) {
    return Math.min(Math.max(activeReportPage - LOCKED_REPORT_PAGE_COUNT, 0), normalizeReportPageOrder(draft).length);
  }

  function applyReportPageOrder(draft, entries) {
    draft.reportPageOrder = entries;
    return draft;
  }

  function moveReportPageToIndex(draft, orderId, nextIndex) {
    const entries = normalizeReportPageOrder(draft);
    const currentIndex = entries.findIndex((entry) => entry.id === orderId);
    if (currentIndex < 0) return draft;

    const nextEntries = entries.slice();
    const [movedEntry] = nextEntries.splice(currentIndex, 1);
    const requestedIndex = Math.min(Math.max(Number(nextIndex) || 0, 0), entries.length);
    const safeIndex = Math.min(Math.max(currentIndex < requestedIndex ? requestedIndex - 1 : requestedIndex, 0), nextEntries.length);
    if (safeIndex === currentIndex) return draft;

    nextEntries.splice(safeIndex, 0, movedEntry);
    applyReportPageOrder(draft, nextEntries);
    activeReportPage = LOCKED_REPORT_PAGE_COUNT + safeIndex + 1;
    return draft;
  }

  function duplicateReportPage(draft, orderId) {
    const entries = normalizeReportPageOrder(draft);
    const currentIndex = entries.findIndex((entry) => entry.id === orderId);
    if (currentIndex < 0) return draft;

    const entry = entries[currentIndex];
    const nextEntries = entries.slice();
    if (entry.type === "custom") {
      const page = customPageById(draft, entry.key);
      if (!page) return draft;
      const newId = makeCustomReportPageId();
      draft.customPages = [
        ...reportCustomPages(draft),
        { ...page, id: newId, title: page.title ? `${page.title} Copy` : page.title }
      ];
      nextEntries.splice(currentIndex + 1, 0, { id: newId, type: "custom", key: newId });
    } else {
      const newId = makeReportOrderId(entry.key);
      draft.pageCopies = {
        ...reportPageCopies(draft),
        [newId]: copyBuiltInReportImages(draft, entry)
      };
      nextEntries.splice(currentIndex + 1, 0, {
        id: newId,
        type: "builtIn",
        key: entry.key,
        duplicateOf: entry.id
      });
    }
    applyReportPageOrder(draft, nextEntries);
    activeReportPage = LOCKED_REPORT_PAGE_COUNT + currentIndex + 2;
    return draft;
  }

  function canDeleteReportPageEntry(entry) {
    return !!entry && (entry.type === "custom" || !!entry.duplicateOf);
  }

  function reportPageNumberForBuiltIn(draft, key) {
    const entries = normalizeReportPageOrder(draft);
    const activeIndex = activeReportPage - LOCKED_REPORT_PAGE_COUNT - 1;
    if (entries[activeIndex]?.type === "builtIn" && entries[activeIndex]?.key === key) return activeReportPage;
    const index = entries.findIndex((entry) => entry.type === "builtIn" && entry.key === key);
    return index >= 0 ? LOCKED_REPORT_PAGE_COUNT + index + 1 : LOCKED_REPORT_PAGE_COUNT + 1;
  }

  function reportEntryForBuiltInControls(draft, key) {
    const entries = normalizeReportPageOrder(draft);
    const activeIndex = activeReportPage - LOCKED_REPORT_PAGE_COUNT - 1;
    if (entries[activeIndex]?.type === "builtIn" && entries[activeIndex]?.key === key) return entries[activeIndex];
    return entries.find((entry) => entry.type === "builtIn" && entry.key === key) || { id: key, type: "builtIn", key, duplicateOf: "" };
  }

  function reportPageNumberForCustomPage(draft, pageId) {
    const index = normalizeReportPageOrder(draft).findIndex((entry) => entry.type === "custom" && entry.key === pageId);
    return index >= 0 ? LOCKED_REPORT_PAGE_COUNT + index + 1 : totalReportPages(draft);
  }

  function copyWithoutGeneratedLead(value, leadPatterns) {
    const paragraphs = String(value || "").split(/\n{2,}/);
    if (paragraphs.length && leadPatterns.some((pattern) => pattern.test(paragraphs[0].trim()))) {
      const copy = paragraphs.slice(1).join("\n\n").trim();
      return copy || paragraphs.join("\n\n");
    }

    return paragraphs.join("\n\n");
  }

  function renderCopyWithSubheading(subheading, body, leadPatterns) {
    const bodyHtml = paragraphHtml(copyWithoutGeneratedLead(body, leadPatterns));
    return `
      <div class="ycs-report-copy">
        <p class="ycs-report-copy-subheading"><strong>${escapeHtml(subheading)}</strong></p>
        ${bodyHtml}
      </div>
    `;
  }

  function monthYear(value) {
    const date = value ? new Date(value) : new Date();
    if (Number.isNaN(date.getTime())) return "";
    return date.toLocaleDateString(undefined, { month: "long", year: "numeric" });
  }

  function defaultReportDraft(client) {
    const paletteCode = String(client.paletteCode || "SCM").trim().toUpperCase();
    const paletteName = client.paletteName || getPaletteName(paletteCode) || "Soft Cool Medium";
    const depth = getDepthFromPalette(paletteCode);
    const temperature = getTemperatureFromPalette(paletteCode);
    const chroma = getChromaFromPalette(paletteCode);
    const firstName = firstNameForCopy(client);

    return {
      version: 1,
      reportType: REPORT_TYPE,
      customerName: displayName(client),
      reportDate: new Date().toISOString().slice(0, 10),
      brandLogoUrl: "",
      brandName: "Your Color Style",
      paletteCode,
      paletteName,
      colorFanImageUrl: "",
      selectedDrapeImageUrl: getAdjustedPhotoUrl(client),
      coverPhotoScale: 1,
      coverPhotoX: 0,
      coverPhotoY: 0,
      colorWheelImageUrl: "",
      depthImageUrl: "",
      depthLightImageUrl: "",
      depthMediumImageUrl: "",
      depthDeepImageUrl: "",
      undertoneImageUrl: "",
      undertoneWarmImageUrl: "",
      undertoneCoolImageUrl: "",
      undertoneOliveImageUrl: "",
      chromaImageUrl: "",
      chromaSoftImageUrl: "",
      chromaClearImageUrl: "",
      showOliveImage: true,
      depth,
      undertone: temperature,
      chroma,
      depthChoice: choiceKey(depth),
      undertoneChoice: choiceKey(temperature),
      chromaChoice: choiceKey(chroma),
      customPages: [],
      reportPageOrder: [],
      pageCopies: {},
      text: {
        intro: `Dear ${firstName},\n\nOne of my favorite parts of creating a Signature Color Analysis is discovering the quiet beauty that makes someone unique. Your best colors reflect the natural harmony already present in your features.\n\nYou are ${paletteName}, a palette built around ${temperature.toLowerCase()} undertones, ${depth.toLowerCase()} depth, and ${chroma.toLowerCase()} color. Together, these qualities create a look that feels refined, approachable, and effortlessly polished.\n\nThe colors throughout this guide were selected because they work with your natural coloring, not against it. My hope is that this guide makes choosing colors feel simple.\n\nWarmly,\nJen Vax`,
        howItWorks: "Your best colors are based on how color interacts with your natural features. At Your Color Style, we use a simple 3-step process to identify the colors that make you look more vibrant, healthy, and put together.",
        colorWheel: "This personalized color wheel shows the range of colors that harmonize with your tones and how your best colors relate to each other.",
        depth: `Your depth is ${depth}.\n\nYour overall coloring sits comfortably in the ${depth.toLowerCase()} range. Wearing the right depth keeps your features balanced instead of washed out or overpowered.`,
        undertone: `You have ${temperature.toUpperCase()} undertones.\n\nYour coloring is naturally enhanced by ${temperature.toLowerCase()}-based colors. These tones support your natural features and help your complexion look clearer and more even.`,
        chroma: `You are ${chroma.toUpperCase()}.\n\nYour best colors have the right level of clarity for your features. They create balance and allow your face to remain the focus.`,
        paletteType: `You are ${paletteName}.\n\nYour palette combines ${temperature.toLowerCase()} undertones, ${depth.toLowerCase()} depth, and ${chroma.toLowerCase()} color. The result is a collection of colors that feels harmonious, wearable, and authentically you.\n\nYour best colors:\n- Harmonize with your natural undertone\n- Sit primarily in your best depth range\n- Match your natural level of softness or clarity\n- Enhance your eyes and complexion without overwhelming your features`
      }
    };
  }

  function normalizeCustomPageTemplate(template) {
    const value = String(template || "").trim();
    if (value === "photos" || value === "photos4") return value;
    return "letter";
  }

  function mergeReportDraft(client, savedDraft) {
    const base = defaultReportDraft(client);
    const incoming = savedDraft && typeof savedDraft === "object" ? savedDraft : {};
    const incomingLogoUrl = String(incoming.brandLogoUrl || "").trim();
    return {
      ...base,
      ...incoming,
      brandLogoUrl: incomingLogoUrl === YCS_REPORT_LOGO_URL ? "" : incomingLogoUrl,
      selectedDrapeImageUrl: base.selectedDrapeImageUrl,
      coverPhotoScale: Math.min(Math.max(Number(incoming.coverPhotoScale) || base.coverPhotoScale, 0.7), 2.4),
      coverPhotoX: Math.min(Math.max(Number(incoming.coverPhotoX) || base.coverPhotoX, -120), 120),
      coverPhotoY: Math.min(Math.max(Number(incoming.coverPhotoY) || base.coverPhotoY, -120), 120),
      customPages: Array.isArray(incoming.customPages)
        ? incoming.customPages.map((page) => ({
          id: String(page.id || makeCustomReportPageId()),
          template: normalizeCustomPageTemplate(page.template),
          title: String(page.title || ""),
          copy: String(page.copy || ""),
          image1Url: String(page.image1Url || ""),
          image2Url: String(page.image2Url || ""),
          image3Url: String(page.image3Url || ""),
          image4Url: String(page.image4Url || "")
        }))
        : [],
      reportPageOrder: Array.isArray(incoming.reportPageOrder) ? incoming.reportPageOrder : [],
      pageCopies: Object.entries(reportPageCopies(incoming)).reduce((copies, entryPair) => {
        const [id, fields] = entryPair;
        if (!fields || typeof fields !== "object" || Array.isArray(fields)) return copies;
        copies[String(id)] = Object.entries(fields).reduce((fieldCopies, fieldPair) => {
          const [fieldName, value] = fieldPair;
          fieldCopies[String(fieldName)] = String(value || "");
          return fieldCopies;
        }, {});
        return copies;
      }, {}),
      text: {
        ...base.text,
        ...(incoming.text || {})
      }
    };
  }

  function reportStorageKey(clientRecordId) {
    return `ycs-report-draft:${consultantId}:${clientRecordId}:${REPORT_TYPE}`;
  }

  function getLocalReportDraft(clientRecordId) {
    try {
      const rawDraft = window.localStorage.getItem(reportStorageKey(clientRecordId));
      return rawDraft ? JSON.parse(rawDraft) : null;
    } catch (error) {
      console.warn("Unable to read local report draft", error);
      return null;
    }
  }

  function saveLocalReportDraft(clientRecordId, draft) {
    try {
      window.localStorage.setItem(reportStorageKey(clientRecordId), JSON.stringify(draft));
      return true;
    } catch (error) {
      console.warn("Unable to save local report draft", error);
      return false;
    }
  }

  function paragraphHtml(value) {
    const copy = String(value || "").trim();
    if (!copy) return "";

    return escapeHtml(copy)
      .split(/\n{2,}/)
      .map((paragraph) => `<p>${paragraph.replace(/\n/g, "<br>")}</p>`)
      .join("");
  }

  function reportDateLabel(draft) {
    return monthYear(draft.reportDate);
  }

  function reportFullDateLabel(draft) {
    const date = draft.reportDate ? new Date(`${draft.reportDate}T12:00:00`) : new Date();
    if (Number.isNaN(date.getTime())) return reportDateLabel(draft);
    return date.toLocaleDateString(undefined, { month: "long", day: "numeric", year: "numeric" });
  }

  function renderReportImage(url, label, className) {
    if (!url) {
      return `<div class="${className || "ycs-report-preview__image"} ycs-report-preview__image--empty">${escapeHtml(label)}</div>`;
    }

    return `<img class="${className || "ycs-report-preview__image"}" src="${escapeHtml(url)}" alt="${escapeHtml(label)}">`;
  }

  function renderPreviewImageTarget(fieldName, label, html, interactive) {
    if (!interactive || !fieldName) return html;

    return `
      <button
        class="ycs-report-preview-image-button"
        type="button"
        data-ycs-report-preview-image-field="${escapeHtml(fieldName)}"
        data-ycs-report-preview-image-label="${escapeHtml(label)}">
        ${html}
      </button>
    `;
  }

  function renderCoverArt(draft, extraClass, options = {}) {
    const scale = Math.min(Math.max(Number(draft.coverPhotoScale) || 1, 0.7), 2.4);
    const x = Math.min(Math.max(Number(draft.coverPhotoX) || 0, -120), 120);
    const y = Math.min(Math.max(Number(draft.coverPhotoY) || 0, -120), 120);
    const isDraggable = options.interactive && options.draggable;
    const frameAttrs = isDraggable
      ? ' data-ycs-report-cover-photo-drag title="Drag to reposition cover photo"'
      : "";
    const drapeHtml = draft.selectedDrapeImageUrl
      ? `
        <div class="ycs-report-cover-art__drape-frame${isDraggable ? " is-draggable" : ""}"${frameAttrs}>
          <img
            class="ycs-report-cover-art__drape"
            src="${escapeHtml(draft.selectedDrapeImageUrl)}"
            alt="${escapeHtml(draft.customerName || "Adjusted photo")}"
            draggable="false"
            style="--cover-photo-scale:${scale};--cover-photo-x:${x}px;--cover-photo-y:${y}px;">
        </div>
      `
      : `<div class="ycs-report-cover-art__drape-frame ycs-report-preview__image--empty${isDraggable ? " is-draggable" : ""}"${frameAttrs}>Adjusted photo</div>`;

    return `
      <div class="ycs-report-cover-art${extraClass ? ` ${extraClass}` : ""}">
        ${draft.colorFanImageUrl
          ? `<img class="ycs-report-cover-art__fan" src="${escapeHtml(draft.colorFanImageUrl)}" alt="Color fan">`
          : `<div class="ycs-report-cover-art__fan ycs-report-preview__image--empty">Color fan image</div>`}
        ${drapeHtml}
      </div>
    `;
  }

  function renderReportBrand(draft) {
    const logoUrl = String(draft.brandLogoUrl || "").trim();
    const brandName = String(draft.brandName || "").trim() || "Your Color Style";

    if (logoUrl) {
      return `<img class="ycs-report-logo" src="${escapeHtml(logoUrl)}" alt="${escapeHtml(brandName)}">`;
    }

    return `<div class="ycs-report-logo ycs-report-logo--text">${escapeHtml(brandName)}</div>`;
  }

  function savedImageTitle(image) {
    return [
      image.drapeColorName,
      image.paletteCode,
      image.createdAt ? formatDate(image.createdAt) : ""
    ].filter(Boolean).join(" · ");
  }

  function clientPhotoSourceLabel(image) {
    const source = String(image.sourceTool || "").trim();
    if (source === "color-analysis") return "Color Analysis Tool";
    if (source === "lip-draping") return "Lip & Draping Studio";
    return source || "Saved draped photo";
  }

  function renderClientPhotoManager(client, images, options = {}) {
    const imageList = Array.isArray(images) ? sortSavedImagesForPicker(images, "") : [];
    const statusHtml = options.loading
      ? `<p class="ycs-client-photo-manager__status">Loading saved draped photos...</p>`
      : options.error
        ? `<p class="ycs-client-photo-manager__status ycs-client-photo-manager__status--error">${escapeHtml(options.error)}</p>`
        : "";

    return `
      <section class="ycs-client-photo-manager__panel" data-ycs-client-photo-manager-panel data-client-record-id="${escapeHtml(client.clientRecordId)}">
        <div class="ycs-client-photo-manager__head">
          <div>
            <h3>Saved Draped Photos</h3>
            <p>${imageList.length ? `${imageList.length} saved photo${imageList.length === 1 ? "" : "s"}` : "No saved draped photos found for this client."}</p>
          </div>
          ${imageList.length ? `
            <button class="ycs-clients__button ycs-clients__button--danger" type="button" data-ycs-bulk-delete-client-photos disabled>Delete Selected</button>
          ` : ""}
        </div>
        ${statusHtml}
        ${imageList.length ? `
          <label class="ycs-client-photo-manager__select-all">
            <input type="checkbox" data-ycs-client-photo-select-all>
            <span>Select all</span>
          </label>
          <div class="ycs-client-photo-manager__grid">
            ${imageList.map((image) => {
              const label = savedImageTitle(image) || image.fileName || "Saved draped photo";
              return `
                <article class="ycs-client-photo-manager__card">
                  <label class="ycs-client-photo-manager__check">
                    <input type="checkbox" value="${escapeHtml(image.id)}" data-ycs-client-photo-select>
                    <span>Select</span>
                  </label>
                  <img src="${escapeHtml(image.imageUrl)}" alt="${escapeHtml(label)}">
                  <div class="ycs-client-photo-manager__body">
                    <strong>${escapeHtml(label)}</strong>
                    <small>${escapeHtml(clientPhotoSourceLabel(image))}</small>
                    <button class="ycs-clients__button ycs-clients__button--danger" type="button" data-ycs-delete-client-photo="${escapeHtml(image.id)}">Delete</button>
                  </div>
                </article>
              `;
            }).join("")}
          </div>
        ` : ""}
      </section>
    `;
  }

  function updateClientPhotoBulkState(panel) {
    if (!panel) return;
    const selectedCount = panel.querySelectorAll("[data-ycs-client-photo-select]:checked").length;
    const bulkButton = panel.querySelector("[data-ycs-bulk-delete-client-photos]");
    const selectAll = panel.querySelector("[data-ycs-client-photo-select-all]");
    const checkboxes = panel.querySelectorAll("[data-ycs-client-photo-select]");

    if (bulkButton) {
      bulkButton.disabled = selectedCount === 0;
      bulkButton.textContent = selectedCount ? `Delete Selected (${selectedCount})` : "Delete Selected";
    }

    if (selectAll) {
      selectAll.checked = checkboxes.length > 0 && selectedCount === checkboxes.length;
      selectAll.indeterminate = selectedCount > 0 && selectedCount < checkboxes.length;
    }
  }

  function sortSavedImagesForPicker(images, preferredChoice) {
    const preferredKey = choiceKey(preferredChoice);
    return images.slice().sort((a, b) => {
      const aMatch = preferredKey && choiceKey(a.drapeColorName) === preferredKey ? 0 : 1;
      const bMatch = preferredKey && choiceKey(b.drapeColorName) === preferredKey ? 0 : 1;
      if (aMatch !== bMatch) return aMatch - bMatch;
      return String(b.createdAt || "").localeCompare(String(a.createdAt || ""));
    });
  }

  function renderSavedImagePicker({ fieldName, title, selectedUrl, preferredChoice }) {
    const images = sortSavedImagesForPicker(activeSavedDrapedImages, preferredChoice);
    const current = images.find((image) => image.imageUrl === selectedUrl);
    const currentLabel = current
      ? savedImageTitle(current)
      : (selectedUrl ? "Custom image selected" : "No image selected");
    const previewHtml = selectedUrl
      ? `<img class="ycs-report-image-picker__preview" src="${escapeHtml(selectedUrl)}" alt="${escapeHtml(currentLabel)}">`
      : `<div class="ycs-report-image-picker__preview ycs-report-image-picker__preview--empty">No image</div>`;

    return `
      <div class="ycs-report-image-picker" data-ycs-report-image-picker="${escapeHtml(fieldName)}">
        <button
          class="ycs-report-image-picker__trigger"
          type="button"
          data-ycs-report-image-picker-toggle="${escapeHtml(fieldName)}">
          ${previewHtml}
          <span class="ycs-report-image-picker__head">
            <span>${escapeHtml(title)}</span>
            <small data-ycs-report-image-current>${escapeHtml(currentLabel)}</small>
          </span>
        </button>
        <details class="ycs-report-image-picker__choices">
          <summary>Choose image</summary>
          <div class="ycs-report-image-picker__grid">
            ${images.length ? images.map((image) => {
              const isSelected = image.imageUrl === selectedUrl;
              const label = savedImageTitle(image) || "Saved draped image";
              return `
                <button
                  class="ycs-report-image-option${isSelected ? " is-selected" : ""}"
                  type="button"
                  data-ycs-report-image-select
                  data-report-image-field="${escapeHtml(fieldName)}"
                  data-report-image-url="${escapeHtml(image.imageUrl || "")}"
                  data-report-image-label="${escapeHtml(label)}"
                  title="${escapeHtml(label)}">
                  <img src="${escapeHtml(image.imageUrl || "")}" alt="${escapeHtml(label)}">
                  <span>${escapeHtml(image.drapeColorName || image.panel || "Saved")}</span>
                </button>
              `;
            }).join("") : `<p class="ycs-report-image-picker__empty">No saved draped images yet.</p>`}
          </div>
        </details>
        <button
          class="ycs-report-image-clear"
          type="button"
          data-ycs-report-image-select
          data-report-image-field="${escapeHtml(fieldName)}"
          data-report-image-url=""
          data-report-image-label="No image selected"
          ${selectedUrl ? "" : "hidden"}>
          Clear selection
        </button>
      </div>
    `;
  }

  function renderReportLogoControls(draft) {
    const logoUrl = String(draft.brandLogoUrl || "").trim();
    return `
      <div class="ycs-report-form-panel ycs-report-logo-controls">
        <div class="ycs-report-form-panel__head">
          <span>Report logo</span>
          <small>${logoUrl ? "Image logo is active." : "Text logo is active."}</small>
        </div>
        <input type="hidden" name="brandLogoUrl" value="${escapeHtml(logoUrl)}">
        ${logoUrl ? `
          <div class="ycs-report-logo-controls__actions">
            <button class="ycs-clients__button ycs-clients__button--secondary" type="button" data-ycs-clear-report-logo>Remove Logo</button>
          </div>
        ` : `
          <label>Upload logo image<input name="brandLogoFile" type="file" accept="image/*"></label>
          <label>Logo text when no image is used<input name="brandName" value="${escapeHtml(draft.brandName)}"></label>
        `}
      </div>
    `;
  }

  function renderCustomPagesForm(draft) {
    const customPages = reportCustomPages(draft);
    return `
      ${customPages.length ? customPages.map((page, index) => {
          const id = String(page.id || makeCustomReportPageId());
          const template = normalizeCustomPageTemplate(page.template);
          const pageNumber = reportPageNumberForCustomPage(draft, id);
          const isPhotoTemplate = template === "photos" || template === "photos4";
          const templateLabel = template === "photos4" ? "Four-photo page" : (template === "photos" ? "Photo page" : "Letter page");
          return `
            <div class="ycs-report-form-page" data-ycs-report-controls-page="${pageNumber}"${pageNumber === activeReportPage ? "" : " hidden"}>
              <div class="ycs-report-form-page__head">
                <span>Page ${pageNumber}</span>
                <small>${templateLabel}</small>
              </div>
              <fieldset class="ycs-report-custom-page" data-ycs-custom-report-page data-report-custom-page-id="${escapeHtml(id)}">
                <legend>Blank page settings</legend>
              <label>Template
                <select name="customPages.${escapeHtml(id)}.template">
                  <option value="letter"${template === "letter" ? " selected" : ""}>Letter Page</option>
                  <option value="photos"${template === "photos" ? " selected" : ""}>Title, two photos, copy</option>
                  <option value="photos4"${template === "photos4" ? " selected" : ""}>Title, four photos</option>
                </select>
              </label>
              <input type="hidden" name="customPages.${escapeHtml(id)}.image1Url" value="${escapeHtml(page.image1Url || "")}">
              <input type="hidden" name="customPages.${escapeHtml(id)}.image2Url" value="${escapeHtml(page.image2Url || "")}">
              <input type="hidden" name="customPages.${escapeHtml(id)}.image3Url" value="${escapeHtml(page.image3Url || "")}">
              <input type="hidden" name="customPages.${escapeHtml(id)}.image4Url" value="${escapeHtml(page.image4Url || "")}">
              ${isPhotoTemplate ? `
                <label>Title<input name="customPages.${escapeHtml(id)}.title" value="${escapeHtml(page.title || "")}"></label>
                ${renderSavedImagePicker({
                  fieldName: `customPages.${id}.image1Url`,
                  title: template === "photos4" ? "Top left photo" : "Left photo",
                  selectedUrl: page.image1Url,
                  preferredChoice: ""
                })}
                ${renderSavedImagePicker({
                  fieldName: `customPages.${id}.image2Url`,
                  title: template === "photos4" ? "Top right photo" : "Right photo",
                  selectedUrl: page.image2Url,
                  preferredChoice: ""
                })}
                ${template === "photos4" ? `
                  ${renderSavedImagePicker({
                    fieldName: `customPages.${id}.image3Url`,
                    title: "Bottom left photo",
                    selectedUrl: page.image3Url,
                    preferredChoice: ""
                  })}
                  ${renderSavedImagePicker({
                    fieldName: `customPages.${id}.image4Url`,
                    title: "Bottom right photo",
                    selectedUrl: page.image4Url,
                    preferredChoice: ""
                  })}
                ` : ""}
              ` : ""}
              ${template !== "photos4" ? `<label>Copy<textarea name="customPages.${escapeHtml(id)}.copy">${escapeHtml(page.copy || "")}</textarea></label>` : ""}
              </fieldset>
            </div>
          `;
        }).join("") : ""}
    `;
  }

  function renderReportPageRail(draft, orderedReportPages, insertPageLabel) {
    const lockedPages = [
      { pageNumber: 1, label: "Cover" },
      { pageNumber: 2, label: "Intro Letter" },
      { pageNumber: 3, label: "How It Works" }
    ];

    return `
      <aside class="ycs-report-page-rail" aria-label="Report pages">
        <div class="ycs-report-page-rail__head">
          <span>Pages</span>
        </div>
        <div class="ycs-report-page-rail__list" data-ycs-report-page-rail>
          ${lockedPages.map((page) => `
            <button
              type="button"
              class="ycs-report-page-rail__item${page.pageNumber === activeReportPage ? " is-active" : ""} is-locked"
              data-ycs-report-page-button="${page.pageNumber}">
              <span class="ycs-report-page-rail__thumb">${page.pageNumber}</span>
              <span class="ycs-report-page-rail__label">${escapeHtml(page.label)}</span>
            </button>
          `).join("")}
          ${orderedReportPages.map((entry, index) => {
            const pageNumber = LOCKED_REPORT_PAGE_COUNT + index + 1;
            const label = reportPageEntryLabel(draft, entry);
            return `
              <div
                class="ycs-report-page-rail__item${pageNumber === activeReportPage ? " is-active" : ""}"
                data-ycs-report-page-order-id="${escapeHtml(entry.id)}"
                data-ycs-report-page-order-index="${index}">
                <button type="button" class="ycs-report-page-rail__select" data-ycs-report-page-button="${pageNumber}">
                  <span class="ycs-report-page-rail__thumb">${pageNumber}</span>
                  <span class="ycs-report-page-rail__label">${escapeHtml(label)}</span>
                </button>
                <div class="ycs-report-page-rail__actions">
                  <button type="button" data-ycs-move-report-page="${escapeHtml(entry.id)}" data-ycs-move-report-page-direction="-1" aria-label="Move page ${pageNumber} up"${index === 0 ? " disabled" : ""}>↑</button>
                  <button type="button" data-ycs-move-report-page="${escapeHtml(entry.id)}" data-ycs-move-report-page-direction="1" aria-label="Move page ${pageNumber} down"${index === orderedReportPages.length - 1 ? " disabled" : ""}>↓</button>
                  <button type="button" data-ycs-duplicate-report-page="${escapeHtml(entry.id)}">Copy</button>
                  ${canDeleteReportPageEntry(entry) ? `<button type="button" class="ycs-report-page-rail__delete" data-ycs-delete-report-page="${escapeHtml(entry.id)}">Delete</button>` : ""}
                </div>
              </div>
            `;
          }).join("")}
        </div>
        <div class="ycs-report-page-add">
          <button type="button" class="ycs-report-page-add__primary" data-ycs-add-custom-report-page="letter">Add Page</button>
          <details class="ycs-report-page-add__more">
            <summary>Photo page types</summary>
            <div class="ycs-report-page-add__menu">
              <span>${escapeHtml(insertPageLabel)}</span>
              <button type="button" data-ycs-add-custom-report-page="photos">2-photo page</button>
              <button type="button" data-ycs-add-custom-report-page="photos4">4-photo page</button>
            </div>
          </details>
        </div>
      </aside>
    `;
  }

  function renderReportControlsPage(pageNumber, title, html) {
    return `
      <div class="ycs-report-form-page" data-ycs-report-controls-page="${pageNumber}"${pageNumber === activeReportPage ? "" : " hidden"}>
        <div class="ycs-report-form-page__head">
          <span>Page ${pageNumber}</span>
          <small>${escapeHtml(title)}</small>
        </div>
        ${html}
      </div>
    `;
  }

  function renderReportImageModal() {
    return `
      <div class="ycs-report-image-modal" data-ycs-report-image-modal hidden>
        <div class="ycs-report-image-modal__backdrop" data-ycs-report-image-modal-close></div>
        <div class="ycs-report-image-modal__dialog" role="dialog" aria-modal="true" aria-labelledby="ycs-report-image-modal-title">
          <div class="ycs-report-image-modal__head">
            <div>
              <h4 id="ycs-report-image-modal-title">Choose Saved Image</h4>
              <p data-ycs-report-image-modal-subtitle></p>
            </div>
            <button type="button" data-ycs-report-image-modal-close aria-label="Close image chooser">Close</button>
          </div>
          <div class="ycs-report-image-modal__grid" data-ycs-report-image-modal-grid></div>
        </div>
      </div>
    `;
  }

  function renderComparisonImages(items, className, selectedValue, options = {}) {
    const visibleItems = items.filter((item) => item.hidden !== true);
    const gridClass = visibleItems.length === 2 && className.includes("ycs-report-comparison-grid--three")
      ? className.replace("ycs-report-comparison-grid--three", "ycs-report-comparison-grid--two")
      : className;
    return `
      <div class="${gridClass}">
        ${visibleItems.map((item) => {
          const isSelected = choiceKey(item.value || item.label) === choiceKey(selectedValue);
          const figureBody = `
              <div class="ycs-report-comparison-image-space">
              ${isSelected
                ? `<img class="ycs-report-checkmark" src="${REPORT_CHECKMARK_URL}" alt="">`
                : ""}
              ${item.url
                ? `<img src="${escapeHtml(item.url)}" alt="${escapeHtml(item.label)}">`
                : `<div class="ycs-report-preview__image--empty">${escapeHtml(item.label)} image</div>`}
              </div>
              <span class="ycs-report-comparison-caption">${escapeHtml(item.label)}</span>
            `;

          return `
            <figure${isSelected ? ` class="is-selected"` : ""}>
              ${renderPreviewImageTarget(item.fieldName, item.label, figureBody, options.interactive)}
            </figure>
          `;
        }).join("")}
      </div>
    `;
  }

  function renderReportFooter(draft, pageNumber) {
    const name = String(draft.customerName || "Client").toUpperCase();
    const date = String(reportDateLabel(draft) || "").toUpperCase();

    return `
      <footer>
        <span>${pageNumber ? `${pageNumber} ` : ""}${escapeHtml(name)}</span>
        <span>${escapeHtml(date)}</span>
      </footer>
    `;
  }

  function renderCustomReportPage(draft, page, pageNumber, options = {}) {
    const template = normalizeCustomPageTemplate(page.template);

    if (template === "photos4") {
      return `
        <section class="ycs-report-page ycs-report-page--custom-photos ycs-report-page--custom-photos-four" data-report-page="${pageNumber}">
          ${renderReportBrand(draft)}
          <h1>${escapeHtml(page.title || "Custom Page")}</h1>
          <div class="ycs-report-custom-photo-grid ycs-report-custom-photo-grid--four">
            ${renderPreviewImageTarget(
              `customPages.${page.id}.image1Url`,
              "Top left photo",
              renderReportImage(page.image1Url, "Top left photo", "ycs-report-preview__custom-photo"),
              options.interactive
            )}
            ${renderPreviewImageTarget(
              `customPages.${page.id}.image2Url`,
              "Top right photo",
              renderReportImage(page.image2Url, "Top right photo", "ycs-report-preview__custom-photo"),
              options.interactive
            )}
            ${renderPreviewImageTarget(
              `customPages.${page.id}.image3Url`,
              "Bottom left photo",
              renderReportImage(page.image3Url, "Bottom left photo", "ycs-report-preview__custom-photo"),
              options.interactive
            )}
            ${renderPreviewImageTarget(
              `customPages.${page.id}.image4Url`,
              "Bottom right photo",
              renderReportImage(page.image4Url, "Bottom right photo", "ycs-report-preview__custom-photo"),
              options.interactive
            )}
          </div>
          ${renderReportFooter(draft, pageNumber)}
        </section>
      `;
    }

    if (template === "photos") {
      return `
        <section class="ycs-report-page ycs-report-page--custom-photos" data-report-page="${pageNumber}">
          ${renderReportBrand(draft)}
          <h1>${escapeHtml(page.title || "Custom Page")}</h1>
          <div class="ycs-report-custom-photo-grid">
            ${renderPreviewImageTarget(
              `customPages.${page.id}.image1Url`,
              "Left photo",
              renderReportImage(page.image1Url, "Left photo", "ycs-report-preview__custom-photo"),
              options.interactive
            )}
            ${renderPreviewImageTarget(
              `customPages.${page.id}.image2Url`,
              "Right photo",
              renderReportImage(page.image2Url, "Right photo", "ycs-report-preview__custom-photo"),
              options.interactive
            )}
          </div>
          <div class="ycs-report-copy ycs-report-copy--custom">${paragraphHtml(page.copy)}</div>
          ${renderReportFooter(draft, pageNumber)}
        </section>
      `;
    }

    return `
      <section class="ycs-report-page ycs-report-page--letter ycs-report-page--custom-letter" data-report-page="${pageNumber}">
        ${renderReportBrand(draft)}
        <div class="ycs-report-copy ycs-report-copy--letter">${paragraphHtml(page.copy)}</div>
        ${renderReportFooter(draft, pageNumber)}
      </section>
    `;
  }

  function reportPagesHtml(draft, options = {}) {
    const name = draft.customerName || "Client";
    const depthLabel = choiceLabel(draft.depthChoice, draft.depth).toUpperCase();
    const undertoneLabel = choiceLabel(draft.undertoneChoice, draft.undertone).toUpperCase();
    const chromaLabel = choiceLabel(draft.chromaChoice, draft.chroma).toUpperCase();

    const builtInRenderers = {
      depth: (pageNumber, entry) => `
        <section class="ycs-report-page ycs-report-page--comparison-copy" data-report-page="${pageNumber}">
          ${renderReportBrand(draft)}
          <h1>${escapeHtml(reportPageEntryLabel(draft, entry))}</h1>
          ${renderComparisonImages([
            { label: "Light Tones", value: "light", url: builtInReportImageValue(draft, entry, "depthLightImageUrl", "depthImageUrl"), fieldName: builtInReportImageFieldName(entry, "depthLightImageUrl") },
            { label: "Medium Tones", value: "medium", url: builtInReportImageValue(draft, entry, "depthMediumImageUrl"), fieldName: builtInReportImageFieldName(entry, "depthMediumImageUrl") },
            { label: "Deep Tones", value: "deep", url: builtInReportImageValue(draft, entry, "depthDeepImageUrl"), fieldName: builtInReportImageFieldName(entry, "depthDeepImageUrl") }
          ], "ycs-report-comparison-grid ycs-report-comparison-grid--three", draft.depthChoice, options)}
          ${renderCopyWithSubheading(`Your depth is ${depthLabel}`, draft.text.depth, [/^your depth is\b/i])}
          ${renderReportFooter(draft, pageNumber)}
        </section>
      `,
      temperature: (pageNumber, entry) => `
        <section class="ycs-report-page ycs-report-page--comparison-copy" data-report-page="${pageNumber}">
          ${renderReportBrand(draft)}
          <h1>${escapeHtml(reportPageEntryLabel(draft, entry))}</h1>
          ${renderComparisonImages([
            { label: "Warm Tones", value: "warm", url: builtInReportImageValue(draft, entry, "undertoneWarmImageUrl", "undertoneImageUrl"), fieldName: builtInReportImageFieldName(entry, "undertoneWarmImageUrl") },
            { label: "Cool Tones", value: "cool", url: builtInReportImageValue(draft, entry, "undertoneCoolImageUrl"), fieldName: builtInReportImageFieldName(entry, "undertoneCoolImageUrl") },
            { label: "Olive Tones", value: "olive", url: builtInReportImageValue(draft, entry, "undertoneOliveImageUrl"), fieldName: builtInReportImageFieldName(entry, "undertoneOliveImageUrl"), hidden: draft.showOliveImage === false }
          ], "ycs-report-comparison-grid ycs-report-comparison-grid--three", draft.undertoneChoice, options)}
          ${renderCopyWithSubheading(`Your undertone is ${undertoneLabel}`, draft.text.undertone, [/^you have\b/i, /^your undertone is\b/i])}
          ${renderReportFooter(draft, pageNumber)}
        </section>
      `,
      chroma: (pageNumber, entry) => `
        <section class="ycs-report-page ycs-report-page--comparison-copy" data-report-page="${pageNumber}">
          ${renderReportBrand(draft)}
          <h1>${escapeHtml(reportPageEntryLabel(draft, entry))}</h1>
          ${renderComparisonImages([
            { label: "Soft Tones", value: "soft", url: builtInReportImageValue(draft, entry, "chromaSoftImageUrl", "chromaImageUrl"), fieldName: builtInReportImageFieldName(entry, "chromaSoftImageUrl") },
            { label: "Clear Tones", value: "clear", url: builtInReportImageValue(draft, entry, "chromaClearImageUrl"), fieldName: builtInReportImageFieldName(entry, "chromaClearImageUrl") }
          ], "ycs-report-comparison-grid ycs-report-comparison-grid--two", draft.chromaChoice, options)}
          ${renderCopyWithSubheading(`Your chroma is ${chromaLabel}`, draft.text.chroma, [/^you are\b/i, /^your chroma is\b/i])}
          ${renderReportFooter(draft, pageNumber)}
        </section>
      `,
      palette: (pageNumber) => `
        <section class="ycs-report-page" data-report-page="${pageNumber}">
          ${renderReportBrand(draft)}
          <h1>${escapeHtml(draft.paletteName)}</h1>
          ${renderCoverArt(draft, "ycs-report-cover-art--inline")}
          ${renderCopyWithSubheading(`You are ${draft.paletteName}`, draft.text.paletteType, [/^you are\b/i])}
          ${renderReportFooter(draft, pageNumber)}
        </section>
      `
    };

    const pages = [`
      <section class="ycs-report-page ycs-report-page--cover" data-report-page="1">
        ${renderReportBrand(draft)}
        <div class="ycs-report-cover-title">
          <p class="ycs-report-kicker">Your</p>
          <h1>Color Analysis</h1>
        </div>
        ${renderCoverArt(draft, "", { interactive: options.interactive, draggable: true })}
        <div class="ycs-report-cover-meta">
          <h2>${escapeHtml(name)}</h2>
          <p>${escapeHtml(reportFullDateLabel(draft))}</p>
        </div>
        ${renderReportFooter(draft)}
      </section>
      `, `
      <section class="ycs-report-page ycs-report-page--letter" data-report-page="2">
        ${renderReportBrand(draft)}
        <div class="ycs-report-copy ycs-report-copy--letter">${paragraphHtml(draft.text.intro)}</div>
        ${renderReportFooter(draft, 2)}
      </section>
      `, `
      <section class="ycs-report-page ycs-report-page--science" data-report-page="3">
        ${renderReportBrand(draft)}
        <h1>How Your Color Analysis Works</h1>
        <div class="ycs-report-two-column">
          <div class="ycs-report-science-left">
            <h3>The Science Behind Your Best Colors</h3>
            ${paragraphHtml(draft.text.howItWorks)}
            <h3 class="ycs-report-system-title">The 3-Step System</h3>
            <div class="ycs-report-steps">
              <div><span>1</span><strong>Depth</strong><p>How light or dark your overall coloring is.</p><p class="ycs-report-step-copy">Based on your hair, skin and eyes. Wearing the right depth keeps your features balanced instead of washed out or overpowered.</p></div>
              <div><span>2</span><strong>Temperature</strong><p>The undertone in your skin.</p><p class="ycs-report-step-copy">Determines whether warm, cool or olive-based colors harmonize with you. The right temperature makes your skin look clearer and more even.</p></div>
              <div><span>3</span><strong>Chroma</strong><p>How muted or vibrant your best colors are.</p><p class="ycs-report-step-copy">The right level of clarity enhances your natural brightness without dulling or overwhelming your features.</p></div>
            </div>
          </div>
          <div class="ycs-report-science-right">
            <h3>Your Color Wheel</h3>
            <h2>${escapeHtml(draft.paletteName)}</h2>
            ${paragraphHtml(draft.text.colorWheel)}
            ${renderReportImage(draft.colorWheelImageUrl, "Color wheel image", "ycs-report-preview__wheel")}
          </div>
        </div>
        ${renderReportFooter(draft, 3)}
      </section>
      `];

    normalizeReportPageOrder(draft).forEach((entry, index) => {
      const pageNumber = LOCKED_REPORT_PAGE_COUNT + index + 1;
      if (entry.type === "builtIn" && builtInRenderers[entry.key]) {
        pages.push(builtInRenderers[entry.key](pageNumber, entry));
        return;
      }
      if (entry.type === "custom") {
        const page = customPageById(draft, entry.key);
        if (page) pages.push(renderCustomReportPage(draft, page, pageNumber, options));
      }
    });

    if (options.exportMode) {
      return pages.map((page) => `<div class="ycs-report-print-sheet">${page}</div>`).join("");
    }

    return pages.join("");
  }

  function renderReportBuilder(client, isHidden = true) {
    const isSameReportClient = activeReportClientId === client.clientRecordId;
    if (!isSameReportClient) {
      activeSavedDrapedImages = [];
      activeSavedDrapedImagesClientId = "";
    }

    const draft = isSameReportClient && activeReportDraft
      ? activeReportDraft
      : defaultReportDraft(client);

    activeReportClientId = client.clientRecordId;
    activeReportDraft = draft;
    activeReportPage = Math.min(Math.max(Number(activeReportPage) || 1, 1), totalReportPages(draft));
    const orderedReportPages = normalizeReportPageOrder(draft);
    const depthControlsEntry = reportEntryForBuiltInControls(draft, "depth");
    const temperatureControlsEntry = reportEntryForBuiltInControls(draft, "temperature");
    const chromaControlsEntry = reportEntryForBuiltInControls(draft, "chroma");
    const insertPageLabel = activeReportPage > LOCKED_REPORT_PAGE_COUNT
      ? `Insert after page ${activeReportPage}`
      : "Add after page 3";

    const paletteOptions = colorTypeOptions.map(([code, name]) => (
      `<option value="${escapeHtml(code)}"${draft.paletteCode === code ? " selected" : ""}>${escapeHtml(name)} (${escapeHtml(code)})</option>`
    )).join("");

    return `
      <section class="ycs-report-builder" data-ycs-report-builder${isHidden ? " hidden" : ""}>
        <div class="ycs-report-builder__header">
          <div>
            <h3>Color Analysis Report</h3>
          </div>
          <div class="ycs-report-builder__actions">
            <button class="ycs-clients__button" type="button" data-ycs-save-report>Save Draft</button>
            <button class="ycs-clients__button ycs-clients__button--secondary" type="button" data-ycs-print-report>Print PDF</button>
          </div>
        </div>
        <div class="ycs-report-builder__status" data-ycs-report-status>Loading saved draft...</div>
        <div class="ycs-report-builder__layout">
          ${renderReportPageRail(draft, orderedReportPages, insertPageLabel)}
          <form class="ycs-report-form" data-ycs-report-form>
            <input type="hidden" name="clientRecordId" value="${escapeHtml(client.clientRecordId)}">
            <input type="hidden" name="selectedDrapeImageUrl" value="${escapeHtml(draft.selectedDrapeImageUrl)}">
            ${renderReportControlsPage(1, "Cover", `
              ${renderReportLogoControls(draft)}
              <div class="ycs-report-cover-controls">
                <div class="ycs-report-cover-controls__head">
                  <span>Cover and palette type photo</span>
                  <small>Uses the adjusted transparent photo.</small>
                </div>
                <label>Zoom<input name="coverPhotoScale" type="range" min="0.7" max="2.4" step="0.05" value="${escapeHtml(draft.coverPhotoScale)}"></label>
                <label>Move left / right<input name="coverPhotoX" type="range" min="-120" max="120" step="2" value="${escapeHtml(draft.coverPhotoX)}"></label>
                <label>Move up / down<input name="coverPhotoY" type="range" min="-120" max="120" step="2" value="${escapeHtml(draft.coverPhotoY)}"></label>
              </div>
              <label>Customer name<input name="customerName" value="${escapeHtml(draft.customerName)}"></label>
              <label>Report date<input name="reportDate" type="date" value="${escapeHtml(draft.reportDate)}"></label>
              <label>Color type<select name="paletteCode">${paletteOptions}</select></label>
              <label>Color type display name<input name="paletteName" value="${escapeHtml(draft.paletteName)}"></label>
            `)}
            ${renderReportControlsPage(2, "Intro Letter", `
              <label>Intro letter<textarea class="ycs-report-textarea--fill" name="text.intro">${escapeHtml(draft.text.intro)}</textarea></label>
            `)}
            ${renderReportControlsPage(3, "How It Works", `
              <div class="ycs-report-form-panel">
                <div class="ycs-report-form-panel__head">
                  <span>Static page</span>
                  <small>This page uses the template copy and selected color wheel automatically.</small>
                </div>
              </div>
            `)}
            ${renderReportControlsPage(reportPageNumberForBuiltIn(draft, "depth"), reportPageEntryLabel(draft, depthControlsEntry), `
              <label>Depth decision<select name="depthChoice">${renderDecisionOptions([
                { value: "light", label: "Light" },
                { value: "medium", label: "Medium" },
                { value: "deep", label: "Deep" }
              ], draft.depthChoice)}</select></label>
              <input type="hidden" name="${escapeHtml(builtInReportImageFieldName(depthControlsEntry, "depthLightImageUrl"))}" value="${escapeHtml(builtInReportImageValue(draft, depthControlsEntry, "depthLightImageUrl", "depthImageUrl"))}">
              ${renderSavedImagePicker({
                fieldName: builtInReportImageFieldName(depthControlsEntry, "depthLightImageUrl"),
                title: "Depth light image",
                selectedUrl: builtInReportImageValue(draft, depthControlsEntry, "depthLightImageUrl", "depthImageUrl"),
                preferredChoice: "light"
              })}
              <input type="hidden" name="${escapeHtml(builtInReportImageFieldName(depthControlsEntry, "depthMediumImageUrl"))}" value="${escapeHtml(builtInReportImageValue(draft, depthControlsEntry, "depthMediumImageUrl"))}">
              ${renderSavedImagePicker({
                fieldName: builtInReportImageFieldName(depthControlsEntry, "depthMediumImageUrl"),
                title: "Depth medium image",
                selectedUrl: builtInReportImageValue(draft, depthControlsEntry, "depthMediumImageUrl"),
                preferredChoice: "medium"
              })}
              <input type="hidden" name="${escapeHtml(builtInReportImageFieldName(depthControlsEntry, "depthDeepImageUrl"))}" value="${escapeHtml(builtInReportImageValue(draft, depthControlsEntry, "depthDeepImageUrl"))}">
              ${renderSavedImagePicker({
                fieldName: builtInReportImageFieldName(depthControlsEntry, "depthDeepImageUrl"),
                title: "Depth deep image",
                selectedUrl: builtInReportImageValue(draft, depthControlsEntry, "depthDeepImageUrl"),
                preferredChoice: "deep"
              })}
              <label>Depth copy<textarea name="text.depth">${escapeHtml(draft.text.depth)}</textarea></label>
            `)}
            ${renderReportControlsPage(reportPageNumberForBuiltIn(draft, "temperature"), reportPageEntryLabel(draft, temperatureControlsEntry), `
              <label>Undertone decision<select name="undertoneChoice">${renderDecisionOptions([
                { value: "warm", label: "Warm" },
                { value: "cool", label: "Cool" },
                { value: "olive", label: "Olive" }
              ], draft.undertoneChoice)}</select></label>
              <label class="ycs-report-checkbox">
                <input name="showOliveImage" type="checkbox" value="1"${draft.showOliveImage === false ? "" : " checked"}>
                <span>Show olive image on the undertone page</span>
              </label>
              <input type="hidden" name="${escapeHtml(builtInReportImageFieldName(temperatureControlsEntry, "undertoneWarmImageUrl"))}" value="${escapeHtml(builtInReportImageValue(draft, temperatureControlsEntry, "undertoneWarmImageUrl", "undertoneImageUrl"))}">
              ${renderSavedImagePicker({
                fieldName: builtInReportImageFieldName(temperatureControlsEntry, "undertoneWarmImageUrl"),
                title: "Undertone warm image",
                selectedUrl: builtInReportImageValue(draft, temperatureControlsEntry, "undertoneWarmImageUrl", "undertoneImageUrl"),
                preferredChoice: "warm"
              })}
              <input type="hidden" name="${escapeHtml(builtInReportImageFieldName(temperatureControlsEntry, "undertoneCoolImageUrl"))}" value="${escapeHtml(builtInReportImageValue(draft, temperatureControlsEntry, "undertoneCoolImageUrl"))}">
              ${renderSavedImagePicker({
                fieldName: builtInReportImageFieldName(temperatureControlsEntry, "undertoneCoolImageUrl"),
                title: "Undertone cool image",
                selectedUrl: builtInReportImageValue(draft, temperatureControlsEntry, "undertoneCoolImageUrl"),
                preferredChoice: "cool"
              })}
              <input type="hidden" name="${escapeHtml(builtInReportImageFieldName(temperatureControlsEntry, "undertoneOliveImageUrl"))}" value="${escapeHtml(builtInReportImageValue(draft, temperatureControlsEntry, "undertoneOliveImageUrl"))}">
              ${draft.showOliveImage === false ? "" : renderSavedImagePicker({
                fieldName: builtInReportImageFieldName(temperatureControlsEntry, "undertoneOliveImageUrl"),
                title: "Undertone olive image",
                selectedUrl: builtInReportImageValue(draft, temperatureControlsEntry, "undertoneOliveImageUrl"),
                preferredChoice: "olive"
              })}
              <label>Temperature copy<textarea name="text.undertone">${escapeHtml(draft.text.undertone)}</textarea></label>
            `)}
            ${renderReportControlsPage(reportPageNumberForBuiltIn(draft, "chroma"), reportPageEntryLabel(draft, chromaControlsEntry), `
              <label>Chroma decision<select name="chromaChoice">${renderDecisionOptions([
                { value: "soft", label: "Soft" },
                { value: "clear", label: "Clear" }
              ], draft.chromaChoice)}</select></label>
              <input type="hidden" name="${escapeHtml(builtInReportImageFieldName(chromaControlsEntry, "chromaSoftImageUrl"))}" value="${escapeHtml(builtInReportImageValue(draft, chromaControlsEntry, "chromaSoftImageUrl", "chromaImageUrl"))}">
              ${renderSavedImagePicker({
                fieldName: builtInReportImageFieldName(chromaControlsEntry, "chromaSoftImageUrl"),
                title: "Chroma soft image",
                selectedUrl: builtInReportImageValue(draft, chromaControlsEntry, "chromaSoftImageUrl", "chromaImageUrl"),
                preferredChoice: "soft"
              })}
              <input type="hidden" name="${escapeHtml(builtInReportImageFieldName(chromaControlsEntry, "chromaClearImageUrl"))}" value="${escapeHtml(builtInReportImageValue(draft, chromaControlsEntry, "chromaClearImageUrl"))}">
              ${renderSavedImagePicker({
                fieldName: builtInReportImageFieldName(chromaControlsEntry, "chromaClearImageUrl"),
                title: "Chroma clear image",
                selectedUrl: builtInReportImageValue(draft, chromaControlsEntry, "chromaClearImageUrl"),
                preferredChoice: "clear"
              })}
              <label>Chroma copy<textarea name="text.chroma">${escapeHtml(draft.text.chroma)}</textarea></label>
            `)}
            ${renderReportControlsPage(reportPageNumberForBuiltIn(draft, "palette"), "Palette Type", `
              <label>Palette type copy<textarea name="text.paletteType">${escapeHtml(draft.text.paletteType)}</textarea></label>
            `)}
            ${renderCustomPagesForm(draft)}
          </form>
          <div class="ycs-report-preview-shell">
            <div class="ycs-report-preview" data-ycs-report-preview data-active-report-page="${activeReportPage}">
              ${reportPagesHtml(draft, { interactive: true })}
            </div>
          </div>
        </div>
        ${renderReportImageModal()}
      </section>
    `;
  }

  function readReportDraftFromForm(form, client) {
    const formData = new FormData(form);
    const draft = mergeReportDraft(client, activeReportDraft);
    const formString = (name, fallback = "") => (
      formData.has(name) ? String(formData.get(name) || "").trim() : String(fallback || "").trim()
    );
    const paletteCode = formString("paletteCode", draft.paletteCode).toUpperCase();

    draft.customerName = formString("customerName", draft.customerName || displayName(client));
    draft.reportDate = formString("reportDate", draft.reportDate);
    draft.brandLogoUrl = formString("brandLogoUrl", draft.brandLogoUrl);
    draft.brandName = formString("brandName", draft.brandName);
    draft.paletteCode = paletteCode;
    draft.paletteName = formString("paletteName", draft.paletteName) || getPaletteName(paletteCode);
    draft.colorFanImageUrl = formString("colorFanImageUrl", draft.colorFanImageUrl);
    draft.selectedDrapeImageUrl = getAdjustedPhotoUrl(client);
    draft.coverPhotoScale = Math.min(Math.max(Number(formString("coverPhotoScale", draft.coverPhotoScale)) || 1, 0.7), 2.4);
    draft.coverPhotoX = Math.min(Math.max(Number(formString("coverPhotoX", draft.coverPhotoX)) || 0, -120), 120);
    draft.coverPhotoY = Math.min(Math.max(Number(formString("coverPhotoY", draft.coverPhotoY)) || 0, -120), 120);
    draft.colorWheelImageUrl = formString("colorWheelImageUrl", draft.colorWheelImageUrl);
    draft.depthChoice = choiceKey(formString("depthChoice", draft.depthChoice));
    draft.depthLightImageUrl = formString("depthLightImageUrl", draft.depthLightImageUrl);
    draft.depthMediumImageUrl = formString("depthMediumImageUrl", draft.depthMediumImageUrl);
    draft.depthDeepImageUrl = formString("depthDeepImageUrl", draft.depthDeepImageUrl);
    draft.undertoneChoice = choiceKey(formString("undertoneChoice", draft.undertoneChoice));
    draft.undertoneWarmImageUrl = formString("undertoneWarmImageUrl", draft.undertoneWarmImageUrl);
    draft.undertoneCoolImageUrl = formString("undertoneCoolImageUrl", draft.undertoneCoolImageUrl);
    draft.undertoneOliveImageUrl = formString("undertoneOliveImageUrl", draft.undertoneOliveImageUrl);
    draft.showOliveImage = formData.has("showOliveImage") || (!form.elements.showOliveImage && draft.showOliveImage !== false);
    draft.chromaChoice = choiceKey(formString("chromaChoice", draft.chromaChoice));
    draft.chromaSoftImageUrl = formString("chromaSoftImageUrl", draft.chromaSoftImageUrl);
    draft.chromaClearImageUrl = formString("chromaClearImageUrl", draft.chromaClearImageUrl);
    draft.depthImageUrl = draft.depthLightImageUrl;
    draft.undertoneImageUrl = draft.undertoneWarmImageUrl;
    draft.chromaImageUrl = draft.chromaSoftImageUrl;
    draft.depth = getDepthFromPalette(paletteCode);
    draft.undertone = getTemperatureFromPalette(paletteCode);
    draft.chroma = getChromaFromPalette(paletteCode);
    draft.pageCopies = { ...reportPageCopies(draft) };
    draft.text = { ...draft.text };

    Array.from(form.elements).forEach((element) => {
      if (!element.name || !element.name.startsWith("text.")) return;
      draft.text[element.name.replace("text.", "")] = element.value;
    });

    draft.customPages = Array.from(form.querySelectorAll("[data-ycs-custom-report-page]")).map((pageEl) => {
      const id = String(pageEl.dataset.reportCustomPageId || makeCustomReportPageId());
      const fieldValue = (fieldName) => String(formData.get(`customPages.${id}.${fieldName}`) || "").trim();
      return {
        id,
        template: normalizeCustomPageTemplate(fieldValue("template")),
        title: fieldValue("title"),
        copy: String(formData.get(`customPages.${id}.copy`) || "").trim(),
        image1Url: fieldValue("image1Url"),
        image2Url: fieldValue("image2Url"),
        image3Url: fieldValue("image3Url"),
        image4Url: fieldValue("image4Url")
      };
    });
    draft.reportPageOrder = normalizeReportPageOrder(draft);
    draft.pageCopies = draft.reportPageOrder.reduce((copies, entry) => {
      if (entry.type !== "builtIn" || !entry.duplicateOf) return copies;
      const previousCopy = reportPageCopies(draft)[entry.id] || {};
      copies[entry.id] = builtInReportImageFields(entry.key).reduce((copy, fieldPair) => {
        const [fieldName, fallbackFieldName] = fieldPair;
        const copyFieldName = builtInReportImageFieldName(entry, fieldName);
        if (formData.has(copyFieldName)) {
          copy[fieldName] = String(formData.get(copyFieldName) || "").trim();
        } else {
          copy[fieldName] = String(previousCopy[fieldName] || builtInReportImageValue(draft, { ...entry, duplicateOf: "" }, fieldName, fallbackFieldName) || "");
        }
        return copy;
      }, {});
      return copies;
    }, {});

    return draft;
  }

  function applyPaletteDefaultsToForm(form, paletteCode) {
    const code = String(paletteCode || "").trim().toUpperCase();
    const paletteNameInput = form.elements.paletteName;
    const depthChoiceSelect = form.elements.depthChoice;
    const undertoneChoiceSelect = form.elements.undertoneChoice;
    const chromaChoiceSelect = form.elements.chromaChoice;

    if (paletteNameInput) {
      paletteNameInput.value = getPaletteName(code);
    }

    if (depthChoiceSelect) {
      depthChoiceSelect.value = choiceKey(getDepthFromPalette(code));
    }

    if (undertoneChoiceSelect) {
      undertoneChoiceSelect.value = choiceKey(getTemperatureFromPalette(code));
    }

    if (chromaChoiceSelect) {
      chromaChoiceSelect.value = choiceKey(getChromaFromPalette(code));
    }
  }

  function applyReportTemplateToDraft(draft, template) {
    if (!template) return draft;

    const copy = template.copy || {};
    const nextDraft = {
      ...draft,
      colorFanImageUrl: template.colorFanImageUrl || draft.colorFanImageUrl,
      colorWheelImageUrl: template.colorWheelImageUrl || draft.colorWheelImageUrl,
      reportTemplateRecordId: template.id || draft.reportTemplateRecordId,
      text: { ...draft.text }
    };

    [
      ["intro", copy.intro],
      ["howItWorks", copy.howItWorks],
      ["colorWheel", copy.colorWheel],
      ["depth", copy.depth],
      ["undertone", copy.undertone],
      ["chroma", copy.chroma],
      ["paletteType", copy.paletteType]
    ].forEach(([key, value]) => {
      const copyValue = String(value || "").trim();
      if (copyValue) {
        nextDraft.text[key] = copyValue;
      }
    });

    return nextDraft;
  }

  function normalizeReportPaletteCode(paletteCode) {
    return String(paletteCode || "").trim().toUpperCase();
  }

  function getReportFanTemplatePaletteCode(paletteCode) {
    const code = normalizeReportPaletteCode(paletteCode);
    return reportFanTemplatePaletteCodeMap[code] || code;
  }

  async function fetchReportPaletteTemplateByCode(paletteCode) {
    const code = String(paletteCode || "").trim().toUpperCase();
    if (!code || !apiBase) return null;

    if (reportTemplateCache.has(code)) {
      return reportTemplateCache.get(code);
    }

    const response = await fetch(`${apiBase}/api/get-report-palette-template?paletteCode=${encodeURIComponent(code)}`);
    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || "Unable to load report template");
    }

    reportTemplateCache.set(code, data.template || null);
    return data.template || null;
  }

  async function fetchReportPaletteTemplate(paletteCode) {
    const code = normalizeReportPaletteCode(paletteCode);
    if (!code || !apiBase) return null;

    const fanCode = getReportFanTemplatePaletteCode(code);
    if (fanCode === code) {
      return fetchReportPaletteTemplateByCode(code);
    }

    const [template, fanTemplate] = await Promise.all([
      fetchReportPaletteTemplateByCode(code),
      fetchReportPaletteTemplateByCode(fanCode)
    ]);
    const fallbackTemplate = template || fanTemplate;

    if (!fallbackTemplate) return null;

    return {
      ...fallbackTemplate,
      colorFanImageUrl: fanTemplate?.colorFanImageUrl || fallbackTemplate.colorFanImageUrl,
      colorWheelImageUrl: reportColorWheelImageUrlMap[code] || fallbackTemplate.colorWheelImageUrl
    };
  }

  async function fetchSavedDrapedImages(client) {
    if (!apiBase || !client?.clientRecordId) return [];

    const response = await fetch(`${apiBase}/api/get-saved-draped-images?clientRecordId=${encodeURIComponent(client.clientRecordId)}`);
    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || "Unable to load saved draped images");
    }

    return Array.isArray(data.images) ? data.images.filter((image) => image.imageUrl) : [];
  }

  async function ensureSavedDrapedImagesLoaded(client) {
    if (!client?.clientRecordId) return [];

    if (activeSavedDrapedImagesClientId === client.clientRecordId && activeSavedDrapedImages.length) {
      return activeSavedDrapedImages;
    }

    activeSavedDrapedImages = await fetchSavedDrapedImages(client);
    activeSavedDrapedImagesClientId = client.clientRecordId;
    return activeSavedDrapedImages;
  }

  async function deleteSavedDrapedImages(client, imageIds) {
    const ids = (Array.isArray(imageIds) ? imageIds : [imageIds]).map((id) => String(id || "").trim()).filter(Boolean);
    if (!client?.clientRecordId || !ids.length) return;

    const response = await fetch("/apps/palette-data?action=deleteSavedDrapedImages", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "same-origin",
      body: JSON.stringify({
        clientRecordId: client.clientRecordId,
        imageIds: ids
      })
    });
    const responseText = await response.text();
    let data = {};
    if (responseText && responseText.trim().startsWith("{")) {
      data = JSON.parse(responseText);
    }

    if (!response.ok) {
      const errorText = responseText && !responseText.trim().startsWith("<")
        ? responseText.slice(0, 160)
        : "";
      throw new Error(data.error || errorText || "Unable to delete saved draped photos");
    }

    activeSavedDrapedImages = activeSavedDrapedImages.filter((image) => !ids.includes(image.id));
    activeSavedDrapedImagesClientId = client.clientRecordId;
    return data;
  }

  async function autofillReportTemplate(client, options = {}) {
    const builder = detailEl.querySelector("[data-ycs-report-builder]");
    const form = builder?.querySelector("[data-ycs-report-form]");
    if (!form || !client) return;

    const paletteCode = String(form.elements.paletteCode?.value || "").trim().toUpperCase();
    const requestId = activeReportTemplateRequest + 1;
    activeReportTemplateRequest = requestId;

    applyPaletteDefaultsToForm(form, paletteCode);
    activeReportDraft = readReportDraftFromForm(form, client);
    updateReportPreview();

    if (!paletteCode) return;

    if (!options.silent) {
      setReportStatus(`Loading ${paletteCode} report template...`, true);
    }

    const template = await fetchReportPaletteTemplate(paletteCode);
    if (requestId !== activeReportTemplateRequest) return;

    if (!template) {
      if (!options.silent) {
        setReportStatus(`No Airtable report template found for ${paletteCode}.`, true);
        window.setTimeout(() => setReportStatus("", false), 3000);
      }
      return;
    }

    activeReportDraft = applyReportTemplateToDraft(activeReportDraft, template);
    const currentBuilder = detailEl.querySelector("[data-ycs-report-builder]");
    if (currentBuilder) {
      currentBuilder.outerHTML = renderReportBuilder(client, currentBuilder.hidden);
      applyActiveReportPage(activeReportPage);
    }

    if (!options.silent) {
      setReportStatus(`${paletteCode} report template applied.`, true);
      window.setTimeout(() => setReportStatus("", false), 3000);
    }
  }

  function updateReportPreview() {
    const builder = detailEl.querySelector("[data-ycs-report-builder]");
    const form = builder?.querySelector("[data-ycs-report-form]");
    const preview = builder?.querySelector("[data-ycs-report-preview]");
    if (!form || !preview || !activeReportClientId) return;

    const client = clients.find((item) => item.clientRecordId === activeReportClientId);
    if (!client) return;

    activeReportDraft = readReportDraftFromForm(form, client);
    preview.innerHTML = reportPagesHtml(activeReportDraft, { interactive: true });
    applyActiveReportPage(activeReportPage);
  }

  function clampReportNumber(value, min, max, fallback) {
    const number = Number(value);
    if (!Number.isFinite(number)) return fallback;
    return Math.min(Math.max(number, min), max);
  }

  function setCoverPhotoPosition(x, y) {
    const form = detailEl.querySelector("[data-ycs-report-form]");
    if (!form || !activeReportDraft) return;

    const safeX = clampReportNumber(x, -120, 120, 0);
    const safeY = clampReportNumber(y, -120, 120, 0);

    if (form.elements.coverPhotoX) {
      form.elements.coverPhotoX.value = String(safeX);
    }

    if (form.elements.coverPhotoY) {
      form.elements.coverPhotoY.value = String(safeY);
    }

    activeReportDraft.coverPhotoX = safeX;
    activeReportDraft.coverPhotoY = safeY;

    detailEl.querySelectorAll(".ycs-report-cover-art__drape").forEach((image) => {
      image.style.setProperty("--cover-photo-x", `${safeX}px`);
      image.style.setProperty("--cover-photo-y", `${safeY}px`);
    });
  }

  function startCoverPhotoDrag(event, frame) {
    const form = detailEl.querySelector("[data-ycs-report-form]");
    if (!form || !activeReportDraft) return;

    coverPhotoDrag = {
      pointerId: event.pointerId,
      startClientX: event.clientX,
      startClientY: event.clientY,
      startX: clampReportNumber(form.elements.coverPhotoX?.value, -120, 120, 0),
      startY: clampReportNumber(form.elements.coverPhotoY?.value, -120, 120, 0)
    };

    frame.classList.add("is-dragging");
    frame.setPointerCapture?.(event.pointerId);
    event.preventDefault();
  }

  function moveCoverPhotoDrag(event) {
    if (!coverPhotoDrag || event.pointerId !== coverPhotoDrag.pointerId) return;
    const nextX = coverPhotoDrag.startX + event.clientX - coverPhotoDrag.startClientX;
    const nextY = coverPhotoDrag.startY + event.clientY - coverPhotoDrag.startClientY;
    setCoverPhotoPosition(nextX, nextY);
    event.preventDefault();
  }

  function endCoverPhotoDrag(event) {
    if (!coverPhotoDrag || event.pointerId !== coverPhotoDrag.pointerId) return;

    detailEl.querySelectorAll(".ycs-report-cover-art__drape-frame.is-dragging").forEach((frame) => {
      frame.classList.remove("is-dragging");
      frame.releasePointerCapture?.(event.pointerId);
    });

    coverPhotoDrag = null;
  }

  function applyActiveReportPage(pageNumber) {
    const safePage = Math.min(Math.max(Number(pageNumber) || 1, 1), totalReportPages(activeReportDraft));
    activeReportPage = safePage;

    const preview = detailEl.querySelector("[data-ycs-report-preview]");
    if (preview) {
      preview.dataset.activeReportPage = String(safePage);
      preview.querySelectorAll("[data-report-page]").forEach((page) => {
        page.style.display = Number(page.dataset.reportPage) === safePage ? "block" : "none";
      });
    }

    detailEl.querySelectorAll("[data-ycs-report-page-button]").forEach((button) => {
      button.classList.toggle("is-active", Number(button.dataset.ycsReportPageButton) === safePage);
      button.closest(".ycs-report-page-rail__item")?.classList.toggle("is-active", Number(button.dataset.ycsReportPageButton) === safePage);
    });

    detailEl.querySelectorAll("[data-ycs-report-controls-page]").forEach((controls) => {
      controls.hidden = Number(controls.dataset.ycsReportControlsPage) !== safePage;
    });
  }

  function rerenderActiveReportBuilder(pageNumber = activeReportPage) {
    const client = clients.find((item) => item.clientRecordId === activeReportClientId);
    const builder = detailEl.querySelector("[data-ycs-report-builder]");
    const form = builder?.querySelector("[data-ycs-report-form]");
    if (!client || !builder || !form) return;

    activeReportDraft = readReportDraftFromForm(form, client);
    builder.outerHTML = renderReportBuilder(client, false);
    applyActiveReportPage(pageNumber);
  }

  function setReportLogoUrl(url) {
    const form = detailEl.querySelector("[data-ycs-report-form]");
    if (!form) return;

    const logoInput = form.elements.brandLogoUrl;
    if (logoInput) {
      logoInput.value = String(url || "").trim();
    }

    rerenderActiveReportBuilder(activeReportPage);
  }

  function fileToDataUrl(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ""));
      reader.onerror = () => reject(reader.error || new Error("Unable to read file"));
      reader.readAsDataURL(file);
    });
  }

  async function uploadReportLogo(fileInput) {
    const file = fileInput?.files?.[0];
    if (!file || !apiBase || !activeReportClientId) return;

    setReportStatus("Uploading logo...", true);
    const imageBase64 = await fileToDataUrl(file);
    const response = await fetch(`${apiBase}/api/upload-report-logo`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        imageBase64,
        fileName: file.name,
        clientRecordId: activeReportClientId,
        consultantId
      })
    });
    const data = await response.json();

    if (!response.ok || !data.imageUrl) {
      throw new Error(data.error || "Logo upload failed");
    }

    setReportLogoUrl(data.imageUrl);
    fileInput.value = "";
    setReportStatus("Logo uploaded.", true);
    window.setTimeout(() => setReportStatus("", false), 2500);
  }

  function setReportStatus(message, visible) {
    const reportStatus = detailEl.querySelector("[data-ycs-report-status]");
    if (!reportStatus) return;
    reportStatus.textContent = message || "";
    reportStatus.hidden = !visible;
  }

  function applyReportImageSelection(fieldName, imageUrl, imageLabel) {
    const form = detailEl.querySelector("[data-ycs-report-form]");
    if (!form) return;

    const input = form.elements[fieldName];
    if (!fieldName || !input) return;

    input.value = imageUrl;

    const picker = form.querySelector(`[data-ycs-report-image-picker="${fieldName}"]`);
    if (picker) {
      picker.querySelectorAll("[data-ycs-report-image-select]").forEach((option) => {
        option.classList.toggle("is-selected", option.dataset.reportImageUrl === imageUrl && !!imageUrl);
      });

      const details = picker.querySelector(".ycs-report-image-picker__choices");
      if (details) {
        details.open = false;
      }

      const current = picker.querySelector("[data-ycs-report-image-current]");
      if (current) {
        current.textContent = imageLabel;
      }

      const preview = picker.querySelector(".ycs-report-image-picker__preview");
      if (preview) {
        if (imageUrl) {
          const img = preview.tagName.toLowerCase() === "img"
            ? preview
            : document.createElement("img");
          img.className = "ycs-report-image-picker__preview";
          img.src = imageUrl;
          img.alt = imageLabel;
          if (img !== preview) {
            preview.replaceWith(img);
          }
        } else {
          const empty = document.createElement("div");
          empty.className = "ycs-report-image-picker__preview ycs-report-image-picker__preview--empty";
          empty.textContent = "No image";
          preview.replaceWith(empty);
        }
      }

      const clearButton = picker.querySelector(".ycs-report-image-clear");
      if (clearButton) {
        clearButton.hidden = !imageUrl;
      }

    }

    updateReportPreview();
  }

  function selectReportSavedImage(button) {
    applyReportImageSelection(
      button.dataset.reportImageField || "",
      button.dataset.reportImageUrl || "",
      button.dataset.reportImageLabel || "No image selected"
    );
  }

  function renderReportModalImageButtons(fieldName) {
    const images = sortSavedImagesForPicker(activeSavedDrapedImages, "");
    if (!images.length) {
      return `<p class="ycs-report-image-modal__empty">No saved draped images yet.</p>`;
    }

    return images.map((image) => {
      const label = savedImageTitle(image) || "Saved draped image";
      return `
        <button
          class="ycs-report-image-modal__option"
          type="button"
          data-ycs-report-modal-image-select
          data-report-image-field="${escapeHtml(fieldName)}"
          data-report-image-url="${escapeHtml(image.imageUrl || "")}"
          data-report-image-label="${escapeHtml(label)}">
          <img src="${escapeHtml(image.imageUrl || "")}" alt="${escapeHtml(label)}">
          <span>${escapeHtml(image.drapeColorName || image.panel || "Saved")}</span>
        </button>
      `;
    }).join("");
  }

  async function openReportImageModal(fieldName, label) {
    const modal = detailEl.querySelector("[data-ycs-report-image-modal]");
    if (!modal) return;

    const title = modal.querySelector("#ycs-report-image-modal-title");
    const subtitle = modal.querySelector("[data-ycs-report-image-modal-subtitle]");
    const grid = modal.querySelector("[data-ycs-report-image-modal-grid]");
    const client = clients.find((item) => item.clientRecordId === activeReportClientId);

    if (title) title.textContent = "Choose Saved Image";
    if (subtitle) subtitle.textContent = label || fieldName || "";
    if (grid) grid.innerHTML = `<p class="ycs-report-image-modal__empty">Loading saved images...</p>`;

    modal.dataset.reportImageField = fieldName;
    modal.hidden = false;

    try {
      await ensureSavedDrapedImagesLoaded(client);
    } catch (error) {
      console.warn("Saved draped image modal lookup failed", error);
    }

    if (grid) grid.innerHTML = renderReportModalImageButtons(fieldName);
  }

  function closeReportImageModal() {
    const modal = detailEl.querySelector("[data-ycs-report-image-modal]");
    if (modal) {
      modal.hidden = true;
      modal.dataset.reportImageField = "";
    }
  }

  async function loadReportDraft(client) {
    if (!consultantId || !client.clientRecordId || !apiBase) return;

    setReportStatus("Loading saved draft...", true);
    let savedDraft = getLocalReportDraft(client.clientRecordId);
    let savedAt = "";
    let loadedFromServer = false;

    try {
      const response = await fetch(`${apiBase}/api/get-color-analysis-report?consultantId=${encodeURIComponent(consultantId)}&clientRecordId=${encodeURIComponent(client.clientRecordId)}&reportType=${encodeURIComponent(REPORT_TYPE)}`);
      const data = await response.json();

      if (response.ok && data.report?.draft) {
        savedDraft = data.report.draft;
        savedAt = data.report.updatedAt;
        loadedFromServer = true;
        saveLocalReportDraft(client.clientRecordId, savedDraft);
      }
    } catch (error) {
      console.warn("Server report draft lookup failed", error);
    }

    activeReportClientId = client.clientRecordId;
    activeReportDraft = mergeReportDraft(client, savedDraft);

    try {
      await ensureSavedDrapedImagesLoaded(client);
    } catch (error) {
      activeSavedDrapedImages = [];
      activeSavedDrapedImagesClientId = "";
      console.warn("Saved draped image lookup failed", error);
    }

    const builder = detailEl.querySelector("[data-ycs-report-builder]");
    if (builder) {
      const wasHidden = builder.hidden;
      builder.outerHTML = renderReportBuilder(client, wasHidden);
      const localMessage = savedDraft ? "Saved browser draft loaded." : "New draft ready.";
      const serverMessage = savedAt ? `Saved draft loaded. Last updated ${formatDate(savedAt)}.` : localMessage;
      setReportStatus(loadedFromServer ? serverMessage : localMessage, true);
      applyActiveReportPage(activeReportPage);
      window.setTimeout(() => setReportStatus("", false), 3500);
      if (!savedDraft) {
        autofillReportTemplate(client, { silent: true })
          .catch((error) => console.warn("Initial report template autofill failed", error));
      }
    }
  }

  async function saveReportDraft(button) {
    const form = detailEl.querySelector("[data-ycs-report-form]");
    if (!form || !activeReportClientId) return;

    const client = clients.find((item) => item.clientRecordId === activeReportClientId);
    if (!client) return;

    const originalButtonText = button?.textContent || "Save Draft";
    if (button) {
      button.disabled = true;
      button.textContent = "Saving...";
    }

    activeReportDraft = readReportDraftFromForm(form, client);
    setReportStatus("Saving report draft...", true);
    const localSaved = saveLocalReportDraft(client.clientRecordId, activeReportDraft);

    if (!localSaved) {
      if (button) {
        button.disabled = false;
        button.textContent = originalButtonText;
      }
      setReportStatus("Unable to save draft in this browser.", true);
      return;
    }

    try {
      const response = await fetch(`${apiBase}/api/save-color-analysis-report`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          consultantId,
          clientRecordId: client.clientRecordId,
          reportType: REPORT_TYPE,
          draft: activeReportDraft
        })
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || "Server draft save failed");
      }

      setReportStatus("Report draft saved.", true);
    } catch (error) {
      console.warn("Server report draft save failed", error);
      setReportStatus(`Draft saved in this browser. Server save failed: ${error.message || "Unknown error"}`, true);
    } finally {
      if (button) {
        button.textContent = "Saved";
        window.setTimeout(() => {
          button.disabled = false;
          button.textContent = originalButtonText;
        }, 1200);
      }
    }
    window.setTimeout(() => setReportStatus("", false), 3000);
  }

  function reportDocumentHtml(draft) {
    const styles = Array.from(document.querySelectorAll("style"))
      .map((style) => style.textContent || "")
      .join("\n");

    return `<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <title>${escapeHtml(draft.customerName || "Color Analysis Report")}</title>
  <style>${styles}</style>
</head>
<body>
  <main class="ycs-report-preview ycs-report-export">${reportPagesHtml(draft, { exportMode: true })}</main>
</body>
</html>`;
  }

  function printReport() {
    updateReportPreview();
    const popup = window.open("", "_blank");
    if (!popup) {
      setReportStatus("Popup blocked. Allow popups to print the report.", true);
      return;
    }

    popup.document.open();
    popup.document.write(reportDocumentHtml(activeReportDraft));
    popup.document.close();
    popup.focus();
    window.setTimeout(() => popup.print(), 500);
  }

  function downloadReportHtml() {
    updateReportPreview();
    const html = reportDocumentHtml(activeReportDraft);
    const blob = new Blob([html], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    const name = (activeReportDraft.customerName || "color-analysis-report").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
    link.href = url;
    link.download = `${name || "color-analysis-report"}.html`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

  function clientUrl(client) {
    const url = new URL(window.location.href);
    url.searchParams.set("clientRecordId", client.clientRecordId);
    url.searchParams.delete("edit");
    url.searchParams.delete("newClient");
    return url.pathname + url.search;
  }

  function photoPrepUrl(client) {
    const url = new URL("/pages/photo-prep", window.location.origin);
    url.searchParams.set("mode", "trade");
    url.searchParams.set("workflow", "color-analysis");
    url.searchParams.set("clientRecordId", client.clientRecordId);
    return url.pathname + url.search;
  }

  function structuredAnalysisUrl(client) {
    const url = new URL("/pages/color-analysis-tool", window.location.origin);
    url.searchParams.set("mode", "trade");
    url.searchParams.set("clientRecordId", client.clientRecordId);
    return url.pathname + url.search;
  }

  function drapingStudioUrl(client) {
    const url = new URL("/pages/signature-color-analysis", window.location.origin);
    url.searchParams.set("clientRecordId", client.clientRecordId);
    url.searchParams.set("mode", "trade");
    return url.pathname + url.search;
  }

  function listUrl() {
    const url = new URL(window.location.href);
    url.searchParams.delete("clientRecordId");
    url.searchParams.delete("newClient");
    url.searchParams.delete("edit");
    return url.pathname + url.search;
  }

  function setSelectedClientNav(client) {
    const hasClient = !!(client && client.clientRecordId);
    const hasPhoto = hasClient && clientHasPhoto(client);

    if (selectedClientNavLink) {
      selectedClientNavLink.hidden = !hasClient;
      if (hasClient) selectedClientNavLink.href = listUrl();
    }

    if (photoPrepNavLink) {
      photoPrepNavLink.hidden = !hasClient;
      if (hasClient) photoPrepNavLink.href = photoPrepUrl(client);
    }

    if (structuredNavLink) {
      structuredNavLink.hidden = !hasPhoto;
      if (hasClient) structuredNavLink.href = structuredAnalysisUrl(client);
    }

    if (lipNavLink) {
      lipNavLink.hidden = !hasPhoto;
      if (hasClient) lipNavLink.href = drapingStudioUrl(client);
    }
  }

  function updateShellMode(mode, client) {
    if (pageBackLinkEl) {
      pageBackLinkEl.href = pageBackLinkEl.dataset.toolsHref || "/pages/my-palettes?view=catools";
      pageBackLinkEl.textContent = "Tools";
      pageBackLinkEl.dataset.ycsBackMode = "tools";
    }

    if (addClientEl) {
      addClientEl.hidden = mode !== "list";
    }

    if (mode === "detail" || mode === "edit") {
      setSelectedClientNav(client);
    } else {
      setSelectedClientNav(null);
    }
  }

  function setStatus(message, visible) {
    if (!statusEl) return;
    statusEl.textContent = message || "";
    statusEl.hidden = !visible;
  }

  function buildPaletteFilter() {
    const seen = new Map();
    clients.forEach((client) => {
      const code = String(client.paletteCode || "").trim();
      if (!code) return;
      const key = code.toUpperCase();
      if (!seen.has(key)) {
        seen.set(key, paletteLabel(client));
      }
    });

    const currentValue = paletteFilterEl.value;
    paletteFilterEl.innerHTML = [
      '<option value="all">All palettes</option>',
      '<option value="unassigned">Unassigned</option>',
      ...Array.from(seen.entries())
        .sort((a, b) => a[1].localeCompare(b[1]))
        .map(([code, label]) => `<option value="${escapeHtml(code)}">${escapeHtml(label)}</option>`)
    ].join("");

    if ([...paletteFilterEl.options].some((option) => option.value === currentValue)) {
      paletteFilterEl.value = currentValue;
    }
  }

  function filteredClients() {
    const query = normalize(searchEl.value);
    const palette = paletteFilterEl.value;
    const sort = sortEl.value;

    const filtered = clients.filter((client) => {
      const haystack = normalize([
        client.firstName,
        client.lastName,
        client.email,
        client.paletteCode,
        client.paletteName
      ].join(" "));
      const code = String(client.paletteCode || "").trim().toUpperCase();
      const matchesQuery = !query || haystack.includes(query);
      const matchesPalette =
        palette === "all" ||
        (palette === "unassigned" && !code) ||
        code === palette;
      return matchesQuery && matchesPalette;
    });

    return filtered.sort((a, b) => {
      if (sort === "newest") return new Date(b.createdAt || 0) - new Date(a.createdAt || 0);
      if (sort === "oldest") return new Date(a.createdAt || 0) - new Date(b.createdAt || 0);
      if (sort === "first-name") return String(a.firstName || "").localeCompare(String(b.firstName || ""));
      if (sort === "last-name") return String(a.lastName || "").localeCompare(String(b.lastName || ""));
      return new Date(b.updatedAt || b.createdAt || 0) - new Date(a.updatedAt || a.createdAt || 0);
    });
  }

  function renderPhoto(client, className) {
    const photoUrl = getPhotoUrl(client);
    if (photoUrl) {
      return `<img src="${escapeHtml(photoUrl)}" alt="${escapeHtml(displayName(client))}" loading="lazy">`;
    }

    return `<a class="${className}__placeholder" href="${escapeHtml(photoPrepUrl(client))}" data-ycs-leave-client-view>Upload Photo</a>`;
  }

  function renderCards() {
    updateShellMode("list");
    const visibleClients = filteredClients();
    detailEl.hidden = true;
    gridEl.hidden = false;
    if (controlsEl) controlsEl.hidden = false;

    if (!visibleClients.length) {
      gridEl.innerHTML = "";
      setStatus(clients.length ? "No clients match these filters." : "No clients found yet.", true);
      return;
    }

    setStatus("", false);
    gridEl.innerHTML = visibleClients.map((client) => `
      ${(() => {
        const palette = paletteLabel(client);
        const status = displayStatus(client.analysisStatus);
        const hasPhoto = clientHasPhoto(client);

        return `
      <article class="ycs-client-card">
        <div class="ycs-client-card__photo">
          ${renderPhoto(client, "ycs-client-card")}
        </div>
        <div class="ycs-client-card__content">
          <h2 class="ycs-client-card__name">${escapeHtml(displayName(client))}</h2>
          <p class="ycs-client-card__email">${escapeHtml(client.email || "No email")}</p>
          ${palette ? `<p class="ycs-client-card__palette">${escapeHtml(palette)}</p>` : ""}
          ${status ? `<div class="ycs-client-card__badges"><span class="ycs-client-badge">${escapeHtml(status)}</span></div>` : ""}
          <div class="ycs-client-card__actions">
            <button class="ycs-client-card__button" type="button" data-ycs-edit-client="${escapeHtml(client.clientRecordId)}">View/Edit</button>
            <button class="ycs-client-card__button ycs-client-card__button--danger" type="button" data-ycs-delete-client="${escapeHtml(client.clientRecordId)}">Delete</button>
            ${hasPhoto ? `<a class="ycs-client-card__button ycs-client-card__button--secondary" href="${escapeHtml(structuredAnalysisUrl(client))}" data-ycs-leave-client-view>Structured Analysis</a>` : ""}
            ${hasPhoto ? `<a class="ycs-client-card__button ycs-client-card__button--secondary" href="${escapeHtml(drapingStudioUrl(client))}" data-ycs-leave-client-view>Lip & Draping Studio</a>` : ""}
          </div>
        </div>
      </article>
        `;
      })()}
    `).join("");
  }

  function renderDetail(client, editMode, saveMessage) {
    updateShellMode(editMode ? "edit" : "detail", client);
    const photoUrl = getPhotoUrl(client);
    gridEl.hidden = true;
    detailEl.hidden = false;
    if (controlsEl) controlsEl.hidden = true;
    setStatus("", false);

    const palette = paletteLabel(client);
    const status = displayStatus(client.analysisStatus);
    const created = formatDate(client.createdAt);
    const updated = formatDate(client.updatedAt);
    const hasPhoto = clientHasPhoto(client);

    detailEl.innerHTML = `
      <div class="ycs-clients__detail-header${editMode ? " ycs-clients__detail-header--edit" : ""}">
        ${photoUrl
          ? `<div class="ycs-clients__detail-photo"><img src="${escapeHtml(photoUrl)}" alt="${escapeHtml(displayName(client))}"></div>`
          : `<a class="ycs-clients__detail-photo ycs-clients__detail-photo--upload" href="${escapeHtml(photoPrepUrl(client))}" data-ycs-leave-client-view>
              <span class="ycs-client-card__placeholder">Upload Photo</span>
            </a>`}
        <div>
          <h2>${escapeHtml(displayName(client))}</h2>
          <div class="ycs-clients__detail-meta${editMode ? " ycs-clients__detail-meta--edit" : ""}">
            <div>${escapeHtml(client.email || "No email")}</div>
            ${palette ? `<div>Palette: ${escapeHtml(palette)}</div>` : ""}
            ${status ? `<div>Status: ${escapeHtml(status)}</div>` : ""}
            ${created ? `<div>Created: ${escapeHtml(created)}</div>` : ""}
            ${updated ? `<div>Updated: ${escapeHtml(updated)}</div>` : ""}
            ${client.notes && !editMode ? `<div>Notes: ${escapeHtml(client.notes)}</div>` : ""}
          </div>
          <div class="ycs-clients__detail-actions">
            ${editMode ? "" : `<button class="ycs-clients__button" type="button" data-ycs-edit-client="${escapeHtml(client.clientRecordId)}">View/Edit</button>`}
            <button class="ycs-clients__button ycs-clients__button--danger" type="button" data-ycs-delete-client="${escapeHtml(client.clientRecordId)}">Delete</button>
            <button class="ycs-clients__button ycs-clients__button--secondary" type="button" data-ycs-manage-client-photos="${escapeHtml(client.clientRecordId)}">Manage Client Photos</button>
            ${canCreateReports ? `<button class="ycs-clients__button ycs-clients__button--secondary" type="button" data-ycs-show-report-builder>Report Builder</button>` : ""}
          </div>
          ${editMode ? renderEditForm(client, saveMessage) : ""}
        </div>
      </div>
      <div class="ycs-client-photo-manager" data-ycs-client-photo-manager hidden></div>
      ${canCreateReports ? renderReportBuilder(client) : ""}
    `;

    if (canCreateReports) {
      loadReportDraft(client).catch((error) => setReportStatus(error.message || "Unable to load report draft.", true));
    }
  }

  function renderCreateClient(saveMessage) {
    updateShellMode("create");
    gridEl.hidden = true;
    detailEl.hidden = false;
    if (controlsEl) controlsEl.hidden = true;
    setStatus("", false);

    const client = {
      clientRecordId: "",
      firstName: "",
      lastName: "",
      email: "",
      paletteCode: "",
      notes: ""
    };

    detailEl.innerHTML = `
      <div class="ycs-clients__detail-header ycs-clients__detail-header--edit">
        <div>
          <button class="ycs-clients__detail-photo ycs-clients__detail-photo--upload" type="submit" form="ycs-create-client-form" name="createAction" value="photoPrep" data-ycs-create-client-photo-prep>
            <span class="ycs-client-card__placeholder">Upload a Photo</span>
          </button>
          <button class="ycs-clients__button ycs-clients__button--secondary ycs-clients__upload-photo-button" type="submit" form="ycs-create-client-form" name="createAction" value="photoPrep" data-ycs-create-client-photo-prep>
            Upload a Photo
          </button>
        </div>
        <div>
          <h2>Add Client</h2>
          ${renderEditForm(client, saveMessage, true)}
        </div>
      </div>
    `;
  }

  function renderEditForm(client, saveMessage, isCreate) {
    const selectedPaletteCode = String(client.paletteCode || "").trim().toUpperCase();
    return `
      <form class="ycs-clients__edit-form" ${isCreate ? 'id="ycs-create-client-form" data-ycs-client-create-form' : "data-ycs-client-edit-form"}>
        <input type="hidden" name="clientRecordId" value="${escapeHtml(client.clientRecordId)}">
        <input class="ycs-clients__input" name="firstName" value="${escapeHtml(client.firstName)}" placeholder="First name" required>
        <input class="ycs-clients__input" name="lastName" value="${escapeHtml(client.lastName)}" placeholder="Last name" required>
        <input class="ycs-clients__input" name="email" value="${escapeHtml(client.email)}" placeholder="Email" type="email">
        <select class="ycs-clients__input" name="paletteCode">
          <option value="">Color type</option>
          ${YCS_PALETTE_OPTIONS.map(([code, label]) => `
            <option value="${escapeHtml(code)}"${code === selectedPaletteCode ? " selected" : ""}>${escapeHtml(label)}</option>
          `).join("")}
        </select>
        <textarea class="ycs-clients__textarea" name="notes" placeholder="Notes">${escapeHtml(client.notes)}</textarea>
        ${saveMessage ? `<p class="ycs-clients__save-message">${escapeHtml(saveMessage)}</p>` : ""}
        <div class="ycs-clients__form-actions">
          <button class="ycs-clients__button" type="submit">${isCreate ? "Create Client" : "Save Client"}</button>
          <button class="ycs-clients__button ycs-clients__button--secondary" type="button" data-ycs-cancel-client-edit>Cancel</button>
        </div>
      </form>
    `;
  }

  function showClientById(clientRecordId, editMode, saveMessage) {
    const client = clients.find((item) => item.clientRecordId === clientRecordId);
    if (!client) {
      renderCards();
      return;
    }

    renderDetail(client, editMode, saveMessage);
  }

  async function showClientPhotoManager(clientRecordId) {
    const client = clients.find((item) => item.clientRecordId === clientRecordId);
    const manager = detailEl.querySelector("[data-ycs-client-photo-manager]");
    if (!client || !manager) return;
    const builder = detailEl.querySelector("[data-ycs-report-builder]");
    if (builder) builder.hidden = true;

    manager.hidden = false;
    manager.innerHTML = renderClientPhotoManager(client, [], { loading: true });

    try {
      activeSavedDrapedImages = await fetchSavedDrapedImages(client);
      activeSavedDrapedImagesClientId = client.clientRecordId;
      manager.innerHTML = renderClientPhotoManager(client, activeSavedDrapedImages);
    } catch (error) {
      manager.innerHTML = renderClientPhotoManager(client, [], {
        error: error.message || "Unable to load saved draped photos."
      });
    }
  }

  async function deleteClientPhotos(panel, imageIds) {
    const clientRecordId = panel?.dataset.clientRecordId;
    const client = clients.find((item) => item.clientRecordId === clientRecordId);
    const ids = (Array.isArray(imageIds) ? imageIds : [imageIds]).map((id) => String(id || "").trim()).filter(Boolean);
    if (!client || !ids.length) return;

    const confirmed = window.confirm(ids.length === 1
      ? "Delete this saved draped photo?"
      : `Delete ${ids.length} saved draped photos?`);
    if (!confirmed) return;

    const manager = detailEl.querySelector("[data-ycs-client-photo-manager]");
    if (manager) {
      manager.innerHTML = renderClientPhotoManager(client, activeSavedDrapedImages, { loading: true });
    }

    try {
      await deleteSavedDrapedImages(client, ids);

      if (manager) {
        manager.innerHTML = renderClientPhotoManager(client, activeSavedDrapedImages);
      }
    } catch (error) {
      if (manager) {
        manager.innerHTML = renderClientPhotoManager(client, activeSavedDrapedImages, {
          error: error.message || "Unable to delete saved draped photos."
        });
      }
      throw error;
    }
  }

  function getActiveClientForm() {
    return detailEl.querySelector("[data-ycs-client-create-form], [data-ycs-client-edit-form]");
  }

  function formElementInitialValue(element) {
    if (element.tagName === "SELECT") {
      const selectedOption = Array.from(element.options || []).find((option) => option.defaultSelected);
      return selectedOption ? selectedOption.value : "";
    }
    return element.defaultValue || "";
  }

  function hasUnsavedClientFormChanges() {
    const form = getActiveClientForm();
    if (!form) return false;

    return Array.from(form.elements || []).some((element) => {
      if (!element.name || element.type === "hidden" || element.type === "submit" || element.type === "button") return false;
      if (element.type === "checkbox" || element.type === "radio") return element.checked !== element.defaultChecked;
      return String(element.value || "") !== String(formElementInitialValue(element) || "");
    });
  }

  function promptDiscardClientChanges() {
    return new Promise((resolve) => {
      const overlay = document.createElement("div");
      overlay.className = "ycs-clients-discard";
      overlay.innerHTML = `
        <div class="ycs-clients-discard__dialog" role="dialog" aria-modal="true" aria-labelledby="ycs-clients-discard-title">
          <h2 id="ycs-clients-discard-title">Unsaved client changes</h2>
          <p>Leave without saving?</p>
          <div class="ycs-clients-discard__actions">
            <button class="ycs-clients__button ycs-clients__button--secondary" type="button" data-ycs-discard-stay>Stay</button>
            <button class="ycs-clients__button" type="button" data-ycs-discard-leave>Leave</button>
          </div>
        </div>
      `;

      const close = (shouldLeave) => {
        overlay.remove();
        resolve(shouldLeave);
      };

      overlay.addEventListener("click", (event) => {
        if (event.target === overlay || event.target.closest("[data-ycs-discard-stay]")) {
          close(false);
          return;
        }
        if (event.target.closest("[data-ycs-discard-leave]")) {
          close(true);
        }
      });

      overlay.addEventListener("keydown", (event) => {
        if (event.key === "Escape") close(false);
      });

      document.body.appendChild(overlay);
      overlay.querySelector("[data-ycs-discard-stay]")?.focus();
    });
  }

  async function confirmDiscardClientChanges() {
    if (!hasUnsavedClientFormChanges()) return true;
    return promptDiscardClientChanges();
  }

  async function saveClient(form) {
    const formData = new FormData(form);
    const payload = {
      clientRecordId: formData.get("clientRecordId"),
      firstName: formData.get("firstName"),
      lastName: formData.get("lastName"),
      email: formData.get("email"),
      paletteCode: String(formData.get("paletteCode") || "").trim().toUpperCase(),
      notes: formData.get("notes")
    };
    payload.paletteName = paletteNameForCode(payload.paletteCode);

    setStatus("Saving client...", true);
    const response = await fetch(`${apiBase}/api/update-consultant-client`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || "Client update failed");
    }

    clients = clients.map((client) => (
      client.clientRecordId === payload.clientRecordId
        ? { ...client, ...payload, updatedAt: new Date().toISOString() }
        : client
    ));
    showClientById(payload.clientRecordId, true, "Client saved.");
  }

  async function createClient(form, options = {}) {
    const formData = new FormData(form);
    const payload = {
      consultantId,
      firstName: formData.get("firstName"),
      lastName: formData.get("lastName"),
      email: formData.get("email"),
      paletteCode: String(formData.get("paletteCode") || "").trim().toUpperCase(),
      notes: formData.get("notes")
    };
    payload.paletteName = paletteNameForCode(payload.paletteCode);

    setStatus("Creating client...", true);
    const response = await fetch(`${apiBase}/api/create-consultant-client`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    const data = await response.json();

    if (!response.ok || !data.clientRecordId) {
      throw new Error(data.error || "Client create failed");
    }

    const client = {
      clientRecordId: data.clientRecordId,
      firstName: data.firstName || payload.firstName,
      lastName: data.lastName || payload.lastName,
      email: data.email || payload.email || "",
      paletteCode: data.paletteCode || payload.paletteCode || "",
      paletteName: data.paletteName || payload.paletteName || "",
      notes: data.notes || payload.notes || "",
      analysisStatus: "New",
      originalPhotoUrl: "",
      adjustedPhotoUrl: "",
      primaryPhotoUrl: "",
      activePhotoUrl: "",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    clients = [client, ...clients];
    buildPaletteFilter();
    const nextUrl = new URL(window.location.href);
    nextUrl.searchParams.delete("newClient");
    nextUrl.searchParams.set("clientRecordId", client.clientRecordId);
    window.history.pushState({}, "", nextUrl.pathname + nextUrl.search);
    if (options.redirectToPhotoPrep) {
      window.location.href = photoPrepUrl(client);
      return client;
    }
    showClientById(client.clientRecordId, true, "Client created.");
    return client;
  }

  async function deleteClientById(clientRecordId) {
    const client = clients.find((item) => item.clientRecordId === clientRecordId);
    if (!client) return;

    const confirmed = window.confirm(`Delete ${displayName(client)}? This will remove them from My Clients.`);
    if (!confirmed) return;

    setStatus("Deleting client...", true);
    const response = await fetch(`${apiBase}/api/delete-consultant-client`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        clientRecordId,
        consultantId
      })
    });
    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || "Client delete failed");
    }

    clients = clients.filter((item) => item.clientRecordId !== clientRecordId);
    const nextUrl = listUrl();
    window.history.pushState({}, "", nextUrl);
    renderCards();
    setStatus("Client deleted.", true);
  }

  async function loadClients() {
    if (!consultantId || !apiBase) {
      setStatus("Unable to load clients for this account.", true);
      return;
    }

    setStatus("Loading clients...", true);
    const response = await fetch(`${apiBase}/api/get-consultant-clients?consultantId=${encodeURIComponent(consultantId)}`);
    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || "Client lookup failed");
    }

    clients = Array.isArray(data.clients) ? data.clients : [];
    buildPaletteFilter();

    const currentParams = new URL(window.location.href).searchParams;
    const selectedClient = currentParams.get("clientRecordId");
    const editClient = currentParams.get("edit") === "1";
    const isNewClient = currentParams.get("newClient") === "1";
    if (isNewClient) {
      renderCreateClient();
    } else if (selectedClient) {
      showClientById(selectedClient, editClient);
    } else {
      renderCards();
    }
  }

  [searchEl, paletteFilterEl, sortEl].forEach((el) => {
    el.addEventListener("input", renderCards);
    el.addEventListener("change", renderCards);
  });

  root.addEventListener("click", async (event) => {
    const viewButton = event.target.closest("[data-ycs-view-client]");
    const editButton = event.target.closest("[data-ycs-edit-client]");
    const deleteButton = event.target.closest("[data-ycs-delete-client]");
    const backButton = event.target.closest("[data-ycs-back-to-clients]");
    const pageBackButton = event.target.closest("[data-ycs-clients-back-link]");
    const addClientButton = event.target.closest("[data-ycs-add-client]");
    const manageClientPhotosButton = event.target.closest("[data-ycs-manage-client-photos]");
    const clientPhotoDeleteButton = event.target.closest("[data-ycs-delete-client-photo]");
    const clientPhotoBulkDeleteButton = event.target.closest("[data-ycs-bulk-delete-client-photos]");
    const clientPhotoSelectAll = event.target.closest("[data-ycs-client-photo-select-all]");
    const clientPhotoSelect = event.target.closest("[data-ycs-client-photo-select]");
    const showReportBuilderButton = event.target.closest("[data-ycs-show-report-builder]");
    const saveReportButton = event.target.closest("[data-ycs-save-report]");
    const printReportButton = event.target.closest("[data-ycs-print-report]");
    const reportPageButton = event.target.closest("[data-ycs-report-page-button]");
    const reportImagePickerToggle = event.target.closest("[data-ycs-report-image-picker-toggle]");
    const reportImageSelectButton = event.target.closest("[data-ycs-report-image-select]");
    const reportPreviewImageButton = event.target.closest("[data-ycs-report-preview-image-field]");
    const reportModalImageButton = event.target.closest("[data-ycs-report-modal-image-select]");
    const reportModalCloseButton = event.target.closest("[data-ycs-report-image-modal-close]");
    const clearReportLogoButton = event.target.closest("[data-ycs-clear-report-logo]");
    const addCustomReportPageButton = event.target.closest("[data-ycs-add-custom-report-page]");
    const deleteReportPageButton = event.target.closest("[data-ycs-delete-report-page]");
    const duplicateReportPageButton = event.target.closest("[data-ycs-duplicate-report-page]");
    const moveReportPageButton = event.target.closest("[data-ycs-move-report-page]");
    const cancelClientEditButton = event.target.closest("[data-ycs-cancel-client-edit]");
    const leaveClientViewLink = event.target.closest("[data-ycs-leave-client-view]");

    if (leaveClientViewLink) {
      event.preventDefault();
      if (!(await confirmDiscardClientChanges())) return;
      window.location.href = leaveClientViewLink.href;
      return;
    }

    if (pageBackButton && pageBackButton.dataset.ycsBackMode !== "clients" && !(await confirmDiscardClientChanges())) {
      event.preventDefault();
      return;
    }

    if (pageBackButton && pageBackButton.dataset.ycsBackMode === "clients") {
      event.preventDefault();
      if (!(await confirmDiscardClientChanges())) return;
      const nextUrl = listUrl();
      window.history.pushState({}, "", nextUrl);
      renderCards();
      return;
    }

    if (cancelClientEditButton) {
      event.preventDefault();
      if (!(await confirmDiscardClientChanges())) return;
      const activeForm = getActiveClientForm();
      const clientRecordId = activeForm?.querySelector("[name='clientRecordId']")?.value || "";
      if (clientRecordId) {
        showClientById(clientRecordId, false);
      } else {
        const nextUrl = listUrl();
        window.history.pushState({}, "", nextUrl);
        renderCards();
      }
      return;
    }

    if (addClientButton) {
      event.preventDefault();
      if (!(await confirmDiscardClientChanges())) return;
      const nextUrl = new URL(window.location.href);
      nextUrl.searchParams.delete("clientRecordId");
      nextUrl.searchParams.delete("edit");
      nextUrl.searchParams.set("newClient", "1");
      window.history.pushState({}, "", nextUrl.pathname + nextUrl.search);
      renderCreateClient();
      return;
    }

    if (viewButton) {
      event.preventDefault();
      if (!(await confirmDiscardClientChanges())) return;
      const clientRecordId = viewButton.dataset.ycsViewClient;
      window.history.pushState({}, "", clientUrl({ clientRecordId }));
      showClientById(clientRecordId, false);
    }

    if (editButton) {
      if (!(await confirmDiscardClientChanges())) return;
      showClientById(editButton.dataset.ycsEditClient, true);
    }

    if (deleteButton) {
      deleteClientById(deleteButton.dataset.ycsDeleteClient)
        .catch((error) => setStatus(error.message || "Client delete failed.", true));
    }

    if (manageClientPhotosButton) {
      event.preventDefault();
      showClientPhotoManager(manageClientPhotosButton.dataset.ycsManageClientPhotos)
        .catch((error) => setStatus(error.message || "Unable to load saved draped photos.", true));
    }

    if (clientPhotoDeleteButton) {
      event.preventDefault();
      const panel = clientPhotoDeleteButton.closest("[data-ycs-client-photo-manager-panel]");
      deleteClientPhotos(panel, clientPhotoDeleteButton.dataset.ycsDeleteClientPhoto)
        .catch((error) => setStatus(error.message || "Unable to delete saved draped photo.", true));
    }

    if (clientPhotoBulkDeleteButton) {
      event.preventDefault();
      const panel = clientPhotoBulkDeleteButton.closest("[data-ycs-client-photo-manager-panel]");
      const selectedIds = Array.from(panel?.querySelectorAll("[data-ycs-client-photo-select]:checked") || []).map((input) => input.value);
      deleteClientPhotos(panel, selectedIds)
        .catch((error) => setStatus(error.message || "Unable to delete saved draped photos.", true));
    }

    if (clientPhotoSelectAll) {
      const panel = clientPhotoSelectAll.closest("[data-ycs-client-photo-manager-panel]");
      panel?.querySelectorAll("[data-ycs-client-photo-select]").forEach((checkbox) => {
        checkbox.checked = clientPhotoSelectAll.checked;
      });
      updateClientPhotoBulkState(panel);
    } else if (clientPhotoSelect) {
      updateClientPhotoBulkState(clientPhotoSelect.closest("[data-ycs-client-photo-manager-panel]"));
    }

    if (showReportBuilderButton) {
      event.preventDefault();
      const builder = detailEl.querySelector("[data-ycs-report-builder]");
      const manager = detailEl.querySelector("[data-ycs-client-photo-manager]");
      if (manager) {
        manager.hidden = true;
        manager.innerHTML = "";
      }
      if (builder) {
        builder.hidden = false;
        builder.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    }

    if (backButton) {
      if (!(await confirmDiscardClientChanges())) return;
      const url = new URL(window.location.href);
      url.searchParams.delete("clientRecordId");
      url.searchParams.delete("edit");
      window.history.pushState({}, "", url.pathname + url.search);
      renderCards();
    }

    if (saveReportButton) {
      if (!canCreateReports) return;
      event.preventDefault();
      saveReportDraft(saveReportButton).catch((error) => setReportStatus(error.message || "Unable to save report draft.", true));
    }

    if (printReportButton) {
      if (!canCreateReports) return;
      printReport();
    }

    if (reportPageButton) {
      if (!canCreateReports) return;
      const nextPage = Number(reportPageButton.dataset.ycsReportPageButton) || 1;
      const client = clients.find((item) => item.clientRecordId === activeReportClientId);
      const builder = detailEl.querySelector("[data-ycs-report-builder]");
      const form = builder?.querySelector("[data-ycs-report-form]");
      if (client && builder && form) {
        activeReportDraft = readReportDraftFromForm(form, client);
        activeReportPage = Math.min(Math.max(nextPage, 1), totalReportPages(activeReportDraft));
        builder.outerHTML = renderReportBuilder(client, false);
      }
      applyActiveReportPage(nextPage);
    }

    if (clearReportLogoButton) {
      if (!canCreateReports) return;
      event.preventDefault();
      setReportLogoUrl("");
    }

    if (addCustomReportPageButton) {
      if (!canCreateReports) return;
      event.preventDefault();
      const client = clients.find((item) => item.clientRecordId === activeReportClientId);
      const builder = detailEl.querySelector("[data-ycs-report-builder]");
      const form = builder?.querySelector("[data-ycs-report-form]");
      if (!client || !builder || !form) return;

      activeReportDraft = readReportDraftFromForm(form, client);
      const template = normalizeCustomPageTemplate(addCustomReportPageButton.dataset.ycsAddCustomReportPage);
      const insertIndex = customReportPageInsertIndex(activeReportDraft);
      const newPage = {
        id: makeCustomReportPageId(),
        template,
        title: template === "letter" ? "" : "New Page",
        copy: "",
        image1Url: "",
        image2Url: "",
        image3Url: "",
        image4Url: ""
      };
      activeReportDraft.customPages = [...reportCustomPages(activeReportDraft), newPage];
      const order = normalizeReportPageOrder(activeReportDraft).filter((entry) => !(entry.type === "custom" && entry.key === newPage.id));
      order.splice(insertIndex, 0, { id: newPage.id, type: "custom", key: newPage.id });
      activeReportDraft.reportPageOrder = order;
      const nextPage = LOCKED_REPORT_PAGE_COUNT + insertIndex + 1;
      builder.outerHTML = renderReportBuilder(client, false);
      applyActiveReportPage(nextPage);
      return;
    }

    if (duplicateReportPageButton) {
      if (!canCreateReports) return;
      event.preventDefault();
      const client = clients.find((item) => item.clientRecordId === activeReportClientId);
      const builder = detailEl.querySelector("[data-ycs-report-builder]");
      const form = builder?.querySelector("[data-ycs-report-form]");
      if (!client || !builder || !form) return;

      activeReportDraft = readReportDraftFromForm(form, client);
      duplicateReportPage(activeReportDraft, duplicateReportPageButton.dataset.ycsDuplicateReportPage);
      const nextPage = activeReportPage;
      builder.outerHTML = renderReportBuilder(client, false);
      applyActiveReportPage(nextPage);
    }

    if (moveReportPageButton) {
      if (!canCreateReports || moveReportPageButton.disabled) return;
      event.preventDefault();
      const client = clients.find((item) => item.clientRecordId === activeReportClientId);
      const builder = detailEl.querySelector("[data-ycs-report-builder]");
      const form = builder?.querySelector("[data-ycs-report-form]");
      if (!client || !builder || !form) return;

      activeReportDraft = readReportDraftFromForm(form, client);
      const entries = normalizeReportPageOrder(activeReportDraft);
      const currentIndex = entries.findIndex((entry) => entry.id === moveReportPageButton.dataset.ycsMoveReportPage);
      if (currentIndex < 0) return;
      const direction = Number(moveReportPageButton.dataset.ycsMoveReportPageDirection) || 0;
      const targetIndex = direction > 0 ? currentIndex + 2 : currentIndex - 1;
      moveReportPageToIndex(activeReportDraft, moveReportPageButton.dataset.ycsMoveReportPage, targetIndex);
      const nextPage = activeReportPage;
      builder.outerHTML = renderReportBuilder(client, false);
      applyActiveReportPage(nextPage);
      return;
    }

    if (deleteReportPageButton) {
      if (!canCreateReports) return;
      event.preventDefault();
      const deleteId = deleteReportPageButton.dataset.ycsDeleteReportPage;
      const client = clients.find((item) => item.clientRecordId === activeReportClientId);
      const builder = detailEl.querySelector("[data-ycs-report-builder]");
      const form = builder?.querySelector("[data-ycs-report-form]");
      if (!client || !builder || !form) return;

      activeReportDraft = readReportDraftFromForm(form, client);
      const entries = normalizeReportPageOrder(activeReportDraft);
      const entry = entries.find((item) => item.id === deleteId);
      if (!canDeleteReportPageEntry(entry)) return;

      const label = entry.type === "custom"
        ? (customPageById(activeReportDraft, entry.key)?.title || "this page")
        : builtInReportPageLabel(entry.key);
      const confirmed = window.confirm(`Delete ${label}? This cannot be undone.`);
      if (!confirmed) return;

      if (entry.type === "custom") {
        activeReportDraft.customPages = reportCustomPages(activeReportDraft).filter((page) => page.id !== entry.key);
      } else if (entry.duplicateOf) {
        const nextCopies = { ...reportPageCopies(activeReportDraft) };
        delete nextCopies[entry.id];
        activeReportDraft.pageCopies = nextCopies;
      }
      activeReportDraft.reportPageOrder = entries.filter((item) => item.id !== entry.id);
      builder.outerHTML = renderReportBuilder(client, false);
      applyActiveReportPage(Math.min(activeReportPage, totalReportPages(activeReportDraft)));
    }

    if (reportImagePickerToggle) {
      if (!canCreateReports) return;
      event.preventDefault();
      const picker = reportImagePickerToggle.closest("[data-ycs-report-image-picker]");
      const details = picker?.querySelector(".ycs-report-image-picker__choices");
      if (details) {
        details.open = !details.open;
      }
    }

    if (reportImageSelectButton) {
      if (!canCreateReports) return;
      event.preventDefault();
      selectReportSavedImage(reportImageSelectButton);
    }

    if (reportPreviewImageButton) {
      if (!canCreateReports) return;
      event.preventDefault();
      openReportImageModal(
        reportPreviewImageButton.dataset.ycsReportPreviewImageField || "",
        reportPreviewImageButton.dataset.ycsReportPreviewImageLabel || ""
      ).catch((error) => console.warn("Unable to open saved image picker", error));
    }

    if (reportModalImageButton) {
      if (!canCreateReports) return;
      event.preventDefault();
      applyReportImageSelection(
        reportModalImageButton.dataset.reportImageField || "",
        reportModalImageButton.dataset.reportImageUrl || "",
        reportModalImageButton.dataset.reportImageLabel || "No image selected"
      );
      closeReportImageModal();
    }

    if (reportModalCloseButton) {
      event.preventDefault();
      closeReportImageModal();
    }

  });

  function cleanupReportPageRailDrag() {
    detailEl.querySelectorAll("[data-ycs-report-page-order-id].is-dragging, [data-ycs-report-page-order-id].is-drop-target").forEach((item) => {
      item.classList.remove("is-dragging", "is-drop-target");
    });
    reportPageRailDrag = null;
  }

  function reportPageRailItemFromPoint(clientX, clientY) {
    return document.elementFromPoint(clientX, clientY)?.closest("[data-ycs-report-page-order-id]") || null;
  }

  function commitReportPageRailDrop(targetItem, clientY) {
    if (!targetItem || !reportPageRailDrag?.orderId || !canCreateReports) return false;
    const client = clients.find((entry) => entry.clientRecordId === activeReportClientId);
    const builder = detailEl.querySelector("[data-ycs-report-builder]");
    const form = builder?.querySelector("[data-ycs-report-form]");
    if (!client || !builder || !form) return false;

    activeReportDraft = readReportDraftFromForm(form, client);
    const rect = targetItem.getBoundingClientRect();
    const insertAfter = clientY > rect.top + (rect.height / 2);
    const targetIndex = (Number(targetItem.dataset.ycsReportPageOrderIndex) || 0) + (insertAfter ? 1 : 0);
    moveReportPageToIndex(activeReportDraft, reportPageRailDrag.orderId, targetIndex);
    const nextPage = activeReportPage;
    builder.outerHTML = renderReportBuilder(client, false);
    applyActiveReportPage(nextPage);
    return true;
  }

  root.addEventListener("pointerdown", (event) => {
    const handle = event.target.closest("[data-ycs-report-page-drag-handle]");
    const item = handle?.closest("[data-ycs-report-page-order-id]");
    if (!handle || !item || !canCreateReports) return;

    event.preventDefault();
    event.stopPropagation();
    reportPageRailDrag = {
      pointerId: event.pointerId,
      handle,
      orderId: item.dataset.ycsReportPageOrderId || "",
      startX: event.clientX,
      startY: event.clientY,
      hasMoved: false
    };
    item.classList.add("is-dragging");
    handle.setPointerCapture?.(event.pointerId);
  });

  root.addEventListener("pointermove", (event) => {
    if (!reportPageRailDrag || event.pointerId !== reportPageRailDrag.pointerId) return;
    event.preventDefault();

    const distance = Math.abs(event.clientX - reportPageRailDrag.startX) + Math.abs(event.clientY - reportPageRailDrag.startY);
    if (distance > 4) reportPageRailDrag.hasMoved = true;

    const targetItem = reportPageRailItemFromPoint(event.clientX, event.clientY);
    detailEl.querySelectorAll("[data-ycs-report-page-order-id].is-drop-target").forEach((item) => {
      if (item !== targetItem) item.classList.remove("is-drop-target");
    });
    if (targetItem && targetItem.dataset.ycsReportPageOrderId !== reportPageRailDrag.orderId) {
      targetItem.classList.add("is-drop-target");
    }
  });

  function endReportPageRailDrag(event) {
    if (!reportPageRailDrag || event.pointerId !== reportPageRailDrag.pointerId) return;
    event.preventDefault();
    event.stopPropagation();

    const handle = reportPageRailDrag.handle;
    const targetItem = reportPageRailItemFromPoint(event.clientX, event.clientY);
    const shouldCommit = reportPageRailDrag.hasMoved && targetItem && targetItem.dataset.ycsReportPageOrderId !== reportPageRailDrag.orderId;
    if (shouldCommit) {
      const committed = commitReportPageRailDrop(targetItem, event.clientY);
      if (committed) {
        handle.releasePointerCapture?.(event.pointerId);
        reportPageRailDrag = null;
        return;
      }
    }

    handle.releasePointerCapture?.(event.pointerId);
    cleanupReportPageRailDrag();
  }

  root.addEventListener("pointerup", endReportPageRailDrag);
  root.addEventListener("pointercancel", endReportPageRailDrag);

  root.addEventListener("pointerdown", (event) => {
    if (!canCreateReports) return;
    const coverFrame = event.target.closest("[data-ycs-report-cover-photo-drag]");
    if (!coverFrame) return;
    startCoverPhotoDrag(event, coverFrame);
  });

  root.addEventListener("pointermove", (event) => {
    moveCoverPhotoDrag(event);
  });

  root.addEventListener("pointerup", (event) => {
    endCoverPhotoDrag(event);
  });

  root.addEventListener("pointercancel", (event) => {
    endCoverPhotoDrag(event);
  });

  root.addEventListener("input", (event) => {
    if (!canCreateReports) return;
    if (!event.target.closest("[data-ycs-report-form]")) return;
    updateReportPreview();
  });

  root.addEventListener("change", (event) => {
    if (!canCreateReports) return;
    const reportForm = event.target.closest("[data-ycs-report-form]");
    if (!reportForm) return;

    if (event.target.name === "brandLogoFile") {
      uploadReportLogo(event.target)
        .catch((error) => setReportStatus(error.message || "Unable to upload logo.", true));
      return;
    }

    if (event.target.name === "paletteCode") {
      const client = clients.find((item) => item.clientRecordId === activeReportClientId);
      autofillReportTemplate(client)
        .catch((error) => setReportStatus(error.message || "Unable to load report template.", true));
      return;
    }

    if (event.target.name === "showOliveImage") {
      const client = clients.find((item) => item.clientRecordId === activeReportClientId);
      const builder = detailEl.querySelector("[data-ycs-report-builder]");
      const form = builder?.querySelector("[data-ycs-report-form]");
      if (client && builder && form) {
        activeReportDraft = readReportDraftFromForm(form, client);
        builder.outerHTML = renderReportBuilder(client, false);
        applyActiveReportPage(activeReportPage);
      }
      return;
    }

    if (/^customPages\..+\.template$/.test(event.target.name || "")) {
      rerenderActiveReportBuilder(activeReportPage);
      return;
    }

    updateReportPreview();
  });

  root.addEventListener("submit", (event) => {
    const createForm = event.target.closest("[data-ycs-client-create-form]");
    const editForm = event.target.closest("[data-ycs-client-edit-form]");
    if (!createForm && !editForm) return;
    event.preventDefault();

    if (createForm) {
      const redirectToPhotoPrep = event.submitter?.dataset?.ycsCreateClientPhotoPrep !== undefined ||
        event.submitter?.value === "photoPrep";
      createClient(createForm, { redirectToPhotoPrep }).catch((error) => setStatus(error.message || "Client create failed.", true));
      return;
    }

    saveClient(editForm).catch((error) => setStatus(error.message || "Client update failed.", true));
  });

  window.addEventListener("popstate", () => {
    const currentParams = new URL(window.location.href).searchParams;
    const selectedClient = currentParams.get("clientRecordId");
    const editClient = currentParams.get("edit") === "1";
    const isNewClient = currentParams.get("newClient") === "1";
    if (isNewClient) {
      renderCreateClient();
    } else if (selectedClient) {
      showClientById(selectedClient, editClient);
    } else {
      renderCards();
    }
  });

  loadClients().catch((error) => setStatus(error.message || "Unable to load clients.", true));
})();
