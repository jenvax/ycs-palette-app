(function () {
  console.log('YCS COLOR ANALYSIS TOOL JS LOADED');

  const appEl = document.querySelector('.ycs-analysis-app');
  if (!appEl) return;

  const APP_BASE_URL = appEl.dataset.appBaseUrl || '';
  const VIEWER_CUSTOMER_ID = (appEl.dataset.customerId || '').trim();
  const IS_ADMIN = appEl.dataset.isAdmin === 'true';
  const IS_TRADE = appEl.dataset.isTrade === 'true';
  const IS_CATOOL = appEl.dataset.isCatool === 'true';
  const IS_CATOOL_GROWTH = appEl.dataset.isCatoolGrowth === 'true';
  const IS_CATOOL_FREE = appEl.dataset.isCatoolFree === 'true';
  const IS_FREE_DIY_CATOOL = appEl.dataset.isFreeDiyCatool === 'true';
  const IS_DIY_CATOOL = appEl.dataset.isDiyCatool === 'true';
  const CAN_USE_ANALYSIS_TOOL = appEl.dataset.canUseAnalysisTool === 'true';

  if (!CAN_USE_ANALYSIS_TOOL) {
    console.warn('Analysis tool blocked for unauthorized account');
    return;
  }

  const urlParams = new URLSearchParams(window.location.search);
  const ADMIN_VIEW_AS = (urlParams.get('viewAs') || '').trim().toLowerCase();

  const CLIENT_RECORD_ID = (urlParams.get('clientRecordId') || '').trim();
  const ADMIN_CUSTOMER_ID = (urlParams.get('adminCustomerId') || '').trim();
  const SIMPLE_CUSTOMER_ID = (urlParams.get('customerId') || '').trim();
  const DEMO_CLIENT_ID = (urlParams.get('demoClient') || '').trim().toLowerCase();
  const PHOTO_ID = (urlParams.get('photoId') || '').trim();
  const PHOTO_SOURCE = (urlParams.get('photoSource') || urlParams.get('source') || '').trim();
  const TOOL_MODE = (urlParams.get('mode') || '').trim().toLowerCase();
  const IS_SIGNATURE_STUDIO = window.location.pathname.indexOf('/pages/signature-color-analysis') !== -1;
  const IS_DIY_MODE = TOOL_MODE === 'diy';
  const IS_FREE_ANALYSIS_DEMO = (IS_CATOOL_FREE || IS_FREE_DIY_CATOOL) && !!DEMO_CLIENT_ID;

  const CUSTOMER_ID = CLIENT_RECORD_ID
    ? ''
    : (ADMIN_CUSTOMER_ID || SIMPLE_CUSTOMER_ID || VIEWER_CUSTOMER_ID);

  const ACTIVE_RECORD_ID = CLIENT_RECORD_ID || CUSTOMER_ID || '';
  const RETURN_STEP = (urlParams.get('returnStep') || '').trim().toLowerCase();
  const forceDepthReturn = RETURN_STEP === 'depth';
  const LAST_ANALYSIS_CLIENT_STORAGE_KEY = 'ycs:last-color-analysis-client:' + (VIEWER_CUSTOMER_ID || 'default');

  const HAS_NEW_PHOTO_FLAG = urlParams.get('newPhoto') === '1';
  const FREE_TRIAL_CLIENTS = {
    bwd: {
      photoUrl: 'https://cdn.shopify.com/s/files/1/0623/6284/5408/files/BWD.png?v=1779737095'
    },
    scd: {
      photoUrl: 'https://cdn.shopify.com/s/files/1/0623/6284/5408/files/SCD.png?v=1779737094'
    },
    cwl: {
      photoUrl: 'https://cdn.shopify.com/s/files/1/0623/6284/5408/files/CWL.png?v=1779737094'
    }
  };
  const FREE_TRIAL_STORAGE_PREFIX = 'ycs-catool-free-demo:';

  function rememberLastAnalysisClient() {
    if (!CLIENT_RECORD_ID || IS_FREE_ANALYSIS_DEMO) return;

    try {
      window.localStorage.setItem(LAST_ANALYSIS_CLIENT_STORAGE_KEY, CLIENT_RECORD_ID);
    } catch (error) {
      console.warn('Could not remember last color analysis client', error);
    }
  }

  const paletteAccessString = appEl.dataset.paletteAccess || '';

  function addAdminPreviewParam(query) {
    if (ADMIN_VIEW_AS && query && typeof query.set === 'function') {
      query.set('viewAs', ADMIN_VIEW_AS);
    }
    return query;
  }

  function appendAdminPreviewToHref(href) {
    if (!ADMIN_VIEW_AS || !href) return href;
    const nextUrl = new URL(href, window.location.origin);
    nextUrl.searchParams.set('viewAs', ADMIN_VIEW_AS);
    return nextUrl.pathname + nextUrl.search;
  }

  const backBtn = document.getElementById('ycs-analysis-back');
  const paletteSelect = document.getElementById('ycs-analysis-palette-select');
  const paletteToolbarBlock = document.querySelector('.ycs-analysis-toolbar-block--palette');
  const currentPaletteNameEl = document.getElementById('ycs-analysis-current-palette-name');
  const signatureAnalysisLink = document.getElementById('ycs-analysis-signature-link');
  const realisticDrapeToggle = document.getElementById('ycs-analysis-realistic-drape-toggle');
  const structuredModeBtn = document.getElementById('ycs-analysis-mode-structured');
  const comparisonModeBtn = document.getElementById('ycs-analysis-mode-comparison');
  const decisionSummaryEl = document.getElementById('ycs-analysis-decision-summary');
  const comparisonPanelEl = document.getElementById('ycs-analysis-comparison-panel');
  const comparisonBackBtn = document.getElementById('ycs-analysis-back-structured');
  const leftPaletteSelect = document.getElementById('ycs-analysis-left-palette-select');
  const rightPaletteSelect = document.getElementById('ycs-analysis-right-palette-select');
  const leftColorSelect = document.getElementById('ycs-analysis-left-color-select');
  const rightColorSelect = document.getElementById('ycs-analysis-right-color-select');
  const leftComparisonFilters = document.getElementById('ycs-analysis-left-comparison-filters');
  const rightComparisonFilters = document.getElementById('ycs-analysis-right-comparison-filters');
  const leftComparisonSwatches = document.getElementById('ycs-analysis-left-comparison-swatches');
  const rightComparisonSwatches = document.getElementById('ycs-analysis-right-comparison-swatches');
  const comparisonRails = Array.from(document.querySelectorAll('.ycs-analysis-comparison-rail'));

  const standardPanelEl = document.getElementById('ycs-analysis-standard-panel');
  const guidedPanelEl = document.getElementById('ycs-analysis-guided-panel');
  const undertoneSectionsEl = document.getElementById('ycs-analysis-undertone-sections');

  const filtersEl = document.getElementById('ycs-analysis-filters');
  const filterLeftBtn = document.getElementById('ycs-analysis-filter-left');
  const filterRightBtn = document.getElementById('ycs-analysis-filter-right');

  const swatchesEl = document.getElementById('ycs-analysis-swatches');
  const swatchLoadingEl = document.getElementById('ycs-analysis-swatch-loading');

  const activePanelButtons = Array.from(document.querySelectorAll('.ycs-analysis-toggle-btn'));
  const zoomSliders = Array.from(document.querySelectorAll('[data-analysis-zoom]'));
  const stagePanels = Array.from(document.querySelectorAll('.ycs-analysis-stage-panel'));

  const leftFrame = document.getElementById('ycs-analysis-frame-left');
  const rightFrame = document.getElementById('ycs-analysis-frame-right');

  const leftImg = document.getElementById('ycs-analysis-photo-left');
  const rightImg = document.getElementById('ycs-analysis-photo-right');

  const lipPanelEl = document.querySelector('.ycs-lip-panel');

  const leftLipCanvas = document.getElementById('ycs-lip-canvas-left');
  const rightLipCanvas = document.getElementById('ycs-lip-canvas-right');

  const leftLipSvg = document.getElementById('ycs-lip-svg-left');
  const rightLipSvg = document.getElementById('ycs-lip-svg-right');

  const leftLipPath = document.getElementById('ycs-lip-path-left');
  const rightLipPath = document.getElementById('ycs-lip-path-right');
  const leftLipGuides = document.getElementById('ycs-lip-guides-left');
  const rightLipGuides = document.getElementById('ycs-lip-guides-right');

  const lipSwatchContainer = document.getElementById('ycs-lip-swatches');
  const lipOpacityInput = document.getElementById('ycs-lip-opacity');
  const lipOpacityValue = document.getElementById('ycs-lip-opacity-value');

  const lipEmptyMode = document.getElementById('ycs-lip-empty-mode');
  const lipUseMode = document.getElementById('ycs-lip-use-mode');
  const lipEditMode = document.getElementById('ycs-lip-edit-mode');
  const lipAdjustMode = document.getElementById('ycs-lip-adjust-mode');

  const lipEditBtn = document.getElementById('ycs-lip-edit');
  const lipEditAgainBtn = document.getElementById('ycs-lip-edit-again');
  const lipFinishBtn = document.getElementById('ycs-lip-finish');
  const lipUndoBtn = document.getElementById('ycs-lip-undo');
  const lipClearBtn = document.getElementById('ycs-lip-clear');
  const lipGuidesToggleBtn = document.getElementById('ycs-lip-guides-toggle');
  const lipDoneBtn = document.getElementById('ycs-lip-done');
  const lipVisibilityToggleBtn = document.getElementById('ycs-lip-visibility-toggle');
  const lipStatus = document.getElementById('ycs-lip-status');
  const lipMovePhotoBtn = document.getElementById('ycs-lip-move-photo');
  const lipStartOverBtn = document.getElementById('ycs-lip-start-over');
  const lipAddShapeBtn = document.getElementById('ycs-lip-add-shape');
  const lipEditShape1Btn = document.getElementById('ycs-lip-edit-shape-1');
  const lipEditShape2Btn = document.getElementById('ycs-lip-edit-shape-2');

  const leftLipBlurPath = document.getElementById('ycs-lip-path-left-blur');
  const rightLipBlurPath = document.getElementById('ycs-lip-path-right-blur');

  const leftLipShadePath = document.getElementById('ycs-lip-path-left-shade');
  const rightLipShadePath = document.getElementById('ycs-lip-path-right-shade');
  const leftLipHighlightPath = document.getElementById('ycs-lip-path-left-highlight');
  const rightLipHighlightPath = document.getElementById('ycs-lip-path-right-highlight');

  const leftDrapePath = document.getElementById('ycs-analysis-drape-left');
  const rightDrapePath = document.getElementById('ycs-analysis-drape-right');
  const leftDrapeWrap = leftDrapePath ? leftDrapePath.closest('.ycs-analysis-drape-wrap') : null;
  const rightDrapeWrap = rightDrapePath ? rightDrapePath.closest('.ycs-analysis-drape-wrap') : null;

  const saveLeftBtn = document.getElementById('ycs-analysis-save-left');
  const saveRightBtn = document.getElementById('ycs-analysis-save-right');
  const exportLabelLeftToggle = document.getElementById('ycs-analysis-export-label-left');
  const exportLabelRightToggle = document.getElementById('ycs-analysis-export-label-right');

  const leftColorLabel = document.getElementById('ycs-analysis-selected-left');
  const rightColorLabel = document.getElementById('ycs-analysis-selected-right');

  const undertoneStepEl = document.getElementById('ycs-analysis-undertone-step');
  const chromaStepEl = document.getElementById('ycs-analysis-chroma-step');
  const chromaSectionsEl = document.getElementById('ycs-analysis-chroma-sections');
  const chromaCopyEl = document.getElementById('ycs-analysis-chroma-copy');
  const resetUndertoneBtn = document.getElementById('ycs-analysis-reset-undertone');

  const chromaResultEl = document.getElementById('ycs-analysis-chroma-result');
  const chromaResultTextEl = document.getElementById('ycs-analysis-chroma-result-text');

  const savePositionBtn = document.getElementById('ycs-analysis-save-position');
  const restorePositionBtn = document.getElementById('ycs-analysis-restore-position');
  const photoPrepLink = document.getElementById('ycs-analysis-photo-prep-link');
  const manageClientLink = document.getElementById('ycs-analysis-manage-client-link');

  const depthStepEl = document.getElementById('ycs-analysis-depth-step');
  const depthSectionsEl = document.getElementById('ycs-analysis-depth-sections');
  const freeTrialLockEl = document.getElementById('ycs-analysis-free-lock');
  const resetDepthBtn = document.getElementById('ycs-analysis-reset-depth');
  const grayscaleToggle = document.getElementById('ycs-analysis-grayscale-toggle');

  const leftDepthDrapeImg = document.getElementById('ycs-analysis-depth-drape-left');
  const rightDepthDrapeImg = document.getElementById('ycs-analysis-depth-drape-right');

  const loadingOverlay = document.getElementById('ycs-analysis-loading');

  const REALISTIC_DRAPE_OVERLAY_URL =
    'https://cdn.shopify.com/s/files/1/0623/6284/5408/files/fabric-drape-overlay-550.png?v=1778252521';
  const REALISTIC_DRAPE_OVERLAY_OPACITY = '0.55';

  if (
    !paletteSelect ||
    !standardPanelEl ||
    !guidedPanelEl ||
    !undertoneSectionsEl ||
    !filtersEl ||
    !swatchesEl ||
    !leftFrame ||
    !rightFrame ||
    !leftImg ||
    !rightImg ||
    !leftLipCanvas ||
    !rightLipCanvas ||
    !leftDrapePath ||
    !rightDrapePath
  ) {
    console.error('YCS analysis tool missing required elements');
    return;
  }

  const MIN_SCALE = 0.6;
  const MAX_SCALE = 6;
  const DRAPING_PALETTE_CODE = 'DRAPINGCOLORS';
  const DRAPING_LIP_PALETTE_CODE = 'DRAPINGLIPCOLORS';

  const paletteNames = {
    DRAPINGCOLORS: 'Draping Colors',
    CWL: 'Clear Warm Light',
    CWM: 'Clear Warm Medium',
    CWD: 'Clear Warm Deep',
    CCL: 'Clear Cool Light',
    CCM: 'Clear Cool Medium',
    CCD: 'Clear Cool Deep',
    SWL: 'Soft Warm Light',
    SWM: 'Soft Warm Medium',
    SWD: 'Soft Warm Deep',
    SCL: 'Soft Cool Light',
    SCM: 'Soft Cool Medium',
    SCD: 'Soft Cool Deep',
    LO: 'Light Olive',
    MO: 'Medium Olive',
    DO: 'Deep Olive',
    CWLG: 'Clear Warm Light Gray Hair',
    CWMG: 'Clear Warm Medium Gray Hair',
    CWDG: 'Clear Warm Deep Gray Hair',
    SWLG: 'Soft Warm Light Gray Hair',
    SWMG: 'Soft Warm Medium Gray Hair',
    SWDG: 'Soft Warm Deep Gray Hair'
  };

  const ALL_CUSTOMER_PALETTE_CODES = [
    'CWL', 'CWM', 'CWD',
    'CCL', 'CCM', 'CCD',
    'SWL', 'SWM', 'SWD',
    'SCL', 'SCM', 'SCD',
    'LO', 'MO', 'DO',
    'CWLG', 'CWMG', 'CWDG',
    'SWLG', 'SWMG', 'SWDG'
  ];

  const validPaletteCodes = new Set(ALL_CUSTOMER_PALETTE_CODES);
  let styleMastersPaletteOptions = [];
  let privateCustomPaletteOptions = [];

  const state = {
  scale: 1,
  x: 0,
  y: 0,
  dragging: false,
  activePanel: 'left',
  activeFilter: 'all',
  currentPaletteColors: [],
  drapingLipColors: [],
  imgLoaded: false,
  loadedImageUrl: '',
  photoSessionKey: '',
  leftColorHex: '',
    rightColorHex: '',
    leftColorName: '',
    rightColorName: '',
    clientFirstName: '',
    clientLastName: '',
    depthLeft: '',
    depthRight: '',
    pointerId: null,
    dragStartX: 0,
    dragStartY: 0,
    selectedDepth: '',
    selectedUndertoneLane: '',
    analysisDepthDecision: '',
    analysisUndertoneDecision: '',
    analysisChromaDecision: '',
    analysisCompletedAt: '',
    analysisCurrentStep: 'depth',
    analysisMode: 'structured',
    grayscale: false,
    lip: {
      leftColor: '',
      rightColor: '',
      leftOpacity: 0.45,
      rightOpacity: 0.45,
      leftVisible: true,
      rightVisible: true,
      editing: false,
      adjusting: false,
      movingPhoto: false,
      closed: false,
      points: [],
      shapes: [],
      activeShapeIndex: 0,
      dragIndex: -1,
      dragSvg: null,
      showGuides: true
    },
    analysisResult: {
      depth: '',
      undertone: '',
      chroma: '',
      resultCode: '',
      resultLabel: ''
    },
    comparison: {
      leftPaletteCode: '',
      rightPaletteCode: '',
      leftColorHex: '',
      rightColorHex: '',
      leftColorName: '',
      rightColorName: '',
      leftFilter: 'all',
      rightFilter: 'all'
    }
  };

  const gestureState = {
    pointers: new Map(),
    pinchStartDistance: 0,
    pinchStartScale: 1,
    isPinching: false
  };

  let isRestoringSession = false;

  function getLipPointFromSvgEvent(event, svg) {
    const rect = svg.getBoundingClientRect();
    return {
      x: ((event.clientX - rect.left) / rect.width) * 1000,
      y: ((event.clientY - rect.top) / rect.height) * 1000
    };
  }

  function getPointerDistance(a, b) {
    const dx = b.clientX - a.clientX;
    const dy = b.clientY - a.clientY;
    return Math.sqrt(dx * dx + dy * dy);
  }

  function normalizeHex(hex) {
    let value = String(hex || '').trim().toLowerCase();
    if (!value) return '';
    value = value.charAt(0) === '#' ? value : '#' + value;

    if (/^#[0-9a-f]{8}$/.test(value)) {
      return value.slice(0, 7);
    }

    return value;
  }

  function syncDrapeLayer(panel, color) {
    const wrap = panel === 'right' ? rightDrapeWrap : leftDrapeWrap;
    const path = panel === 'right' ? rightDrapePath : leftDrapePath;
    if (!wrap || !path) return;

    const drapeColor = normalizeHex(color || path.getAttribute('fill') || '#e8dfd4');
    const realisticEnabled = !!(realisticDrapeToggle && realisticDrapeToggle.checked);

    wrap.style.setProperty('--analysis-drape-color', drapeColor);
    wrap.style.setProperty('--analysis-drape-overlay-url', 'url("' + REALISTIC_DRAPE_OVERLAY_URL + '")');
    wrap.style.setProperty(
      '--analysis-drape-overlay-opacity',
      realisticEnabled ? REALISTIC_DRAPE_OVERLAY_OPACITY : '0'
    );
    wrap.classList.toggle('drape-realistic', realisticEnabled);
  }

  function syncDrapeLayers() {
    syncDrapeLayer('left');
    syncDrapeLayer('right');
  }

  function clampScale(value) {
    const num = Number(value || 1);
    return Math.max(MIN_SCALE, Math.min(MAX_SCALE, num));
  }

  function getPaletteDisplayName(code) {
    if (isCustomPaletteCode(code)) {
      const match = getCustomPaletteOptions().find(function (palette) {
        return palette.code === code;
      });
      return match ? match.name : 'Custom Palette';
    }
    return paletteNames[code] || code || '—';
  }

  async function saveClientColorType(result) {
    if (!APP_BASE_URL || !CLIENT_RECORD_ID || !result || !result.resultCode) return;

    const firstName = String(state.clientFirstName || '').trim();
    const lastName = String(state.clientLastName || '').trim();
    if (!firstName || !lastName) return;

    const response = await fetch(APP_BASE_URL + '/api/update-consultant-client', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        clientRecordId: CLIENT_RECORD_ID,
        firstName,
        lastName,
        paletteCode: result.resultCode,
        paletteName: result.resultLabel || getPaletteDisplayName(result.resultCode)
      })
    });
    const data = await response.json().catch(function () {
      return {};
    });

    if (!response.ok || !data.success) {
      throw new Error(data.error || 'Could not save color type');
    }
  }

  function getLaneLabel(lane) {
    const map = {
      'light-warm': 'Light Warm',
      'light-cool': 'Light Cool',
      'med-warm': 'Medium Warm',
      'med-cool': 'Medium Cool',
      'deep-warm': 'Deep Warm',
      'deep-cool': 'Deep Cool'
    };
    return map[lane] || '';
  }

  function capitalize(str) {
    const value = String(str || '').trim();
    if (!value) return '';
    return value.charAt(0).toUpperCase() + value.slice(1);
  }

  function getReturnUrl() {
    const returnUrl = urlParams.get('returnUrl');
    if (returnUrl) return returnUrl;
    return '/pages/my-palettes';
  }

  function buildClientListHref() {
    return appendAdminPreviewToHref('/pages/my-clients');
  }

  function buildManageClientHref() {
    if (!CLIENT_RECORD_ID) return '/pages/my-clients';

    const query = new URLSearchParams({
      clientRecordId: CLIENT_RECORD_ID,
      edit: '1'
    });

    addAdminPreviewParam(query);
    return '/pages/my-clients?' + query.toString();
  }

  function getFreeTrialClient(clientId) {
    return FREE_TRIAL_CLIENTS[String(clientId || '').trim().toLowerCase()] || null;
  }

  function getFreeTrialStorageKey(clientId, suffix) {
    return FREE_TRIAL_STORAGE_PREFIX + VIEWER_CUSTOMER_ID + ':' + clientId + ':' + suffix;
  }

  function getStoredFreeTrialValue(clientId, suffix) {
    try {
      return localStorage.getItem(getFreeTrialStorageKey(clientId, suffix)) || '';
    } catch (error) {
      console.warn('Could not read free trial demo data', error);
      return '';
    }
  }

  function setStoredFreeTrialValue(clientId, suffix, value) {
    try {
      localStorage.setItem(getFreeTrialStorageKey(clientId, suffix), value);
    } catch (error) {
      console.warn('Could not save free trial demo data', error);
      throw new Error('Your browser could not save this trial adjustment.');
    }
  }

  function showLoading(message) {
    if (!loadingOverlay) return;
    loadingOverlay.hidden = false;
    const textEl = loadingOverlay.querySelector('.ycs-analysis-loading__text');
    if (textEl) textEl.textContent = message || 'Loading…';
  }

  function hideLoading() {
    if (!loadingOverlay) return;
    loadingOverlay.hidden = true;
  }

  function showSwatchLoading() {
    if (swatchLoadingEl) swatchLoadingEl.hidden = false;
    filtersEl.classList.add('is-loading');
    swatchesEl.innerHTML = '';
    undertoneSectionsEl.innerHTML = '';
  }
