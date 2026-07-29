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
  const statusFilterEl = root.querySelector("[data-ycs-client-status-filter]");
  const sortEl = root.querySelector("[data-ycs-client-sort]");

  let clients = [];
  let activeReportDraft = null;
  let activeReportClientId = "";

  const REPORT_TYPE = "signature_first_section";
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
    CCLG: "Clear Cool Light for Gray Hair",
    CCMG: "Clear Cool Medium for Gray Hair",
    CCDG: "Clear Cool Deep for Gray Hair",
    CWLG: "Clear Warm Light for Gray Hair",
    CWMG: "Clear Warm Medium for Gray Hair",
    CWDG: "Clear Warm Deep for Gray Hair",
    SCLG: "Soft Cool Light for Gray Hair",
    SCMG: "Soft Cool Medium for Gray Hair",
    SCDG: "Soft Cool Deep for Gray Hair",
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
    const status = normalize(value || "New");
    if (status.includes("complete") || status === "done") return "complete";
    if (status.includes("progress")) return "in-progress";
    return "new";
  }

  function displayStatus(value) {
    const key = normalizeStatus(value);
    if (key === "complete") return "Complete";
    if (key === "in-progress") return "In Progress";
    return "New";
  }

  function displayName(client) {
    const name = [client.firstName, client.lastName].filter(Boolean).join(" ").trim();
    return name || "Unnamed Client";
  }

  function formatDate(value) {
    if (!value) return "Not available";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "Not available";
    return date.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
  }

  function getPhotoUrl(client) {
    return client.primaryPhotoUrl || client.activePhotoUrl || client.adjustedPhotoUrl || client.originalPhotoUrl || "";
  }

  function paletteLabel(client) {
    const code = String(client.paletteCode || "").trim();
    const name = String(client.paletteName || "").trim();
    if (code && name) return `${name} (${code})`;
    return name || code || "Unassigned";
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
      paletteCode,
      paletteName,
      selectedDrapeImageUrl: getPhotoUrl(client),
      colorWheelImageUrl: "",
      depthImageUrl: "",
      undertoneImageUrl: "",
      chromaImageUrl: "",
      depth,
      undertone: temperature,
      chroma,
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

  function mergeReportDraft(client, savedDraft) {
    const base = defaultReportDraft(client);
    const incoming = savedDraft && typeof savedDraft === "object" ? savedDraft : {};
    return {
      ...base,
      ...incoming,
      text: {
        ...base.text,
        ...(incoming.text || {})
      }
    };
  }

  function paragraphHtml(value) {
    return escapeHtml(value)
      .split(/\n{2,}/)
      .map((paragraph) => `<p>${paragraph.replace(/\n/g, "<br>")}</p>`)
      .join("");
  }

  function reportDateLabel(draft) {
    return monthYear(draft.reportDate);
  }

  function renderReportImage(url, label, className) {
    if (!url) {
      return `<div class="${className || "ycs-report-preview__image"} ycs-report-preview__image--empty">${escapeHtml(label)}</div>`;
    }

    return `<img class="${className || "ycs-report-preview__image"}" src="${escapeHtml(url)}" alt="${escapeHtml(label)}">`;
  }

  function reportPagesHtml(draft) {
    const name = draft.customerName || "Client";
    const footer = `${escapeHtml(name.toUpperCase())} ${escapeHtml(reportDateLabel(draft).toUpperCase())}`;

    return `
      <section class="ycs-report-page ycs-report-page--cover">
        <div class="ycs-report-logo">Your<br>Color<br>Style</div>
        <div>
          <p class="ycs-report-kicker">Your</p>
          <h1>Color Analysis</h1>
          <h2>${escapeHtml(name)}</h2>
          <p>${escapeHtml(reportDateLabel(draft))}</p>
        </div>
        <footer>${footer}</footer>
      </section>
      <section class="ycs-report-page">
        <div class="ycs-report-copy ycs-report-copy--letter">${paragraphHtml(draft.text.intro)}</div>
        <footer>2 ${footer}</footer>
      </section>
      <section class="ycs-report-page">
        <div class="ycs-report-two-column">
          <div>
            <h1>How Your<br>Color Analysis Works</h1>
            <h3>The Science Behind Your Best Colors</h3>
            ${paragraphHtml(draft.text.howItWorks)}
            <div class="ycs-report-steps">
              <div><span>1</span><strong>Depth</strong><p>How light or dark your overall coloring is.</p></div>
              <div><span>2</span><strong>Temperature</strong><p>The undertone in your skin.</p></div>
              <div><span>3</span><strong>Chroma</strong><p>How muted or vibrant your best colors are.</p></div>
            </div>
          </div>
          <div>
            <h3>Your Color Wheel</h3>
            <h2>${escapeHtml(draft.paletteName)}</h2>
            ${paragraphHtml(draft.text.colorWheel)}
            ${renderReportImage(draft.colorWheelImageUrl, "Color wheel image", "ycs-report-preview__wheel")}
          </div>
        </div>
        <footer>3 ${footer}</footer>
      </section>
      <section class="ycs-report-page">
        <h1>Depth</h1>
        ${renderReportImage(draft.depthImageUrl, "Depth image", "ycs-report-preview__wide-image")}
        <div class="ycs-report-copy">${paragraphHtml(draft.text.depth)}</div>
        <footer>4 ${footer}</footer>
      </section>
      <section class="ycs-report-page">
        <h1>Temperature</h1>
        ${renderReportImage(draft.undertoneImageUrl, "Undertone image", "ycs-report-preview__wide-image")}
        <div class="ycs-report-copy">${paragraphHtml(draft.text.undertone)}</div>
        <footer>5 ${footer}</footer>
      </section>
      <section class="ycs-report-page">
        <h1>Chroma</h1>
        ${renderReportImage(draft.chromaImageUrl, "Chroma image", "ycs-report-preview__wide-image")}
        <div class="ycs-report-copy">${paragraphHtml(draft.text.chroma)}</div>
        <footer>6 ${footer}</footer>
      </section>
      <section class="ycs-report-page">
        <h1>${escapeHtml(draft.paletteName)}</h1>
        ${renderReportImage(draft.selectedDrapeImageUrl, "Selected draped image", "ycs-report-preview__drape")}
        <div class="ycs-report-copy">${paragraphHtml(draft.text.paletteType)}</div>
        <footer>7 ${footer}</footer>
      </section>
    `;
  }

  function renderReportBuilder(client) {
    const draft = activeReportClientId === client.clientRecordId && activeReportDraft
      ? activeReportDraft
      : defaultReportDraft(client);

    activeReportClientId = client.clientRecordId;
    activeReportDraft = draft;

    const paletteOptions = colorTypeOptions.map(([code, name]) => (
      `<option value="${escapeHtml(code)}"${draft.paletteCode === code ? " selected" : ""}>${escapeHtml(name)} (${escapeHtml(code)})</option>`
    )).join("");

    return `
      <section class="ycs-report-builder" data-ycs-report-builder>
        <div class="ycs-report-builder__header">
          <div>
            <h3>Signature Report Draft</h3>
            <p>Template pages: cover through color palette type.</p>
          </div>
          <div class="ycs-report-builder__actions">
            <button class="ycs-clients__button" type="button" data-ycs-save-report>Save Draft</button>
            <button class="ycs-clients__button ycs-clients__button--secondary" type="button" data-ycs-print-report>Print PDF</button>
            <button class="ycs-clients__button ycs-clients__button--secondary" type="button" data-ycs-download-report-html>Editable HTML</button>
          </div>
        </div>
        <div class="ycs-report-builder__status" data-ycs-report-status>Loading saved draft...</div>
        <div class="ycs-report-builder__layout">
          <form class="ycs-report-form" data-ycs-report-form>
            <input type="hidden" name="clientRecordId" value="${escapeHtml(client.clientRecordId)}">
            <label>Customer name<input name="customerName" value="${escapeHtml(draft.customerName)}"></label>
            <label>Report date<input name="reportDate" type="date" value="${escapeHtml(draft.reportDate)}"></label>
            <label>Color type<select name="paletteCode">${paletteOptions}</select></label>
            <label>Color type display name<input name="paletteName" value="${escapeHtml(draft.paletteName)}"></label>
            <label>Desired draped image URL<input name="selectedDrapeImageUrl" value="${escapeHtml(draft.selectedDrapeImageUrl)}"></label>
            <label>Color wheel image URL<input name="colorWheelImageUrl" value="${escapeHtml(draft.colorWheelImageUrl)}"></label>
            <label>Depth image URL<input name="depthImageUrl" value="${escapeHtml(draft.depthImageUrl)}"></label>
            <label>Undertone image URL<input name="undertoneImageUrl" value="${escapeHtml(draft.undertoneImageUrl)}"></label>
            <label>Chroma image URL<input name="chromaImageUrl" value="${escapeHtml(draft.chromaImageUrl)}"></label>
            <label>Intro letter<textarea name="text.intro">${escapeHtml(draft.text.intro)}</textarea></label>
            <label>How it works<textarea name="text.howItWorks">${escapeHtml(draft.text.howItWorks)}</textarea></label>
            <label>Color wheel copy<textarea name="text.colorWheel">${escapeHtml(draft.text.colorWheel)}</textarea></label>
            <label>Depth copy<textarea name="text.depth">${escapeHtml(draft.text.depth)}</textarea></label>
            <label>Temperature copy<textarea name="text.undertone">${escapeHtml(draft.text.undertone)}</textarea></label>
            <label>Chroma copy<textarea name="text.chroma">${escapeHtml(draft.text.chroma)}</textarea></label>
            <label>Palette type copy<textarea name="text.paletteType">${escapeHtml(draft.text.paletteType)}</textarea></label>
          </form>
          <div class="ycs-report-preview" data-ycs-report-preview>
            ${reportPagesHtml(draft)}
          </div>
        </div>
      </section>
    `;
  }

  function readReportDraftFromForm(form, client) {
    const formData = new FormData(form);
    const paletteCode = String(formData.get("paletteCode") || "").trim().toUpperCase();
    const draft = mergeReportDraft(client, activeReportDraft);

    draft.customerName = String(formData.get("customerName") || "").trim();
    draft.reportDate = String(formData.get("reportDate") || "").trim();
    draft.paletteCode = paletteCode;
    draft.paletteName = String(formData.get("paletteName") || "").trim() || getPaletteName(paletteCode);
    draft.selectedDrapeImageUrl = String(formData.get("selectedDrapeImageUrl") || "").trim();
    draft.colorWheelImageUrl = String(formData.get("colorWheelImageUrl") || "").trim();
    draft.depthImageUrl = String(formData.get("depthImageUrl") || "").trim();
    draft.undertoneImageUrl = String(formData.get("undertoneImageUrl") || "").trim();
    draft.chromaImageUrl = String(formData.get("chromaImageUrl") || "").trim();
    draft.depth = getDepthFromPalette(paletteCode);
    draft.undertone = getTemperatureFromPalette(paletteCode);
    draft.chroma = getChromaFromPalette(paletteCode);
    draft.text = { ...draft.text };

    Array.from(form.elements).forEach((element) => {
      if (!element.name || !element.name.startsWith("text.")) return;
      draft.text[element.name.replace("text.", "")] = element.value;
    });

    return draft;
  }

  function updateReportPreview() {
    const builder = detailEl.querySelector("[data-ycs-report-builder]");
    const form = builder?.querySelector("[data-ycs-report-form]");
    const preview = builder?.querySelector("[data-ycs-report-preview]");
    if (!form || !preview || !activeReportClientId) return;

    const client = clients.find((item) => item.clientRecordId === activeReportClientId);
    if (!client) return;

    activeReportDraft = readReportDraftFromForm(form, client);
    preview.innerHTML = reportPagesHtml(activeReportDraft);
  }

  function setReportStatus(message, visible) {
    const reportStatus = detailEl.querySelector("[data-ycs-report-status]");
    if (!reportStatus) return;
    reportStatus.textContent = message || "";
    reportStatus.hidden = !visible;
  }

  async function loadReportDraft(client) {
    if (!consultantId || !client.clientRecordId || !apiBase) return;

    setReportStatus("Loading saved draft...", true);
    const response = await fetch(`${apiBase}/api/get-color-analysis-report?consultantId=${encodeURIComponent(consultantId)}&clientRecordId=${encodeURIComponent(client.clientRecordId)}&reportType=${encodeURIComponent(REPORT_TYPE)}`);
    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || "Report draft lookup failed");
    }

    activeReportClientId = client.clientRecordId;
    activeReportDraft = mergeReportDraft(client, data.report?.draft);
    const builder = detailEl.querySelector("[data-ycs-report-builder]");
    if (builder) {
      builder.outerHTML = renderReportBuilder(client);
      setReportStatus(data.report ? `Saved draft loaded. Last updated ${formatDate(data.report.updatedAt)}.` : "New draft ready.", true);
      window.setTimeout(() => setReportStatus("", false), 3500);
    }
  }

  async function saveReportDraft() {
    const form = detailEl.querySelector("[data-ycs-report-form]");
    if (!form || !activeReportClientId) return;

    const client = clients.find((item) => item.clientRecordId === activeReportClientId);
    if (!client) return;

    activeReportDraft = readReportDraftFromForm(form, client);
    setReportStatus("Saving report draft...", true);

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
    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || "Report draft save failed");
    }

    setReportStatus("Report draft saved.", true);
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
  <main class="ycs-report-preview ycs-report-export">${reportPagesHtml(draft)}</main>
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
    return url.pathname + url.search;
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
    const status = statusFilterEl.value;
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
      const matchesStatus = status === "all" || normalizeStatus(client.analysisStatus) === status;
      return matchesQuery && matchesPalette && matchesStatus;
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

    return `<div class="${className}__placeholder">No photo yet</div>`;
  }

  function renderCards() {
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
      <article class="ycs-client-card">
        <div class="ycs-client-card__photo">
          ${renderPhoto(client, "ycs-client-card")}
        </div>
        <div class="ycs-client-card__content">
          <h2 class="ycs-client-card__name">${escapeHtml(displayName(client))}</h2>
          <p class="ycs-client-card__email">${escapeHtml(client.email || "No email")}</p>
          <div class="ycs-client-card__badges">
            <span class="ycs-client-badge ycs-client-badge--palette">${escapeHtml(paletteLabel(client))}</span>
            <span class="ycs-client-badge">${escapeHtml(displayStatus(client.analysisStatus))}</span>
          </div>
          <p class="ycs-client-card__date">Created ${escapeHtml(formatDate(client.createdAt))}</p>
          <p class="ycs-client-card__date">Updated ${escapeHtml(formatDate(client.updatedAt))}</p>
          <div class="ycs-client-card__actions">
            <a class="ycs-client-card__button" href="${escapeHtml(clientUrl(client))}" data-ycs-view-client="${escapeHtml(client.clientRecordId)}">View Client</a>
            <button class="ycs-client-card__button ycs-client-card__button--secondary" type="button" data-ycs-edit-client="${escapeHtml(client.clientRecordId)}">Edit</button>
          </div>
        </div>
      </article>
    `).join("");
  }

  function renderDetail(client, editMode) {
    const photoUrl = getPhotoUrl(client);
    gridEl.hidden = true;
    detailEl.hidden = false;
    if (controlsEl) controlsEl.hidden = true;
    setStatus("", false);

    const photoFigures = [
      ["Prepared Photo", client.adjustedPhotoUrl],
      ["Original Photo", client.originalPhotoUrl]
    ].filter((item) => item[1]);

    detailEl.innerHTML = `
      <div class="ycs-clients__detail-header">
        <div class="ycs-clients__detail-photo">
          ${photoUrl ? `<img src="${escapeHtml(photoUrl)}" alt="${escapeHtml(displayName(client))}">` : '<div class="ycs-client-card__placeholder">No photo yet</div>'}
        </div>
        <div>
          <h2>${escapeHtml(displayName(client))}</h2>
          <div class="ycs-clients__detail-meta">
            <div>${escapeHtml(client.email || "No email")}</div>
            <div>Palette: ${escapeHtml(paletteLabel(client))}</div>
            <div>Status: ${escapeHtml(displayStatus(client.analysisStatus))}</div>
            <div>Created: ${escapeHtml(formatDate(client.createdAt))}</div>
            <div>Updated: ${escapeHtml(formatDate(client.updatedAt))}</div>
            ${client.notes ? `<div>Notes: ${escapeHtml(client.notes)}</div>` : ""}
          </div>
          <div class="ycs-clients__detail-actions">
            <button class="ycs-clients__button ycs-clients__button--secondary" type="button" data-ycs-back-to-clients>Back to Clients</button>
            <a class="ycs-clients__button" href="/pages/photo-prep?mode=trade&workflow=color-analysis&clientRecordId=${encodeURIComponent(client.clientRecordId)}">Prep Photo</a>
            <a class="ycs-clients__button" href="/pages/signature-color-analysis?clientRecordId=${encodeURIComponent(client.clientRecordId)}&mode=trade">Lip & Draping Studio</a>
            <button class="ycs-clients__button ycs-clients__button--secondary" type="button" data-ycs-edit-client="${escapeHtml(client.clientRecordId)}">Edit</button>
          </div>
          ${editMode ? renderEditForm(client) : ""}
        </div>
      </div>
      <div class="ycs-clients__photo-list">
        ${photoFigures.length ? photoFigures.map(([label, url]) => `
          <figure>
            <img src="${escapeHtml(url)}" alt="${escapeHtml(label)}">
            <figcaption>${escapeHtml(label)}</figcaption>
          </figure>
        `).join("") : ""}
      </div>
      ${canCreateReports ? renderReportBuilder(client) : ""}
    `;

    if (canCreateReports) {
      loadReportDraft(client).catch((error) => setReportStatus(error.message || "Unable to load report draft.", true));
    }
  }

  function renderEditForm(client) {
    return `
      <form class="ycs-clients__edit-form" data-ycs-client-edit-form>
        <input type="hidden" name="clientRecordId" value="${escapeHtml(client.clientRecordId)}">
        <input class="ycs-clients__input" name="firstName" value="${escapeHtml(client.firstName)}" placeholder="First name" required>
        <input class="ycs-clients__input" name="lastName" value="${escapeHtml(client.lastName)}" placeholder="Last name" required>
        <input class="ycs-clients__input" name="email" value="${escapeHtml(client.email)}" placeholder="Email" type="email">
        <button class="ycs-clients__button" type="submit">Save Client</button>
      </form>
    `;
  }

  function showClientById(clientRecordId, editMode) {
    const client = clients.find((item) => item.clientRecordId === clientRecordId);
    if (!client) {
      renderCards();
      return;
    }

    renderDetail(client, editMode);
  }

  async function saveClient(form) {
    const formData = new FormData(form);
    const payload = {
      clientRecordId: formData.get("clientRecordId"),
      firstName: formData.get("firstName"),
      lastName: formData.get("lastName"),
      email: formData.get("email")
    };

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
    showClientById(payload.clientRecordId, false);
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

    const selectedClient = new URL(window.location.href).searchParams.get("clientRecordId");
    if (selectedClient) {
      showClientById(selectedClient, false);
    } else {
      renderCards();
    }
  }

  [searchEl, paletteFilterEl, statusFilterEl, sortEl].forEach((el) => {
    el.addEventListener("input", renderCards);
    el.addEventListener("change", renderCards);
  });

  root.addEventListener("click", (event) => {
    const viewButton = event.target.closest("[data-ycs-view-client]");
    const editButton = event.target.closest("[data-ycs-edit-client]");
    const backButton = event.target.closest("[data-ycs-back-to-clients]");
    const saveReportButton = event.target.closest("[data-ycs-save-report]");
    const printReportButton = event.target.closest("[data-ycs-print-report]");
    const downloadReportButton = event.target.closest("[data-ycs-download-report-html]");

    if (viewButton) {
      event.preventDefault();
      const clientRecordId = viewButton.dataset.ycsViewClient;
      window.history.pushState({}, "", clientUrl({ clientRecordId }));
      showClientById(clientRecordId, false);
    }

    if (editButton) {
      showClientById(editButton.dataset.ycsEditClient, true);
    }

    if (backButton) {
      const url = new URL(window.location.href);
      url.searchParams.delete("clientRecordId");
      window.history.pushState({}, "", url.pathname + url.search);
      renderCards();
    }

    if (saveReportButton) {
      if (!canCreateReports) return;
      saveReportDraft().catch((error) => setReportStatus(error.message || "Unable to save report draft.", true));
    }

    if (printReportButton) {
      if (!canCreateReports) return;
      printReport();
    }

    if (downloadReportButton) {
      if (!canCreateReports) return;
      downloadReportHtml();
    }
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

    if (event.target.name === "paletteCode") {
      const paletteNameInput = reportForm.elements.paletteName;
      if (paletteNameInput) {
        paletteNameInput.value = getPaletteName(event.target.value);
      }
    }

    updateReportPreview();
  });

  root.addEventListener("submit", (event) => {
    const form = event.target.closest("[data-ycs-client-edit-form]");
    if (!form) return;
    event.preventDefault();
    saveClient(form).catch((error) => setStatus(error.message || "Client update failed.", true));
  });

  window.addEventListener("popstate", () => {
    const selectedClient = new URL(window.location.href).searchParams.get("clientRecordId");
    if (selectedClient) {
      showClientById(selectedClient, false);
    } else {
      renderCards();
    }
  });

  loadClients().catch((error) => setStatus(error.message || "Unable to load clients.", true));
})();
