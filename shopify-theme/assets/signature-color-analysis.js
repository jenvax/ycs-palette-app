(function () {
  console.log('YCS COLOR ANALYSIS TOOL JS LOADED');

  const appEl = document.querySelector('.ycs-analysis-app');
  if (!appEl) return;

  const APP_BASE_URL = appEl.dataset.appBaseUrl || '';
  const VIEWER_CUSTOMER_ID = (appEl.dataset.customerId || '').trim();
  const IS_ADMIN = appEl.dataset.isAdmin === 'true';
  const IS_SIGNATURE_MODE = appEl.dataset.signatureMode === 'true';
  const IS_TRADE = appEl.dataset.isTrade === 'true';
  const IS_CATOOL = appEl.dataset.isCatool === 'true';
  const IS_CATOOL_GROWTH = appEl.dataset.isCatoolGrowth === 'true';
  const CAN_USE_ANALYSIS_TOOL = appEl.dataset.canUseAnalysisTool === 'true';
  

  if (!CAN_USE_ANALYSIS_TOOL) {
    console.warn('Analysis tool blocked for unauthorized account');
    return;
  }

  const urlParams = new URLSearchParams(window.location.search);
  const ADMIN_VIEW_AS = (urlParams.get('viewAs') || '').trim().toLowerCase();
  const RETURN_URL = (urlParams.get('returnUrl') || '').trim();

  const CLIENT_RECORD_ID = (urlParams.get('clientRecordId') || '').trim();
  const ADMIN_CUSTOMER_ID = (urlParams.get('adminCustomerId') || '').trim();
  const SIMPLE_CUSTOMER_ID = (urlParams.get('customerId') || '').trim();
  
  const PHOTO_ID = (urlParams.get('photoId') || '').trim();
  const PHOTO_SOURCE =
  (urlParams.get('source') || urlParams.get('photoSource') || '').trim();
  
function getClientFirstName() {
  return (new URLSearchParams(window.location.search).get('firstName') || '').trim();
}
function getClientLastName() {
  return (new URLSearchParams(window.location.search).get('lastName') || '').trim();
}
function getCustomerPaletteCode() {
  return (new URLSearchParams(window.location.search).get('customerPaletteCode') || '').trim().toUpperCase();
}

  const CUSTOMER_ID = CLIENT_RECORD_ID
    ? ''
    : (ADMIN_CUSTOMER_ID || SIMPLE_CUSTOMER_ID || VIEWER_CUSTOMER_ID);

  const ACTIVE_RECORD_ID = CLIENT_RECORD_ID || CUSTOMER_ID || '';
  const RETURN_STEP = (urlParams.get('returnStep') || '').trim().toLowerCase();
  const forceDepthReturn = RETURN_STEP === 'depth';

  const HAS_NEW_PHOTO_FLAG = urlParams.get('newPhoto') === '1';

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
  const signatureBackLink = document.getElementById('ycs-signature-back-link');
  const standardAnalysisLink = document.getElementById('ycs-signature-standard-analysis-link');
  const paletteSelect = document.getElementById('ycs-analysis-palette-select');
  const currentPaletteNameEl = document.getElementById('ycs-analysis-current-palette-name');
  const realisticDrapeToggle = document.getElementById('ycs-analysis-realistic-drape-toggle');
  const signatureLeftPaletteSelect = document.getElementById('ycs-signature-left-palette-select');
  const signatureRightPaletteSelect = document.getElementById('ycs-signature-right-palette-select');
  const signatureLeftDrapeFilters = document.getElementById('ycs-signature-left-drape-filters');
  const signatureRightDrapeFilters = document.getElementById('ycs-signature-right-drape-filters');
  const signatureLeftDrapeSwatches = document.getElementById('ycs-signature-left-drape-swatches');
  const signatureRightDrapeSwatches = document.getElementById('ycs-signature-right-drape-swatches');
  const signatureLeftLipSwatches = document.getElementById('ycs-signature-left-lip-swatches');
  const signatureRightLipSwatches = document.getElementById('ycs-signature-right-lip-swatches');

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
  const signatureLeftLipOpacityInput = document.getElementById('ycs-signature-left-lip-opacity');
  const signatureRightLipOpacityInput = document.getElementById('ycs-signature-right-lip-opacity');
  const signatureLeftLipOpacityValue = document.getElementById('ycs-signature-left-lip-opacity-value');
  const signatureRightLipOpacityValue = document.getElementById('ycs-signature-right-lip-opacity-value');
  const signatureLeftLipEditBtn = document.getElementById('ycs-signature-left-lip-edit');
  const signatureRightLipEditBtn = document.getElementById('ycs-signature-right-lip-edit');
  const signatureLeftLipVisibilityBtn = document.getElementById('ycs-signature-left-lip-visibility');
  const signatureRightLipVisibilityBtn = document.getElementById('ycs-signature-right-lip-visibility');

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

  const leftLipBlurPath = document.getElementById('ycs-lip-path-left-blur');
  const rightLipBlurPath = document.getElementById('ycs-lip-path-right-blur');

  const leftLipShadePath = document.getElementById('ycs-lip-path-left-shade');
  const rightLipShadePath = document.getElementById('ycs-lip-path-right-shade');
  const leftLipHighlightPath = document.getElementById('ycs-lip-path-left-highlight');
  const rightLipHighlightPath = document.getElementById('ycs-lip-path-right-highlight');

  const leftDrapePath = document.getElementById('ycs-analysis-drape-left');
  const rightDrapePath = document.getElementById('ycs-analysis-drape-right');
  const leftDrapeSvg = leftDrapePath ? leftDrapePath.closest('.ycs-analysis-drape-svg') : null;
  const rightDrapeSvg = rightDrapePath ? rightDrapePath.closest('.ycs-analysis-drape-svg') : null;

  const saveLeftBtn = document.getElementById('ycs-analysis-save-left');
  const saveRightBtn = document.getElementById('ycs-analysis-save-right');
  const exportLabelLeftToggle = document.getElementById('ycs-analysis-export-label-left');
  const exportLabelRightToggle = document.getElementById('ycs-analysis-export-label-right');
  const exportNameLeftToggle = document.getElementById('ycs-analysis-export-name-left');
  const exportNameRightToggle = document.getElementById('ycs-analysis-export-name-right');

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
  const photoPrepLink = document.getElementById('ycs-analysis-photo-prep-link');

  const depthStepEl = document.getElementById('ycs-analysis-depth-step');
  const depthSectionsEl = document.getElementById('ycs-analysis-depth-sections');
  const resetDepthBtn = document.getElementById('ycs-analysis-reset-depth');
  const grayscaleToggle = document.getElementById('ycs-analysis-grayscale-toggle');

  const leftDepthDrapeImg = document.getElementById('ycs-analysis-depth-drape-left');
  const rightDepthDrapeImg = document.getElementById('ycs-analysis-depth-drape-right');

  const loadingOverlay = document.getElementById('ycs-analysis-loading');
  const lipCancelBtns = Array.from(document.querySelectorAll('#ycs-lip-cancel, .ycs-lip-cancel-secondary'));
  const lipAddShapeBtn = document.getElementById('ycs-lip-add-shape');
  const lipEditShape1Btn = document.getElementById('ycs-lip-edit-shape-1');
const lipEditShape2Btn = document.getElementById('ycs-lip-edit-shape-2');

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
  const REALISTIC_DRAPE_OVERLAY_URL =
    'https://cdn.shopify.com/s/files/1/0623/6284/5408/files/fabric-drape-overlay-550.png?v=1778252521';
  const REALISTIC_DRAPE_OVERLAY_OPACITY = '0.78';
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
    SWDG: 'Soft Warm Deep Gray Hair',
    SCLG: 'Soft Cool Light Gray Hair',
    SCMG: 'Soft Cool Medium Gray Hair',
    SCDG: 'Soft Cool Deep Gray Hair'
  };

  const ALL_CUSTOMER_PALETTE_CODES = [
    'CWL', 'CWM', 'CWD',
    'CCL', 'CCM', 'CCD',
    'SWL', 'SWM', 'SWD',
    'SCL', 'SCM', 'SCD',
    'LO', 'MO', 'DO',
    'CWLG', 'CWMG', 'CWDG',
    'SWLG', 'SWMG', 'SWDG',
    'SCLG', 'SCMG', 'SCDG'
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
clientFirstName: '',
clientLastName: '',
customerPaletteCode: '',
signature: {
  leftPaletteCode: '',
  rightPaletteCode: '',
  leftFilter: 'all',
  rightFilter: 'all'
},
  leftColorHex: '',
    rightColorHex: '',
    leftColorName: '',
    rightColorName: '',
    depthLeft: '',
    depthRight: '',
    pointerId: null,
    dragStartX: 0,
    dragStartY: 0,
    selectedDepth: '',
    selectedUndertoneLane: '',
    grayscale: false,
    lip: {
      leftColor: '',
      rightColor: '',
      leftName: '',
      rightName: '',
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

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

function drawSignatureExportLabels(ctx, canvas, options) {
  if (!IS_SIGNATURE_MODE) return;

  const firstName = options.showCustomerName === false ? '' : String(options.firstName || '').trim();
  const paletteCode = options.showCustomerName === false ? '' : String(options.paletteCode || '').trim().toUpperCase();
  const colorName = options.showColorName === false ? '' : String(options.colorName || '').trim();
  const lipName = String(options.lipName || '').trim();
  const lipColor = normalizeHex(options.lipColor || '');

  const exportWidth = canvas.width / 2;
const exportHeight = canvas.height / 2;

const padding = Math.max(16, Math.round(exportWidth * 0.03));
const nameFontSize = Math.max(12, Math.round(exportWidth * 0.025));
const paletteFontSize = Math.max(11, Math.round(exportWidth * 0.022));
const colorFontSize = Math.max(14, Math.round(exportWidth * 0.034));

  ctx.save();

  if (firstName) {
    ctx.font = `500 ${nameFontSize}px Poppins, Arial, sans-serif`;
    ctx.fillStyle = '#7a7a7a';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillText(firstName, padding, padding);
  }

  if (paletteCode) {
    ctx.font = `600 ${paletteFontSize}px Poppins, Arial, sans-serif`;

    const textWidth = ctx.measureText(paletteCode).width;
    const pillPaddingX = 12;
    const pillPaddingY = 7;
    const pillWidth = textWidth + pillPaddingX * 2;
    const pillHeight = paletteFontSize + pillPaddingY * 2;

    const x = exportWidth - padding - pillWidth;
    const y = padding;

    ctx.fillStyle = '#111111';
    roundRect(ctx, x, y, pillWidth, pillHeight, pillHeight / 2);
    ctx.fill();

    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(paletteCode, x + pillWidth / 2, y + pillHeight / 2);
  }

  if (colorName) {
    ctx.font = `500 ${colorFontSize}px Poppins, Arial, sans-serif`;
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.shadowColor = 'rgba(0,0,0,0.25)';
    ctx.shadowBlur = 6;

    ctx.fillText(
      colorName,
      exportWidth / 2,
exportHeight - Math.max(30, exportHeight * 0.04)
    );

    ctx.shadowBlur = 0;
  }

  if (lipName) {
    const badgeSize = Math.max(74, Math.round(exportWidth * 0.18));
    const badgeX = padding;
    const badgeY = exportHeight - padding - badgeSize;
    const badgeRadius = Math.max(12, Math.round(badgeSize * 0.16));
    const textMaxWidth = badgeSize - 14;
    const textColor = getReadableTextColor(lipColor || '#ffffff');

    ctx.shadowColor = 'rgba(0,0,0,0.18)';
    ctx.shadowBlur = 8;
    ctx.fillStyle = lipColor || 'rgba(255,255,255,0.9)';
    roundRect(ctx, badgeX, badgeY, badgeSize, badgeSize, badgeRadius);
    ctx.fill();
    ctx.shadowBlur = 0;

    ctx.strokeStyle = 'rgba(255,255,255,0.75)';
    ctx.lineWidth = 1;
    roundRect(ctx, badgeX + 0.5, badgeY + 0.5, badgeSize - 1, badgeSize - 1, badgeRadius);
    ctx.stroke();

    ctx.fillStyle = textColor;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = `500 ${Math.max(9, Math.round(badgeSize * 0.13))}px Poppins, Arial, sans-serif`;
    wrapCanvasText(ctx, lipName, badgeX + badgeSize / 2, badgeY + badgeSize / 2, textMaxWidth, Math.round(badgeSize * 0.17), 3);
  }

  ctx.restore();
}

function shouldDrawExportColorLabel(panel) {
  const toggle = panel === 'right' ? exportLabelRightToggle : exportLabelLeftToggle;
  return !toggle || toggle.checked;
}

function shouldDrawExportCustomerName(panel) {
  const toggle = panel === 'right' ? exportNameRightToggle : exportNameLeftToggle;
  return !toggle || toggle.checked;
}

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function formatHexLabel(hex) {
  return normalizeHex(hex || '').toUpperCase();
}

function buildSelectedColorHtml(colorName, colorHex, lipName, lipHex) {
  const drapeHex = formatHexLabel(colorHex);
  const lipHexLabel = formatHexLabel(lipHex);
  const lines = [];

  lines.push(escapeHtml(colorName || '—'));

  if (drapeHex) {
    lines.push(
      '<span class="ycs-hex-row">Drape: ' +
      '<button type="button" class="ycs-hex-copy" data-copy-hex="' + drapeHex + '" title="Copy ' + drapeHex + '">' +
      drapeHex +
      '</button></span>'
    );
  }

  if (lipName || lipHexLabel) {
    lines.push(
      '<span class="ycs-lip-label">Lip: ' +
      escapeHtml(lipName || '—') +
      (lipHexLabel
        ? ' <button type="button" class="ycs-hex-copy" data-copy-hex="' + lipHexLabel + '" title="Copy ' + lipHexLabel + '">' + lipHexLabel + '</button>'
        : '') +
      '</span>'
    );
  }

  return lines.join('<br>');
}

function getReadableTextColor(hex) {
  const normalized = normalizeHex(hex);
  if (!normalized || normalized.length !== 7) return '#2f2a25';
  const r = parseInt(normalized.slice(1, 3), 16);
  const g = parseInt(normalized.slice(3, 5), 16);
  const b = parseInt(normalized.slice(5, 7), 16);
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.62 ? '#2f2a25' : '#ffffff';
}

function wrapCanvasText(ctx, text, centerX, centerY, maxWidth, lineHeight, maxLines) {
  const words = String(text || '').split(/\s+/).filter(Boolean);
  const lines = [];
  let line = '';

  words.forEach(function (word) {
    const testLine = line ? line + ' ' + word : word;
    if (ctx.measureText(testLine).width <= maxWidth || !line) {
      line = testLine;
    } else {
      lines.push(line);
      line = word;
    }
  });

  if (line) lines.push(line);
  const visibleLines = lines.slice(0, maxLines || 3);
  if (lines.length > visibleLines.length) {
    visibleLines[visibleLines.length - 1] = visibleLines[visibleLines.length - 1].replace(/\.*$/, '') + '...';
  }

  const startY = centerY - ((visibleLines.length - 1) * lineHeight) / 2;
  visibleLines.forEach(function (lineText, index) {
    ctx.fillText(lineText, centerX, startY + index * lineHeight, maxWidth);
  });
}

function syncDrapeLayer(panel, color) {
  const svg = panel === 'right' ? rightDrapeSvg : leftDrapeSvg;
  const path = panel === 'right' ? rightDrapePath : leftDrapePath;
  if (!svg || !path) return;

  const drapeColor = normalizeHex(color || path.getAttribute('fill') || '#e8dfd4');
  const realisticEnabled = !!(realisticDrapeToggle && realisticDrapeToggle.checked);

  svg.style.setProperty('--analysis-drape-color', drapeColor);
  svg.style.setProperty('--analysis-drape-overlay-url', 'url("' + REALISTIC_DRAPE_OVERLAY_URL + '")');
  svg.style.setProperty(
    '--analysis-drape-overlay-opacity',
    realisticEnabled ? REALISTIC_DRAPE_OVERLAY_OPACITY : '0'
  );
  svg.classList.toggle('drape-realistic', realisticEnabled);
}

function syncDrapeLayers() {
  syncDrapeLayer('left');
  syncDrapeLayer('right');
}

async function drawRealisticDrapeTexture(ctx, options) {
  const pathD = options.pathD || '';
  const drapeY = options.drapeY || 0;
  const frameWidth = options.frameWidth || 0;
  const drapeHeight = options.drapeHeight || 0;
  const fillColor = normalizeHex(options.fillColor || '#e8dfd4') || '#e8dfd4';
  if (!pathD || !frameWidth || !drapeHeight) return;

  ctx.save();
  ctx.translate(0, drapeY);
  ctx.scale(frameWidth / 1000, drapeHeight / 500);

  try {
    ctx.clip(new Path2D(pathD));
  } catch (clipError) {
    console.warn('Could not clip realistic drape texture', clipError);
  }

  try {
    const overlayImg = await loadImage(REALISTIC_DRAPE_OVERLAY_URL);
    ctx.globalCompositeOperation = 'multiply';
    ctx.globalAlpha = 0.9;
    ctx.drawImage(overlayImg, 0, 0, 1000, 500);
  } catch (overlayError) {
    console.warn('Could not render realistic drape image texture', overlayError);
  }

  ctx.globalCompositeOperation = 'multiply';
  ctx.globalAlpha = 0.18;
  const centerShade = ctx.createRadialGradient(500, 80, 80, 500, 250, 520);
  centerShade.addColorStop(0, '#ffffff');
  centerShade.addColorStop(0.55, fillColor);
  centerShade.addColorStop(1, '#555555');
  ctx.fillStyle = centerShade;
  ctx.fillRect(0, 0, 1000, 500);

  ctx.globalCompositeOperation = 'screen';
  ctx.globalAlpha = 0.16;
  const highlight = ctx.createLinearGradient(0, 0, 0, 500);
  highlight.addColorStop(0, '#ffffff');
  highlight.addColorStop(0.35, 'rgba(255,255,255,0.35)');
  highlight.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = highlight;
  ctx.fillRect(0, 0, 1000, 500);

  ctx.restore();
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
  return RETURN_URL || document.referrer || '/pages/my-palettes';
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
        action: 'getStyleMastersPalettes',
        isAdmin: 'true'
      });
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
      console.error('Failed to load private custom palettes for signature studio', error);
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

  function getAnalystPaletteCodes(accessString) {
  const adminStyleMastersCodes = styleMastersPaletteOptions.map(function (palette) {
    return palette.code;
  });

  if (IS_SIGNATURE_MODE) {
    return orderPalettesWithCustomPalettes(adminStyleMastersCodes.concat(ALL_CUSTOMER_PALETTE_CODES));
  }

  if (IS_ADMIN || IS_TRADE || IS_CATOOL || IS_CATOOL_GROWTH) {
    return orderPalettesWithCustomPalettes([DRAPING_PALETTE_CODE].concat(adminStyleMastersCodes, ALL_CUSTOMER_PALETTE_CODES));
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

    paletteSelect.value = IS_SIGNATURE_MODE
  ? (palettes[0] || '')
  : palettes.indexOf(DRAPING_PALETTE_CODE) !== -1
    ? DRAPING_PALETTE_CODE
    : (palettes[0] || '');

    updateCurrentPaletteName();
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

  function syncSignatureFrameLabels() {
  if (!IS_SIGNATURE_MODE) return;

  const firstNameEls = Array.from(document.querySelectorAll('[data-signature-first-name]'));
  const paletteEls = Array.from(document.querySelectorAll('[data-signature-palette-code]'));
  const leftColorEl = document.querySelector('[data-signature-color-name-left]');
  const rightColorEl = document.querySelector('[data-signature-color-name-right]');

  firstNameEls.forEach(function (el) {
    el.textContent = state.clientFirstName || getClientFirstName();
  });

  paletteEls.forEach(function (el) {
  const code = state.customerPaletteCode || getCustomerPaletteCode() || state.analysisResult.resultCode || '';
  el.textContent = code;
  el.hidden = !code;
});

  if (leftColorEl) {
    leftColorEl.textContent = state.leftColorName || '';
  }

  if (rightColorEl) {
    rightColorEl.textContent = state.rightColorName || '';
  }
}

  function syncColorLabels() {
    if (leftColorLabel) {
      if (state.depthLeft && depthStepEl && !depthStepEl.hidden) {
        leftColorLabel.textContent = state.depthLeft;
      } else {
        leftColorLabel.innerHTML = buildSelectedColorHtml(
          state.leftColorName,
          state.leftColorHex,
          state.lip.leftName,
          state.lip.leftColor
        );
      }
    }

    if (rightColorLabel) {
      if (state.depthRight && depthStepEl && !depthStepEl.hidden) {
        rightColorLabel.textContent = state.depthRight;
      } else {
        rightColorLabel.innerHTML = buildSelectedColorHtml(
          state.rightColorName,
          state.rightColorHex,
          state.lip.rightName,
          state.lip.rightColor
        );
      }
    }
    syncSignatureFrameLabels();
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
        signature: state.signature,
        selectedDepth: state.selectedDepth,
        selectedUndertoneLane: state.selectedUndertoneLane,
        grayscale: !!state.grayscale,
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
          leftName: state.lip.leftName,
          rightName: state.lip.rightName,
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
    const undertonesVisible = IS_SIGNATURE_MODE
  ? true
  : undertoneStepEl && !undertoneStepEl.hidden;
    const hasCompletedMask = state.lip.closed && state.lip.points.length >= 3;
    const isEditing = !!state.lip.editing;
    const isAdjusting = !!state.lip.adjusting;

    if (!isEditing && !isAdjusting && !hasCompletedMask && state.lip.points.length > 0) {
      state.lip.points = [];
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
    syncLipOpacityControl();
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

      lipAddShapeBtn.disabled =
      !state.lip.closed ||      // must finish first shape
      shapes.length >= 2;       // max 2 shapes
    }

    if (lipEditShape1Btn) {
      lipEditShape1Btn.disabled = !state.lip.shapes[0];
    }

    if (lipEditShape2Btn) {
      lipEditShape2Btn.disabled = !state.lip.shapes[1];
    }

    syncLipUiMode();
    syncLipOpacityControl();
  } //updateLipActionButton


    // 🔑 KEY FIX: always exit shape creation cleanly
   lipCancelBtns.forEach(function (lipCancelBtn) {
  lipCancelBtn.onclick = function () {
    state.lip.editing = false;
    state.lip.adjusting = false;
    state.lip.movingPhoto = false;
    state.lip.dragIndex = -1;
    state.lip.dragSvg = null;

    if (lipMovePhotoBtn) {
      lipMovePhotoBtn.textContent = 'Move Photo';
    }

    appEl.classList.remove('is-lip-editing');
    appEl.classList.remove('is-lip-adjusting');

    updateLipActionButtons();
    syncLipUiMode();
    syncLipOpacityControl();
    renderLips();
    saveAnalysisSession();
  };
}); 
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

  function updateImageTransform() {
    const transform =
      'translate(calc(-50% + ' + state.x + 'px), calc(-50% + ' + state.y + 'px)) scale(' + state.scale + ')';

    leftImg.style.transform = transform;
    rightImg.style.transform = transform;

    const filterValue = state.grayscale ? 'grayscale(1)' : 'none';
    leftImg.style.filter = filterValue;
    rightImg.style.filter = filterValue;

    Array.from(document.querySelectorAll('.ycs-analysis-depth-photo')).forEach(function (img) {
      img.style.transform = transform;
      img.style.filter = filterValue;
    });

    requestAnimationFrame(syncLipOverlayToImage);
  }

  function applySavedTransform(transform) {
    if (
      transform &&
      typeof transform.x === 'number' &&
      typeof transform.y === 'number' &&
      typeof transform.scale === 'number'
    ) {
      state.x = transform.x;
      state.y = transform.y;
      state.scale = clampScale(transform.scale);
    } else {
      state.x = 0;
      state.y = 0;
      state.scale = 1;
    }

    syncZoomSliders(state.scale);
    updateImageTransform();
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
  }//getCompletedLipShapes

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
} // setActiveLipShape

  async function savePhotoTransform(options) {
    options = options || {};
    const silent = !!options.silent;

    if (!ACTIVE_RECORD_ID) {
      if (!silent) alert('No client record ID found.');
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
  refreshSignatureSideHighlights();
}

  function updateDrapeShape() {
    const d = window.innerWidth <= 900
      ? 'M0,255 Q140,182 305,198 Q500,355 695,198 Q860,182 1000,255 L1000,500 L0,500 Z'
      : 'M0,235 Q160,170 320,182 Q500,310 680,182 Q840,170 1000,235 L1000,500 L0,500 Z';

    leftDrapePath.setAttribute('d', d);
    rightDrapePath.setAttribute('d', d);
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
async function fetchSignatureLipColors(paletteCode) {
  try {
    const url =
      '/apps/palette-data?action=getSignatureLipColors&palette=' +
      encodeURIComponent(paletteCode);

    const res = await fetch(url, { credentials: 'same-origin' });
    const data = await res.json();

    return Array.isArray(data.lipColors) ? data.lipColors : [];
  } catch (error) {
    console.error('Failed to load signature lip colors', error);
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
      saveAnalysisSession();
    };
  }
function renderSignatureLipSwatches(colors) {
  if (!lipSwatchContainer) return;

  lipSwatchContainer.innerHTML = '';

  const wrap = document.createElement('div');
  wrap.className = 'ycs-analysis-guided-swatches';

  if (!colors || !colors.length) {
    const empty = document.createElement('div');
    empty.className = 'ycs-analysis-guided-empty';
    empty.textContent = 'No lip colors for this palette yet.';
    lipSwatchContainer.appendChild(empty);
    return;
  }

  colors.forEach(function (color) {
    const hex = normalizeHex(color.hex || '');
    const name = color.name || 'Lip Color';

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
    state.lip.rightName = name;
    state.lip.rightVisible = true;
  } else {
    state.lip.leftColor = hex;
    state.lip.leftName = name;
    state.lip.leftVisible = true;
  }

  syncLipUiMode();
  renderLips();
  syncColorLabels();   // 👈 IMPORTANT
  saveAnalysisSession();
});

    wrap.appendChild(btn);
  });

  lipSwatchContainer.appendChild(wrap);
}

function getSignatureSideRefs(panel) {
  const isRight = panel === 'right';
  return {
    paletteSelect: isRight ? signatureRightPaletteSelect : signatureLeftPaletteSelect,
    filtersEl: isRight ? signatureRightDrapeFilters : signatureLeftDrapeFilters,
    drapeSwatchesEl: isRight ? signatureRightDrapeSwatches : signatureLeftDrapeSwatches,
    lipSwatchesEl: isRight ? signatureRightLipSwatches : signatureLeftLipSwatches
  };
}

function getSignatureSideFilter(panel) {
  return panel === 'right'
    ? (state.signature.rightFilter || 'all')
    : (state.signature.leftFilter || 'all');
}

function setSignatureSideFilter(panel, value) {
  if (panel === 'right') {
    state.signature.rightFilter = value || 'all';
  } else {
    state.signature.leftFilter = value || 'all';
  }
}

function populateSignatureSidePaletteSelects() {
  if (!IS_SIGNATURE_MODE) return;
  const palettes = getAnalystPaletteCodes(paletteAccessString);
  const selects = [signatureLeftPaletteSelect, signatureRightPaletteSelect].filter(Boolean);

  selects.forEach(function (selectEl, index) {
    const panel = index === 1 ? 'right' : 'left';
    const savedCode = panel === 'right' ? state.signature.rightPaletteCode : state.signature.leftPaletteCode;
    selectEl.innerHTML = '';

    palettes.forEach(function (code) {
      const option = document.createElement('option');
      option.value = code;
      option.textContent = getPaletteDisplayName(code);
      selectEl.appendChild(option);
    });

    selectEl.value = palettes.indexOf(savedCode) !== -1
      ? savedCode
      : (palettes[index] || palettes[0] || '');

    if (panel === 'right') {
      state.signature.rightPaletteCode = selectEl.value;
    } else {
      state.signature.leftPaletteCode = selectEl.value;
    }
  });
}

function getSignatureFilteredColors(colors, panel) {
  const activeFilter = getSignatureSideFilter(panel);
  const sortedColors = colors.slice().sort(function (a, b) {
    return Number(a.sortOrder || 0) - Number(b.sortOrder || 0);
  });

  if (activeFilter === 'all') return sortedColors;

  return sortedColors.filter(function (color) {
    return getCategoryFromColor(color).some(function (category) {
      return String(category).toLowerCase() === activeFilter;
    });
  });
}

function renderSignatureSideFilters(containerEl, colors, panel) {
  if (!containerEl) return;

  const categorySet = new Set();
  colors.forEach(function (color) {
    getCategoryFromColor(color).forEach(function (category) {
      if (category) categorySet.add(String(category).toLowerCase());
    });
  });

  const filters = [{ key: 'all', label: 'All' }].concat(
    Array.from(categorySet).map(function (category) {
      return { key: category, label: category };
    })
  );

  const activeFilter = filters.some(function (filter) {
    return filter.key === getSignatureSideFilter(panel);
  }) ? getSignatureSideFilter(panel) : 'all';

  setSignatureSideFilter(panel, activeFilter);
  containerEl.innerHTML = '';

  filters.forEach(function (filter) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'ycs-signature-side-filter';
    btn.textContent = filter.label;
    btn.classList.toggle('is-active', filter.key === activeFilter);

    btn.addEventListener('click', function () {
      setSignatureSideFilter(panel, filter.key);
      renderSignatureSide(panel);
    });

    containerEl.appendChild(btn);
  });
}

function renderSignatureSideDrapeSwatches(containerEl, colors, panel) {
  if (!containerEl) return;
  containerEl.innerHTML = '';

  if (!colors.length) {
    const empty = document.createElement('p');
    empty.className = 'ycs-signature-side-empty';
    empty.textContent = 'No colors found.';
    containerEl.appendChild(empty);
    return;
  }

  colors.forEach(function (color) {
    const hex = normalizeHex(color.hex || color.hexCode || color.colorHex || '');
    const name = color.name || color.colorName || color.title || 'Color';
    if (!hex) return;

    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'ycs-signature-side-swatch';
    btn.style.background = hex;
    btn.dataset.hex = hex;
    btn.title = name + ' ' + formatHexLabel(hex);
    btn.setAttribute('aria-label', name + ' ' + formatHexLabel(hex));

    btn.addEventListener('click', function () {
      setActivePanel(panel);
      applyDrapeColor(panel, hex, name);
      refreshSignatureSideHighlights();
    });

    containerEl.appendChild(btn);
  });
}

function renderSignatureSideLipSwatches(containerEl, colors, panel) {
  if (!containerEl) return;
  containerEl.innerHTML = '';

  if (!colors.length) {
    const empty = document.createElement('p');
    empty.className = 'ycs-signature-side-empty';
    empty.textContent = 'No lip colors for this palette yet.';
    containerEl.appendChild(empty);
    return;
  }

  colors.forEach(function (color) {
    const hex = normalizeHex(color.hex || color.hexCode || color.colorHex || '');
    const name = color.name || color.colorName || color.title || 'Lip Color';
    if (!hex) return;

    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'ycs-signature-side-swatch';
    btn.style.background = hex;
    btn.dataset.hex = hex;
    btn.title = name + ' ' + formatHexLabel(hex);
    btn.setAttribute('aria-label', name + ' ' + formatHexLabel(hex));

    btn.addEventListener('click', function () {
      setActivePanel(panel);
      if (panel === 'right') {
        state.lip.rightColor = hex;
        state.lip.rightName = name;
        state.lip.rightVisible = true;
      } else {
        state.lip.leftColor = hex;
        state.lip.leftName = name;
        state.lip.leftVisible = true;
      }

      syncLipUiMode();
      renderLips();
      syncColorLabels();
      refreshSignatureSideHighlights();
      saveAnalysisSession();
    });

    containerEl.appendChild(btn);
  });
}

async function renderSignatureSide(panel) {
  if (!IS_SIGNATURE_MODE) return;
  const refs = getSignatureSideRefs(panel);
  if (!refs.paletteSelect) return;

  const paletteCode = refs.paletteSelect.value || paletteSelect.value || '';
  if (panel === 'right') {
    state.signature.rightPaletteCode = paletteCode;
  } else {
    state.signature.leftPaletteCode = paletteCode;
  }

  const colors = await fetchPaletteColors(paletteCode);
  const lipColors = await fetchSignatureLipColors(paletteCode);
  const filteredColors = getSignatureFilteredColors(colors, panel);

  renderSignatureSideFilters(refs.filtersEl, colors, panel);
  renderSignatureSideDrapeSwatches(refs.drapeSwatchesEl, filteredColors, panel);
  renderSignatureSideLipSwatches(refs.lipSwatchesEl, lipColors, panel);
  refreshSignatureSideHighlights();
  if (!isRestoringSession) {
    saveAnalysisSession();
  }
}

function refreshSignatureSideHighlights() {
  if (!IS_SIGNATURE_MODE) return;

  [
    { panel: 'left', drapeHex: state.leftColorHex, lipHex: state.lip.leftColor },
    { panel: 'right', drapeHex: state.rightColorHex, lipHex: state.lip.rightColor }
  ].forEach(function (item) {
    const refs = getSignatureSideRefs(item.panel);
    if (refs.drapeSwatchesEl) {
      Array.from(refs.drapeSwatchesEl.querySelectorAll('.ycs-signature-side-swatch')).forEach(function (btn) {
        btn.classList.toggle('is-active', normalizeHex(btn.dataset.hex || '') === normalizeHex(item.drapeHex || ''));
      });
    }

    if (refs.lipSwatchesEl) {
      Array.from(refs.lipSwatchesEl.querySelectorAll('.ycs-signature-side-swatch')).forEach(function (btn) {
        btn.classList.toggle('is-active', normalizeHex(btn.dataset.hex || '') === normalizeHex(item.lipHex || ''));
      });
    }
  });
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
  if (IS_SIGNATURE_MODE) {
    guidedPanelEl.hidden = true;
    standardPanelEl.hidden = false;
    return;
  }

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
    } else {
      state.depthLeft = depth;
      leftDepthDrapeImg.src = src;
      leftDepthDrapeImg.hidden = false;
      leftDrapePath.style.visibility = 'visible';
      leftDrapePath.setAttribute('fill', '#ffffff');
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

    syncColorLabels();
  }

  function updatePhotoPrepLink() {
  if (!photoPrepLink) return;

  const currentSignatureUrl =
    window.location.pathname + window.location.search;

  const mode = (urlParams.get('mode') || '').trim().toLowerCase();

  if (mode === 'member' && (ADMIN_CUSTOMER_ID || CLIENT_RECORD_ID)) {
  const memberCustomerId = ADMIN_CUSTOMER_ID || CLIENT_RECORD_ID;

  const prepQuery = new URLSearchParams({
  mode: 'member',
  workflow: 'member-photo',
  adminCustomerId: memberCustomerId,
  returnUrl: currentSignatureUrl
});

if (PHOTO_ID) {
  prepQuery.set('photoId', PHOTO_ID);
}

if (PHOTO_SOURCE) {
  prepQuery.set('photoSource', PHOTO_SOURCE);
}

addAdminPreviewParam(prepQuery);

photoPrepLink.href =
  '/pages/photo-prep?' + prepQuery.toString();

  return;
}

  photoPrepLink.textContent = 'Back to Photo Prep';

  if (CLIENT_RECORD_ID) {
    const prepQuery = new URLSearchParams({
      mode: 'trade',
      workflow: 'color-analysis',
      clientRecordId: CLIENT_RECORD_ID,
      returnUrl: currentSignatureUrl
    });
    addAdminPreviewParam(prepQuery);
    photoPrepLink.href =
      '/pages/photo-prep?' +
      prepQuery.toString();

    return;
  }

  if (ADMIN_CUSTOMER_ID) {
    const prepQuery = new URLSearchParams({
      mode: 'trade',
      workflow: 'color-analysis',
      adminCustomerId: ADMIN_CUSTOMER_ID,
      returnUrl: currentSignatureUrl
    });
    addAdminPreviewParam(prepQuery);
    photoPrepLink.href =
      '/pages/photo-prep?' +
      prepQuery.toString();

    return;
  }

  const prepQuery = new URLSearchParams({
    mode: 'trade',
    workflow: 'color-analysis',
    returnUrl: currentSignatureUrl
  });
  addAdminPreviewParam(prepQuery);
  photoPrepLink.href =
    '/pages/photo-prep?' +
    prepQuery.toString();
}

function updateBackLink() {
  if (!signatureBackLink) return;

  const mode = (urlParams.get('mode') || '').trim().toLowerCase();

  if (mode === 'member' && (ADMIN_CUSTOMER_ID || CLIENT_RECORD_ID)) {
    signatureBackLink.textContent = '← Back to Member Photos';
    signatureBackLink.href = '/pages/member-photos';
    return;
  }

  signatureBackLink.textContent = '← Back to Client List';
  signatureBackLink.href = appendAdminPreviewToHref('/pages/photo-prep?mode=trade&workflow=color-analysis');
}

function buildStandardAnalysisHref() {
  const query = new URLSearchParams();
  query.set('returnUrl', window.location.pathname + window.location.search);
  query.set('mode', 'trade');

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

  addAdminPreviewParam(query);
  const queryString = query.toString();
  return '/pages/color-analysis-tool' + (queryString ? '?' + queryString : '');
}

function updateStandardAnalysisLink() {
  if (!standardAnalysisLink) return;
  standardAnalysisLink.href = buildStandardAnalysisHref();
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
    return 'ycs-analysis-state:' + (CLIENT_RECORD_ID || CUSTOMER_ID || 'default');
  }
function getSharedLipStorageKey() {
  return 'ycs-shared-lip-state:' + (CLIENT_RECORD_ID || CUSTOMER_ID || 'default');
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
state.lip.editing = false;
state.lip.adjusting = false;
state.lip.movingPhoto = false;
appEl.classList.remove('is-lip-editing');
appEl.classList.remove('is-lip-adjusting');
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

    state.signature = Object.assign({}, state.signature, saved.signature || {});

    state.selectedDepth = saved.selectedDepth || '';
    state.selectedUndertoneLane = saved.selectedUndertoneLane || '';
    state.grayscale = !!saved.grayscale;

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
  state.lip.leftName = saved.lip.leftName || '';
  state.lip.rightName = saved.lip.rightName || '';
  state.lip.leftOpacity = typeof saved.lip.leftOpacity === 'number' ? saved.lip.leftOpacity : 0.45;
  state.lip.rightOpacity = typeof saved.lip.rightOpacity === 'number' ? saved.lip.rightOpacity : 0.45;
  state.lip.leftVisible = saved.lip.leftVisible !== false;
  state.lip.rightVisible = saved.lip.rightVisible !== false;
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

state.lip.showGuides = saved.lip.showGuides !== false;
state.lip.editing = false;
state.lip.adjusting = false;
state.lip.movingPhoto = false;
appEl.classList.remove('is-lip-editing');
appEl.classList.remove('is-lip-adjusting');
}
    if (grayscaleToggle) {
      grayscaleToggle.checked = !!state.grayscale;
    }

    setActivePanel(state.activePanel);
    syncColorLabels();
    updateImageTransform();
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
      !state.selectedDepth ||
      (saved.analysisCurrentStep && saved.analysisCurrentStep === 'depth');

    if (shouldShowDepthStep) {
      renderDepthStep();
      refreshAllSwatchHighlights();
      return;
    }

    hideDepthStageDrapes();

    if (state.selectedDepth) {
      if (depthStepEl) depthStepEl.hidden = true;
      if (undertoneStepEl) undertoneStepEl.hidden = false;
      if (chromaStepEl) chromaStepEl.hidden = true;

      await renderUndertoneSections(state.selectedDepth);

      if (!state.selectedUndertoneLane) {
        showLipEmptyModeNow();
      }

      if (state.selectedUndertoneLane) {
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

    refreshAllSwatchHighlights();
  }

  function commitAnalysisResult(lane, chroma) {
    const result = buildResultFromLaneAndChroma(lane, chroma);

    state.analysisResult.depth = result.depth;
    state.analysisResult.undertone = result.undertone;
    state.analysisResult.chroma = result.chroma;
    state.analysisResult.resultCode = result.resultCode;
    state.analysisResult.resultLabel = result.resultLabel;

    if (chromaResultEl && chromaResultTextEl) {
      chromaResultEl.hidden = false;
      chromaResultTextEl.textContent = state.analysisResult.resultLabel;
    }

    saveAnalysisSession();
  }

  function resetGuidedFlow() {
    state.selectedDepth = '';
    state.selectedUndertoneLane = '';

    state.analysisResult.depth = '';
    state.analysisResult.undertone = '';
    state.analysisResult.chroma = '';
    state.analysisResult.resultCode = '';
    state.analysisResult.resultLabel = '';

    if (depthStepEl) depthStepEl.hidden = false;
    if (undertoneStepEl) undertoneStepEl.hidden = true;
    if (chromaStepEl) chromaStepEl.hidden = true;

    if (depthSectionsEl) depthSectionsEl.innerHTML = '';
    if (undertoneSectionsEl) undertoneSectionsEl.innerHTML = '';
    if (chromaSectionsEl) chromaSectionsEl.innerHTML = '';

    if (chromaResultEl && chromaResultTextEl) {
      chromaResultEl.hidden = true;
      chromaResultTextEl.textContent = '—';
    }

    setLipVisibilityForCurrentStep();

    if (!isRestoringSession) {
      saveAnalysisSession();
    }
  }

  function resetAnalysisForNewPhoto() {
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
  syncColorLabels();
  setActivePanel('left');
  setLipVisibilityForCurrentStep();
  syncLipUiMode();
  syncLipOpacityControl();
  syncSignatureFrameLabels();
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

  function setLipVisibilityForCurrentStep() {
  const undertonesVisible = undertoneStepEl && !undertoneStepEl.hidden;
  const showLipsNow = IS_SIGNATURE_MODE ? true : !!undertonesVisible;

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
    saveAnalysisSession();

    if (undertoneStepEl) undertoneStepEl.hidden = true;

    chromaStepEl.hidden = false;
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
    saveAnalysisSession();
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

  renderModeForPalette(paletteCode);

  if (IS_SIGNATURE_MODE) {
    if (signatureLeftPaletteSelect || signatureRightPaletteSelect) {
      await Promise.all([
        renderSignatureSide('left'),
        renderSignatureSide('right')
      ]);
    } else {
      renderFilterButtons();
      renderFilteredSwatches();

      const signatureLipColors = await fetchSignatureLipColors(paletteCode);
      renderSignatureLipSwatches(signatureLipColors);
    }

    setLipVisibilityForCurrentStep();
    syncLipUiMode();
    syncLipOpacityControl();
    renderLips();

    hideSwatchLoading();
    return;
  }

  resetGuidedFlow();

  if (isDrapingPalette(paletteCode)) {
    await ensureDrapingLipColorsLoaded();
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
  if (!ACTIVE_RECORD_ID) {
    alert('No client record ID found.');
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
(PHOTO_SOURCE ? '&source=' + encodeURIComponent(PHOTO_SOURCE) : '')
    );
    const data = await res.json();
    state.clientFirstName = data.firstName || getClientFirstName() || '';
state.clientLastName = data.lastName || getClientLastName() || '';
state.customerPaletteCode = getCustomerPaletteCode() || data.customerPaletteCode || '';

    if (!res.ok) {
      throw new Error(data.error || 'Could not load photo');
    }

    if (!data || !data.activePhotoUrl) {
      throw new Error('No saved photo found for this client.');
    }

    await loadPhotoIntoPanels(data.activePhotoUrl);
applySavedTransform(data.photoTransform || null);

if (data.lipMask) {
  if (Array.isArray(data.lipMask.shapes) && data.lipMask.shapes.length) {
    state.lip.shapes = data.lipMask.shapes.slice(0, 2);
    state.lip.activeShapeIndex = 0;
    state.lip.points = state.lip.shapes[0].points || [];
    state.lip.closed = !!state.lip.shapes[0].closed;
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

  async function downloadPanelView(panel) {
    if (!state.imgLoaded || !state.loadedImageUrl) {
      alert('No photo loaded.');
      return;
    }

    const isRight = panel === 'right';
    const frameEl = isRight ? rightFrame : leftFrame;
    const drapePathEl = isRight ? rightDrapePath : leftDrapePath;
    const colorName = isRight ? state.rightColorName : state.leftColorName;
    const drapeColorHex = isRight ? state.rightColorHex : state.leftColorHex;
    const lipName = isRight ? state.lip.rightName : state.lip.leftName;
    const lipColor = isRight ? state.lip.rightColor : state.lip.leftColor;

    try {
  const frameRect = frameEl.getBoundingClientRect();
  const frameWidth = Math.round(frameRect.width);
  const frameHeight = Math.round(frameRect.height);

  let signatureDrapeY = frameHeight * 0.72;
  let signatureDrapeHeight = frameHeight * 0.28;

      const canvas = document.createElement('canvas');
      canvas.width = frameWidth * 2;
      canvas.height = frameHeight * 2;

      const ctx = canvas.getContext('2d');
      ctx.scale(2, 2);

      const uploadedImg = await loadImage(state.loadedImageUrl);

      const naturalWidth = uploadedImg.naturalWidth;
      const naturalHeight = uploadedImg.naturalHeight;

      const fitScale = Math.min(frameWidth / naturalWidth, frameHeight / naturalHeight);
      const baseWidth = naturalWidth * fitScale;
      const baseHeight = naturalHeight * fitScale;

      const drawWidth = baseWidth * state.scale;
      const drawHeight = baseHeight * state.scale;

      const centerX = frameWidth / 2 + state.x;
      const centerY = frameHeight / 2 + state.y;

      const drawX = centerX - drawWidth / 2;
      const drawY = centerY - drawHeight / 2;

      ctx.filter = state.grayscale ? 'grayscale(1)' : 'none';
      ctx.drawImage(uploadedImg, drawX, drawY, drawWidth, drawHeight);
      ctx.filter = 'none';
      const lipCanvas = isRight ? rightLipCanvas : leftLipCanvas;

if (lipCanvas) {
  const lipRect = lipCanvas.getBoundingClientRect();
  const frameRectForLip = frameEl.getBoundingClientRect();

  const lipX = lipRect.left - frameRectForLip.left;
  const lipY = lipRect.top - frameRectForLip.top;
  const lipW = lipRect.width;
  const lipH = lipRect.height;

  ctx.drawImage(lipCanvas, lipX, lipY, lipW, lipH);
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
        signatureDrapeY = drapeY;
        signatureDrapeHeight = drapeHeight;

        const depthOverlayEl = isRight ? rightDepthDrapeImg : leftDepthDrapeImg;
        const hasDepthOverlay =
          depthOverlayEl && !depthOverlayEl.hidden && depthOverlayEl.getAttribute('src');

        if (realisticDrapeToggle && realisticDrapeToggle.checked && !hasDepthOverlay) {
          await drawRealisticDrapeTexture(ctx, {
            pathD: pathD,
            drapeY: drapeY,
            frameWidth: frameWidth,
            drapeHeight: drapeHeight,
            fillColor: fillColor
          });
        }

        if (hasDepthOverlay) {
          const depthOverlayImg = await loadImage(depthOverlayEl.getAttribute('src'));
          const overlayRect = depthOverlayEl.getBoundingClientRect();
          const frameRect2 = frameEl.getBoundingClientRect();

          const overlayX = overlayRect.left - frameRect2.left;
          const overlayY = overlayRect.top - frameRect2.top;
          const overlayWidth = overlayRect.width;
          const overlayHeight = overlayRect.height;

          ctx.drawImage(depthOverlayImg, overlayX, overlayY, overlayWidth, overlayHeight);
        }
      } finally {
        URL.revokeObjectURL(svgUrl);
      }
      drawSignatureExportLabels(ctx, canvas, {
  firstName: state.clientFirstName || getClientFirstName(),
  paletteCode: state.customerPaletteCode || getCustomerPaletteCode(),
  colorName: colorName,
  lipName: lipName,
  lipColor: lipColor,
  showColorName: shouldDrawExportColorLabel(panel),
  showCustomerName: shouldDrawExportCustomerName(panel),
  drapeY: signatureDrapeY,
  drapeHeight: signatureDrapeHeight
});
      //saved file name
      function slugify(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

const color = slugify(colorName) || 'color';
const lip = slugify(lipName) || 'none';
const firstName = slugify(state.clientFirstName || getClientFirstName()) || 'client';
const lastName = slugify(state.clientLastName || getClientLastName()) || 'photo';
const fileName = [color, 'lip', lip, firstName, lastName].join('-');


      const dataUrl = canvas.toDataURL('image/png');

      try {
        await saveDrapedImageForReport({
          imageBase64: dataUrl,
          clientRecordId: CLIENT_RECORD_ID,
          customerId: CUSTOMER_ID,
          consultantId: VIEWER_CUSTOMER_ID,
          paletteCode: isRight
            ? (signatureRightPaletteSelect && signatureRightPaletteSelect.value) || paletteSelect.value || ''
            : (signatureLeftPaletteSelect && signatureLeftPaletteSelect.value) || paletteSelect.value || '',
          panel: panel,
          drapeColorName: colorName,
          drapeColorHex: drapeColorHex,
          lipColorName: lipName,
          lipColorHex: lipColor,
          fileName: fileName
        });
      } catch (saveError) {
        console.warn('Could not save draped image for report selection:', saveError);
        window.setTimeout(function () {
          alert('The PNG downloaded, but it could not be saved for report selection yet.');
        }, 0);
      }

      const link = document.createElement('a');
      link.href = dataUrl;
      link.download = `${fileName}.png`;
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (error) {
      console.error('Could not download panel view', error);
      alert('Could not save this view. Please try again.');
    }
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
    saveAnalysisSession();
  });
}

function setLipOpacityForPanel(panel, value) {
  const opacity = Math.max(0.1, Math.min(0.8, parseFloat(value) || 0.45));

  if (panel === 'right') {
    state.lip.rightOpacity = opacity;
  } else {
    state.lip.leftOpacity = opacity;
  }

  syncLipOpacityControl();
  renderLips();
  saveAnalysisSession();
}

function syncSignatureLipSideControl(panel) {
  const isRight = panel === 'right';
  const input = isRight ? signatureRightLipOpacityInput : signatureLeftLipOpacityInput;
  const valueEl = isRight ? signatureRightLipOpacityValue : signatureLeftLipOpacityValue;
  const visibilityBtn = isRight ? signatureRightLipVisibilityBtn : signatureLeftLipVisibilityBtn;
  const editBtn = isRight ? signatureRightLipEditBtn : signatureLeftLipEditBtn;
  const value = isRight ? state.lip.rightOpacity : state.lip.leftOpacity;
  const visible = isRight ? state.lip.rightVisible : state.lip.leftVisible;
  const hasCompletedMask = getCompletedLipShapes().length > 0;
  const sectionEl = editBtn ? editBtn.closest('.ycs-signature-side-section--lip') : null;

  if (sectionEl) {
    sectionEl.classList.toggle('has-lip-shape', hasCompletedMask);
  }

  if (editBtn) {
    editBtn.textContent = hasCompletedMask ? 'Edit' : 'Create Lip';
  }

  if (input) {
    input.value = String(value);
    input.disabled = !hasCompletedMask;
  }

  if (valueEl) {
    valueEl.textContent = Math.round(value * 100) + '%';
  }

  if (visibilityBtn) {
    visibilityBtn.disabled = !hasCompletedMask;
    visibilityBtn.textContent = visible ? 'Hide Lips' : 'Show Lips';
  }
}

function syncLipOpacityControl() {
  const value = state.activePanel === 'right'
    ? state.lip.rightOpacity
    : state.lip.leftOpacity;

  if (lipOpacityInput && lipOpacityValue) {
    lipOpacityInput.value = String(value);
    lipOpacityValue.textContent = Math.round(value * 100) + '%';
  }

  syncSignatureLipSideControl('left');
  syncSignatureLipSideControl('right');
}

function enterLipEditOrAdjustMode() {
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
  saveAnalysisSession();
}

[
  { panel: 'left', input: signatureLeftLipOpacityInput },
  { panel: 'right', input: signatureRightLipOpacityInput }
].forEach(function (item) {
  if (!item.input) return;

  item.input.addEventListener('input', function () {
    setLipOpacityForPanel(item.panel, this.value);
  });
});

[
  { panel: 'left', button: signatureLeftLipVisibilityBtn },
  { panel: 'right', button: signatureRightLipVisibilityBtn }
].forEach(function (item) {
  if (!item.button) return;

  item.button.addEventListener('click', function () {
    setActivePanel(item.panel);

    if (item.panel === 'right') {
      state.lip.rightVisible = !state.lip.rightVisible;
    } else {
      state.lip.leftVisible = !state.lip.leftVisible;
    }

    syncLipUiMode();
    renderLips();
    saveAnalysisSession();
  });
});

[
  { panel: 'left', button: signatureLeftLipEditBtn },
  { panel: 'right', button: signatureRightLipEditBtn }
].forEach(function (item) {
  if (!item.button) return;

  item.button.addEventListener('click', function () {
    setActivePanel(item.panel);
    enterLipEditOrAdjustMode();
  });
});

  if (lipGuidesToggleBtn) {
    lipGuidesToggleBtn.onclick = function () {
      state.lip.showGuides = !state.lip.showGuides;
      lipGuidesToggleBtn.textContent = state.lip.showGuides ? 'Hide Outline' : 'Show Outline';
      renderLips();
    };
  }
// LIP HANDLERS
  if (lipEditBtn) {
  lipEditBtn.onclick = function () {
    state.lip.editing = true;
    state.lip.adjusting = false;
    state.lip.closed = false;
    state.lip.points = [];
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
  if (lipEditAgainBtn) {
    lipEditAgainBtn.onclick = function () {
      enterLipEditOrAdjustMode();
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
    }; // onclick
  } //lipFinishBttn

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
} //lipAddShapeBtn
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

  if (backBtn) {
    backBtn.addEventListener('click', function () {
      if (document.referrer && document.referrer.indexOf('/pages/') !== -1) {
        window.history.back();
      } else {
        window.location.href = getReturnUrl();
      }
    });
  }

  activePanelButtons.forEach(function (btn) {
    btn.addEventListener('click', function () {
      setActivePanel(btn.dataset.panel);
    });
  });

  document.addEventListener('click', function (event) {
    const copyBtn = event.target.closest('.ycs-hex-copy');
    if (!copyBtn) return;

    event.preventDefault();
    event.stopPropagation();

    const hex = copyBtn.dataset.copyHex || copyBtn.textContent.trim();
    if (!hex) return;

    navigator.clipboard.writeText(hex).then(function () {
      const original = copyBtn.textContent;
      copyBtn.textContent = 'Copied';
      copyBtn.classList.add('is-copied');
      window.setTimeout(function () {
        copyBtn.textContent = original;
        copyBtn.classList.remove('is-copied');
      }, 900);
    }).catch(function () {
      window.prompt('Copy hex code', hex);
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
        event.target.closest('.ycs-hex-copy') ||
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
    syncSignatureFrameLabels();

    // In Signature mode, keep the currently draped colors when switching palettes.
    // Only the swatch list should change.
    if (!IS_SIGNATURE_MODE) {
      state.leftColorHex = '';
      state.rightColorHex = '';
      state.leftColorName = '';
      state.rightColorName = '';

      syncColorLabels();
      setActivePanel('left');
    }

    saveAnalysisSession();
    renderPaletteUI(this.value);
  });
}

  if (signatureLeftPaletteSelect) {
    signatureLeftPaletteSelect.addEventListener('change', function () {
      state.signature.leftPaletteCode = this.value;
      state.signature.leftFilter = 'all';
      renderSignatureSide('left');
    });
  }

  if (signatureRightPaletteSelect) {
    signatureRightPaletteSelect.addEventListener('change', function () {
      state.signature.rightPaletteCode = this.value;
      state.signature.rightFilter = 'all';
      renderSignatureSide('right');
    });
  }

  if (realisticDrapeToggle) {
    realisticDrapeToggle.checked = true;
    realisticDrapeToggle.addEventListener('change', function () {
      syncDrapeLayers();
    });
  }

  if (savePositionBtn) {
    savePositionBtn.addEventListener('click', function () {
      savePhotoTransform();
    });
  }

  if (resetUndertoneBtn) {
  resetUndertoneBtn.addEventListener('click', async function () {
    state.selectedUndertoneLane = '';
    state.analysisResult.undertone = '';
    state.analysisResult.chroma = '';
    state.analysisResult.resultCode = '';
    state.analysisResult.resultLabel = '';

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

    saveAnalysisSession();
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

  if (standardAnalysisLink) {
    updateStandardAnalysisLink();
    standardAnalysisLink.addEventListener('click', function () {
      standardAnalysisLink.href = buildStandardAnalysisHref();
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

  // 🚫 BLOCK DRAG DURING PINCH
  if (gestureState.isPinching) return;
  if (!state.dragging) return;
  if (state.pointerId !== event.pointerId) return;

  state.x = event.clientX - state.dragStartX;
  state.y = event.clientY - state.dragStartY;
  updateImageTransform();
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
  window.addEventListener('pageshow', function () {
  syncSignatureFrameLabels();
    });
  (async function initAnalysisTool() {
    updateLipActionButtons();
    updateDrapeShape();
    syncZoomSliderBounds();
    syncDrapeLayers();
    const customPaletteResults = await Promise.all([
      loadAdminStyleMastersPalettes(),
      loadPrivateCustomPalettes()
    ]);
    styleMastersPaletteOptions = customPaletteResults[0];
    privateCustomPaletteOptions = customPaletteResults[1];
    populatePaletteSelect();
    populateSignatureSidePaletteSelects();

const saved = loadAnalysisSession();
        if (saved && saved.paletteCode && paletteSelect) {
            paletteSelect.value = saved.paletteCode;
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

        

    if (IS_SIGNATURE_MODE) {
        if (shouldRestoreSavedSession) {
            applySavedAnalysisState(latestSaved);
            setActivePanel(state.activePanel);
            syncColorLabels();
            populateSignatureSidePaletteSelects();
            await Promise.all([
                renderSignatureSide('left'),
                renderSignatureSide('right')
            ]);
        }

        const sharedLip = loadSharedLipSession();
        const sharedLipPhotoKey =
            sharedLip && sharedLip.photoSessionKey
            ? String(sharedLip.photoSessionKey)
            : '';
        const latestSavedPhotoKey =
            latestSaved && latestSaved.photoSessionKey
            ? String(latestSaved.photoSessionKey)
            : '';
        const canApplySharedLip =
            sharedLip &&
            sharedLip.lip &&
            hasCompletedLipShapes(sharedLip.lip) &&
            (!sharedLipPhotoKey || sharedLipPhotoKey === state.photoSessionKey);
        const canApplyLatestSavedLip =
            latestSaved &&
            latestSaved.lip &&
            hasCompletedLipShapes(latestSaved.lip) &&
            latestSavedPhotoKey === state.photoSessionKey;

        if (canApplySharedLip) {
            applySharedLipState(sharedLip);
            } else if (canApplyLatestSavedLip) {
                applySharedLipState({ lip: latestSaved.lip });
                }

        isRestoringSession = false;

        requestAnimationFrame(function () {
            updateImageTransform();
            syncLipOverlayToImage();
            setLipVisibilityForCurrentStep();
            syncLipUiMode();
            syncLipOpacityControl();
            renderLips();
            refreshSignatureSideHighlights();
        });

        updatePhotoPrepLink();
        updateBackLink();
        syncLipOpacityControl();
        return;
}

  if (forceDepthReturn && isDrapingPalette(paletteSelect.value)) {
    resetAnalysisForNewPhoto();
    renderDepthStep();
    saveAnalysisSession();
  } else if (shouldRestoreSavedSession) {
    await restoreGuidedFlowFromSession();
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
  updateStandardAnalysisLink();

  ensureLipEmptyModeVisible();
  requestAnimationFrame(function () {
    ensureLipEmptyModeVisible();
  });
  syncLipOpacityControl();
})();
})();