function buildSignatureAnalysisHref() {
  const canUseSignatureStudio =
    IS_ADMIN || IS_TRADE || IS_CATOOL || IS_CATOOL_GROWTH;

  if (!canUseSignatureStudio) return '/pages/signature-color-analysis';

  const query = new URLSearchParams();
  query.set('returnUrl', window.location.pathname + window.location.search);

  if (CLIENT_RECORD_ID) {
    query.set('clientRecordId', CLIENT_RECORD_ID);
  } else if (ADMIN_CUSTOMER_ID) {
    query.set('adminCustomerId', ADMIN_CUSTOMER_ID);
  } else if (SIMPLE_CUSTOMER_ID) {
    query.set('customerId', SIMPLE_CUSTOMER_ID);
  }

  if (PHOTO_ID) {
    query.set('photoId', PHOTO_ID);
  }

  if (PHOTO_SOURCE) {
    query.set('photoSource', PHOTO_SOURCE);
  }

  if (DEMO_CLIENT_ID) {
    query.set('demoClient', DEMO_CLIENT_ID);
  }

  query.set('mode', 'trade');
  addAdminPreviewParam(query);

  const queryString = query.toString();
  return '/pages/signature-color-analysis' + (queryString ? '?' + queryString : '');
}

function buildColorAnalysisToolHref() {
  const query = new URLSearchParams();

  if (CLIENT_RECORD_ID) {
    query.set('clientRecordId', CLIENT_RECORD_ID);
  } else if (ADMIN_CUSTOMER_ID) {
    query.set('adminCustomerId', ADMIN_CUSTOMER_ID);
  } else if (SIMPLE_CUSTOMER_ID) {
    query.set('customerId', SIMPLE_CUSTOMER_ID);
  }

  if (PHOTO_ID) {
    query.set('photoId', PHOTO_ID);
  }

  if (PHOTO_SOURCE) {
    query.set('photoSource', PHOTO_SOURCE);
  }

  if (DEMO_CLIENT_ID) {
    query.set('demoClient', DEMO_CLIENT_ID);
  }

  if (TOOL_MODE) {
    query.set('mode', TOOL_MODE);
  }

  const returnUrl = getReturnUrl();
  if (returnUrl) {
    query.set('returnUrl', returnUrl);
  }

  addAdminPreviewParam(query);

  const queryString = query.toString();
  return '/pages/color-analysis-tool' + (queryString ? '?' + queryString : '');
}

function updateSignatureAnalysisLink() {
  if (!signatureAnalysisLink) return;

  const canUseSignatureStudio =
    IS_ADMIN || IS_TRADE || IS_CATOOL || IS_CATOOL_GROWTH;

  if (!canUseSignatureStudio) {
    signatureAnalysisLink.hidden = true;
    signatureAnalysisLink.style.display = 'none';
    return;
  }

  signatureAnalysisLink.hidden = false;
  signatureAnalysisLink.style.display = '';
  if (IS_SIGNATURE_STUDIO) {
    signatureAnalysisLink.textContent = 'Switch to Color Analysis Tool';
    signatureAnalysisLink.href = buildColorAnalysisToolHref();
  } else {
    signatureAnalysisLink.textContent = 'Lip & Draping Studio';
    signatureAnalysisLink.href = buildSignatureAnalysisHref();
  }
}

function updateManageClientLink() {
  if (!manageClientLink) return;

  if (!CLIENT_RECORD_ID) {
    manageClientLink.hidden = true;
    manageClientLink.style.display = 'none';
    return;
  }

  manageClientLink.hidden = false;
  manageClientLink.style.display = '';
  manageClientLink.href = buildManageClientHref();
}
  function hideSwatchLoading() {
    if (swatchLoadingEl) swatchLoadingEl.hidden = true;
    filtersEl.classList.remove('is-loading');
  }

  function isDrapingPalette(paletteCode) {
    return String(paletteCode || '').toUpperCase() === DRAPING_PALETTE_CODE;
  }

  function isCustomPaletteCode(code) {
    return /^CUSTOM_/i.test(String(code || '').trim());
  }

  function normalizeCustomPaletteOption(palette) {
    const id = String(palette && palette.id ? palette.id : '').trim();
    if (!id) return null;

    return {
      code: 'CUSTOM_' + id,
      name: String(palette.name || 'Custom Palette').trim() || 'Custom Palette',
      colors: Array.isArray(palette.colors) ? palette.colors : []
    };
  }

  function getCustomPaletteOptions() {
    return styleMastersPaletteOptions.concat(privateCustomPaletteOptions);
  }

  async function loadAdminStyleMastersPalettes() {
    if (!IS_ADMIN) return [];

    try {
      const query = new URLSearchParams({
        isAdmin: 'true',
        action: 'list'
      });
      query.set('action', 'getStyleMastersPalettes');
      const response = await fetch('/apps/palette-data?' + query.toString(), { credentials: 'same-origin' });
      const text = await response.text();
      const data = text ? JSON.parse(text) : {};

      if (!response.ok) {
        throw new Error(data.error || 'Unable to load Style Masters palettes');
      }

      return (data.palettes || [])
        .map(normalizeCustomPaletteOption)
        .filter(Boolean);
    } catch (error) {
      console.error('Failed to load Style Masters palettes for signature studio', error);
      return [];
    }
  }

  async function loadPrivateCustomPalettes() {
    if (!IS_CATOOL_GROWTH || !APP_BASE_URL || !VIEWER_CUSTOMER_ID) return [];

    try {
      const query = new URLSearchParams({
        customerId: VIEWER_CUSTOMER_ID,
        hasGrowthAccess: 'true',
        action: 'list'
      });
      const response = await fetch(APP_BASE_URL.replace(/\/$/, '') + '/api/custom-palettes?' + query.toString());
      const text = await response.text();
      const data = text ? JSON.parse(text) : {};

      if (!response.ok) {
        throw new Error(data.error || 'Unable to load custom palettes');
      }

      return (data.palettes || [])
        .map(normalizeCustomPaletteOption)
        .filter(Boolean);
    } catch (error) {
      console.error('Failed to load private custom palettes for analysis tool', error);
      return [];
    }
  }

  function orderPalettesWithCustomPalettes(palettes) {
    const customPalettes = getCustomPaletteOptions();
    if (!customPalettes.length) return palettes;

    const customCodes = customPalettes.map(function (palette) {
      return palette.code;
    });

    return customCodes
      .concat(palettes.filter(function (code) {
        return customCodes.indexOf(code) === -1;
      }))
      .filter(function (code, index, allCodes) {
        return allCodes.indexOf(code) === index;
      });
  }

  function setFreeTrialLockVisible(visible) {
    if (!freeTrialLockEl) return;
    freeTrialLockEl.hidden = true;
    if (undertoneStepEl) {
      undertoneStepEl.classList.remove('ycs-analysis-free-locked');
    }
  }

  function getAnalystPaletteCodes(accessString) {
    if (IS_ADMIN || IS_TRADE || IS_CATOOL || IS_CATOOL_GROWTH || IS_CATOOL_FREE || IS_DIY_CATOOL || IS_FREE_DIY_CATOOL) {
      return orderPalettesWithCustomPalettes([DRAPING_PALETTE_CODE].concat(ALL_CUSTOMER_PALETTE_CODES));
    }

    const owned = String(accessString || '')
      .split(',')
      .map(function (code) { return code.trim().toUpperCase(); })
      .filter(function (code) { return validPaletteCodes.has(code); });

    return [DRAPING_PALETTE_CODE]
      .concat(owned.filter(function (code) { return code !== DRAPING_PALETTE_CODE; }))
      .filter(function (code, index, arr) {
        return arr.indexOf(code) === index;
      });
  }

  function populatePaletteSelect() {
    const palettes = getAnalystPaletteCodes(paletteAccessString);
    paletteSelect.innerHTML = '';

    palettes.forEach(function (code) {
      const option = document.createElement('option');
      option.value = code;
      option.textContent = getPaletteDisplayName(code);
      paletteSelect.appendChild(option);
    });

    paletteSelect.value = palettes.indexOf(DRAPING_PALETTE_CODE) !== -1
      ? DRAPING_PALETTE_CODE
      : (palettes[0] || '');

    updateCurrentPaletteName();

  }

  function populateComparisonPaletteSelects() {
    if (!leftPaletteSelect || !rightPaletteSelect) return;

    const palettes = getAnalystPaletteCodes(paletteAccessString).filter(function (code) {
      return code !== DRAPING_PALETTE_CODE;
    });
    const fallbackPalettes = palettes.length ? palettes : [DRAPING_PALETTE_CODE];

    [leftPaletteSelect, rightPaletteSelect].forEach(function (selectEl, index) {
      selectEl.innerHTML = '';
      fallbackPalettes.forEach(function (code) {
        const option = document.createElement('option');
        option.value = code;
        option.textContent = getPaletteDisplayName(code);
        selectEl.appendChild(option);
      });

      const savedCode = index === 0 ? state.comparison.leftPaletteCode : state.comparison.rightPaletteCode;
      selectEl.value = fallbackPalettes.indexOf(savedCode) !== -1
        ? savedCode
        : (fallbackPalettes[index] || fallbackPalettes[0] || '');
    });

    state.comparison.leftPaletteCode = leftPaletteSelect.value;
    state.comparison.rightPaletteCode = rightPaletteSelect.value;
  }

  function populateComparisonColorSelect(selectEl, colors, panel) {
    if (!selectEl) return;
    selectEl.innerHTML = '';

    colors.forEach(function (color) {
      const hex = normalizeHex(color.hex || color.hexCode || color.colorHex || '');
      if (!hex) return;

      const option = document.createElement('option');
      option.value = hex;
      option.textContent = color.name || color.colorName || color.title || 'Color';
      option.dataset.name = option.textContent;
      selectEl.appendChild(option);
    });

    const savedHex = normalizeHex(panel === 'right' ? state.comparison.rightColorHex : state.comparison.leftColorHex);
    if (savedHex && Array.from(selectEl.options).some(function (option) { return normalizeHex(option.value) === savedHex; })) {
      selectEl.value = savedHex;
    }

    const selected = selectEl.selectedOptions[0];
    if (selected) {
      if (panel === 'right') {
        state.comparison.rightColorHex = selected.value;
        state.comparison.rightColorName = selected.dataset.name || selected.textContent;
      } else {
        state.comparison.leftColorHex = selected.value;
        state.comparison.leftColorName = selected.dataset.name || selected.textContent;
      }
      applyDrapeColor(panel, selected.value, selected.dataset.name || selected.textContent);
    }
  }

  function getComparisonFilter(panel) {
    return panel === 'right'
      ? (state.comparison.rightFilter || 'all')
      : (state.comparison.leftFilter || 'all');
  }

  function setComparisonFilter(panel, value) {
    if (panel === 'right') {
      state.comparison.rightFilter = value || 'all';
    } else {
      state.comparison.leftFilter = value || 'all';
    }
  }

  function getComparisonFilteredColors(colors, panel) {
    const activeFilter = getComparisonFilter(panel);
    const sortedColors = colors.slice().sort(function (a, b) {
      return Number(a.sortOrder || 0) - Number(b.sortOrder || 0);
    });

    if (activeFilter === 'all') {
      return sortedColors;
    }

    return sortedColors.filter(function (color) {
      const categories = getCategoryFromColor(color);
      return categories.some(function (category) {
        return String(category).toLowerCase() === activeFilter;
      });
    });
  }

  function populateComparisonFilters(containerEl, colors, panel) {
    if (!containerEl) return;

    const categorySet = new Set();
    colors.forEach(function (color) {
      const categories = getCategoryFromColor(color);
      categories.forEach(function (category) {
        if (category) categorySet.add(String(category).toLowerCase());
      });
    });

    const filters = [{ key: 'all', label: 'All' }].concat(
      Array.from(categorySet).map(function (category) {
        return {
          key: category,
          label: category
        };
      })
    );

    const activeFilter = filters.some(function (filter) {
      return filter.key === getComparisonFilter(panel);
    })
      ? getComparisonFilter(panel)
      : 'all';

    if (activeFilter !== getComparisonFilter(panel)) {
      setComparisonFilter(panel, activeFilter);
    }

    containerEl.innerHTML = '';
    filters.forEach(function (filter) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'ycs-analysis-comparison-filter';
      btn.dataset.filter = filter.key;
      btn.textContent = filter.label;
      btn.classList.toggle('is-active', filter.key === activeFilter);

      btn.addEventListener('click', function () {
        setComparisonFilter(panel, filter.key);
        if (panel === 'right') {
          state.comparison.rightColorHex = '';
        } else {
          state.comparison.leftColorHex = '';
        }
        loadComparisonSide(panel);
      });

      containerEl.appendChild(btn);
    });
  }

  function populateComparisonSwatches(containerEl, colors, panel) {
    if (!containerEl) return;

    containerEl.innerHTML = '';

    colors.forEach(function (color) {
      const hex = normalizeHex(color.hex || color.hexCode || color.colorHex || '');
      if (!hex) return;

      const name = color.name || color.colorName || color.title || 'Color';
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'ycs-analysis-comparison-swatch';
      btn.style.background = hex;
      btn.dataset.hex = hex;
      btn.dataset.name = name;
      btn.setAttribute('aria-label', name);
      btn.title = name;

      btn.addEventListener('click', function () {
        if (panel === 'right') {
          state.comparison.rightColorHex = hex;
          state.comparison.rightColorName = name;
        } else {
          state.comparison.leftColorHex = hex;
          state.comparison.leftColorName = name;
        }

        applyDrapeColor(panel, hex, name);
        refreshComparisonSwatches();
      });

      containerEl.appendChild(btn);
    });
  }

  function refreshComparisonSwatches() {
    [
      { el: leftComparisonSwatches, hex: state.comparison.leftColorHex },
      { el: rightComparisonSwatches, hex: state.comparison.rightColorHex }
    ].forEach(function (item) {
      if (!item.el) return;

      const activeHex = normalizeHex(item.hex || '');
      Array.from(item.el.querySelectorAll('.ycs-analysis-comparison-swatch')).forEach(function (btn) {
        btn.classList.toggle('is-active', normalizeHex(btn.dataset.hex || '') === activeHex);
      });
    });
  }

  async function loadComparisonSide(panel) {
    const paletteEl = panel === 'right' ? rightPaletteSelect : leftPaletteSelect;
    const colorEl = panel === 'right' ? rightColorSelect : leftColorSelect;
    const filtersContainer = panel === 'right' ? rightComparisonFilters : leftComparisonFilters;
    const swatchesContainer = panel === 'right' ? rightComparisonSwatches : leftComparisonSwatches;
    if (!paletteEl) return;

    const paletteCode = paletteEl.value || DRAPING_PALETTE_CODE;
    const colors = await fetchPaletteColors(paletteCode);
    const filteredColors = getComparisonFilteredColors(colors, panel);

    if (panel === 'right') {
      state.comparison.rightPaletteCode = paletteCode;
    } else {
      state.comparison.leftPaletteCode = paletteCode;
    }

    populateComparisonFilters(filtersContainer, colors, panel);
    populateComparisonColorSelect(colorEl, filteredColors, panel);
    populateComparisonSwatches(swatchesContainer, filteredColors, panel);

    const savedHex = normalizeHex(panel === 'right' ? state.comparison.rightColorHex : state.comparison.leftColorHex);
    const colorToApply =
      filteredColors.find(function (color) {
        return normalizeHex(color.hex || color.hexCode || color.colorHex || '') === savedHex;
      }) || filteredColors.find(function (color) {
        return normalizeHex(color.hex || color.hexCode || color.colorHex || '');
      });

    if (colorToApply) {
      const hex = normalizeHex(colorToApply.hex || colorToApply.hexCode || colorToApply.colorHex || '');
      const name = colorToApply.name || colorToApply.colorName || colorToApply.title || 'Color';

      if (panel === 'right') {
        state.comparison.rightColorHex = hex;
        state.comparison.rightColorName = name;
      } else {
        state.comparison.leftColorHex = hex;
        state.comparison.leftColorName = name;
      }

      applyDrapeColor(panel, hex, name);
    }

    refreshComparisonSwatches();
    saveAnalysisSession();
  }

  function setAnalysisMode(mode) {
    const previousMode = state.analysisMode;
    state.analysisMode = mode === 'comparison' ? 'comparison' : 'structured';

    appEl.classList.toggle('is-comparison-mode', state.analysisMode === 'comparison');
    appEl.classList.toggle('is-structured-mode', state.analysisMode === 'structured');

    if (structuredModeBtn) structuredModeBtn.classList.toggle('is-active', state.analysisMode === 'structured');
    if (comparisonModeBtn) comparisonModeBtn.classList.toggle('is-active', state.analysisMode === 'comparison');
    if (comparisonPanelEl) comparisonPanelEl.hidden = state.analysisMode !== 'comparison';
    comparisonRails.forEach(function (rail) {
      rail.hidden = state.analysisMode !== 'comparison';
    });

    if (state.analysisMode === 'structured') {
      if (paletteSelect && !isDrapingPalette(paletteSelect.value)) {
        paletteSelect.value = DRAPING_PALETTE_CODE;
        updateCurrentPaletteName();
        renderPaletteUI(DRAPING_PALETTE_CODE);
      }
      syncStructuredStepVisibility();
    } else {
      state.grayscale = false;
      if (grayscaleToggle) grayscaleToggle.checked = false;
      hideDepthStageDrapes();
      setLipVisibilityForCurrentStep();
      syncLipUiMode();
      updateImageTransform();
      [leftImg, rightImg].forEach(function (img) {
        if (!img) return;
        img.style.filter = 'none';
        img.style.webkitFilter = 'none';
      });
      if (leftPaletteSelect) {
        populateComparisonPaletteSelects();
      }
      loadComparisonSide('left');
      loadComparisonSide('right');
    }

    if (previousMode !== state.analysisMode) {
      exitLipEditingUi();
    }

    refreshLipOverlayAfterLayout();
    updateDecisionSummary();
    saveAnalysisSession();
  }

  function syncStructuredStepVisibility() {
    if (!isDrapingPalette(paletteSelect ? paletteSelect.value : '')) return;

    const hasDepthDecision = !!(state.analysisDepthDecision || state.selectedDepth);
    const hasUndertoneDecision = !!(
      state.analysisUndertoneDecision ||
      state.selectedUndertoneLane ||
      state.analysisCurrentStep === 'chroma' ||
      state.analysisCurrentStep === 'complete'
    );

    if (!hasDepthDecision) {
      if (depthStepEl) depthStepEl.hidden = false;
      if (undertoneStepEl) undertoneStepEl.hidden = true;
      if (chromaStepEl) chromaStepEl.hidden = true;
      return;
    }

    state.selectedDepth = state.selectedDepth || state.analysisDepthDecision;

    if (hasUndertoneDecision) {
      if (depthStepEl) depthStepEl.hidden = true;
      if (undertoneStepEl) undertoneStepEl.hidden = true;
      if (chromaStepEl) chromaStepEl.hidden = false;

      if (resetUndertoneBtn) {
        resetUndertoneBtn.hidden = false;
        resetUndertoneBtn.removeAttribute('hidden');
      }
      return;
    }

    if (depthStepEl) depthStepEl.hidden = true;
    if (undertoneStepEl) undertoneStepEl.hidden = false;
    if (chromaStepEl) chromaStepEl.hidden = true;

    if (resetDepthBtn) {
      resetDepthBtn.hidden = false;
      resetDepthBtn.removeAttribute('hidden');
    }
  }

  function updateCurrentPaletteName() {
    if (!currentPaletteNameEl) return;
    currentPaletteNameEl.textContent = getPaletteDisplayName(paletteSelect.value);
  }

  function setActivePanel(panel) {
    state.activePanel = panel === 'right' ? 'right' : 'left';

    activePanelButtons.forEach(function (btn) {
      const isActive = btn.dataset.panel === state.activePanel;
      btn.classList.toggle('is-active', isActive);
      btn.setAttribute('aria-pressed', isActive ? 'true' : 'false');
    });

    stagePanels.forEach(function (panelEl) {
      const isActive = panelEl.dataset.panel === state.activePanel;
      panelEl.classList.toggle('is-active-panel', isActive);
    });

    refreshAllSwatchHighlights();
    syncLipOpacityControl();
  }

  function syncColorLabels() {
    if (leftColorLabel) {
      if (state.depthLeft && depthStepEl && !depthStepEl.hidden) {
        leftColorLabel.textContent = state.depthLeft;
      } else {
        leftColorLabel.textContent = state.leftColorName || '—';
      }
    }

    if (rightColorLabel) {
      if (state.depthRight && depthStepEl && !depthStepEl.hidden) {
        rightColorLabel.textContent = state.depthRight;
      } else {
        rightColorLabel.textContent = state.rightColorName || '—';
      }
    }
  }

  function syncZoomSliders(value) {
    zoomSliders.forEach(function (slider) {
      slider.value = String(value);
    });
  }

  function syncZoomSliderBounds() {
    zoomSliders.forEach(function (slider) {
      slider.min = String(MIN_SCALE);
      slider.max = String(MAX_SCALE);
    });
  }

  function saveAnalysisSession() {
    try {
      const payload = {
  paletteCode: paletteSelect ? paletteSelect.value : '',
  photoSessionKey: state.photoSessionKey || '',
  activePanel: state.activePanel,
  leftColorHex: state.leftColorHex,
        rightColorHex: state.rightColorHex,
        leftColorName: state.leftColorName,
        rightColorName: state.rightColorName,
        selectedDepth: state.selectedDepth,
        selectedUndertoneLane: state.selectedUndertoneLane,
        analysisDepthDecision: state.analysisDepthDecision,
        analysisUndertoneDecision: state.analysisUndertoneDecision,
        analysisChromaDecision: state.analysisChromaDecision,
        analysisCompletedAt: state.analysisCompletedAt,
        analysisCurrentStep: state.analysisCurrentStep,
        analysisMode: state.analysisMode,
        comparison: state.comparison,
        grayscale: state.analysisMode === 'comparison' ? false : !!state.grayscale,
        analysisResult: state.analysisResult || {
          depth: '',
          undertone: '',
          chroma: '',
          resultCode: '',
          resultLabel: ''
        },
        lip: {
          leftColor: state.lip.leftColor,
          rightColor: state.lip.rightColor,
          leftOpacity: state.lip.leftOpacity,
          rightOpacity: state.lip.rightOpacity,
          leftVisible: state.lip.leftVisible,
          rightVisible: state.lip.rightVisible,
          closed: state.lip.closed,
          points: state.lip.points,
          shapes: getCompletedLipShapes(),
          activeShapeIndex: state.lip.activeShapeIndex || 0,
          showGuides: state.lip.showGuides
        }
      };

      sessionStorage.setItem(getAnalysisStorageKey(), JSON.stringify(payload));
      saveSharedLipSession();
    } catch (error) {
      console.warn('Could not save analysis session', error);
    }
  }
