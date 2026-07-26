(function () {
  const root = document.querySelector(".ycs-member-photos");
  if (!root) return;

  const isAdmin = String(root.dataset.isAdmin || "") === "true";
  const loggedInCustomerId = String(root.dataset.customerId || "");
  const searchInput = document.getElementById("ycs-member-search");
  const statusFilterSelect = document.getElementById("ycs-member-status-filter");
const photoFilterSelect = document.getElementById("ycs-member-photo-filter");
const permissionFilterSelect = document.getElementById("ycs-member-permission-filter");
  const loadingEl = document.getElementById("ycs-member-photos-loading");
  const emptyEl = document.getElementById("ycs-member-photos-empty");
  const gridEl = document.getElementById("ycs-member-photos-grid");
  const syncBtn = document.getElementById("ycs-member-sync-btn");
  const syncStatusEl = document.getElementById("ycs-member-sync-status");
  const countsEl = document.getElementById("ycs-member-photos-counts");
const activeCountEl = document.getElementById("ycs-member-active-count");
const inactiveCountEl = document.getElementById("ycs-member-inactive-count");
const dueForDrapingCountEl = document.getElementById("ycs-member-due-for-draping-count");
const viewToggleEl = document.getElementById("ycs-member-view-toggle");
const gridViewBtn = document.getElementById("ycs-member-grid-view-btn");
const tableViewBtn = document.getElementById("ycs-member-table-view-btn");
const tableWrapEl = document.getElementById("ycs-member-photos-table-wrap");
const tableBodyEl = document.getElementById("ycs-member-photos-table-body");
const drapingSummaryEl = document.getElementById("ycs-member-draping-summary");
const colorTypeFilterSelect = document.getElementById("ycs-member-color-type-filter");

  if (!isAdmin || !gridEl) return;

  if (syncBtn) syncBtn.hidden = true;
  if (syncStatusEl) syncStatusEl.hidden = true;

  let members = [];
  let memberStats = null;
  let searchTerm = "";
  let statusFilter = "all";
let photoFilter = "all";
let activeView = "grid";
let drapingFilter = "all";
let colorTypeFilter = "all";
let permissionFilter = "all";
let memberQuickFilter = "all";

statusFilter = localStorage.getItem("ycs_status_filter") || "all";
photoFilter = localStorage.getItem("ycs_photo_filter") || "all";
activeView = localStorage.getItem("ycs_view") || "grid";
drapingFilter = localStorage.getItem("ycs_draping_filter") || "all";
colorTypeFilter = localStorage.getItem("ycs_color_type_filter") || "all";
permissionFilter = localStorage.getItem("ycs_permission_filter") || "all";

if (statusFilterSelect) statusFilterSelect.value = statusFilter;
if (photoFilterSelect) photoFilterSelect.value = photoFilter;
if (colorTypeFilterSelect) colorTypeFilterSelect.value = colorTypeFilter;
if (permissionFilterSelect) permissionFilterSelect.value = permissionFilter;

function resetMemberFilters() {
  searchTerm = "";
  statusFilter = "all";
  photoFilter = "all";
  colorTypeFilter = "all";
  permissionFilter = "all";
  drapingFilter = "all";
  memberQuickFilter = "all";

  if (searchInput) searchInput.value = "";
  if (statusFilterSelect) statusFilterSelect.value = "all";
  if (photoFilterSelect) photoFilterSelect.value = "all";
  if (colorTypeFilterSelect) colorTypeFilterSelect.value = "all";
  if (permissionFilterSelect) permissionFilterSelect.value = "all";

  localStorage.setItem("ycs_status_filter", "all");
  localStorage.setItem("ycs_photo_filter", "all");
  localStorage.setItem("ycs_color_type_filter", "all");
  localStorage.setItem("ycs_permission_filter", "all");
  localStorage.setItem("ycs_draping_filter", "all");

  render();
}

function syncQuickFilterCards() {
  Array.from(document.querySelectorAll("[data-member-quick-filter]")).forEach(function (card) {
    const value = String(card.dataset.memberQuickFilter || "all");
    const isActive =
      value === "all"
        ? statusFilter === "all" && memberQuickFilter === "all"
        : value === "active" || value === "inactive"
          ? statusFilter === value && memberQuickFilter === "all"
          : memberQuickFilter === value;

    card.classList.toggle("is-active", isActive);
  });
}

function applyMemberQuickFilter(value) {
  const quickValue = String(value || "all");

  searchTerm = "";
  photoFilter = "all";
  colorTypeFilter = "all";
  permissionFilter = "all";
  drapingFilter = "all";

  if (quickValue === "active" || quickValue === "inactive") {
    statusFilter = quickValue;
    memberQuickFilter = "all";
  } else if (
    quickValue === "new-this-month" ||
    quickValue === "lost-this-month" ||
    quickValue === "due-for-draping"
  ) {
    statusFilter = "all";
    memberQuickFilter = quickValue;
  } else {
    statusFilter = "all";
    memberQuickFilter = "all";
  }

  if (searchInput) searchInput.value = "";
  if (statusFilterSelect) statusFilterSelect.value = statusFilter;
  if (photoFilterSelect) photoFilterSelect.value = "all";
  if (colorTypeFilterSelect) colorTypeFilterSelect.value = "all";
  if (permissionFilterSelect) permissionFilterSelect.value = "all";
  localStorage.setItem("ycs_status_filter", statusFilter);
  localStorage.setItem("ycs_photo_filter", "all");
  localStorage.setItem("ycs_color_type_filter", "all");
  localStorage.setItem("ycs_permission_filter", "all");
  localStorage.setItem("ycs_draping_filter", "all");
  render();
}

  function escapeHtml(value) {
    return String(value || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function formatJoinedDate(value) {
    if (!value) return "";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return String(value);
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric"
    });
  }
function updateCounts(stats) {
  if (!members.length) return;

  const activeCount = members.filter(function (member) {
    const status = String(member.membershipStatus || "").toLowerCase();
    return status === "active" || status === "legacy";
  }).length;

  const inactiveCount = members.filter(function (member) {
    return String(member.membershipStatus || "").toLowerCase() === "inactive";
  }).length;

  if (activeCountEl) activeCountEl.textContent = String(activeCount);
  if (inactiveCountEl) inactiveCountEl.textContent = String(inactiveCount);
  if (dueForDrapingCountEl) {
    const dueCount = members.filter(function (member) {
      return !!member.isDueForDraping;
    }).length;
    dueForDrapingCountEl.textContent = String(dueCount);
  }
  const totalEl = document.getElementById("ycs-member-total-count");
if (totalEl) totalEl.textContent = String(members.length);

  // NEW STATS (if backend sends them)
  if (stats) {
  const newEl = document.getElementById("ycs-member-new-count");
  const lostEl = document.getElementById("ycs-member-lost-count");
  const netEl = document.getElementById("ycs-member-net-count");
  const totalNetEl = document.getElementById("ycs-member-total-net-count");
  const newCount = members.filter(function (member) {
    return !!member.isNewThisMonth;
  }).length;
  const lostCount = members.filter(function (member) {
    return !!member.isLostThisMonth;
  }).length;

  if (newEl) newEl.textContent = newCount;
  if (lostEl) lostEl.textContent = lostCount;

  if (netEl) netEl.textContent = formatChangeNumber(newCount - lostCount);
  if (totalNetEl) totalNetEl.textContent = formatChangeNumber(stats.totalNetChangeSinceTracking);
}

  if (countsEl) countsEl.hidden = false;
}
function formatChangeNumber(value) {
  const number = Number(value || 0);
  if (number > 0) return `+${number}`;
  if (number < 0) return String(number);
  return "0";
}

  function getFilteredMembers() {
  return members.filter(function (member) {
    const haystack = `${member.customerId || ""} ${member.name || ""} ${member.email || ""} ${member.colorType || ""} ${member.membershipStatus || ""}`.toLowerCase();
    const matchesSearch = !searchTerm || haystack.indexOf(searchTerm) !== -1;

    if (searchTerm) return matchesSearch;

    const status = String(member.membershipStatus || "").toLowerCase();

    let matchesStatus = true;
    if (statusFilter === "active") {
  matchesStatus = status === "active" || status === "legacy";
}
    if (statusFilter === "inactive") matchesStatus = status === "inactive";
    if (statusFilter === "legacy") matchesStatus = status === "legacy";

    let matchesPhoto = true;
if (photoFilter === "has-photo") matchesPhoto = !!member.hasPhoto;
if (photoFilter === "no-photo") matchesPhoto = !member.hasPhoto;

let matchesColorType = true;
const hasColorType = !!String(member.colorType || "").trim();

if (colorTypeFilter === "has-color-type") matchesColorType = hasColorType;
if (colorTypeFilter === "no-color-type") matchesColorType = !hasColorType;

let matchesDraping = true;
if (drapingFilter !== "all") {
  const buckets = Array.isArray(member.drapingRecencyBuckets)
    ? member.drapingRecencyBuckets
    : [];

  matchesDraping = drapingFilter === "never"
    ? buckets.length === 0
    : buckets.includes(drapingFilter);
}
let matchesPermission = true;

if (permissionFilter === "has-permission") {
  matchesPermission = !!member.permissionToUse;
}

if (permissionFilter === "no-permission") {
  matchesPermission = !member.permissionToUse;
}
return matchesSearch && matchesStatus && matchesPhoto && matchesColorType && matchesPermission && matchesDraping;
  }).filter(function (member) {
    if (memberQuickFilter === "new-this-month") return !!member.isNewThisMonth;
    if (memberQuickFilter === "lost-this-month") return !!member.isLostThisMonth;
    if (memberQuickFilter === "due-for-draping") return !!member.isDueForDraping;
    return true;
  });
} // getFilteredMembers
function renderDrapingHistory(history) {
  if (!history || !history.length) return "";

  const visible = history.slice(0, 2);
  const remaining = history.length - visible.length;

  return `
    <div class="ycs-member-history">
      ${visible.map(function (entry) {
        const label = entry.drapedMonthYear || entry.drapedDate || "";
        const color = entry.colorName || "";
        return `<div class="ycs-member-history-item">${label} — ${color}</div>`;
      }).join("")}
      ${remaining > 0 ? `<div class="ycs-member-history-more">+${remaining} more</div>` : ""}
    </div>
  `;
}
function getDrapingSummary() {
  const summary = {
    thisMonth: 0,
    lastMonth: 0,
    twoMonthsAgo: 0,
    threeMonthsAgo: 0,
    fourMonthsAgo: 0,
    fiveMonthsAgo: 0,
    sixMonthsAgo: 0,
    older: 0,
    never: 0
  };

  members.forEach(function (member) {
    const buckets = Array.isArray(member.drapingRecencyBuckets)
      ? member.drapingRecencyBuckets
      : [];

    if (!buckets.length) {
      summary.never += 1;
      return;
    }

    buckets.forEach(function (key) {
      if (summary[key] === undefined) summary.older += 1;
      else summary[key] += 1;
    });
  });

  return summary;
}

function renderDrapingSummary() {
  if (!drapingSummaryEl) return;

  const summary = getDrapingSummary();

  function getMonthLabel(offset) {
  const now = new Date();
  const date = new Date(now.getFullYear(), now.getMonth() - offset, 1);

  return date.toLocaleDateString("en-US", {
    month: "short"
  });
}

const items = [
  ["thisMonth", getMonthLabel(0), summary.thisMonth],
  ["lastMonth", getMonthLabel(1), summary.lastMonth],
  ["twoMonthsAgo", getMonthLabel(2), summary.twoMonthsAgo],
  ["threeMonthsAgo", getMonthLabel(3), summary.threeMonthsAgo],
  ["fourMonthsAgo", getMonthLabel(4), summary.fourMonthsAgo],
  ["fiveMonthsAgo", getMonthLabel(5), summary.fiveMonthsAgo],
  ["sixMonthsAgo", getMonthLabel(6), summary.sixMonthsAgo],
  ["older", "Older", summary.older],
  ["never", "Never Draped", summary.never]
];

  drapingSummaryEl.innerHTML = items.map(function (item) {
    const key = item[0];
    const label = item[1];
    const count = item[2];

    return `
      <button
        type="button"
        class="ycs-member-draping-summary__btn ${drapingFilter === key ? "is-active" : ""}"
        data-draping-filter="${escapeHtml(key)}"
      >
        <span>${escapeHtml(label)}</span>
        <strong>${count}</strong>
      </button>
    `;
  }).join("");
}

function renderTable(filtered) {
  if (!tableBodyEl) return;

  tableBodyEl.innerHTML = filtered.map(function (member) {
    const primaryPhoto = Array.isArray(member.photos) ? member.photos[0] : null;
const primaryPhotoId = primaryPhoto?.photoId || "";
const primaryPhotoSource = primaryPhoto?.sourceTable || "PersonalStudioPhotos";

    const photoPrepParams = new URLSearchParams({
      mode: "member",
      workflow: "member-photo",
      adminCustomerId: member.customerId || "",
      firstName: member.firstName || "",
      lastName: member.lastName || "",
      email: member.email || "",
      customerPaletteCode: member.colorType || "",
      returnUrl: "/pages/member-photos"
    });

    if (primaryPhotoId) {
      photoPrepParams.set("photoId", primaryPhotoId);
      photoPrepParams.set("photoSource", primaryPhotoSource);
    }

    const photoPrepUrl = `/pages/photo-prep?${photoPrepParams.toString()}`;

    return `
  <tr>
    <td class="ycs-member-permission-cell">
      <input
        type="checkbox"
        class="ycs-input-permission"
        data-id="${escapeHtml(member.customerId)}"
        ${member.permissionToUse ? "checked" : ""}
        aria-label="Permission to use photo"
      />
    </td>
    <td>
      <strong>${escapeHtml(member.name || "Unnamed member")}</strong><br>
          <span>${escapeHtml(member.email || "")}</span>
        </td>
        <td>${escapeHtml(member.membershipStatus || "Inactive")}</td>
        <td>
  <input
    class="ycs-input-color-type"
    data-id="${member.customerId}"
    value="${escapeHtml(member.colorType || "")}"
  />
</td>
        <td>${member.hasPhoto ? "Yes" : "No"}</td>
        <td>${escapeHtml(member.lastDrapedDate || "")}</td>
        <td>${escapeHtml(member.lastDrapedColor || "")}</td>
        <td>${Number(member.drapedCount || 0)}</td>
        <td>
          <div class="ycs-member-table-actions">
            <a href="${photoPrepUrl}" class="ycs-member-table-link">
              Drape
            </a>
            <button
              type="button"
              class="ycs-member-table-link ycs-member-add-drape-note"
              data-customer-id="${escapeHtml(member.customerId)}"
              data-member-name="${escapeHtml(member.name || "")}"
              data-email="${escapeHtml(member.email || "")}"
            >
              Add Drape
            </button>
          </div>
        </td>
      </tr>
    `;
  }).join("");
}

function syncViewVisibility() {
  const isTable = activeView === "table";

  if (gridEl) {
    gridEl.hidden = isTable;
    gridEl.style.display = isTable ? "none" : "grid";
  }

  if (tableWrapEl) {
    tableWrapEl.hidden = !isTable;
    tableWrapEl.style.display = isTable ? "block" : "none";
  }

  if (gridViewBtn) {
    gridViewBtn.classList.toggle("is-active", !isTable);
  }

  if (tableViewBtn) {
    tableViewBtn.classList.toggle("is-active", isTable);
  }
}

  function render() {
  updateCounts(memberStats);
  syncQuickFilterCards();

  renderDrapingSummary();

const filtered = getFilteredMembers();

gridEl.innerHTML = "";
if (tableBodyEl) tableBodyEl.innerHTML = "";

emptyEl.hidden = filtered.length > 0;
if (!filtered.length) {
  if (members.length) {
    emptyEl.innerHTML = `
      <p>No members match the current filters.</p>
      <button type="button" class="ycs-member-photos__button" data-reset-member-filters>
        Reset Filters
      </button>
    `;
  } else {
    emptyEl.textContent = "No members found.";
  }
}

syncViewVisibility();

if (!filtered.length) return;

renderTable(filtered);

    filtered.forEach(function (member) {
      const paletteTags = Array.isArray(member.paletteTags) ? member.paletteTags.join(", ") : "";
      const primaryPhoto = Array.isArray(member.photos) ? member.photos[0] : null;
const primaryPhotoId = primaryPhoto?.photoId || "";
const primaryPhotoSource = primaryPhoto?.sourceTable || "PersonalStudioPhotos";

const photoPrepParams = new URLSearchParams({
  mode: "member",
  workflow: "member-photo",
  adminCustomerId: member.customerId || "",
  firstName: member.firstName || "",
  lastName: member.lastName || "",
  email: member.email || "",
  customerPaletteCode: member.colorType || "",
  returnUrl: "/pages/member-photos"
});

if (primaryPhotoId) {
  photoPrepParams.set("photoId", primaryPhotoId);
  photoPrepParams.set("photoSource", primaryPhotoSource);
}

const photoPrepUrl = `/pages/photo-prep?${photoPrepParams.toString()}`;

      const statusLabel = member.hasPaletteAccess
        ? `Palettes Owned${paletteTags ? ` • ${paletteTags}` : ""}`
        : "No palette yet";

      const joinedLabel = formatJoinedDate(member.joinedDate);
      const colorTypeLabel = member.colorType || "Not set";
      const membershipStatusLabel = member.membershipStatus || "Unknown";
      const joinedDisplay = joinedLabel || "Legacy member";
      const photoCount = Number(
  member.photoCount ||
  (Array.isArray(member.photos) ? member.photos.length : 0) ||
  (member.hasPhoto ? 1 : 0)
);

const hasMultiplePhotos = photoCount > 1;

      const card = document.createElement("article");
      const normalizedStatus = String(member.membershipStatus || "").toLowerCase();
const isInactive = normalizedStatus === "inactive";

card.className = `ycs-member-card ${isInactive ? "is-inactive" : ""}`;

      card.innerHTML = `
        <div class="ycs-member-card__photo">
  ${member.permissionToUse ? `<div class="ycs-member-card__permission-check">✓</div>` : ""}
  ${member.colorType ? `<div class="ycs-member-card__palette-badge">${escapeHtml(member.colorType)}</div>` : ""}
          ${
            member.photoUrl
              ? `<img src="${escapeHtml(member.photoUrl)}" alt="${escapeHtml(member.name)} photo">`
              : `<div class="ycs-member-card__placeholder">No photo on file</div>`
          }
        </div>
        <div class="ycs-member-card__content">
        ${isInactive ? `<div class="ycs-member-card__badge">Inactive</div>` : ""}
          <h2 class="ycs-member-card__name">${escapeHtml(member.name || "Unnamed member")}</h2>
          <p class="ycs-member-card__email">${escapeHtml(member.email || "")}</p>
         
          <p class="ycs-member-card__meta"><strong>Joined:</strong> ${escapeHtml(joinedDisplay)}</p>
          <p class="ycs-member-card__meta"><strong>Photos:</strong> ${photoCount}${hasMultiplePhotos ? " • Multiple" : ""}</p>
          <p class="ycs-member-card__status">${escapeHtml(statusLabel)}</p>
          ${renderDrapingHistory(member.drapingHistory)}

         <div class="ycs-member-card__actions">

  ${hasMultiplePhotos ? `
    <button
      class="ycs-member-card__button ycs-member-card__button--secondary choose-photo-btn"
      data-customer-id="${member.customerId}">
      Choose Photo
    </button>
  ` : ""}

  <a href="${photoPrepUrl}" class="ycs-member-card__button ycs-member-card__button--primary">
  Drape
</a>

</div>
      </div>
      `;

      gridEl.appendChild(card);
    });
  }

  async function syncMembers() {
  if (!syncBtn) return;

  const appBaseUrl =
    root.dataset.appBaseUrl ||
    "https://ycs-palette-app.vercel.app";

  syncBtn.disabled = true;
  if (syncStatusEl) syncStatusEl.textContent = "Syncing members...";

  try {
    const response = await fetch(`${appBaseUrl}/api/admin-sync-members`, {
  method: "POST",
  credentials: "omit",
  headers: {
    "Content-Type": "application/json"
  },
  body: JSON.stringify({ isAdmin: true })
});

    const text = await response.text();

    let data = {};
    try {
      data = text ? JSON.parse(text) : {};
    } catch (error) {
      console.error("Raw sync response:", text);
      throw new Error("Sync returned HTML instead of JSON.");
    }

    if (!response.ok) {
      throw new Error(data.error || "Sync failed");
    }

    const summary = data.summary || {};
    if (syncStatusEl) {
      syncStatusEl.textContent =
        `Sync complete. New: ${summary.created || 0} · Updated: ${summary.updated || 0} · Became VIP: ${summary.becameVIP || 0} · Lost VIP: ${summary.lostVIP || 0}`;
    }

    await loadMembers();
  } catch (error) {
    console.error("Member sync failed:", error);
    if (syncStatusEl) syncStatusEl.textContent = error.message || "Sync failed.";
  } finally {
    syncBtn.disabled = false;
  }
}

  async function loadMembers() {
    loadingEl.hidden = false;
    emptyEl.hidden = true;
    emptyEl.textContent = "No members found.";
    gridEl.innerHTML = "";

    try {
      const response = await fetch(
  `/apps/palette-data?action=getAdminMembers&logged_in_customer_id=${encodeURIComponent(loggedInCustomerId)}&isAdmin=true&_=${Date.now()}`,
  {
    credentials: "same-origin",
    cache: "no-store"
  }
);

      const text = await response.text();

      let data = {};
      try {
        data = text ? JSON.parse(text) : {};
      } catch (parseError) {
        console.error("Raw response text:", text);
        throw new Error(text.slice(0, 300));
      }

      if (!response.ok) {
        throw new Error(data.error || `Could not load members (status ${response.status})`);
      }

      members = Array.isArray(data.members) ? data.members : [];
      window.__YCS_MEMBERS__ = members;
memberStats = data.stats || null;
updateCounts(memberStats);
console.log("Loaded members:", members.slice(0, 5));
render();
    } catch (error) {
      console.error("Member photo dashboard failed:", error);
      emptyEl.hidden = false;
      emptyEl.textContent = error.message || "Could not load members.";
    } finally {
      loadingEl.hidden = true;
    }
  }

  if (searchInput) {
    searchInput.addEventListener("input", function () {
      searchTerm = String(this.value || "").trim().toLowerCase();
      render();
    });
  }

  if (statusFilterSelect) {
  statusFilterSelect.addEventListener("change", function () {
  statusFilter = String(this.value || "all");

  localStorage.setItem("ycs_status_filter", statusFilter);

  render();
});
}

if (photoFilterSelect) {
  photoFilterSelect.addEventListener("change", function () {
  photoFilter = String(this.value || "all");

  localStorage.setItem("ycs_photo_filter", photoFilter);

  render();
});
}
if (colorTypeFilterSelect) {
  colorTypeFilterSelect.addEventListener("change", function () {
    colorTypeFilter = String(this.value || "all");

    localStorage.setItem("ycs_color_type_filter", colorTypeFilter);

    render();
  });
}
if (permissionFilterSelect) {
  permissionFilterSelect.addEventListener("change", function () {
    permissionFilter = String(this.value || "all");

    localStorage.setItem("ycs_permission_filter", permissionFilter);

    render();
  });
}
document.addEventListener("click", function (e) {
  const quickFilterBtn = e.target.closest("[data-member-quick-filter]");
  if (quickFilterBtn) {
    applyMemberQuickFilter(quickFilterBtn.dataset.memberQuickFilter || "all");
    return;
  }

  const resetFiltersBtn = e.target.closest("[data-reset-member-filters]");
  if (resetFiltersBtn) {
    resetMemberFilters();
    return;
  }

  const btn = e.target.closest(".choose-photo-btn");
  if (!btn) return;

  const customerId = btn.dataset.customerId;

  openPhotoPicker(customerId);
});
function openPhotoPicker(customerId) {
  const member = window.__YCS_MEMBERS__.find(m => m.customerId === customerId);
  if (!member || !member.photos) return;

  const photos = member.photos;

  const html = photos.map(p => {
  const isActive = p.photoUrl === member.photoUrl;
  const photoId = p.photoId || p.PhotoId || p.id || p.recordId || "";

  return `
      <div class="ycs-photo-picker-item ${isActive ? "is-active" : ""}">
        <img src="${escapeHtml(p.photoUrl || "")}" />

        ${isActive ? `<div class="ycs-photo-active-badge">Current</div>` : ""}

        <button
          type="button"
          class="ycs-photo-picker-use"
          data-customer-id="${escapeHtml(customerId)}"
          data-photo-id="${escapeHtml(photoId)}"
data-source-table="${escapeHtml(p.sourceTable || "PersonalStudioPhotos")}"
        >
          Use This
        </button>
      </div>
    `;
  }).join("");

  const modal = document.createElement("div");
  modal.className = "ycs-photo-picker-modal";
  modal.innerHTML = `
    <div class="ycs-photo-picker-content">
      ${html}
      <button type="button" class="ycs-photo-picker-close">Close</button>
    </div>
  `;

  document.body.appendChild(modal);
}

// Click Handler
document.addEventListener("click", function (event) {
  const useBtn = event.target.closest(".ycs-photo-picker-use");

  if (useBtn) {
    const customerId = useBtn.dataset.customerId;
    const photoId = useBtn.dataset.photoId;
    const sourceTable = useBtn.dataset.sourceTable || "PersonalStudioPhotos";
    if (!photoId) {
  alert("This photo is missing a PhotoId, so it cannot be opened directly.");
  return;
}
    const member = window.__YCS_MEMBERS__.find(m => m.customerId === customerId);

    const modal = useBtn.closest(".ycs-photo-picker-modal");
    if (modal) modal.remove();

    const photoPrepParams = new URLSearchParams({
      mode: "member",
      workflow: "member-photo",
      adminCustomerId: customerId || "",
      firstName: member?.firstName || "",
      lastName: member?.lastName || "",
      email: member?.email || "",
      customerPaletteCode: member?.colorType || "",
      photoId,
      photoSource: sourceTable,
      returnUrl: "/pages/member-photos"
    });

    window.location.href = `/pages/photo-prep?${photoPrepParams.toString()}`;

    return;
  }

  const closeBtn = event.target.closest(".ycs-photo-picker-close");
  if (closeBtn) {
    closeBtn.closest(".ycs-photo-picker-modal")?.remove();
  }
});


document.addEventListener("click", async function (event) {
  const button = event.target.closest(".ycs-member-add-drape-note");
  if (!button) return;

  const customerId = button.dataset.customerId || "";
  const memberName = button.dataset.memberName || "";
  const email = button.dataset.email || "";

  const drapedDate = prompt("Draped date? Use YYYY-MM-DD");
if (!drapedDate) return;

const colorName = prompt("Color chosen?");
if (!colorName) return;

const colorHex = ""; // no longer needed
const paletteCode = prompt("Palette code? Optional.") || "";
  const callTheme = prompt("Call theme? Optional.") || "";
  const notes = prompt("Notes? Optional.") || "";

  try {
    const appBaseUrl =
  root.dataset.appBaseUrl ||
  "https://ycs-palette-app.vercel.app";

const response = await fetch(`${appBaseUrl}/api/add-member-drape`, {
      method: "POST",
      credentials: "same-origin",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        customerId,
        memberName,
        email,
        drapedDate,
        colorName,
        colorHex,
        paletteCode,
        callTheme,
        notes
      })
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || "Could not save draping note");
    }

    await loadMembers();
  } catch (error) {
    alert(error.message || "Could not save draping note");
  }
});
if (gridViewBtn) {
  gridViewBtn.addEventListener("click", function () {
    activeView = "grid";
localStorage.setItem("ycs_view", "grid");
    render();
  });
}

