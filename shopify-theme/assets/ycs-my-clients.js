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
  const statusFilterEl = root.querySelector("[data-ycs-client-status-filter]");
  const sortEl = root.querySelector("[data-ycs-client-sort]");

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
    return name || code || "Unassigned";
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
    `;
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
