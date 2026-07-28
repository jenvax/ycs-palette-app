(function () {
  const root = document.querySelector(".ycs-clients[data-can-manage-clients='true']");
  if (!root) return;

  const apiBase = (root.dataset.appBaseUrl || "").replace(/\/$/, "");
  const consultantId = root.dataset.customerId || "";
  const gridEl = root.querySelector("[data-ycs-client-grid]");
  const detailEl = root.querySelector("[data-ycs-client-detail]");
  const statusEl = root.querySelector("[data-ycs-client-status]");
  const controlsEl = root.querySelector("[data-ycs-client-list-controls]");
  const searchEl = root.querySelector("[data-ycs-client-search]");
  const paletteFilterEl = root.querySelector("[data-ycs-client-palette-filter]");
  const sortEl = root.querySelector("[data-ycs-client-sort]");
  const pageBackLinkEl = root.querySelector("[data-ycs-clients-back-link]");
  const addClientEl = root.querySelector("[data-ycs-add-client]");

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
    ["CCLG", "Clear Cool Light for Gray Hair"],
    ["CCMG", "Clear Cool Medium for Gray Hair"],
    ["CCDG", "Clear Cool Deep for Gray Hair"],
    ["CWLG", "Clear Warm Light for Gray Hair"],
    ["CWMG", "Clear Warm Medium for Gray Hair"],
    ["CWDG", "Clear Warm Deep for Gray Hair"],
    ["SCLG", "Soft Cool Light for Gray Hair"],
    ["SCMG", "Soft Cool Medium for Gray Hair"],
    ["SCDG", "Soft Cool Deep for Gray Hair"],
    ["SWLG", "Soft Warm Light for Gray Hair"],
    ["SWMG", "Soft Warm Medium for Gray Hair"],
    ["SWDG", "Soft Warm Deep for Gray Hair"],
    ["LO", "Light Olive"],
    ["MO", "Medium Olive"],
    ["DO", "Deep Olive"]
  ];

  let clients = [];

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

  function clientUrl(client) {
    const url = new URL(window.location.href);
    url.searchParams.set("clientRecordId", client.clientRecordId);
    return url.pathname + url.search;
  }

  function startAnalysisUrl(client) {
    const url = new URL("/pages/photo-prep", window.location.origin);
    url.searchParams.set("mode", "trade");
    url.searchParams.set("workflow", "color-analysis");
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
    return url.pathname + url.search;
  }

  function updateShellMode(mode) {
    if (pageBackLinkEl) {
      if (mode === "list") {
        pageBackLinkEl.href = pageBackLinkEl.dataset.toolsHref || "/pages/my-palettes?view=catools";
        pageBackLinkEl.textContent = "← Back to Color Analysis Tools";
        pageBackLinkEl.dataset.ycsBackMode = "tools";
      } else {
        pageBackLinkEl.href = listUrl();
        pageBackLinkEl.textContent = "← Back to My Clients";
        pageBackLinkEl.dataset.ycsBackMode = "clients";
      }
    }

    if (addClientEl) {
      addClientEl.hidden = mode !== "list";
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

    return `<div class="${className}__placeholder">No photo yet</div>`;
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
            <a class="ycs-client-card__button ycs-client-card__button--secondary" href="${escapeHtml(startAnalysisUrl(client))}">Start Color Analysis</a>
            <a class="ycs-client-card__button ycs-client-card__button--secondary" href="${escapeHtml(drapingStudioUrl(client))}">Lip & Draping Studio</a>
          </div>
        </div>
      </article>
        `;
      })()}
    `).join("");
  }

  function renderDetail(client, editMode, saveMessage) {
    updateShellMode(editMode ? "edit" : "detail");
    const photoUrl = getPhotoUrl(client);
    gridEl.hidden = true;
    detailEl.hidden = false;
    if (controlsEl) controlsEl.hidden = true;
    setStatus("", false);

    const photoFigures = [
      ["Prepared Photo", client.adjustedPhotoUrl],
      ["Original Photo", client.originalPhotoUrl]
    ].filter((item) => item[1]);
    const palette = paletteLabel(client);
    const status = displayStatus(client.analysisStatus);
    const created = formatDate(client.createdAt);
    const updated = formatDate(client.updatedAt);

    detailEl.innerHTML = `
      <div class="ycs-clients__detail-header${editMode ? " ycs-clients__detail-header--edit" : ""}">
        <div class="ycs-clients__detail-photo">
          ${photoUrl ? `<img src="${escapeHtml(photoUrl)}" alt="${escapeHtml(displayName(client))}">` : '<div class="ycs-client-card__placeholder">No photo yet</div>'}
        </div>
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
            <a class="ycs-clients__button ycs-clients__button--secondary" href="${escapeHtml(startAnalysisUrl(client))}">Start Color Analysis</a>
            <a class="ycs-clients__button ycs-clients__button--secondary" href="${escapeHtml(drapingStudioUrl(client))}">Lip & Draping Studio</a>
          </div>
          ${editMode ? renderEditForm(client, saveMessage) : ""}
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
    `;
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
        <div class="ycs-clients__detail-photo">
          <div class="ycs-client-card__placeholder">No photo yet</div>
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
      <form class="ycs-clients__edit-form" ${isCreate ? "data-ycs-client-create-form" : "data-ycs-client-edit-form"}>
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
        <button class="ycs-clients__button" type="submit">${isCreate ? "Create Client" : "Save Client"}</button>
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

  async function createClient(form) {
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
    showClientById(client.clientRecordId, true, "Client created.");
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

    const selectedClient = new URL(window.location.href).searchParams.get("clientRecordId");
    const isNewClient = new URL(window.location.href).searchParams.get("newClient") === "1";
    if (isNewClient) {
      renderCreateClient();
    } else if (selectedClient) {
      showClientById(selectedClient, false);
    } else {
      renderCards();
    }
  }

  [searchEl, paletteFilterEl, sortEl].forEach((el) => {
    el.addEventListener("input", renderCards);
    el.addEventListener("change", renderCards);
  });

  root.addEventListener("click", (event) => {
    const viewButton = event.target.closest("[data-ycs-view-client]");
    const editButton = event.target.closest("[data-ycs-edit-client]");
    const deleteButton = event.target.closest("[data-ycs-delete-client]");
    const backButton = event.target.closest("[data-ycs-back-to-clients]");
    const pageBackButton = event.target.closest("[data-ycs-clients-back-link]");
    const addClientButton = event.target.closest("[data-ycs-add-client]");

    if (pageBackButton && pageBackButton.dataset.ycsBackMode === "clients") {
      event.preventDefault();
      const nextUrl = listUrl();
      window.history.pushState({}, "", nextUrl);
      renderCards();
      return;
    }

    if (addClientButton) {
      event.preventDefault();
      const nextUrl = new URL(window.location.href);
      nextUrl.searchParams.delete("clientRecordId");
      nextUrl.searchParams.set("newClient", "1");
      window.history.pushState({}, "", nextUrl.pathname + nextUrl.search);
      renderCreateClient();
      return;
    }

    if (viewButton) {
      event.preventDefault();
      const clientRecordId = viewButton.dataset.ycsViewClient;
      window.history.pushState({}, "", clientUrl({ clientRecordId }));
      showClientById(clientRecordId, false);
    }

    if (editButton) {
      showClientById(editButton.dataset.ycsEditClient, true);
    }

    if (deleteButton) {
      deleteClientById(deleteButton.dataset.ycsDeleteClient)
        .catch((error) => setStatus(error.message || "Client delete failed.", true));
    }

    if (backButton) {
      const url = new URL(window.location.href);
      url.searchParams.delete("clientRecordId");
      window.history.pushState({}, "", url.pathname + url.search);
      renderCards();
    }
  });

  root.addEventListener("submit", (event) => {
    const createForm = event.target.closest("[data-ycs-client-create-form]");
    const editForm = event.target.closest("[data-ycs-client-edit-form]");
    if (!createForm && !editForm) return;
    event.preventDefault();

    if (createForm) {
      createClient(createForm).catch((error) => setStatus(error.message || "Client create failed.", true));
      return;
    }

    saveClient(editForm).catch((error) => setStatus(error.message || "Client update failed.", true));
  });

  window.addEventListener("popstate", () => {
    const selectedClient = new URL(window.location.href).searchParams.get("clientRecordId");
    const isNewClient = new URL(window.location.href).searchParams.get("newClient") === "1";
    if (isNewClient) {
      renderCreateClient();
    } else if (selectedClient) {
      showClientById(selectedClient, false);
    } else {
      renderCards();
    }
  });

  loadClients().catch((error) => setStatus(error.message || "Unable to load clients.", true));
})();