if (tableViewBtn) {
  tableViewBtn.addEventListener("click", function () {
    activeView = "table";
localStorage.setItem("ycs_view", "table");
    render();
  });
}

if (drapingSummaryEl) {
  drapingSummaryEl.addEventListener("click", function (event) {
    const button = event.target.closest("[data-draping-filter]");
    if (!button) return;

    drapingFilter = String(button.dataset.drapingFilter || "all");

localStorage.setItem("ycs_draping_filter", drapingFilter);

render();
  });
}
const appBase =
  root.dataset.appBaseUrl ||
  "https://ycs-palette-app.vercel.app";

// PERMISSION TO USE PHOTO SAVE
document.addEventListener("change", async (e) => {
  if (!e.target.classList.contains("ycs-input-permission")) return;

  try {
    const response = await fetch(`${appBase}/api/update-member-field`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        customerId: e.target.dataset.id,
        field: "PermissionToUse",
        value: e.target.checked
      })
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || "Permission save failed");
    }

    const member = members.find(m => String(m.customerId) === String(e.target.dataset.id));
    if (member) member.permissionToUse = e.target.checked;

    render();
  } catch (error) {
    e.target.checked = !e.target.checked;
    alert(error.message || "Permission save failed");
  }
});

  // COLOR TYPE SAVE