function getSharedLipStorageKey() {
  return 'ycs-shared-lip-state:' + (DEMO_CLIENT_ID ? 'demo:' + DEMO_CLIENT_ID : (CLIENT_RECORD_ID || CUSTOMER_ID || 'default'));
}

function saveSharedLipSession() {
  try {
    if (!state.lip || !Array.isArray(state.lip.points) || state.lip.points.length < 3) {
      return;
    }

    const payload = {
      photoSessionKey: state.photoSessionKey || '',
      lip: {
        leftColor: state.lip.leftColor,
        rightColor: state.lip.rightColor,
        leftOpacity: state.lip.leftOpacity,
        rightOpacity: state.lip.rightOpacity,
        leftVisible: state.lip.leftVisible,
        rightVisible: state.lip.rightVisible,
        closed: state.lip.closed,
        points: state.lip.points,
        shapes: getCompletedLipShapes(),
        activeShapeIndex: state.lip.activeShapeIndex || 0,
        showGuides: state.lip.showGuides
      }
    };

    sessionStorage.setItem(getSharedLipStorageKey(), JSON.stringify(payload));
  } catch (error) {
    console.warn('Could not save shared lip session', error);
  }
}

function loadSharedLipSession() {
  try {
    const raw = sessionStorage.getItem(getSharedLipStorageKey());
    return raw ? JSON.parse(raw) : null;
  } catch (error) {
    console.warn('Could not load shared lip session', error);
    return null;
  }
}

function applySharedLipState(shared) {
  if (!shared || !shared.lip) return;

  const lip = shared.lip;

  state.lip.leftColor = lip.leftColor || '';
  state.lip.rightColor = lip.rightColor || '';
  state.lip.leftOpacity = typeof lip.leftOpacity === 'number' ? lip.leftOpacity : 0.45;
  state.lip.rightOpacity = typeof lip.rightOpacity === 'number' ? lip.rightOpacity : 0.45;
  state.lip.leftVisible = lip.leftVisible !== false;
  state.lip.rightVisible = lip.rightVisible !== false;
  state.lip.shapes = Array.isArray(lip.shapes) ? lip.shapes.slice(0, 2) : [];
  if (state.lip.shapes.length) {
    state.lip.activeShapeIndex =
      typeof lip.activeShapeIndex === 'number' ? lip.activeShapeIndex : 0;
    const activeShape = state.lip.shapes[state.lip.activeShapeIndex] || state.lip.shapes[0];
    state.lip.points = Array.isArray(activeShape.points) ? activeShape.points : [];
    state.lip.closed = !!activeShape.closed;
  } else {
    state.lip.activeShapeIndex = 0;
    state.lip.closed = !!lip.closed;
    state.lip.points = Array.isArray(lip.points) ? lip.points : [];
  }
  state.lip.showGuides = lip.showGuides !== false;
}
  function syncLipOverlayToImage() {
    const pairs = [
      { frame: leftFrame, img: leftImg, svg: leftLipSvg, canvas: leftLipCanvas },
      { frame: rightFrame, img: rightImg, svg: rightLipSvg, canvas: rightLipCanvas }
    ];

    pairs.forEach(function (item) {
      if (!item.frame || !item.img) return;

      const frameRect = item.frame.getBoundingClientRect();
      const imgRect = item.img.getBoundingClientRect();

      const left = imgRect.left - frameRect.left;
      const top = imgRect.top - frameRect.top;
      const width = imgRect.width;
      const height = imgRect.height;

      if (item.svg) {
        item.svg.style.left = left + 'px';
        item.svg.style.top = top + 'px';
        item.svg.style.width = width + 'px';
        item.svg.style.height = height + 'px';
      }

      if (item.canvas) {
        item.canvas.style.left = left + 'px';
        item.canvas.style.top = top + 'px';
        item.canvas.style.width = width + 'px';
        item.canvas.style.height = height + 'px';

        const pixelWidth = Math.max(1, Math.round(width));
        const pixelHeight = Math.max(1, Math.round(height));

        if (item.canvas.width !== pixelWidth || item.canvas.height !== pixelHeight) {
          item.canvas.width = pixelWidth;
          item.canvas.height = pixelHeight;
        }
      }
    });
  }

  function refreshLipOverlayAfterLayout() {
    setLipVisibilityForCurrentStep();
    syncLipUiMode();
    syncLipOpacityControl();

    requestAnimationFrame(function () {
      syncLipOverlayToImage();

      requestAnimationFrame(function () {
        syncLipOverlayToImage();
        renderLips();
      });
    });
  }

  function exitLipEditingUi() {
    state.lip.editing = false;
    state.lip.adjusting = false;
    state.lip.dragIndex = -1;
    state.lip.dragSvg = null;
    state.lip.movingPhoto = false;

    if (lipMovePhotoBtn) {
      lipMovePhotoBtn.textContent = 'Move Photo';
    }

    appEl.classList.remove('is-lip-editing');
    appEl.classList.remove('is-lip-adjusting');
    syncLipEditingModeClass();
  }

  function syncLipEditingModeClass() {
    if (!guidedPanelEl) return;
    const lipEditingMode = state.lip.editing || state.lip.adjusting;
    guidedPanelEl.classList.toggle('is-lip-editing-mode', lipEditingMode);
  }

  function setLipPanelMode(mode) {
    if (!lipPanelEl) return;
    lipPanelEl.setAttribute('data-lip-mode', mode || 'none');
  }

  function forceHidden(el, shouldHide) {
    if (!el) return;
    el.hidden = !!shouldHide;
    if (shouldHide) {
      el.setAttribute('hidden', '');
      el.style.display = 'none';
    } else {
      el.removeAttribute('hidden');
      el.style.display = 'flex';
    }
  }

  function showLipEmptyModeNow() {
    forceHidden(lipEmptyMode, false);
    forceHidden(lipUseMode, true);
    forceHidden(lipEditMode, true);
    forceHidden(lipAdjustMode, true);

    setLipPanelMode('empty');

    state.lip.editing = false;
    state.lip.adjusting = false;
    state.lip.dragIndex = -1;
    state.lip.dragSvg = null;
    state.lip.movingPhoto = false;

    if (lipStatus) {
      lipStatus.textContent = 'Create a lip shape to test lip colors.';
    }

    appEl.classList.remove('is-lip-editing');
    appEl.classList.remove('is-lip-adjusting');
  }

  function clearLipMask() {
    state.lip.leftColor = '';
    state.lip.rightColor = '';
    state.lip.closed = false;
    state.lip.points = [];
    state.lip.shapes = [];
    state.lip.activeShapeIndex = 0;
    state.lip.dragIndex = -1;
    state.lip.dragSvg = null;
  }

  function resetLipStateForNewPhoto() {
  state.lip.leftColor = '';
  state.lip.rightColor = '';
  state.lip.leftOpacity = 0.45;
  state.lip.rightOpacity = 0.45;
  state.lip.leftVisible = true;
  state.lip.rightVisible = true;
  state.lip.editing = false;
  state.lip.adjusting = false;
  state.lip.movingPhoto = false;
  state.lip.closed = false;
  state.lip.points = [];
  state.lip.shapes = [];
  state.lip.activeShapeIndex = 0;
  state.lip.dragIndex = -1;
  state.lip.dragSvg = null;
  state.lip.showGuides = true;

  if (lipMovePhotoBtn) {
    lipMovePhotoBtn.textContent = 'Move Photo';
  }

  if (lipStatus) {
    lipStatus.textContent = 'Create a lip shape to test lip colors.';
  }

  appEl.classList.remove('is-lip-editing');
  appEl.classList.remove('is-lip-adjusting');
}

  function forceLipMode(mode) {
    const modes = [lipEmptyMode, lipUseMode, lipEditMode, lipAdjustMode];

    modes.forEach(function (el) {
      if (!el) return;
      el.hidden = true;
      el.setAttribute('hidden', '');
      el.style.display = 'none';
    });

    if (mode) {
      mode.hidden = false;
      mode.removeAttribute('hidden');
      mode.style.display = 'flex';
    }

    if (mode === lipEmptyMode) setLipPanelMode('empty');
    else if (mode === lipUseMode) setLipPanelMode('use');
    else if (mode === lipEditMode) setLipPanelMode('edit');
    else if (mode === lipAdjustMode) setLipPanelMode('adjust');
    else setLipPanelMode('none');
  }

  function syncLipUiMode() {
    const undertonesVisible = undertoneStepEl && !undertoneStepEl.hidden;
    const hasCompletedMask = state.lip.closed && state.lip.points.length >= 3;
    const isEditing = !!state.lip.editing;
    const isAdjusting = !!state.lip.adjusting;

    if (!isEditing && !isAdjusting && !hasCompletedMask && state.lip.points.length > 0) {
      state.lip.points = [];
      state.lip.shapes = [];
      state.lip.activeShapeIndex = 0;
      state.lip.closed = false;
    }

    if (!undertonesVisible) {
      forceLipMode(null);
      syncLipEditingModeClass();
      return;
    }

    if (isEditing) {
      forceLipMode(lipEditMode);
    } else if (isAdjusting) {
      forceLipMode(lipAdjustMode);
    } else if (hasCompletedMask) {
      forceLipMode(lipUseMode);
    } else {
      forceLipMode(lipEmptyMode);
    }

    if (lipVisibilityToggleBtn) {
      const isVisible = state.activePanel === 'right'
        ? state.lip.rightVisible
        : state.lip.leftVisible;

      lipVisibilityToggleBtn.textContent = isVisible ? 'Hide Lips' : 'Show Lips';
    }

    if (lipStatus) {
      if (isEditing && state.lip.points.length === 0) {
        lipStatus.textContent = 'Zoom in if needed. Click around the lips to place points.';
      } else if (isEditing && state.lip.points.length > 0) {
        lipStatus.textContent = 'Keep placing points. Click Finish Shape when it looks right.';
      } else if (isAdjusting) {
        lipStatus.textContent = 'Drag points to refine the lip shape, then click Done Editing.';
      } else if (hasCompletedMask) {
        lipStatus.textContent = 'Lip shape saved.';
      } else {
        lipStatus.textContent = 'Create a lip shape to test lip colors.';
      }
    }

    syncLipEditingModeClass();
  }

  function ensureLipEmptyModeVisible() {
    const undertonesVisible = undertoneStepEl && !undertoneStepEl.hidden;
    const hasCompletedMask = state.lip.closed && state.lip.points.length >= 3;
    const isEditing = !!state.lip.editing;
    const isAdjusting = !!state.lip.adjusting;

    if (undertonesVisible && !hasCompletedMask && !isEditing && !isAdjusting) {
      showLipEmptyModeNow();
    }
  }

  function updateLipActionButtons() {
    if (lipFinishBtn) {
      lipFinishBtn.disabled = !state.lip.editing || state.lip.points.length < 3;
    }

    if (lipUndoBtn) {
      lipUndoBtn.disabled =
        (!state.lip.editing && !state.lip.adjusting) || state.lip.points.length === 0;
    }

    if (lipClearBtn) {
      lipClearBtn.disabled = state.lip.points.length === 0;
    }

    if (lipAddShapeBtn) {
      const shapes = getCompletedLipShapes();
      lipAddShapeBtn.disabled = !state.lip.closed || shapes.length >= 2;
    }

    if (lipEditShape1Btn) {
      lipEditShape1Btn.disabled = !state.lip.shapes[0];
    }

    if (lipEditShape2Btn) {
      lipEditShape2Btn.disabled = !state.lip.shapes[1];
    }

    syncLipUiMode();
  }

  if (lipDoneBtn) {
    lipDoneBtn.onclick = function () {
      state.lip.editing = false;
      state.lip.adjusting = false;
      state.lip.dragIndex = -1;
      state.lip.dragSvg = null;
      state.lip.movingPhoto = false;

      if (lipMovePhotoBtn) {
        lipMovePhotoBtn.textContent = 'Move Photo';
      }

      appEl.classList.remove('is-lip-editing');
      appEl.classList.remove('is-lip-adjusting');

      if (lipStatus) {
        lipStatus.textContent = 'Lip shape saved.';
      }

      updateLipActionButtons();
      syncLipOpacityControl();
      renderLips();
      saveAnalysisSession();
      if (getCompletedLipShapes().length) {
        savePhotoTransform({ silent: true });
      }
    };
  }

  function currentImageTransform() {
    return 'translate(calc(-50% + ' + state.x + 'px), calc(-50% + ' + state.y + 'px)) scale(' + state.scale + ')';
  }

  function updateImageTransform() {
    const transform = currentImageTransform();

    leftImg.style.transform = transform;
    rightImg.style.transform = transform;

    const filterValue = shouldApplyGrayscale() ? 'grayscale(1)' : 'none';
    leftImg.style.filter = filterValue;
    leftImg.style.webkitFilter = filterValue;
    rightImg.style.filter = filterValue;
    rightImg.style.webkitFilter = filterValue;

    Array.from(document.querySelectorAll('.ycs-analysis-depth-photo')).forEach(function (img) {
      img.style.transform = transform;
      img.style.filter = filterValue;
      img.style.webkitFilter = filterValue;
    });

    requestAnimationFrame(syncLipOverlayToImage);
  }

  function applySavedTransform(transform) {
    const x = transform ? Number(transform.x) : NaN;
    const y = transform ? Number(transform.y) : NaN;
    const scale = transform ? Number(transform.scale) : NaN;

    if (
      transform &&
      Number.isFinite(x) &&
      Number.isFinite(y) &&
      Number.isFinite(scale)
    ) {
      state.x = x;
      state.y = y;
      state.scale = clampScale(scale);
    } else {
      state.x = 0;
      state.y = 0;
      state.scale = 1;
    }

    syncZoomSliders(state.scale);
    updateImageTransform();
  }

  function reapplyImageTransformAfterRender() {
    updateImageTransform();
    syncLipOverlayToImage();
    renderLips();
    requestAnimationFrame(function () {
      updateImageTransform();
      syncLipOverlayToImage();
      renderLips();
      requestAnimationFrame(function () {
        updateImageTransform();
        syncLipOverlayToImage();
        renderLips();
      });
    });
    window.setTimeout(function () {
      updateImageTransform();
      syncLipOverlayToImage();
      renderLips();
    }, 80);
  }

  function getAnalysisStatePayload() {
    return {
      analysisDepthDecision: state.analysisDepthDecision || '',
      analysisUndertoneDecision: state.analysisUndertoneDecision || '',
      analysisChromaDecision: state.analysisChromaDecision || '',
      analysisCompletedAt: state.analysisCompletedAt || '',
      analysisCurrentStep: state.analysisCurrentStep || 'depth'
    };
  }

  function applySavedAnalysisDecisions(transform) {
    if (!transform || typeof transform !== 'object') return;

    state.analysisDepthDecision = transform.analysisDepthDecision || '';
    state.analysisUndertoneDecision = transform.analysisUndertoneDecision || '';
    state.analysisChromaDecision = transform.analysisChromaDecision || '';
    state.analysisCompletedAt = transform.analysisCompletedAt || '';
    state.analysisCurrentStep = transform.analysisCurrentStep || (
      state.analysisChromaDecision
        ? 'complete'
        : state.analysisUndertoneDecision
          ? 'chroma'
          : state.analysisDepthDecision
            ? 'undertone'
            : 'depth'
    );

    if (state.analysisDepthDecision) {
      state.selectedDepth = state.analysisDepthDecision;
      state.analysisResult.depth = state.analysisDepthDecision;
    }

    if (state.analysisUndertoneDecision) {
      const labelToLane = {
        'Light Warm': 'light-warm',
        'Light Cool': 'light-cool',
        'Medium Warm': 'med-warm',
        'Medium Cool': 'med-cool',
        'Deep Warm': 'deep-warm',
        'Deep Cool': 'deep-cool'
      };
      state.selectedUndertoneLane = labelToLane[state.analysisUndertoneDecision] || state.selectedUndertoneLane;
      state.analysisResult.undertone = state.analysisUndertoneDecision;
    }

    if (state.analysisChromaDecision) {
      state.analysisResult.chroma = state.analysisChromaDecision;
      state.analysisResult.resultLabel = state.analysisChromaDecision;
    }
  }

  function updateDecisionSummary() {
    if (!decisionSummaryEl) return;

    const items = [
      state.analysisDepthDecision ? 'Depth: ' + state.analysisDepthDecision : '',
      state.analysisUndertoneDecision ? 'Undertone: ' + state.analysisUndertoneDecision : '',
      state.analysisChromaDecision ? 'Result: ' + state.analysisChromaDecision : ''
    ].filter(Boolean);

    decisionSummaryEl.hidden = !items.length || state.analysisMode !== 'structured';
    decisionSummaryEl.textContent = items.join(' • ');
  }

  function saveAnalysisProgress(options) {
    updateDecisionSummary();
    saveAnalysisSession();
    savePhotoTransform(Object.assign({ silent: true }, options || {}));
  }

  function getCompletedLipShapes() {
    const shapes = Array.isArray(state.lip.shapes) ? state.lip.shapes.slice() : [];

    if (state.lip.closed && Array.isArray(state.lip.points) && state.lip.points.length >= 3) {
      shapes[state.lip.activeShapeIndex || 0] = {
        points: state.lip.points,
        closed: true
      };
    }

    return shapes
      .filter(function (shape) {
        return shape && Array.isArray(shape.points) && shape.points.length >= 3;
      })
      .slice(0, 2);
  }

  function hasCompletedLipShapes(lip) {
    return !!(
      lip &&
      Array.isArray(lip.shapes) &&
      lip.shapes.some(function (shape) {
        return shape && Array.isArray(shape.points) && shape.points.length >= 3;
      })
    );
  }

  function setActiveLipShape(index) {
    const shape = state.lip.shapes[index];
    if (!shape || !Array.isArray(shape.points)) return;

    state.lip.activeShapeIndex = index;
    state.lip.points = shape.points.slice();
    state.lip.closed = !!shape.closed;
    state.lip.editing = false;
    state.lip.adjusting = true;
    state.lip.dragIndex = -1;
    state.lip.dragSvg = null;

    appEl.classList.remove('is-lip-editing');
    appEl.classList.add('is-lip-adjusting');

    if (lipStatus) {
      lipStatus.textContent = 'Editing lip shape ' + (index + 1) + '. Drag points to refine.';
    }

    updateLipActionButtons();
    renderLips();
  }

  async function savePhotoTransform(options) {
    options = options || {};
    const silent = !!options.silent;

    if (IS_FREE_ANALYSIS_DEMO) {
      const payload = {
        photoTransform: {
          x: state.x,
          y: state.y,
          scale: state.scale
        },
        analysisState: getAnalysisStatePayload(),
        lipMask: {
          shapes: getCompletedLipShapes()
        }
      };

      try {
        setStoredFreeTrialValue(DEMO_CLIENT_ID, 'transform', JSON.stringify(payload));
        if (!silent) alert('Position saved.');
      } catch (error) {
        if (!silent) alert(error.message || 'Could not save position');
      }
      return;
    }

    if (!ACTIVE_RECORD_ID) {
      if (!silent) alert(IS_DIY_MODE ? 'No saved photo found.' : 'No client record ID found.');
      return;
    }

    try {
      if (!silent) showLoading('Saving position…');

      const response = await fetch(APP_BASE_URL + '/api/save-photo-transform', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(
              CLIENT_RECORD_ID
            ? {
                clientRecordId: CLIENT_RECORD_ID,
                photoTransform: {
                  x: state.x,
                  y: state.y,
                  scale: state.scale
                },
                analysisState: getAnalysisStatePayload(),
                lipMask: {
                  shapes: getCompletedLipShapes()
                }
              }
            : {
                customerId: CUSTOMER_ID,
                photoId: PHOTO_ID,
                photoSource: PHOTO_SOURCE,
                photoTransform: {
                  x: state.x,
                  y: state.y,
                  scale: state.scale
                },
                analysisState: getAnalysisStatePayload(),
                lipMask: {
                  shapes: getCompletedLipShapes()
                }
              }
        )
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Could not save position');
      }

      if (!silent) {
        hideLoading();
        alert('Photo position saved.');
      }
    } catch (error) {
      if (!silent) hideLoading();
      console.error(error);
      if (!silent) alert(error.message || 'Could not save position.');
    }
  }

  async function restoreSavedPhotoPosition() {
    if (IS_FREE_ANALYSIS_DEMO) {
      const storedTransform = getStoredFreeTrialValue(DEMO_CLIENT_ID, 'transform');

      if (!storedTransform) {
        alert('No saved position found.');
        return;
      }

      try {
        const parsed = JSON.parse(storedTransform);
        if (!parsed.photoTransform) {
          alert('No saved position found.');
          return;
        }

        applySavedTransform(parsed.photoTransform);
        reapplyImageTransformAfterRender();
        alert('Saved position restored.');
      } catch (error) {
        console.warn('Could not restore trial transform', error);
        alert('Could not restore saved position.');
      }
      return;
    }

    if (!ACTIVE_RECORD_ID) {
      alert(IS_DIY_MODE ? 'No saved photo found.' : 'No client record ID found.');
      return;
    }

    try {
      showLoading('Restoring saved position...');

      const response = await fetch(
        CLIENT_RECORD_ID
          ? APP_BASE_URL + '/api/get-photo?clientRecordId=' + encodeURIComponent(CLIENT_RECORD_ID)
          : APP_BASE_URL +
            '/api/get-photo?customerId=' + encodeURIComponent(CUSTOMER_ID) +
            (PHOTO_ID ? '&photoId=' + encodeURIComponent(PHOTO_ID) : '') +
            (PHOTO_SOURCE ? '&photoSource=' + encodeURIComponent(PHOTO_SOURCE) : '')
      );
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Could not restore saved position');
      }

      if (!data || !data.photoTransform) {
        throw new Error('No saved position found.');
      }

      applySavedTransform(data.photoTransform);
      reapplyImageTransformAfterRender();
      hideLoading();
      alert('Saved position restored.');
    } catch (error) {
      hideLoading();
      console.error(error);
      alert(error.message || 'Could not restore saved position.');
    }
  }

  function applyDrapeColor(panel, hex, name) {
    const normalizedHex = normalizeHex(hex);
    if (!normalizedHex) return;

    if (panel === 'right') {
      state.rightColorHex = normalizedHex;
      state.rightColorName = name || 'Color';
      rightDrapePath.setAttribute('fill', normalizedHex);
      rightDrapePath.setAttribute('fill-opacity', '1');
      rightDrapePath.style.opacity = '1';
      syncDrapeLayer('right', normalizedHex);
    } else {
      state.leftColorHex = normalizedHex;
      state.leftColorName = name || 'Color';
      leftDrapePath.setAttribute('fill', normalizedHex);
      leftDrapePath.setAttribute('fill-opacity', '1');
      leftDrapePath.style.opacity = '1';
      syncDrapeLayer('left', normalizedHex);
    }

    syncColorLabels();
    refreshAllSwatchHighlights();
    saveAnalysisSession();
  }

  
  function refreshStandardSwatches() {
  const activeHex = state.activePanel === 'right'
    ? state.rightColorHex
    : state.leftColorHex;

  Array.from(swatchesEl.querySelectorAll('.ycs-analysis-swatch')).forEach(function (btn) {
    const btnHex = normalizeHex(btn.dataset.hex || '');
    btn.classList.toggle('is-active', btnHex === activeHex);
  });
}