document.addEventListener("blur", async (e) => {
  if (!e.target.classList.contains("ycs-input-color-type")) return;

  try {
    const response = await fetch(`${appBase}/api/update-member-field`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        customerId: e.target.dataset.id,
        field: "ColorType",
        value: e.target.value
      })
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || "Color Type save failed");
    }
  } catch (error) {
    alert(error.message || "Color Type save failed");
  }
}, true);

// COLOR + DATE SAVE
/* async function saveDrape(customerId) {
  const row = document.querySelector(`[data-id="${customerId}"]`)?.closest("tr");
  if (!row) return;

  const color = row.querySelector(".ycs-input-color")?.value;
  const date = row.querySelector(".ycs-input-date")?.value;

  if (!color && !date) return;

  const response = await fetch(`${appBase}/api/upsert-draping`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      customerId,
      colorName: color,
      drapedDate: date || new Date().toISOString().split("T")[0]
    })
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || "Draping save failed");
  }
}

document.addEventListener("blur", (e) => {
  if (e.target.classList.contains("ycs-input-color")) {
    saveDrape(e.target.dataset.id);
  }

  if (e.target.classList.contains("ycs-input-date")) {
    saveDrape(e.target.dataset.id);
  }
}, true);
*/
 
  loadMembers();
})();