function refreshGuidedSwatches() {
  const activeHex = state.activePanel === 'right'
    ? state.rightColorHex
    : state.leftColorHex;

  Array.from(undertoneSectionsEl.querySelectorAll('.ycs-analysis-guided-swatch')).forEach(function (btn) {
    const btnHex = normalizeHex(btn.dataset.hex || '');
    btn.classList.toggle('is-active', btnHex === activeHex);
  });
}

function refreshAllSwatchHighlights() {
  refreshStandardSwatches();
  refreshGuidedSwatches();
  refreshComparisonSwatches();
}

  function updateDrapeShape() {
    const d = window.innerWidth <= 900
      ? 'M0,255 Q140,182 305,198 Q500,355 695,198 Q860,182 1000,255 L1000,500 L0,500 Z'
      : 'M0,235 Q160,170 320,182 Q500,310 680,182 Q840,170 1000,235 L1000,500 L0,500 Z';

    leftDrapePath.setAttribute('d', d);
    rightDrapePath.setAttribute('d', d);
    syncDrapeLayers();
  }

  async function fetchPaletteColors(paletteCode) {
    try {
      if (isCustomPaletteCode(paletteCode) && !IS_ADMIN) {
        const match = getCustomPaletteOptions().find(function (palette) {
          return palette.code === paletteCode;
        });

        return ((match && match.colors) || []).map(function (join, index) {
          const color = join.color || {};
          return {
            name: color.name || 'Custom Color',
            hex: normalizeHex(color.hexCode),
            hexCode: normalizeHex(color.hexCode),
            sortOrder: Number(join.displayOrder) || index,
            category: color.category || ''
          };
        });
      }

      const query = new URLSearchParams({ palette: paletteCode });
      if (IS_ADMIN && isCustomPaletteCode(paletteCode)) {
        query.set('isAdmin', 'true');
      }
      const url = '/apps/palette-data?' + query.toString();
      const res = await fetch(url, { credentials: 'same-origin' });
      const data = await res.json();
      return Array.isArray(data.colors) ? data.colors : [];
    } catch (error) {
      console.error('Failed to load palette colors', error);
      return [];
    }
  }

  function getCategoryFromColor(color) {
    const raw =
      color.categories ||
      color.CategoryNames ||
      color.category ||
      color.categoryName ||
      '';

    if (Array.isArray(raw)) {
      return raw
        .map(function (item) {
          return String(item || '')
            .toLowerCase()
            .replace(/[^a-z\s]/g, ' ')
            .replace(/\s+/g, ' ')
            .trim();
        })
        .filter(Boolean);
    }

    return [
      String(raw || '')
        .toLowerCase()
        .replace(/[^a-z\s]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
    ].filter(Boolean);
  }

  function colorHasCategory(color, categoryName) {
    const categories = getCategoryFromColor(color);
    const normalized = String(categoryName || '')
      .toLowerCase()
      .replace(/[^a-z\s]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    return categories.some(function (category) {
      return category === normalized;
    });
  }

  async function ensureDrapingLipColorsLoaded() {
    if (state.drapingLipColors.length) {
      console.log('DRAPINGLIPCOLORS already loaded', state.drapingLipColors);
      return;
    }

    state.drapingLipColors = await fetchPaletteColors(DRAPING_LIP_PALETTE_CODE);
    console.log('DRAPINGLIPCOLORS fetched', state.drapingLipColors);
  }

  function getLipColorsForLane(lane) {
  if (!lane) return [];

  const parts = String(lane).split('-');
  const depthPart = parts[0] || '';
  const undertonePart = parts[1] || '';

  const targetDepths = depthPart === 'med'
    ? ['medium', 'med']
    : [depthPart];

  const matches = state.drapingLipColors
    .filter(function (color) {
      const categories = getCategoryFromColor(color);

      const hasDepth = categories.some(function (c) {
        return targetDepths.some(function (depthToken) {
          return c.includes(depthToken);
        });
      });

      const hasUndertone = categories.some(function (c) {
        return c.includes(undertonePart);
      });

      return hasDepth && hasUndertone;
    })
    .sort(function (a, b) {
      return Number(a.sortOrder || 0) - Number(b.sortOrder || 0);
    });

  return matches;
}

  if (lipVisibilityToggleBtn) {
    lipVisibilityToggleBtn.onclick = function () {
      if (state.activePanel === 'right') {
        state.lip.rightVisible = !state.lip.rightVisible;
      } else {
        state.lip.leftVisible = !state.lip.leftVisible;
      }

      syncLipUiMode();
      renderLips();
    };
  }

  function renderLipSwatches(warmColors, coolColors) {
    if (!lipSwatchContainer) return;

    lipSwatchContainer.innerHTML = '';

    function buildLipColumn(label, colors) {
      const col = document.createElement('div');
      col.className = 'ycs-analysis-undertone-column';

      const head = document.createElement('div');
      head.className = 'ycs-analysis-undertone-column-head';

      const labelEl = document.createElement('span');
      labelEl.className = 'ycs-analysis-undertone-label';
      labelEl.textContent = label;

      head.appendChild(labelEl);

      const grid = document.createElement('div');
      grid.className = 'ycs-analysis-guided-swatches';

      if (!colors || !colors.length) {
        const empty = document.createElement('div');
        empty.className = 'ycs-analysis-guided-empty';
        empty.textContent = 'No lip colors';
        col.appendChild(head);
        col.appendChild(empty);
        return col;
      }

      colors.forEach(function (color) {
        const hex = normalizeHex(color.hex || color.hexCode || color.colorHex || '');
        const name = color.name || color.colorName || color.title || 'Lip Color';
        if (!hex) return;

        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'ycs-analysis-guided-swatch';
        btn.style.background = hex;
        btn.title = name;
        btn.setAttribute('aria-label', name);

        btn.addEventListener('click', function () {
          if (state.activePanel === 'right') {
            state.lip.rightColor = hex;
            state.lip.rightVisible = true;
          } else {
            state.lip.leftColor = hex;
            state.lip.leftVisible = true;
          }

          syncLipUiMode();
          renderLips();
        });

        grid.appendChild(btn);
      });

      col.appendChild(head);
      col.appendChild(grid);
      return col;
    }

    const wrap = document.createElement('div');
    wrap.className = 'ycs-analysis-undertone-columns';

    wrap.appendChild(buildLipColumn('Warm', warmColors));
    wrap.appendChild(buildLipColumn('Cool', coolColors));

    lipSwatchContainer.appendChild(wrap);
  }

  function renderModeForPalette(paletteCode) {
    const guided = isDrapingPalette(paletteCode);
    guidedPanelEl.hidden = !guided;
    standardPanelEl.hidden = guided;
  }

  function getDepthDrapeImage(depth) {
    const map = {
      Light: 'https://cdn.shopify.com/s/files/1/0623/6284/5408/files/depth-wheel_LIGHT.png?v=1776258573',
      Medium: 'https://cdn.shopify.com/s/files/1/0623/6284/5408/files/depth-wheel_MEDIUM_44b8d0fc-28bb-41cd-b85f-bc4c24008c6c.png?v=1776258573',
      Deep: 'https://cdn.shopify.com/s/files/1/0623/6284/5408/files/depth-wheel_DEEP.png?v=1776258573'
    };
    return map[depth] || '';
  }

  function showDepthStageDrape(panel, depth) {
    const src = getDepthDrapeImage(depth);
    if (!src) return;

    if (panel === 'right') {
      state.depthRight = depth;
      rightDepthDrapeImg.src = src;
      rightDepthDrapeImg.hidden = false;
      rightDrapePath.style.visibility = 'visible';
      rightDrapePath.setAttribute('fill', '#ffffff');
      syncDrapeLayer('right', '#ffffff');
    } else {
      state.depthLeft = depth;
      leftDepthDrapeImg.src = src;
      leftDepthDrapeImg.hidden = false;
      leftDrapePath.style.visibility = 'visible';
      leftDrapePath.setAttribute('fill', '#ffffff');
      syncDrapeLayer('left', '#ffffff');
    }

    syncColorLabels();
  }

  function hideDepthStageDrapes() {
    state.depthLeft = '';
    state.depthRight = '';

    if (leftDepthDrapeImg) {
      leftDepthDrapeImg.hidden = true;
      leftDepthDrapeImg.removeAttribute('src');
    }

    if (rightDepthDrapeImg) {
      rightDepthDrapeImg.hidden = true;
      rightDepthDrapeImg.removeAttribute('src');
    }

    leftDrapePath.style.visibility = 'visible';
    rightDrapePath.style.visibility = 'visible';

    leftDrapePath.setAttribute('fill', state.leftColorHex || '#e8dfd4');
    rightDrapePath.setAttribute('fill', state.rightColorHex || '#e8dfd4');
    syncDrapeLayers();

    syncColorLabels();
  }

  function updatePhotoPrepLink() {
  if (!photoPrepLink) return;

  const returnUrl = window.location.pathname + window.location.search;
  const step = depthStepEl && !depthStepEl.hidden
    ? 'depth'
    : undertoneStepEl && !undertoneStepEl.hidden
      ? 'undertones'
      : chromaStepEl && !chromaStepEl.hidden
        ? 'chroma'
        : 'depth';

  const prepMode = IS_DIY_MODE ? 'diy' : 'trade';
  let hrefBase = '/pages/photo-prep?workflow=color-analysis&mode=' + encodeURIComponent(prepMode) + '&returnStep=' + encodeURIComponent(step);
  if (ADMIN_VIEW_AS) {
    hrefBase += '&viewAs=' + encodeURIComponent(ADMIN_VIEW_AS);
  }

  if (DEMO_CLIENT_ID) {
    photoPrepLink.href =
      hrefBase +
      '&demoClient=' + encodeURIComponent(DEMO_CLIENT_ID) +
      '&returnUrl=' + encodeURIComponent(returnUrl);
    return;
  }

  if (PHOTO_ID) {
    hrefBase += '&photoId=' + encodeURIComponent(PHOTO_ID);
  }

  if (PHOTO_SOURCE) {
    hrefBase += '&photoSource=' + encodeURIComponent(PHOTO_SOURCE);
  }

  if (CLIENT_RECORD_ID) {
    photoPrepLink.href =
      hrefBase +
      '&clientRecordId=' + encodeURIComponent(CLIENT_RECORD_ID) +
      '&returnUrl=' + encodeURIComponent(returnUrl);
    return;
  }

  if (ADMIN_CUSTOMER_ID) {
    photoPrepLink.href =
      hrefBase +
      '&adminCustomerId=' + encodeURIComponent(ADMIN_CUSTOMER_ID) +
      '&returnUrl=' + encodeURIComponent(returnUrl);
    return;
  }

  if (SIMPLE_CUSTOMER_ID) {
    photoPrepLink.href =
      hrefBase +
      '&customerId=' + encodeURIComponent(SIMPLE_CUSTOMER_ID) +
      '&returnUrl=' + encodeURIComponent(returnUrl);
    return;
  }

  if (VIEWER_CUSTOMER_ID) {
    photoPrepLink.href =
      hrefBase +
      '&customerId=' + encodeURIComponent(VIEWER_CUSTOMER_ID) +
      '&returnUrl=' + encodeURIComponent(returnUrl);
    return;
  }

  photoPrepLink.href =
    hrefBase + '&returnUrl=' + encodeURIComponent(returnUrl);
}

function updateBackLink() {
  if (!backBtn) return;

  if (IS_DIY_MODE) {
    backBtn.textContent = 'Photo Prep';
    backBtn.href = photoPrepLink ? photoPrepLink.href : appendAdminPreviewToHref('/pages/photo-prep?mode=diy&workflow=color-analysis');
    return;
  }

  backBtn.textContent = 'My Clients';
  backBtn.href = buildClientListHref();
}

  function getChromaDisplayLabel(lane, type) {
    const map = {
      'light-warm': { clear: 'Clear Warm Light', soft: 'Soft Warm Light' },
      'light-cool': { clear: 'Clear Cool Light', soft: 'Soft Cool Light' },
      'med-warm': { clear: 'Clear Warm Medium', soft: 'Soft Warm Medium' },
      'med-cool': { clear: 'Clear Cool Medium', soft: 'Soft Cool Medium' },
      'deep-warm': { clear: 'Clear Warm Deep', soft: 'Soft Warm Deep' },
      'deep-cool': { clear: 'Clear Cool Deep', soft: 'Soft Cool Deep' }
    };

    return map[lane] ? map[lane][type] : '';
  }

  function getChromaPairForLane(lane) {
    const map = {
      'light-warm': { clearCode: 'CWL', softCode: 'SWL' },
      'light-cool': { clearCode: 'CCL', softCode: 'SCL' },
      'med-warm': { clearCode: 'CWM', softCode: 'SWM' },
      'med-cool': { clearCode: 'CCM', softCode: 'SCM' },
      'deep-warm': { clearCode: 'CWD', softCode: 'SWD' },
      'deep-cool': { clearCode: 'CCD', softCode: 'SCD' }
    };
    return map[lane] || null;
  }

  function getLaneParts(lane) {
    const parts = String(lane || '').split('-');
    const depthPart = parts[0] || '';
    const undertonePart = parts[1] || '';

    return {
      depth: depthPart === 'med' ? 'Medium' : capitalize(depthPart),
      undertone: capitalize(undertonePart)
    };
  }

  function buildResultFromLaneAndChroma(lane, chroma) {
    const pair = getChromaPairForLane(lane);
    const laneParts = getLaneParts(lane);

    const result = {
      depth: laneParts.depth,
      undertone: laneParts.undertone,
      chroma: chroma,
      resultCode: '',
      resultLabel: ''
    };

    if (pair) {
      result.resultCode = chroma === 'Soft' ? pair.softCode : pair.clearCode;
    }

    result.resultLabel = chroma + ' ' + laneParts.undertone + ' ' + laneParts.depth;
    return result;
  }

  function getAnalysisStorageKey() {
    return 'ycs-analysis-state:' + (DEMO_CLIENT_ID ? 'demo:' + DEMO_CLIENT_ID : (CLIENT_RECORD_ID || CUSTOMER_ID || 'default'));
  }

  function loadAnalysisSession() {
    try {
      const raw = sessionStorage.getItem(getAnalysisStorageKey());
      if (!raw) return null;
      return JSON.parse(raw);
    } catch (error) {
      console.warn('Could not read analysis session', error);
      return null;
    }
  }

  function applySavedAnalysisState(saved) {
    if (!saved) return;

    state.activePanel = saved.activePanel === 'right' ? 'right' : 'left';

    state.leftColorHex = saved.leftColorHex || '';
    state.rightColorHex = saved.rightColorHex || '';
    state.leftColorName = saved.leftColorName || '';
    state.rightColorName = saved.rightColorName || '';

    state.selectedDepth = saved.selectedDepth || '';
    state.selectedUndertoneLane = saved.selectedUndertoneLane || '';
    state.analysisDepthDecision = saved.analysisDepthDecision || '';
    state.analysisUndertoneDecision = saved.analysisUndertoneDecision || '';
    state.analysisChromaDecision = saved.analysisChromaDecision || '';
    state.analysisCompletedAt = saved.analysisCompletedAt || '';
    state.analysisCurrentStep = saved.analysisCurrentStep || 'depth';
    state.analysisMode = saved.analysisMode === 'comparison' ? 'comparison' : 'structured';
    state.comparison = saved.comparison || state.comparison;
    state.grayscale = saved.analysisMode === 'comparison' ? false : !!saved.grayscale;

    state.analysisResult = saved.analysisResult || {
      depth: '',
      undertone: '',
      chroma: '',
      resultCode: '',
      resultLabel: ''
    };
    if (saved.lip) {
  state.lip.leftColor = saved.lip.leftColor || '';
  state.lip.rightColor = saved.lip.rightColor || '';
    state.lip.leftOpacity = typeof saved.lip.leftOpacity === 'number' ? saved.lip.leftOpacity : 0.45;
  state.lip.rightOpacity = typeof saved.lip.rightOpacity === 'number' ? saved.lip.rightOpacity : 0.45;
  state.lip.leftVisible = saved.lip.leftVisible !== false;
  state.lip.rightVisible = saved.lip.rightVisible !== false;

  const savedHasLipShapes = hasCompletedLipShapes(saved.lip);
  const currentHasLipShapes = getCompletedLipShapes().length > 0;

  if (savedHasLipShapes || !currentHasLipShapes) {
    state.lip.shapes = Array.isArray(saved.lip.shapes) ? saved.lip.shapes.slice(0, 2) : [];
    if (state.lip.shapes.length) {
      state.lip.activeShapeIndex =
        typeof saved.lip.activeShapeIndex === 'number' ? saved.lip.activeShapeIndex : 0;
      const activeShape = state.lip.shapes[state.lip.activeShapeIndex] || state.lip.shapes[0];
      state.lip.points = Array.isArray(activeShape.points) ? activeShape.points : [];
      state.lip.closed = !!activeShape.closed;
    } else {
      state.lip.activeShapeIndex = 0;
      state.lip.closed = !!saved.lip.closed;
      state.lip.points = Array.isArray(saved.lip.points) ? saved.lip.points : [];
    }
  }

  state.lip.showGuides = saved.lip.showGuides !== false;
}
    if (grayscaleToggle) {
      grayscaleToggle.checked = !!state.grayscale;
    }

    setActivePanel(state.activePanel);
    syncColorLabels();
    updateImageTransform();
    updateDecisionSummary();
  }

  async function restoreGuidedFlowFromSession() {
    const saved = loadAnalysisSession();
    if (!saved) return;

    if (
    state.photoSessionKey &&
    saved.photoSessionKey &&
    String(state.photoSessionKey) !== String(saved.photoSessionKey)
  ) {
    return;
  }

    if (saved.paletteCode && paletteSelect && paletteSelect.value !== saved.paletteCode) {
      paletteSelect.value = saved.paletteCode;
      updateCurrentPaletteName();
    }

    applySavedAnalysisState(saved);

    if (!isDrapingPalette(paletteSelect.value)) {
      hideDepthStageDrapes();
      refreshAllSwatchHighlights();
      return;
    }

    const shouldShowDepthStep =
      state.analysisCurrentStep === 'depth' || !state.selectedDepth;

    if (shouldShowDepthStep) {
      renderDepthStep();
      refreshAllSwatchHighlights();
      return;
    }

    hideDepthStageDrapes();

    if (state.selectedDepth) {
      const shouldReturnToChroma =
        state.selectedUndertoneLane &&
        state.analysisCurrentStep !== 'undertone' &&
        state.analysisCurrentStep !== 'depth';

      if (depthStepEl) depthStepEl.hidden = true;
      if (undertoneStepEl) undertoneStepEl.hidden = false;
      if (chromaStepEl) chromaStepEl.hidden = true;

      await renderUndertoneSections(state.selectedDepth);

      if (!state.selectedUndertoneLane || state.analysisCurrentStep === 'undertone') {
        showLipEmptyModeNow();
      }

      if (shouldReturnToChroma) {
        await renderChromaStep(state.selectedUndertoneLane);

        if (state.analysisResult && state.analysisResult.resultLabel) {
          if (chromaResultEl && chromaResultTextEl) {
            chromaResultEl.hidden = false;
            chromaResultTextEl.textContent = state.analysisResult.resultLabel;
          }

          const chosenLabel = state.analysisResult.resultLabel.toLowerCase();

          Array.from(document.querySelectorAll('.ycs-analysis-chroma-column .ycs-analysis-commit-btn'))
            .forEach(function (btn) {
              const col = btn.closest('.ycs-analysis-chroma-column');
              const labelEl = col ? col.querySelector('.ycs-analysis-chroma-label') : null;
              const label = labelEl ? labelEl.textContent.toLowerCase() : '';
              btn.classList.toggle('is-selected', label === chosenLabel);
            });
        }
      }
    }

    if (state.leftColorHex) {
      leftDrapePath.setAttribute('fill', state.leftColorHex);
    }

    if (state.rightColorHex) {
      rightDrapePath.setAttribute('fill', state.rightColorHex);
    }

    syncDrapeLayers();
    refreshAllSwatchHighlights();
  }

  async function restoreGuidedFlowFromDecisions() {
    if (!state.analysisDepthDecision) return false;

    if (depthStepEl) depthStepEl.hidden = true;
    if (undertoneStepEl) undertoneStepEl.hidden = false;
    if (chromaStepEl) chromaStepEl.hidden = true;

    state.selectedDepth = state.analysisDepthDecision;
    await renderUndertoneSections(state.selectedDepth);

    const shouldReturnToChroma =
      state.selectedUndertoneLane &&
      state.analysisCurrentStep !== 'undertone' &&
      state.analysisCurrentStep !== 'depth';

    if (shouldReturnToChroma) {
      await renderChromaStep(state.selectedUndertoneLane);
    }

    if (state.analysisChromaDecision && chromaResultEl && chromaResultTextEl) {
      chromaResultEl.hidden = false;
      chromaResultTextEl.textContent = state.analysisChromaDecision;
    }

    updateDecisionSummary();
    return true;
  }

  function commitAnalysisResult(lane, chroma) {
    const result = buildResultFromLaneAndChroma(lane, chroma);

    state.analysisResult.depth = result.depth;
    state.analysisResult.undertone = result.undertone;
    state.analysisResult.chroma = result.chroma;
    state.analysisResult.resultCode = result.resultCode;
    state.analysisResult.resultLabel = result.resultLabel;
    state.analysisChromaDecision = result.resultLabel;
    state.analysisCompletedAt = new Date().toISOString();
    state.analysisCurrentStep = 'complete';

    if (chromaResultEl && chromaResultTextEl) {
      chromaResultEl.hidden = false;
      chromaResultTextEl.textContent = state.analysisResult.resultLabel;
    }

    saveAnalysisProgress();
    saveClientColorType(result)
      .then(function () {
        if (chromaResultEl && chromaResultTextEl) {
          chromaResultEl.hidden = false;
          chromaResultTextEl.textContent = state.analysisResult.resultLabel + ' saved to client';
        }
      })
      .catch(function (error) {
        console.warn('Client color type save failed', error);
        if (chromaResultEl && chromaResultTextEl) {
          chromaResultEl.hidden = false;
          chromaResultTextEl.textContent = state.analysisResult.resultLabel + ' selected. Client color type could not be saved.';
        }
      });
  }

  function resetGuidedFlow() {
    state.selectedDepth = '';
    state.selectedUndertoneLane = '';
    state.analysisDepthDecision = '';
    state.analysisUndertoneDecision = '';
    state.analysisChromaDecision = '';
    state.analysisCompletedAt = '';
    state.analysisCurrentStep = 'depth';

    state.analysisResult.depth = '';
    state.analysisResult.undertone = '';
    state.analysisResult.chroma = '';
    state.analysisResult.resultCode = '';
    state.analysisResult.resultLabel = '';

    if (depthStepEl) depthStepEl.hidden = false;
    if (undertoneStepEl) undertoneStepEl.hidden = true;
    if (chromaStepEl) chromaStepEl.hidden = true;
    setFreeTrialLockVisible(false);

    if (depthSectionsEl) depthSectionsEl.innerHTML = '';
    if (undertoneSectionsEl) undertoneSectionsEl.innerHTML = '';
    if (chromaSectionsEl) chromaSectionsEl.innerHTML = '';

    if (chromaResultEl && chromaResultTextEl) {
      chromaResultEl.hidden = true;
      chromaResultTextEl.textContent = '—';
    }

    setLipVisibilityForCurrentStep();

    if (!isRestoringSession) {
      saveAnalysisProgress();
    }
  }

  function resetAnalysisForNewPhoto() {
  state.x = 0;
  state.y = 0;
  state.scale = 1;
  state.leftColorHex = '';
  state.rightColorHex = '';
  state.leftColorName = '';
  state.rightColorName = '';
  state.depthLeft = '';
  state.depthRight = '';
  state.activePanel = 'left';
  state.activeFilter = 'all';
  state.grayscale = false;

  if (grayscaleToggle) {
    grayscaleToggle.checked = false;
  }

  resetLipStateForNewPhoto();
  hideDepthStageDrapes();
  resetGuidedFlow();
  syncZoomSliders(state.scale);
  syncColorLabels();
  setActivePanel('left');
  setLipVisibilityForCurrentStep();
  syncLipUiMode();
  syncLipOpacityControl();
  renderLips();
}

  function createChromaSwatch(color) {
    const hex = normalizeHex(color.hex || color.hexCode || color.colorHex || '');
    const name = color.name || color.colorName || color.title || 'Color';

    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'ycs-analysis-guided-swatch';
    btn.style.background = hex;
    btn.dataset.hex = hex;
    btn.dataset.name = name;
    btn.setAttribute('aria-label', name);
    btn.title = name;

    btn.addEventListener('click', function () {
      applyDrapeColor(state.activePanel, hex, name);
    });

    return btn;
  }

  function isUndertoneStepVisible() {
    return !!(
      state.analysisMode !== 'comparison' &&
      undertoneStepEl &&
      !undertoneStepEl.hidden
    );
  }

  function isDepthStepVisible() {
    return !!(
      state.analysisMode !== 'comparison' &&
      depthStepEl &&
      !depthStepEl.hidden
    );
  }

  function shouldApplyGrayscale() {
    return !!state.grayscale && isDepthStepVisible();
  }

  function setLipVisibilityForCurrentStep() {
    const showLipsNow = isUndertoneStepVisible();

    if (leftLipSvg) leftLipSvg.style.display = showLipsNow ? '' : 'none';
    if (rightLipSvg) rightLipSvg.style.display = showLipsNow ? '' : 'none';

    if (leftLipCanvas) {
      leftLipCanvas.style.display = showLipsNow ? '' : 'none';
      if (!showLipsNow) {
        const ctx = leftLipCanvas.getContext('2d');
        ctx.clearRect(0, 0, leftLipCanvas.width, leftLipCanvas.height);
      }
    }

    if (rightLipCanvas) {
      rightLipCanvas.style.display = showLipsNow ? '' : 'none';
      if (!showLipsNow) {
        const ctx = rightLipCanvas.getContext('2d');
        ctx.clearRect(0, 0, rightLipCanvas.width, rightLipCanvas.height);
      }
    }
  }

  function createChromaColumn(fullLabel, colors, lane, chroma) {
    const col = document.createElement('div');
    col.className = 'ycs-analysis-chroma-column';

    const head = document.createElement('div');
    head.className = 'ycs-analysis-chroma-column-head';

    const labelEl = document.createElement('span');
    labelEl.className = 'ycs-analysis-chroma-label';
    labelEl.textContent = fullLabel;

    head.appendChild(labelEl);

    const grid = document.createElement('div');
    grid.className = 'ycs-analysis-guided-swatches';

    if (!colors.length) {
      const empty = document.createElement('div');
      empty.className = 'ycs-analysis-guided-empty';
      empty.textContent = 'No colors';
      col.appendChild(head);
      col.appendChild(empty);
      return col;
    }

    colors.forEach(function (color) {
      grid.appendChild(createChromaSwatch(color));
    });

    const actionRow = document.createElement('div');
    actionRow.className = 'ycs-analysis-commit-row';

    const chooseBtn = document.createElement('button');
    chooseBtn.type = 'button';
    chooseBtn.className = 'ycs-analysis-commit-btn';
    chooseBtn.textContent = 'Choose This Result';
    chooseBtn.addEventListener('click', function () {
      Array.from(document.querySelectorAll('.ycs-analysis-chroma-column .ycs-analysis-commit-btn'))
        .forEach(function (btn) {
          btn.classList.remove('is-selected');
        });

      chooseBtn.classList.add('is-selected');
      commitAnalysisResult(lane, chroma);
    });

    actionRow.appendChild(chooseBtn);

    col.appendChild(head);
    col.appendChild(grid);
    col.appendChild(actionRow);
    return col;
  }

  async function renderChromaStep(lane) {
    const pair = getChromaPairForLane(lane);
    renderLipSwatches([], []);
    if (!pair || !chromaStepEl || !chromaSectionsEl) return;

    state.selectedUndertoneLane = lane;

    const laneParts = getLaneParts(lane);
    state.analysisResult.depth = laneParts.depth;
    state.analysisResult.undertone = laneParts.undertone;
    state.analysisResult.chroma = '';
    state.analysisResult.resultCode = '';
    state.analysisResult.resultLabel = '';
    state.analysisUndertoneDecision = getLaneLabel(lane);
    state.analysisChromaDecision = '';
    state.analysisCompletedAt = '';
    state.analysisCurrentStep = 'chroma';
    exitLipEditingUi();
    saveAnalysisSession();

    if (undertoneStepEl) undertoneStepEl.hidden = true;

    chromaStepEl.hidden = false;
    if (resetUndertoneBtn) {
      resetUndertoneBtn.hidden = false;
      resetUndertoneBtn.removeAttribute('hidden');
    }
    setLipVisibilityForCurrentStep();
    chromaSectionsEl.innerHTML = '';
    updateLipActionButtons();

    if (chromaCopyEl) {
      chromaCopyEl.textContent = 'Now compare clear vs soft for ' + getLaneLabel(lane) + '.';
    }

    const drapingColors = state.currentPaletteColors.slice();

    const clearColors = drapingColors.filter(function (color) {
      const categories = getCategoryFromColor(color);
      return categories.some(function (c) {
        return c === pair.clearCode.toLowerCase();
      });
    });

    const softColors = drapingColors.filter(function (color) {
      const categories = getCategoryFromColor(color);
      return categories.some(function (c) {
        return c === pair.softCode.toLowerCase();
      });
    });

    const block = document.createElement('section');
    block.className = 'ycs-analysis-chroma-block';

    const cols = document.createElement('div');
    cols.className = 'ycs-analysis-chroma-columns';

    cols.appendChild(createChromaColumn(
      getChromaDisplayLabel(lane, 'clear'),
      clearColors,
      lane,
      'Clear'
    ));

    cols.appendChild(createChromaColumn(
      getChromaDisplayLabel(lane, 'soft'),
      softColors,
      lane,
      'Soft'
    ));

    block.appendChild(cols);
    chromaSectionsEl.appendChild(block);

    refreshGuidedSwatches();

    const colorsPanel = document.querySelector('.ycs-analysis-colors-panel');
    if (colorsPanel) colorsPanel.scrollTop = 0;
  }

  function renderFilterButtons() {
    const categorySet = new Set();

    state.currentPaletteColors.forEach(function (color) {
      const categories = getCategoryFromColor(color);
      categories.forEach(function (category) {
        if (category) categorySet.add(category);
      });
    });

    const categories = Array.from(categorySet);

    filtersEl.innerHTML = '';

    const filters = [{ key: 'all', label: 'All' }].concat(
      categories.map(function (category) {
        return {
          key: String(category).toLowerCase(),
          label: String(category)
        };
      })
    );

    filters.forEach(function (filter) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'ycs-analysis-filter';
      btn.dataset.filter = filter.key;
      btn.textContent = filter.label;

      if (filter.key === state.activeFilter) {
        btn.classList.add('is-active');
      }

      btn.addEventListener('click', function () {
        state.activeFilter = filter.key;

        Array.from(filtersEl.querySelectorAll('.ycs-analysis-filter')).forEach(function (el) {
          el.classList.remove('is-active');
        });

        btn.classList.add('is-active');
        renderFilteredSwatches();
      });

      filtersEl.appendChild(btn);
    });

    window.setTimeout(updateFilterArrows, 40);
  }

  function renderFilteredSwatches() {
    swatchesEl.innerHTML = '';

    let colors = state.currentPaletteColors.slice().sort(function (a, b) {
      return Number(a.sortOrder || 0) - Number(b.sortOrder || 0);
    });

    if (state.activeFilter !== 'all') {
      colors = colors.filter(function (color) {
        const categories = getCategoryFromColor(color);
        return categories.some(function (category) {
          return String(category).toLowerCase() === state.activeFilter;
        });
      });
    }

    if (!colors.length) {
      swatchesEl.innerHTML = '<p class="ycs-analysis-empty">No colors found</p>';
      return;
    }

    colors.forEach(function (color) {
      const hex = normalizeHex(color.hex || color.hexCode || color.colorHex || '');
      const name = color.name || color.colorName || color.title || 'Color';

      if (!hex) return;

      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'ycs-analysis-swatch';
      btn.style.background = hex;
      btn.dataset.hex = hex;
      btn.dataset.name = name;
      btn.setAttribute('aria-label', name);
      btn.title = name;

      btn.addEventListener('click', function () {
        applyDrapeColor(state.activePanel, hex, name);
      });

      swatchesEl.appendChild(btn);
    });

    autoApplyFirstColorIfNeeded();
    refreshStandardSwatches();
  }

  function groupUndertoneColors(colors) {
    const buckets = {
      Light: { warm: [], cool: [] },
      Medium: { warm: [], cool: [] },
      Deep: { warm: [], cool: [] }
    };

    colors.forEach(function (color) {
      const categories = getCategoryFromColor(color);

      const hasLight = categories.some(function (c) { return c.includes('light'); });
      const hasMedium = categories.some(function (c) { return c.includes('medium') || c.includes('med'); });
      const hasDeep = categories.some(function (c) { return c.includes('deep'); });
      const hasWarm = categories.some(function (c) { return c.includes('warm'); });
      const hasCool = categories.some(function (c) { return c.includes('cool'); });

      if (hasLight && hasWarm) buckets.Light.warm.push(color);
      if (hasLight && hasCool) buckets.Light.cool.push(color);

      if (hasMedium && hasWarm) buckets.Medium.warm.push(color);
      if (hasMedium && hasCool) buckets.Medium.cool.push(color);

      if (hasDeep && hasWarm) buckets.Deep.warm.push(color);
      if (hasDeep && hasCool) buckets.Deep.cool.push(color);
    });

    Object.keys(buckets).forEach(function (depth) {
      buckets[depth].warm.sort(function (a, b) {
        return Number(a.sortOrder || 0) - Number(b.sortOrder || 0);
      });
      buckets[depth].cool.sort(function (a, b) {
        return Number(a.sortOrder || 0) - Number(b.sortOrder || 0);
      });
    });

    return buckets;
  }

  function createGuidedSwatch(color) {
    const hex = normalizeHex(color.hex || color.hexCode || color.colorHex || '');
    const name = color.name || color.colorName || color.title || 'Color';

    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'ycs-analysis-guided-swatch';
    btn.style.background = hex;
    btn.dataset.hex = hex;
    btn.dataset.name = name;
    btn.setAttribute('aria-label', name);
    btn.title = name;

    btn.addEventListener('click', function () {
      applyDrapeColor(state.activePanel, hex, name);
    });

    return btn;
  }

  function createUndertoneColumn(label, lane, colors) {
    const col = document.createElement('div');
    col.className = 'ycs-analysis-undertone-column';

    const head = document.createElement('div');
    head.className = 'ycs-analysis-undertone-column-head';

    const labelEl = document.createElement('span');
    labelEl.className = 'ycs-analysis-undertone-label';
    labelEl.textContent = label;

    head.appendChild(labelEl);

    const grid = document.createElement('div');
    grid.className = 'ycs-analysis-guided-swatches';

    if (!colors.length) {
      const empty = document.createElement('div');
      empty.className = 'ycs-analysis-guided-empty';
      empty.textContent = 'No colors';
      col.appendChild(head);
      col.appendChild(empty);
      return col;
    }

    colors.forEach(function (color) {
      grid.appendChild(createGuidedSwatch(color));
    });

    const commitRow = document.createElement('div');
    commitRow.className = 'ycs-analysis-commit-row';

    const commitBtn = document.createElement('button');
    commitBtn.type = 'button';
    commitBtn.className = 'ycs-analysis-commit-btn';
    commitBtn.textContent = 'Continue with ' + getLaneLabel(lane);
    commitBtn.addEventListener('click', function () {
      state.analysisUndertoneDecision = getLaneLabel(lane);
      state.analysisChromaDecision = '';
      state.analysisCompletedAt = '';
      state.analysisCurrentStep = 'chroma';
      saveAnalysisProgress();
      renderChromaStep(lane);
    });

    commitRow.appendChild(commitBtn);

    col.appendChild(head);
    col.appendChild(grid);
    col.appendChild(commitRow);
    return col;
  }

  async function renderUndertoneSections(selectedDepth) {
    await ensureDrapingLipColorsLoaded();

    const grouped = groupUndertoneColors(state.currentPaletteColors);
    undertoneSectionsEl.innerHTML = '';

    const depthKey = selectedDepth || state.selectedDepth;
    if (!depthKey || !grouped[depthKey]) return;

    const block = document.createElement('section');
    block.className = 'ycs-analysis-undertone-block';

    const title = document.createElement('h3');
    title.className = 'ycs-analysis-undertone-depth';
    title.textContent = depthKey + ' Color Drapes';

    const cols = document.createElement('div');
    cols.className = 'ycs-analysis-undertone-columns';

    const lanePrefix = depthKey.toLowerCase() === 'medium' ? 'med' : depthKey.toLowerCase();

    cols.appendChild(createUndertoneColumn('Warm', lanePrefix + '-warm', grouped[depthKey].warm));
    cols.appendChild(createUndertoneColumn('Cool', lanePrefix + '-cool', grouped[depthKey].cool));

    block.appendChild(title);
    block.appendChild(cols);
    undertoneSectionsEl.appendChild(block);

    const warmLane = lanePrefix + '-warm';
    const coolLane = lanePrefix + '-cool';

    const warmLipColors = getLipColorsForLane(warmLane);
    const coolLipColors = getLipColorsForLane(coolLane);

    renderLipSwatches(warmLipColors, coolLipColors);

    autoApplyFirstGuidedColorsIfNeeded();
    refreshGuidedSwatches();
  }

  function autoApplyFirstGuidedColorsIfNeeded() {
    const firstSwatch = undertoneSectionsEl.querySelector('.ycs-analysis-guided-swatch');
    if (!firstSwatch) return;

    if (!state.leftColorHex) {
      applyDrapeColor('left', firstSwatch.dataset.hex, firstSwatch.dataset.name);
    }

    if (!state.rightColorHex) {
      applyDrapeColor('right', firstSwatch.dataset.hex, firstSwatch.dataset.name);
    }
  }

  function autoApplyFirstColorIfNeeded() {
    const firstSwatch = swatchesEl.querySelector('.ycs-analysis-swatch');
    if (!firstSwatch) return;

    if (!state.leftColorHex) {
      applyDrapeColor('left', firstSwatch.dataset.hex, firstSwatch.dataset.name);
    }

    if (!state.rightColorHex) {
      applyDrapeColor('right', firstSwatch.dataset.hex, firstSwatch.dataset.name);
    }
  }

  function getDepthSwatchColor(depth) {
    const map = {
      Light: '#d9d9d9',
      Medium: '#7a7a7a',
      Deep: '#2f2f2f'
    };
    return map[depth] || '#cccccc';
  }

  function createDepthCard(depth) {
    const card = document.createElement('div');
    card.className = 'ycs-analysis-depth-card';

    const swatch = document.createElement('button');
    swatch.type = 'button';
    swatch.className = 'ycs-analysis-depth-swatch';
    swatch.style.background = getDepthSwatchColor(depth);
    swatch.setAttribute('aria-label', 'Apply ' + depth + ' depth drape');
    swatch.title = depth;

    swatch.addEventListener('click', function () {
      showDepthStageDrape(state.activePanel, depth);

      Array.from(document.querySelectorAll('.ycs-analysis-depth-swatch')).forEach(function (el) {
        el.classList.remove('is-selected');
      });

      swatch.classList.add('is-selected');
    });

    const meta = document.createElement('div');
    meta.className = 'ycs-analysis-depth-meta';

    const label = document.createElement('div');
    label.className = 'ycs-analysis-depth-label';
    label.textContent = depth;

    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'ycs-analysis-commit-btn';
    btn.textContent = 'Choose ' + depth;
    btn.addEventListener('click', function () {
      selectDepth(depth);
    });

    meta.appendChild(label);
    meta.appendChild(btn);

    card.appendChild(swatch);
    card.appendChild(meta);
    return card;
  }

  function renderDepthStep() {
    if (!depthStepEl || !depthSectionsEl) return;
    renderLipSwatches([], []);
    depthStepEl.hidden = false;
    undertoneStepEl.hidden = true;
    chromaStepEl.hidden = true;
    setFreeTrialLockVisible(false);

    depthSectionsEl.innerHTML = '';

    ['Light', 'Medium', 'Deep'].forEach(function (depth) {
      depthSectionsEl.appendChild(createDepthCard(depth));
    });

    updateImageTransform();

    if (!state.depthLeft && !state.depthRight) {
      showDepthStageDrape('left', 'Light');
      showDepthStageDrape('right', 'Medium');
    }

    updateLipActionButtons();
  }

  async function selectDepth(depth) {
    state.selectedDepth = depth;
    state.analysisResult.depth = depth;
    state.analysisDepthDecision = depth;
    state.analysisUndertoneDecision = '';
    state.analysisChromaDecision = '';
    state.analysisCompletedAt = '';
    state.analysisCurrentStep = 'undertone';

    state.grayscale = false;
    if (grayscaleToggle) grayscaleToggle.checked = false;

    hideDepthStageDrapes();
    updateImageTransform();

    if (depthStepEl) depthStepEl.hidden = true;
    if (undertoneStepEl) undertoneStepEl.hidden = false;
    if (chromaStepEl) chromaStepEl.hidden = true;
    setLipVisibilityForCurrentStep();

    await renderUndertoneSections(depth);

setLipVisibilityForCurrentStep();
syncLipUiMode();
syncLipOpacityControl();
renderLips();

requestAnimationFrame(function () {
  setLipVisibilityForCurrentStep();
  syncLipUiMode();
  syncLipOpacityControl();
  renderLips();
});

    syncColorLabels();
    updateLipActionButtons();
    ensureLipEmptyModeVisible();
    saveAnalysisProgress();
  }

  function updateFilterArrows() {
    if (!filtersEl || !filterLeftBtn || !filterRightBtn) return;

    const scrollLeft = filtersEl.scrollLeft;
    const maxScrollLeft = filtersEl.scrollWidth - filtersEl.clientWidth;
    const canScroll = maxScrollLeft > 2;

    if (!canScroll) {
      filterLeftBtn.classList.add('is-hidden');
      filterRightBtn.classList.add('is-hidden');
      filtersEl.classList.remove('has-left-fade', 'has-right-fade');
      return;
    }

    if (scrollLeft <= 2) {
      filterLeftBtn.classList.add('is-hidden');
      filtersEl.classList.remove('has-left-fade');
    } else {
      filterLeftBtn.classList.remove('is-hidden');
      filtersEl.classList.add('has-left-fade');
    }

    if (scrollLeft >= maxScrollLeft - 2) {
      filterRightBtn.classList.add('is-hidden');
      filtersEl.classList.remove('has-right-fade');
    } else {
      filterRightBtn.classList.remove('is-hidden');
      filtersEl.classList.add('has-right-fade');
    }
  }

  async function renderPaletteUI(paletteCode) {
    showSwatchLoading();

    state.activeFilter = 'all';
    state.currentPaletteColors = await fetchPaletteColors(paletteCode);
    if (isDrapingPalette(paletteCode)) {
      await ensureDrapingLipColorsLoaded();
    }

    renderModeForPalette(paletteCode);
    resetGuidedFlow();

    if (isDrapingPalette(paletteCode)) {
      renderDepthStep();
      filtersEl.innerHTML = '';
      swatchesEl.innerHTML = '';
      renderLipSwatches([], []);
    } else {
      renderFilterButtons();
      renderFilteredSwatches();
      undertoneSectionsEl.innerHTML = '';
      renderLipSwatches([], []);
    }

    hideSwatchLoading();
  }

  function loadSingleImage(imgEl, src) {
  return new Promise(function (resolve, reject) {
    imgEl.onload = function () { resolve(); };
    imgEl.onerror = function () { reject(new Error('Image failed to load')); };

    imgEl.crossOrigin = 'anonymous';
    imgEl.src = src;
  });
}

  async function loadPhotoIntoPanels(src) {
    state.loadedImageUrl = src;

    await Promise.all([
      loadSingleImage(leftImg, src),
      loadSingleImage(rightImg, src)
    ]);

    leftImg.classList.add('is-visible');
    rightImg.classList.add('is-visible');

    state.imgLoaded = true;
    requestAnimationFrame(syncLipOverlayToImage);
  }

  async function fetchSavedPhoto() {
  if (IS_FREE_ANALYSIS_DEMO) {
    const demoClient = getFreeTrialClient(DEMO_CLIENT_ID);
    if (!demoClient) {
      alert(IS_FREE_DIY_CATOOL ? 'Demo photo was not found.' : 'Trial client was not found.');
      return null;
    }

    showLoading(IS_FREE_DIY_CATOOL ? 'Loading demo photo…' : 'Loading trial photo…');

    try {
      const adjustedUrl = getStoredFreeTrialValue(DEMO_CLIENT_ID, 'adjusted');
      const activePhotoUrl = adjustedUrl || demoClient.photoUrl;
      state.clientFirstName = demoClient.firstName || '';
      state.clientLastName = demoClient.lastName || '';
      await loadPhotoIntoPanels(activePhotoUrl);

      const storedTransform = getStoredFreeTrialValue(DEMO_CLIENT_ID, 'transform');
      if (storedTransform) {
        try {
          const parsed = JSON.parse(storedTransform);
          applySavedTransform(parsed.photoTransform || null);
          applySavedAnalysisDecisions(parsed.analysisState || parsed.photoTransform || null);

          if (parsed.lipMask) {
            if (Array.isArray(parsed.lipMask.shapes) && parsed.lipMask.shapes.length) {
              state.lip.shapes = parsed.lipMask.shapes.slice(0, 2);
              state.lip.activeShapeIndex = 0;
              const activeShape = state.lip.shapes[0] || {};
              state.lip.points = Array.isArray(activeShape.points) ? activeShape.points : [];
              state.lip.closed = !!activeShape.closed;
              state.lip.editing = false;
              state.lip.adjusting = false;
              state.lip.showGuides = true;
              appEl.classList.remove('is-lip-editing');
              appEl.classList.remove('is-lip-adjusting');
              syncLipUiMode();
              syncLipOpacityControl();
              renderLips();
            }
          }
        } catch (parseError) {
          console.warn('Could not restore trial transform', parseError);
        }
      }

      hideLoading();
      return {
        activePhotoUrl: activePhotoUrl,
        activePhotoSessionKey: 'demo:' + DEMO_CLIENT_ID + ':' + activePhotoUrl
      };
    } catch (error) {
      console.error('Failed to load demo photo', error);
      hideLoading();
      alert(error.message || (IS_FREE_DIY_CATOOL ? 'Could not load the demo photo.' : 'Could not load the trial photo.'));
      return null;
    }
  }

  if (!ACTIVE_RECORD_ID) {
    alert(IS_DIY_MODE ? 'No saved photo found.' : 'No client record ID found.');
    return;
  }

  showLoading('Loading photo…');

  try {
    const res = await fetch(
      CLIENT_RECORD_ID
        ? APP_BASE_URL + '/api/get-photo?clientRecordId=' + encodeURIComponent(CLIENT_RECORD_ID)
        : APP_BASE_URL +
          '/api/get-photo?customerId=' + encodeURIComponent(CUSTOMER_ID) +
          (PHOTO_ID ? '&photoId=' + encodeURIComponent(PHOTO_ID) : '') +
          (PHOTO_SOURCE ? '&photoSource=' + encodeURIComponent(PHOTO_SOURCE) : '')
    );
    const data = await res.json();

    if (!res.ok) {
      throw new Error(data.error || 'Could not load photo');
    }

    if (!data || !data.activePhotoUrl) {
      throw new Error(IS_DIY_MODE ? 'No saved photo found.' : 'No saved photo found for this client.');
    }

    rememberLastAnalysisClient();
    await loadPhotoIntoPanels(data.activePhotoUrl);
state.clientFirstName = data.firstName || state.clientFirstName || '';
state.clientLastName = data.lastName || state.clientLastName || '';
if (!HAS_NEW_PHOTO_FLAG) {
  applySavedTransform(data.photoTransform || null);
}
applySavedAnalysisDecisions(data.photoTransform || null);

if (data.lipMask) {
  if (Array.isArray(data.lipMask.shapes) && data.lipMask.shapes.length) {
    state.lip.shapes = data.lipMask.shapes.slice(0, 2);
    state.lip.activeShapeIndex = 0;
    const activeShape = state.lip.shapes[0] || {};
    state.lip.points = Array.isArray(activeShape.points) ? activeShape.points : [];
    state.lip.closed = !!activeShape.closed;
  } else if (Array.isArray(data.lipMask.points)) {
    state.lip.shapes = [
      {
        points: data.lipMask.points,
        closed: !!data.lipMask.closed
      }
    ];
    state.lip.activeShapeIndex = 0;
    state.lip.points = data.lipMask.points;
    state.lip.closed = !!data.lipMask.closed;
  }

  if (state.lip.shapes.length) {
    state.lip.editing = false;
    state.lip.adjusting = false;
    state.lip.showGuides = true;
    appEl.classList.remove('is-lip-editing');
    appEl.classList.remove('is-lip-adjusting');
  }

  syncLipUiMode();
  syncLipOpacityControl();
  renderLips();
}

hideLoading();
return data;
  } catch (error) {
    console.error('Failed to load saved photo', error);
hideLoading();
alert(error.message || 'Could not load the saved photo.');
return null;
  }
}

  async function loadImage(src) {
    return new Promise(function (resolve, reject) {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = function () { resolve(img); };
      img.onerror = function () { reject(new Error('Image failed to load')); };
      img.src = src;
    });
  }

  function slugifyFilePart(value, fallback) {
    const slug = String(value || '')
      .trim()
      .toLowerCase()
      .replace(/&/g, ' and ')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');

    return slug || fallback;
  }

  function getExportColorName(panel) {
    const isRight = panel === 'right';
    if (depthStepEl && !depthStepEl.hidden) {
      return isRight ? state.depthRight : state.depthLeft;
    }

    return isRight ? state.rightColorName : state.leftColorName;
  }

  function getClientNameForExport() {
    const demoClient = DEMO_CLIENT_ID ? getFreeTrialClient(DEMO_CLIENT_ID) : null;
    return {
      firstName: state.clientFirstName || (demoClient && demoClient.firstName) || 'client',
      lastName: state.clientLastName || (demoClient && demoClient.lastName) || 'photo'
    };
  }

  function buildDrapedExportFileName(colorName) {
    const clientName = getClientNameForExport();
    const color = slugifyFilePart(colorName, 'color');
    const firstName = slugifyFilePart(clientName.firstName, 'client');
    const lastName = slugifyFilePart(clientName.lastName, 'photo');

    return color + '-' + firstName + '-' + lastName + '.png';
  }

  async function getCanvasSafeImageUrl(src) {
    const imageUrl = String(src || '').trim();
    if (!imageUrl || !APP_BASE_URL) return imageUrl;
    if (/^(data|blob):/i.test(imageUrl)) return imageUrl;

    try {
      const response = await fetch(APP_BASE_URL + '/api/proxy-image?url=' + encodeURIComponent(imageUrl));
      const data = await response.json().catch(function () {
        return {};
      });

      if (response.ok && data.imageBase64) {
        return data.imageBase64;
      }
    } catch (error) {
      console.warn('Could not proxy image for export canvas:', error);
    }

    return imageUrl;
  }

  function isCanvasExportSafe(canvas) {
    if (!canvas) return false;

    try {
      const ctx = canvas.getContext('2d');
      ctx.getImageData(0, 0, 1, 1);
      return true;
    } catch (error) {
      console.warn('Canvas layer is not export-safe:', error);
      return false;
    }
  }

  function drawExportLipFallback(ctx, drawX, drawY, drawWidth, drawHeight, lipColor, lipOpacity) {
    const shapes = getCompletedLipShapes();
    if (!Array.isArray(shapes) || !shapes.length || !lipColor) return;

    ctx.save();
    ctx.translate(drawX, drawY);
    ctx.scale(drawWidth / 1000, drawHeight / 1000);
    ctx.globalAlpha = Math.min(Math.max(Number(lipOpacity) || 0.45, 0), 1);
    ctx.fillStyle = lipColor;

    shapes.forEach(function (shape) {
      if (!shape || !Array.isArray(shape.points) || shape.points.length < 3) return;
      ctx.fill(new Path2D(buildSmoothClosedPath(shape.points, true)));
    });

    ctx.restore();
  }

  async function saveDrapedImageForReport(payload) {
    if (!APP_BASE_URL || (!CLIENT_RECORD_ID && !CUSTOMER_ID)) {
      return null;
    }

    const response = await fetch(APP_BASE_URL + '/api/save-draped-image', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    const data = await response.json().catch(function () {
      return {};
    });

    if (!response.ok) {
      throw new Error(data.error || 'Could not save draped image');
    }

    return data.image || null;
  }

  function shouldDrawExportColorLabel(panel) {
    const toggle = panel === 'right' ? exportLabelRightToggle : exportLabelLeftToggle;
    return !toggle || toggle.checked;
  }

  function drawExportColorLabel(ctx, frameWidth, frameHeight, colorName, panel) {
    if (!(IS_TRADE || IS_ADMIN || IS_CATOOL || IS_CATOOL_GROWTH)) return;
    if (!shouldDrawExportColorLabel(panel)) return;

    const label = String(colorName || '').trim();
    if (!label) return;

    const fontSize = Math.max(12, Math.round(frameWidth * 0.032));
    const paddingX = Math.round(fontSize * 0.9);
    const paddingY = Math.round(fontSize * 0.42);
    const y = frameHeight - Math.round(fontSize * 1.15);

    ctx.save();
    ctx.font = '700 ' + fontSize + 'px Arial, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    const textWidth = ctx.measureText(label).width;
    const pillWidth = Math.min(frameWidth - 24, textWidth + paddingX * 2);
    const pillHeight = fontSize + paddingY * 2;
    const pillX = (frameWidth - pillWidth) / 2;
    const pillY = y - pillHeight / 2;
    const radius = pillHeight / 2;

    ctx.fillStyle = 'rgba(255, 255, 255, 0.82)';
    ctx.beginPath();
    ctx.moveTo(pillX + radius, pillY);
    ctx.lineTo(pillX + pillWidth - radius, pillY);
    ctx.quadraticCurveTo(pillX + pillWidth, pillY, pillX + pillWidth, pillY + radius);
    ctx.lineTo(pillX + pillWidth, pillY + pillHeight - radius);
    ctx.quadraticCurveTo(pillX + pillWidth, pillY + pillHeight, pillX + pillWidth - radius, pillY + pillHeight);
    ctx.lineTo(pillX + radius, pillY + pillHeight);
    ctx.quadraticCurveTo(pillX, pillY + pillHeight, pillX, pillY + pillHeight - radius);
    ctx.lineTo(pillX, pillY + radius);
    ctx.quadraticCurveTo(pillX, pillY, pillX + radius, pillY);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = '#222222';
    ctx.fillText(label, frameWidth / 2, y);
    ctx.restore();
  }

  async function downloadPanelView(panel) {
    if (!state.imgLoaded || !state.loadedImageUrl) {
      alert('No photo loaded.');
      return;
    }

    const isRight = panel === 'right';
    const frameEl = isRight ? rightFrame : leftFrame;
    const drapePathEl = isRight ? rightDrapePath : leftDrapePath;
    const colorName = getExportColorName(panel);
    const drapeColorHex = isRight ? state.rightColorHex : state.leftColorHex;
    const lipColorHex = isRight ? state.lip.rightColor : state.lip.leftColor;

    try {
      const frameRect = frameEl.getBoundingClientRect();
      const frameWidth = Math.round(frameRect.width);
      const frameHeight = Math.round(frameRect.height);

      const canvas = document.createElement('canvas');
      canvas.width = frameWidth * 2;
      canvas.height = frameHeight * 2;

      const ctx = canvas.getContext('2d');
      ctx.scale(2, 2);

      const canvasSafePhotoUrl = await getCanvasSafeImageUrl(state.loadedImageUrl);
      const uploadedImg = await loadImage(canvasSafePhotoUrl);

      const photoEl = isRight ? rightImg : leftImg;
      const photoRect = photoEl.getBoundingClientRect();
      const drawX = photoRect.left - frameRect.left;
      const drawY = photoRect.top - frameRect.top;
      const drawWidth = photoRect.width;
      const drawHeight = photoRect.height;

      ctx.filter = shouldApplyGrayscale() ? 'grayscale(1)' : 'none';
      ctx.drawImage(uploadedImg, drawX, drawY, drawWidth, drawHeight);
      ctx.filter = 'none';

      const lipCanvas = isRight ? rightLipCanvas : leftLipCanvas;
      const lipColor = isRight ? state.lip.rightColor : state.lip.leftColor;
      const lipVisible = isRight ? state.lip.rightVisible : state.lip.leftVisible;
      const lipOpacity = isRight ? state.lip.rightOpacity : state.lip.leftOpacity;

      if (
        isUndertoneStepVisible() &&
        lipCanvas &&
        lipCanvas.width > 0 &&
        lipCanvas.height > 0 &&
        lipVisible &&
        lipColor &&
        state.lip.closed
      ) {
        if (isCanvasExportSafe(lipCanvas)) {
          try {
            const lipRect = lipCanvas.getBoundingClientRect();
            ctx.drawImage(
              lipCanvas,
              lipRect.left - frameRect.left,
              lipRect.top - frameRect.top,
              lipRect.width,
              lipRect.height
            );
          } catch (lipExportError) {
            console.warn('Could not include lips in exported draped view:', lipExportError);
            drawExportLipFallback(ctx, drawX, drawY, drawWidth, drawHeight, lipColor, lipOpacity);
          }
        } else {
          drawExportLipFallback(ctx, drawX, drawY, drawWidth, drawHeight, lipColor, lipOpacity);
        }
      }

      const pathD = drapePathEl.getAttribute('d') || '';
      const fillColor = drapePathEl.getAttribute('fill') || '#e8dfd4';

      const svgMarkup =
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 500" preserveAspectRatio="none">' +
        '<path d="' + pathD + '" fill="' + fillColor + '"/>' +
        '</svg>';

      const svgBlob = new Blob([svgMarkup], { type: 'image/svg+xml;charset=utf-8' });
      const svgUrl = URL.createObjectURL(svgBlob);

      try {
        const drapeImg = await loadImage(svgUrl);
        const drapeSvgEl = frameEl.querySelector('.ycs-analysis-drape-svg');

        let drapeHeight = frameHeight * 0.28;
        let drapeY = frameHeight * 0.72;

        if (drapeSvgEl) {
          const drapeRect = drapeSvgEl.getBoundingClientRect();
          const frameRect2 = frameEl.getBoundingClientRect();
          drapeHeight = drapeRect.height;
          drapeY = drapeRect.top - frameRect2.top;
        }

        ctx.drawImage(drapeImg, 0, drapeY, frameWidth, drapeHeight);

        const depthOverlayEl = isRight ? rightDepthDrapeImg : leftDepthDrapeImg;
        const hasDepthOverlay =
          depthOverlayEl && !depthOverlayEl.hidden && depthOverlayEl.getAttribute('src');

        if (realisticDrapeToggle && realisticDrapeToggle.checked && !hasDepthOverlay) {
          try {
            const overlayUrl = await getCanvasSafeImageUrl(REALISTIC_DRAPE_OVERLAY_URL);
            const overlayImg = await loadImage(overlayUrl);

            ctx.save();
            ctx.translate(0, drapeY);
            ctx.scale(frameWidth / 1000, drapeHeight / 500);
            ctx.clip(new Path2D(pathD));
            ctx.globalCompositeOperation = 'multiply';
            ctx.globalAlpha = Number(REALISTIC_DRAPE_OVERLAY_OPACITY);
            ctx.drawImage(overlayImg, 0, 0, 1000, 500);
            ctx.restore();
          } catch (overlayError) {
            console.warn('Could not render realistic drape overlay', overlayError);
          }
        }

        if (hasDepthOverlay) {
          try {
            const depthOverlayUrl = await getCanvasSafeImageUrl(depthOverlayEl.getAttribute('src'));
            const depthOverlayImg = await loadImage(depthOverlayUrl);
            const overlayRect = depthOverlayEl.getBoundingClientRect();
            const frameRect2 = frameEl.getBoundingClientRect();

            const overlayX = overlayRect.left - frameRect2.left;
            const overlayY = overlayRect.top - frameRect2.top;
            const overlayWidth = overlayRect.width;
            const overlayHeight = overlayRect.height;

            ctx.drawImage(depthOverlayImg, overlayX, overlayY, overlayWidth, overlayHeight);
          } catch (depthOverlayError) {
            console.warn('Could not include depth overlay in exported draped view:', depthOverlayError);
          }
        }
      } finally {
        URL.revokeObjectURL(svgUrl);
      }

      drawExportColorLabel(ctx, frameWidth, frameHeight, colorName, panel);

      const fileName = buildDrapedExportFileName(colorName);
      const dataUrl = canvas.toDataURL('image/png');

      const link = document.createElement('a');
      link.href = dataUrl;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      link.remove();

      saveDrapedImageForReport({
          imageBase64: dataUrl,
          clientRecordId: CLIENT_RECORD_ID,
          customerId: CUSTOMER_ID,
          consultantId: VIEWER_CUSTOMER_ID,
          paletteCode: paletteSelect ? paletteSelect.value : '',
          panel: panel,
          drapeColorName: colorName,
          drapeColorHex: drapeColorHex,
          lipColorHex: lipColorHex,
          fileName: fileName
        }).catch(function (saveError) {
        console.warn('Could not save draped image for report selection:', saveError);
      });
    } catch (error) {
      console.error('Could not download panel view', error);
      alert('Could not save this view. Please try again.');
    }
  }

  function updateSharedDragFromPointer(event) {
    if (gestureState.isPinching) return false;
    if (!state.dragging) return false;
    if (state.pointerId !== event.pointerId) return false;

    event.preventDefault();
    state.x = event.clientX - state.dragStartX;
    state.y = event.clientY - state.dragStartY;
    updateImageTransform();
    return true;
  }

  function attachSharedDrag(frameEl) {
  frameEl.addEventListener('pointerdown', function (event) {
    if (!state.imgLoaded) return;

    gestureState.pointers.set(event.pointerId, {
      clientX: event.clientX,
      clientY: event.clientY
    });

    const lipEditingLocked =
      (state.lip.editing && !state.lip.movingPhoto) ||
      (state.lip.adjusting && state.lip.showGuides && !state.lip.movingPhoto);

    if (lipEditingLocked) return;

    setActivePanel(frameEl.id === 'ycs-analysis-frame-right' ? 'right' : 'left');

    // 👉 PINCH START
    if (gestureState.pointers.size === 2) {
      const pts = Array.from(gestureState.pointers.values());
      gestureState.pinchStartDistance = getPointerDistance(pts[0], pts[1]);
      gestureState.pinchStartScale = state.scale;
      gestureState.isPinching = true;

      state.dragging = false;
      state.pointerId = null;

      leftFrame.classList.remove('is-dragging');
      rightFrame.classList.remove('is-dragging');
      return;
    }

    if (gestureState.isPinching) return;

    // 👉 DRAG START
    state.dragging = true;
    state.pointerId = event.pointerId;
    state.dragStartX = event.clientX - state.x;
    state.dragStartY = event.clientY - state.y;

    leftFrame.classList.add('is-dragging');
    rightFrame.classList.add('is-dragging');

    try {
      frameEl.setPointerCapture(event.pointerId);
    } catch (e) {}
  });

  frameEl.addEventListener('pointermove', function (event) {
    if (!gestureState.pointers.has(event.pointerId)) return;

    gestureState.pointers.set(event.pointerId, {
      clientX: event.clientX,
      clientY: event.clientY
    });

    // 👉 PINCH MOVE
    if (gestureState.pointers.size === 2) {
      event.preventDefault();

      const pts = Array.from(gestureState.pointers.values());
      const distance = getPointerDistance(pts[0], pts[1]);

      if (!gestureState.pinchStartDistance) return;

      const nextScale = clampScale(
        gestureState.pinchStartScale *
        (distance / gestureState.pinchStartDistance)
      );

      // small smoothing
      if (Math.abs(nextScale - state.scale) > 0.01) {
        state.scale = nextScale;
        syncZoomSliders(state.scale);
        updateImageTransform();
      }

      return;
    }

    updateSharedDragFromPointer(event);
  }, { passive: false });
}

  function clearPointer(event) {
    framePointers.delete(event.pointerId);
    if (framePointers.size < 2) {
      pinchStartDistance = 0;
      pinchStartScale = state.scale;
    }
  }

  


  function stopDragging() {
    state.dragging = false;
    state.pointerId = null;
    leftFrame.classList.remove('is-dragging');
    rightFrame.classList.remove('is-dragging');
  }

  function buildSmoothClosedPath(points, closed) {
    if (!points || points.length < 2) return '';

    if (!closed) {
      return points
        .map(function (p, i) {
          return (i === 0 ? 'M' : 'L') + p.x + ',' + p.y;
        })
        .join(' ');
    }

    if (points.length < 3) {
      return points
        .map(function (p, i) {
          return (i === 0 ? 'M' : 'L') + p.x + ',' + p.y;
        })
        .join(' ') + ' Z';
    }

    let d = '';
    const len = points.length;

    for (let i = 0; i < len; i++) {
      const p0 = points[(i - 1 + len) % len];
      const p1 = points[i];
      const p2 = points[(i + 1) % len];
      const p3 = points[(i + 2) % len];

      const cp1x = p1.x + (p2.x - p0.x) / 6;
      const cp1y = p1.y + (p2.y - p0.y) / 6;
      const cp2x = p2.x - (p3.x - p1.x) / 6;
      const cp2y = p2.y - (p3.y - p1.y) / 6;

      if (i === 0) {
        d += 'M' + p1.x + ',' + p1.y;
      }

      d += ' C' + cp1x + ',' + cp1y + ' ' + cp2x + ',' + cp2y + ' ' + p2.x + ',' + p2.y;
    }

    d += ' Z';
    return d;
  } // buildSmoothClosedPath
async function fetchSignatureLipColors({ baseId, token, paletteCode }) {
  const tableName =
    process.env.AIRTABLE_SIGNATURE_LIP_COLORS_TABLE || "SignatureLipColors";

  const records = await fetchAllAirtableRecords({
    baseId,
    tableName,
    token,
    sortField: "SortOrder",
  });

  return records
    .map((record) => {
      const f = record.fields || {};

      const paletteCodes = String(f.PaletteCodes || "")
        .split(",")
        .map((code) => code.toUpperCase().trim())
        .filter(Boolean);

      return {
        name: normalizeField(f.ColorName),
        hex: normalizeField(f.Hex),
        sortOrder: Number(normalizeField(f.SortOrder)) || 999,
        paletteCodes,
      };
    })
    .filter((color) => color.name && color.hex)
    .filter((color) => color.paletteCodes.includes(paletteCode))
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map(({ paletteCodes, ...color }) => color);
}
  function recolorLipsOnCanvas(imgEl, canvas, shapes, hex, opacity) {
  if (!imgEl || !canvas || !Array.isArray(shapes) || !shapes.length || !hex) return;

  const ctx = canvas.getContext('2d');
  const w = canvas.width;
  const h = canvas.height;

  ctx.clearRect(0, 0, w, h);

  try {
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = w;
    tempCanvas.height = h;
    const tempCtx = tempCanvas.getContext('2d');

    // Draw only the displayed photo area into an offscreen canvas
    tempCtx.drawImage(imgEl, 0, 0, w, h);

    const sourceImageData = tempCtx.getImageData(0, 0, w, h);
    const source = sourceImageData.data;

    const outputImageData = ctx.createImageData(w, h);
    const out = outputImageData.data;

    // Build a mask canvas so we know which pixels are inside the lips
    const maskCanvas = document.createElement('canvas');
    maskCanvas.width = w;
    maskCanvas.height = h;
    const maskCtx = maskCanvas.getContext('2d');
    maskCtx.filter = 'blur(1.2px)';

    maskCtx.clearRect(0, 0, w, h);
    maskCtx.fillStyle = 'rgba(255,255,255,1)';

shapes.forEach(function (shape) {
  if (!shape || !Array.isArray(shape.points) || shape.points.length < 3) return;

  const smoothPathD = buildSmoothClosedPath(shape.points, true);

  const scaledPathD = smoothPathD.replace(
    /(-?\d*\.?\d+),(-?\d*\.?\d+)/g,
    function (_, x, y) {
      const scaledX = (parseFloat(x) / 1000) * w;
      const scaledY = (parseFloat(y) / 1000) * h;
      return scaledX + ',' + scaledY;
    }
  );

  const lipPath = new Path2D(scaledPathD);
  maskCtx.fill(lipPath);
});
maskCtx.filter = 'none';

    const maskData = maskCtx.getImageData(0, 0, w, h).data;

    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    

    for (let i = 0; i < source.length; i += 4) {
  const maskAlpha = maskData[i + 3] / 255;
  if (maskAlpha <= 0) continue;

  const originalR = source[i];
  const originalG = source[i + 1];
  const originalB = source[i + 2];
  const originalA = source[i + 3];

  const brightness = (originalR + originalG + originalB) / 3 / 255;
  const liftedBrightness = 0.42 + (brightness * 0.38);
  const strength = opacity * 0.9 * maskAlpha;

  // STEP 1: base blend (this was missing before saturation)
  let rOut = originalR * (1 - strength) + r * strength * liftedBrightness;
  let gOut = originalG * (1 - strength) + g * strength * liftedBrightness;
  let bOut = originalB * (1 - strength) + b * strength * liftedBrightness;

  // STEP 2: saturation (correct way)
  const satBoost = 1 + (opacity * 0.45);
  const avg = (rOut + gOut + bOut) / 3;

  rOut = avg + (rOut - avg) * satBoost;
  gOut = avg + (gOut - avg) * satBoost;
  bOut = avg + (bOut - avg) * satBoost;

  out[i]     = Math.min(255, rOut);
  out[i + 1] = Math.min(255, gOut);
  out[i + 2] = Math.min(255, bOut);
  out[i + 3] = originalA * maskAlpha;
}// end for

    ctx.putImageData(outputImageData, 0, 0);
  } catch (error) {
    console.error('Lip canvas recolor failed', error);
    ctx.clearRect(0, 0, w, h);
  }
}// recolorLipsOnCanvas

  function renderLips() {
    if (!leftLipPath || !rightLipPath) return;

    if (!isUndertoneStepVisible()) {
      setLipVisibilityForCurrentStep();
      return;
    }

  const guideGroups = [leftLipGuides, rightLipGuides];
  const mainPaths = [leftLipPath, rightLipPath];
  const blurPaths = [leftLipBlurPath, rightLipBlurPath];
  const shadePaths = [leftLipShadePath, rightLipShadePath];
  const highlightPaths = [leftLipHighlightPath, rightLipHighlightPath];

  guideGroups.forEach(function (group) {
    if (group) group.innerHTML = '';
  });

  if (!state.lip.points.length) {
    [leftLipCanvas, rightLipCanvas].forEach(function (canvas) {
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    });

    [mainPaths, blurPaths, shadePaths, highlightPaths].forEach(function (collection) {
      collection.forEach(function (path) {
        if (!path) return;
        path.setAttribute('d', '');
        path.setAttribute('fill', 'none');
        path.setAttribute('fill-opacity', '0');
        path.setAttribute('stroke', 'none');
        path.removeAttribute('filter');
      });
    });

    return;
  }

  const finalD = buildSmoothClosedPath(state.lip.points, state.lip.closed);

    mainPaths.forEach(function (path, i) {
      const isLeft = i === 0;
      const lipColor = isLeft ? state.lip.leftColor : state.lip.rightColor;
      const lipVisible = isLeft ? state.lip.leftVisible : state.lip.rightVisible;
      const fillIsOn = !!(lipVisible && lipColor && state.lip.closed);

      const canvas = isLeft ? leftLipCanvas : rightLipCanvas;
const img = isLeft ? leftImg : rightImg;

if (lipVisible && lipColor && state.lip.closed) {
  const lipOpacity = isLeft ? state.lip.leftOpacity : state.lip.rightOpacity;

    recolorLipsOnCanvas(
        img,
        canvas,
        getCompletedLipShapes(),
        lipColor,
        lipOpacity
    );
} else if (canvas) {
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, canvas.width, canvas.height);
}

      const blurPath = blurPaths[i];
      const shadePath = shadePaths[i];
      const highlightPath = highlightPaths[i];

      const showOutline = state.lip.editing || state.lip.adjusting;

      path.setAttribute('d', finalD);
      path.setAttribute('stroke', showOutline ? '#111' : 'none');
      path.setAttribute('stroke-width', showOutline ? (state.lip.editing ? '2' : '1.25') : '0');
      path.setAttribute('stroke-linejoin', 'round');
      path.setAttribute('stroke-linecap', 'round');

      if (blurPath) {
        blurPath.setAttribute('d', finalD);
        blurPath.setAttribute('stroke', 'none');
      }

      if (fillIsOn) {
  path.setAttribute('fill', 'none');
  path.setAttribute('fill-opacity', '0');

  if (blurPath) {
    blurPath.setAttribute('d', '');
    blurPath.setAttribute('fill', 'none');
    blurPath.setAttribute('fill-opacity', '0');
    blurPath.removeAttribute('filter');
  }

  if (shadePath) {
    shadePath.setAttribute('d', '');
    shadePath.setAttribute('fill', 'none');
    shadePath.setAttribute('fill-opacity', '0');
    shadePath.removeAttribute('filter');
  }

  if (highlightPath) {
    highlightPath.setAttribute('d', '');
    highlightPath.setAttribute('fill', 'none');
    highlightPath.setAttribute('fill-opacity', '0');
    highlightPath.removeAttribute('filter');
  }
} else {
  path.setAttribute('fill', 'none');
  path.setAttribute('fill-opacity', '0');

  if (blurPath) {
    blurPath.setAttribute('d', '');
    blurPath.setAttribute('fill', 'none');
    blurPath.setAttribute('fill-opacity', '0');
    blurPath.removeAttribute('filter');
  }

  if (shadePath) {
    shadePath.setAttribute('d', '');
    shadePath.setAttribute('fill', 'none');
    shadePath.setAttribute('fill-opacity', '0');
    shadePath.removeAttribute('filter');
  }

  if (highlightPath) {
    highlightPath.setAttribute('d', '');
    highlightPath.setAttribute('fill', 'none');
    highlightPath.setAttribute('fill-opacity', '0');
    highlightPath.removeAttribute('filter');
  }
}
    });

    const shouldShowHandles =
      state.lip.showGuides && (state.lip.editing || state.lip.adjusting);

    if (!shouldShowHandles) return;

    guideGroups.forEach(function (group, groupIndex) {
      if (!group) return;

      const svg = groupIndex === 0 ? leftLipSvg : rightLipSvg;
      const svgRect = svg ? svg.getBoundingClientRect() : null;

      const visualRadiusPx = 3.5;
      const rx = svgRect ? (visualRadiusPx * 1000 / svgRect.width) : 3.5;
      const ry = svgRect ? (visualRadiusPx * 1000 / svgRect.height) : 3.5;
      const hitRx = svgRect ? (10 * 1000 / svgRect.width) : 10;
      const hitRy = svgRect ? (10 * 1000 / svgRect.height) : 10;

      state.lip.points.forEach(function (pt, index) {
        const handleGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
        handleGroup.setAttribute('class', 'ycs-lip-guide-point');
        handleGroup.setAttribute('data-index', index);

        const hit = document.createElementNS('http://www.w3.org/2000/svg', 'ellipse');
        hit.setAttribute('cx', pt.x);
        hit.setAttribute('cy', pt.y);
        hit.setAttribute('rx', hitRx);
        hit.setAttribute('ry', hitRy);
        hit.setAttribute('fill', 'transparent');
        hit.setAttribute('pointer-events', 'all');
        hit.setAttribute('data-index', index);

        const dot = document.createElementNS('http://www.w3.org/2000/svg', 'ellipse');
        dot.setAttribute('cx', pt.x);
        dot.setAttribute('cy', pt.y);
        dot.setAttribute('rx', rx);
        dot.setAttribute('ry', ry);
        dot.setAttribute('fill', index === state.lip.dragIndex ? '#ff3366' : '#111');
        dot.setAttribute('stroke', '#ffffff');
        dot.setAttribute('stroke-width', '1.25');
        dot.setAttribute('pointer-events', 'none');

        handleGroup.appendChild(hit);
        handleGroup.appendChild(dot);
        group.appendChild(handleGroup);
      });
    });
  }

  if (lipOpacityInput) {
  lipOpacityInput.addEventListener('input', function () {
    const value = parseFloat(this.value);

    if (state.activePanel === 'right') {
      state.lip.rightOpacity = value;
    } else {
      state.lip.leftOpacity = value;
    }

    if (lipOpacityValue) {
      lipOpacityValue.textContent = Math.round(value * 100) + '%';
    }

    renderLips();
  });
}

function syncLipOpacityControl() {
  if (!lipOpacityInput || !lipOpacityValue) return;

  const value = state.activePanel === 'right'
    ? state.lip.rightOpacity
    : state.lip.leftOpacity;

  lipOpacityInput.value = String(value);
  lipOpacityValue.textContent = Math.round(value * 100) + '%';
}

  if (lipGuidesToggleBtn) {
    lipGuidesToggleBtn.onclick = function () {
      state.lip.showGuides = !state.lip.showGuides;
      lipGuidesToggleBtn.textContent = state.lip.showGuides ? 'Hide Outline' : 'Show Outline';
      renderLips();
    };
  }

  if (lipEditBtn) {
  lipEditBtn.onclick = function () {
      state.lip.editing = true;
      state.lip.adjusting = false;
      state.lip.closed = false;
      state.lip.points = [];
      state.lip.shapes = [];
      state.lip.activeShapeIndex = 0;
      state.lip.dragIndex = -1;
    state.lip.dragSvg = null;

    if (leftLipSvg) leftLipSvg.style.display = '';
    if (rightLipSvg) rightLipSvg.style.display = '';

    appEl.classList.add('is-lip-editing');
    appEl.classList.remove('is-lip-adjusting');

    syncLipOverlayToImage();
    requestAnimationFrame(function () {
      syncLipOverlayToImage();
      renderLips();
    });

    updateLipActionButtons();
    renderLips();
  };
}

  if (lipEditAgainBtn) {
    lipEditAgainBtn.onclick = function () {
      state.lip.movingPhoto = false;
      if (lipMovePhotoBtn) lipMovePhotoBtn.textContent = 'Move Photo';

      if (state.lip.closed && state.lip.points.length > 0) {
        state.lip.editing = false;
        state.lip.adjusting = true;
        state.lip.dragIndex = -1;
        state.lip.dragSvg = null;
        appEl.classList.remove('is-lip-editing');
        appEl.classList.add('is-lip-adjusting');

        if (lipStatus) {
          lipStatus.textContent = 'You can edit the shape by dragging the handles.';
        }
      } else {
        state.lip.editing = true;
        state.lip.adjusting = false;
        state.lip.dragIndex = -1;
        state.lip.dragSvg = null;
        appEl.classList.add('is-lip-editing');
        appEl.classList.remove('is-lip-adjusting');

        if (lipStatus) {
          lipStatus.textContent = 'Click around the lips. When it looks right, click Finish Shape.';
        }
      }

      updateLipActionButtons();
      syncLipOpacityControl();
      renderLips();
    };
  }

if (lipEditShape1Btn) {
  lipEditShape1Btn.onclick = function () {
    setActiveLipShape(0);
  };
}

if (lipEditShape2Btn) {
  lipEditShape2Btn.onclick = function () {
    setActiveLipShape(1);
  };
}

  if (lipMovePhotoBtn) {
    lipMovePhotoBtn.onclick = function () {
      state.lip.movingPhoto = !state.lip.movingPhoto;
      lipMovePhotoBtn.textContent = state.lip.movingPhoto ? 'Done Moving Photo' : 'Move Photo';

      if (lipStatus) {
        lipStatus.textContent = state.lip.movingPhoto
          ? 'Drag the photo to reposition it, then click Done Moving Photo.'
          : 'Zoom in if needed. Click around the lips to place points.';
      }
    };
  }

  if (lipFinishBtn) {
    lipFinishBtn.onclick = function () {
      if (state.lip.points.length < 3) return;
      state.lip.movingPhoto = false;
      if (lipMovePhotoBtn) lipMovePhotoBtn.textContent = 'Move Photo';
      state.lip.closed = true;
      state.lip.shapes[state.lip.activeShapeIndex || 0] = {
        points: state.lip.points,
        closed: true
      };
      state.lip.editing = false;
      state.lip.adjusting = true;
      appEl.classList.remove('is-lip-editing');
      appEl.classList.add('is-lip-adjusting');

      if (lipStatus) {
        lipStatus.textContent = 'Lip mask created. Drag points to refine.';
      }

      updateLipActionButtons();
      renderLips();
      saveAnalysisSession();
      savePhotoTransform({ silent: true });
    };
  }

if (lipAddShapeBtn) {
  lipAddShapeBtn.onclick = function () {
    if (state.lip.points.length >= 3 && state.lip.closed) {
      state.lip.shapes[state.lip.activeShapeIndex || 0] = {
        points: state.lip.points,
        closed: true
      };
    }

    if (state.lip.shapes.length >= 2) return;

    state.lip.activeShapeIndex = 1;
    state.lip.points = [];
    state.lip.closed = false;
    state.lip.editing = true;
    state.lip.adjusting = false;
    state.lip.dragIndex = -1;
    state.lip.dragSvg = null;

    appEl.classList.add('is-lip-editing');
    appEl.classList.remove('is-lip-adjusting');

    if (lipStatus) {
      lipStatus.textContent = 'Now draw the second lip shape.';
    }

    updateLipActionButtons();
    renderLips();
  };
}

  if (lipUndoBtn) {
    lipUndoBtn.onclick = function () {
      if (!state.lip.points.length) return;

      state.lip.points.pop();

      if (state.lip.points.length < 3) {
        state.lip.closed = false;
        state.lip.adjusting = false;
        appEl.classList.remove('is-lip-adjusting');
      }

      if (lipStatus) {
        lipStatus.textContent = state.lip.points.length === 0
          ? 'Click around the lips. When it looks right, click Finish Shape.'
          : 'Placed ' + state.lip.points.length + ' point' + (state.lip.points.length === 1 ? '' : 's');
      }

      updateLipActionButtons();
      renderLips();
    };
  }

  if (lipClearBtn) {
    lipClearBtn.onclick = function () {
      state.lip.movingPhoto = false;
      if (lipMovePhotoBtn) lipMovePhotoBtn.textContent = 'Move Photo';

      state.lip.points = [];
      state.lip.shapes = [];
      state.lip.activeShapeIndex = 0;
      state.lip.closed = false;
      state.lip.editing = true;
      state.lip.adjusting = false;
      state.lip.dragIndex = -1;
      state.lip.dragSvg = null;

      appEl.classList.add('is-lip-editing');
      appEl.classList.remove('is-lip-adjusting');

      if (lipStatus) {
        lipStatus.textContent = 'Start placing points for a new lip shape.';
      }

      updateLipActionButtons();
      renderLips();
    };
  }

  if (lipStartOverBtn) {
    lipStartOverBtn.onclick = function () {
      state.lip.movingPhoto = false;
      if (lipMovePhotoBtn) lipMovePhotoBtn.textContent = 'Move Photo';

      state.lip.points = [];
      state.lip.shapes = [];
      state.lip.activeShapeIndex = 0;
      state.lip.closed = false;
      state.lip.editing = true;
      state.lip.adjusting = false;
      state.lip.dragIndex = -1;
      state.lip.dragSvg = null;

      appEl.classList.add('is-lip-editing');
      appEl.classList.remove('is-lip-adjusting');

      if (lipStatus) {
        lipStatus.textContent = 'Start placing points for a new lip shape.';
      }

      updateLipActionButtons();
      renderLips();
    };
  }

  [leftFrame, rightFrame].forEach(function (frame, index) {
    frame.addEventListener('click', function (e) {
      if (!state.lip.editing || state.lip.movingPhoto) return;
      if (state.lip.dragIndex !== -1) return;

      e.preventDefault();
      e.stopPropagation();

      const svg = index === 0 ? leftLipSvg : rightLipSvg;
      if (!svg) return;

      const svgRect = svg.getBoundingClientRect();

if (!svgRect.width || !svgRect.height) {
  syncLipOverlayToImage();
  return;
}

const x = ((e.clientX - svgRect.left) / svgRect.width) * 1000;
const y = ((e.clientY - svgRect.top) / svgRect.height) * 1000;

      state.lip.points.push({ x: x, y: y });
      state.lip.closed = false;

      if (lipStatus) {
        lipStatus.textContent =
          'Placed ' + state.lip.points.length + ' point' +
          (state.lip.points.length === 1 ? '' : 's') +
          '. Click Finish Shape when ready.';
      }

      updateLipActionButtons();
      renderLips();
    });
  });

  [leftLipSvg, rightLipSvg].forEach(function (svg) {
    if (!svg) return;

    svg.addEventListener('pointerdown', function (e) {
      if (!state.lip.editing && !state.lip.adjusting) return;

      const target = e.target;
      const handle = target && target.closest ? target.closest('.ycs-lip-guide-point') : null;
      if (!handle) return;

      const indexAttr = handle.getAttribute('data-index');
      if (indexAttr == null) return;

      e.preventDefault();
      e.stopPropagation();

      state.lip.dragIndex = Number(indexAttr);
      state.lip.dragSvg = svg;

      try {
        svg.setPointerCapture(e.pointerId);
      } catch (error) {
        /* ignore */
      }

      renderLips();
    });

    svg.addEventListener('pointermove', function (e) {
      if (!state.lip.editing && !state.lip.adjusting) return;
      if (state.lip.dragIndex < 0) return;
      if (state.lip.dragSvg !== svg) return;

      e.preventDefault();

      const pt = getLipPointFromSvgEvent(e, svg);
      state.lip.points[state.lip.dragIndex] = pt;
      state.lip.shapes[state.lip.activeShapeIndex || 0] = {
        points: state.lip.points,
        closed: state.lip.closed
      };
      renderLips();
    });

    svg.addEventListener('pointerup', function () {
      state.lip.dragIndex = -1;
      state.lip.dragSvg = null;
      renderLips();
    });

    svg.addEventListener('pointercancel', function () {
      state.lip.dragIndex = -1;
      state.lip.dragSvg = null;
      renderLips();
    });
  });

  activePanelButtons.forEach(function (btn) {
    btn.addEventListener('click', function () {
      setActivePanel(btn.dataset.panel);
    });
  });

  stagePanels.forEach(function (panelEl) {
    panelEl.addEventListener('click', function (event) {
      if (
        event.target.closest('.ycs-analysis-save-btn') ||
        event.target.closest('.ycs-analysis-toggle-btn') ||
        event.target.closest('.ycs-analysis-filter') ||
        event.target.closest('.ycs-analysis-swatch') ||
        event.target.closest('.ycs-analysis-guided-swatch') ||
        event.target.closest('.ycs-analysis-palette-select') ||
        event.target.closest('.ycs-analysis-drag-layer')
      ) {
        return;
      }

      setActivePanel(panelEl.dataset.panel);
    });
  });

  zoomSliders.forEach(function (slider) {
    slider.addEventListener('input', function () {
      state.scale = clampScale(this.value);
      syncZoomSliders(state.scale);
      updateImageTransform();
    });
  });

  if (filterLeftBtn && filterRightBtn) {
    filterLeftBtn.addEventListener('click', function () {
      filtersEl.scrollBy({ left: -180, behavior: 'smooth' });
    });

    filterRightBtn.addEventListener('click', function () {
      filtersEl.scrollBy({ left: 180, behavior: 'smooth' });
    });

    filtersEl.addEventListener('scroll', updateFilterArrows);
    window.addEventListener('resize', updateFilterArrows);
  }

  if (paletteSelect) {
    paletteSelect.addEventListener('change', function () {
      updateCurrentPaletteName();

      state.leftColorHex = '';
      state.rightColorHex = '';
      state.leftColorName = '';
      state.rightColorName = '';

      syncColorLabels();
      setActivePanel('left');
      saveAnalysisSession();
      renderPaletteUI(this.value);
    });
  }

  if (structuredModeBtn) {
    structuredModeBtn.addEventListener('click', function () {
      setAnalysisMode('structured');
    });
  }

  if (comparisonModeBtn) {
    comparisonModeBtn.addEventListener('click', function () {
      setAnalysisMode('comparison');
    });
  }

  if (comparisonBackBtn) {
    comparisonBackBtn.addEventListener('click', function () {
      setAnalysisMode('structured');
    });
  }

  if (leftPaletteSelect) {
    leftPaletteSelect.addEventListener('change', function () {
      state.comparison.leftColorHex = '';
      state.comparison.leftFilter = 'all';
      loadComparisonSide('left');
    });
  }

  if (rightPaletteSelect) {
    rightPaletteSelect.addEventListener('change', function () {
      state.comparison.rightColorHex = '';
      state.comparison.rightFilter = 'all';
      loadComparisonSide('right');
    });
  }

  if (leftColorSelect) {
    leftColorSelect.addEventListener('change', function () {
      const selected = leftColorSelect.selectedOptions[0];
      state.comparison.leftColorHex = leftColorSelect.value;
      state.comparison.leftColorName = selected ? (selected.dataset.name || selected.textContent) : '';
      applyDrapeColor('left', state.comparison.leftColorHex, state.comparison.leftColorName);
    });
  }

  if (rightColorSelect) {
    rightColorSelect.addEventListener('change', function () {
      const selected = rightColorSelect.selectedOptions[0];
      state.comparison.rightColorHex = rightColorSelect.value;
      state.comparison.rightColorName = selected ? (selected.dataset.name || selected.textContent) : '';
      applyDrapeColor('right', state.comparison.rightColorHex, state.comparison.rightColorName);
    });
  }

  if (savePositionBtn) {
    savePositionBtn.addEventListener('click', function () {
      savePhotoTransform();
    });
  }

  if (restorePositionBtn) {
    restorePositionBtn.addEventListener('click', restoreSavedPhotoPosition);
  }

  if (resetUndertoneBtn) {
  resetUndertoneBtn.addEventListener('click', async function () {
    state.selectedUndertoneLane = '';
    state.analysisResult.undertone = '';
    state.analysisResult.chroma = '';
    state.analysisResult.resultCode = '';
    state.analysisResult.resultLabel = '';
    state.analysisUndertoneDecision = '';
    state.analysisChromaDecision = '';
    state.analysisCompletedAt = '';
    state.analysisCurrentStep = state.analysisDepthDecision ? 'undertone' : 'depth';

    if (undertoneStepEl) undertoneStepEl.hidden = false;
    if (chromaStepEl) chromaStepEl.hidden = true;
    if (chromaSectionsEl) chromaSectionsEl.innerHTML = '';

    if (chromaResultEl && chromaResultTextEl) {
      chromaResultEl.hidden = true;
      chromaResultTextEl.textContent = '—';
    }

    if (leftLipSvg) leftLipSvg.style.display = '';
    if (rightLipSvg) rightLipSvg.style.display = '';

    await renderUndertoneSections(state.selectedDepth);

    setLipVisibilityForCurrentStep();
    syncLipUiMode();
    syncLipOpacityControl();
    renderLips();

    requestAnimationFrame(function () {
      setLipVisibilityForCurrentStep();
      syncLipUiMode();
      syncLipOpacityControl();
      renderLips();
    });

    saveAnalysisProgress();
  });
} // resetUnderToneBtn handler

  if (resetDepthBtn) {
    resetDepthBtn.addEventListener('click', function () {
      state.grayscale = false;
      if (grayscaleToggle) grayscaleToggle.checked = false;

      hideDepthStageDrapes();
      resetGuidedFlow();
      updateImageTransform();
      renderDepthStep();
      syncColorLabels();
    });
  }

  if (grayscaleToggle) {
    grayscaleToggle.addEventListener('change', function () {
      state.grayscale = this.checked;
      updateImageTransform();
      saveAnalysisSession();
    });
  }

  if (signatureAnalysisLink) {
    updateSignatureAnalysisLink();
    signatureAnalysisLink.addEventListener('click', function () {
      signatureAnalysisLink.href = IS_SIGNATURE_STUDIO
        ? buildColorAnalysisToolHref()
        : buildSignatureAnalysisHref();
    });
  }

  if (manageClientLink) {
    updateManageClientLink();
    manageClientLink.addEventListener('click', function () {
      manageClientLink.href = buildManageClientHref();
    });
  }

  if (realisticDrapeToggle) {
    realisticDrapeToggle.checked = false;
    realisticDrapeToggle.addEventListener('change', function () {
      syncDrapeLayers();
    });
  }

  attachSharedDrag(leftFrame);
  attachSharedDrag(rightFrame);

  // Tap each frame to select
  Array.from(document.querySelectorAll('.ycs-analysis-drag-layer')).forEach(function (layer) {
  layer.addEventListener('click', function (event) {
    event.preventDefault();
    event.stopPropagation();
    setActivePanel(layer.dataset.panel);
  });

  layer.addEventListener('pointerdown', function () {
    setActivePanel(layer.dataset.panel);
  });
});


  window.addEventListener('pointermove', function (event) {
  if (gestureState.pointers.has(event.pointerId)) {
    gestureState.pointers.set(event.pointerId, {
      clientX: event.clientX,
      clientY: event.clientY
    });
  }

  updateSharedDragFromPointer(event);
});

function endGesturePointer(event) {
  gestureState.pointers.delete(event.pointerId);

  if (gestureState.pointers.size < 2) {
    gestureState.isPinching = false;
    gestureState.pinchStartDistance = 0;
    gestureState.pinchStartScale = state.scale;
  }

  if (state.pointerId === event.pointerId) {
    stopDragging();
  }
}

window.addEventListener('pointerup', endGesturePointer);
window.addEventListener('pointercancel', endGesturePointer);

  if (saveLeftBtn) {
    saveLeftBtn.addEventListener('click', function () {
      downloadPanelView('left');
    });
  }

  if (saveRightBtn) {
    saveRightBtn.addEventListener('click', function () {
      downloadPanelView('right');
    });
  }

  window.addEventListener('resize', function () {
    updateDrapeShape();
    requestAnimationFrame(syncLipOverlayToImage);
  });

  if (!CAN_USE_ANALYSIS_TOOL) {
    console.warn('Analysis tool loaded without consultant/admin privileges.');
  }

  (async function initAnalysisTool() {
  updateLipActionButtons();
  updateDrapeShape();
  syncZoomSliderBounds();
  const customPaletteResults = await Promise.all([
    loadAdminStyleMastersPalettes(),
    loadPrivateCustomPalettes()
  ]);
  styleMastersPaletteOptions = customPaletteResults[0];
  privateCustomPaletteOptions = customPaletteResults[1];
  populatePaletteSelect();
  populateComparisonPaletteSelects();

  const saved = loadAnalysisSession();
  if (saved && saved.paletteCode && paletteSelect) {
    paletteSelect.value = isDrapingPalette(saved.paletteCode) || isCustomPaletteCode(saved.paletteCode)
      ? saved.paletteCode
      : DRAPING_PALETTE_CODE;
    updateCurrentPaletteName();
  }

  setActivePanel('left');
  syncColorLabels();

  isRestoringSession = true;

  await renderPaletteUI(paletteSelect.value);

  const photoData = await fetchSavedPhoto();
  state.photoSessionKey =
    photoData && photoData.activePhotoSessionKey
      ? String(photoData.activePhotoSessionKey)
      : (photoData && photoData.activePhotoUrl ? String(photoData.activePhotoUrl) : '');

  const latestSaved = loadAnalysisSession();
  const savedPhotoSessionKey =
    latestSaved && latestSaved.photoSessionKey
      ? String(latestSaved.photoSessionKey)
      : '';

  const shouldRestoreSavedSession =
  !!latestSaved &&
  !!state.photoSessionKey &&
  savedPhotoSessionKey === state.photoSessionKey &&
  !forceDepthReturn &&
  !HAS_NEW_PHOTO_FLAG;

  if (forceDepthReturn && isDrapingPalette(paletteSelect.value)) {
    resetAnalysisForNewPhoto();
    renderDepthStep();
    saveAnalysisSession();
  } else if (shouldRestoreSavedSession) {
    await restoreGuidedFlowFromSession();
  } else if (await restoreGuidedFlowFromDecisions()) {
    saveAnalysisSession();
  } else {
    resetAnalysisForNewPhoto();
    if (isDrapingPalette(paletteSelect.value)) {
      renderDepthStep();
    }
    saveAnalysisSession();
  }

  isRestoringSession = false;

  requestAnimationFrame(function () {
    updateImageTransform();
    syncLipOverlayToImage();
    setLipVisibilityForCurrentStep();
    syncLipUiMode();
    syncLipOpacityControl();
    renderLips();
  });

  updatePhotoPrepLink();
  updateBackLink();
  updateSignatureAnalysisLink();
  updateManageClientLink();
  setAnalysisMode(saved && saved.analysisMode === 'comparison' ? 'comparison' : 'structured');

  ensureLipEmptyModeVisible();
  requestAnimationFrame(function () {
    ensureLipEmptyModeVisible();
  });
  syncLipOpacityControl();
})();
})();
