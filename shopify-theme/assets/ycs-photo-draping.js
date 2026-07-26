(function () {
  console.log('YCS PHOTO DRAPING JS LOADED');

  const appEl = document.querySelector('.ycs-drape-app');

  const IS_SAMPLE_USER = appEl && appEl.dataset
    ? (appEl.dataset.isSampleUser === 'true')
    : false;

  const uploadBtn = document.getElementById('ycs-upload-btn');
  const fileInput = document.getElementById('ycs-photo-input');
  const previewImg = document.getElementById('ycs-photo-preview');
  const uploadWrap = document.querySelector('.ycs-drape-upload');
  const photoFrame = document.getElementById('ycs-photo-frame');
  const drapeWrap = document.getElementById('ycs-drape-wrap');
  const drapePath = document.getElementById('ycs-drape-path');
  const drapeClipPath = document.getElementById('ycs-drape-clip-path');
  const studioRoot = document.getElementById('ycs-drape-studio-root');
  const paletteSelect = document.getElementById('ycs-drape-palette-select');
  const currentPaletteNameEl = document.getElementById('ycs-current-palette-name');
  const swatchesEl = document.getElementById('ycs-drape-swatches');
  const filtersEl = document.getElementById('ycs-drape-filters');
  const selectedColorEl = document.getElementById('ycs-selected-color');
  const photoLoadingEl = document.getElementById('ycs-drape-loading');
  const swatchLoadingEl = document.getElementById('ycs-swatch-loading');
  const backBtn = document.getElementById('ycs-drape-back');
  const favBtn = document.getElementById('ycs-drape-fav-btn');
  const uploadUsageMessageEl = document.getElementById('ycs-upload-usage-message');
  const realisticDrapeToggle = document.getElementById('realisticDrapeToggle');
  const drapeTextureStyleEl = document.getElementById('drapeTextureStyle');
  const realisticDrapeToggleComparison = document.getElementById('realisticDrapeToggleComparison');
  const drapeTextureStyleComparisonEl = document.getElementById('drapeTextureStyleComparison');
  const singleViewBtn = document.getElementById('ycs-drape-view-single');
  const comparisonViewBtn = document.getElementById('ycs-drape-view-comparison');
  const comparisonLayout = document.getElementById('ycs-drape-comparison-layout');
  const leftPaletteSelect = document.getElementById('ycs-drape-left-palette-select');
  const rightPaletteSelect = document.getElementById('ycs-drape-right-palette-select');
  const leftComparisonFilters = document.getElementById('ycs-drape-left-filters');
  const rightComparisonFilters = document.getElementById('ycs-drape-right-filters');
  const leftComparisonSwatches = document.getElementById('ycs-drape-left-swatches');
  const rightComparisonSwatches = document.getElementById('ycs-drape-right-swatches');
  const leftComparisonFrame = document.getElementById('ycs-left-photo-frame');
  const rightComparisonFrame = document.getElementById('ycs-right-photo-frame');
  const leftComparisonImg = document.getElementById('ycs-left-photo-preview');
  const rightComparisonImg = document.getElementById('ycs-right-photo-preview');
  const leftComparisonDrapeWrap = document.getElementById('ycs-left-drape-wrap');
  const rightComparisonDrapeWrap = document.getElementById('ycs-right-drape-wrap');
  const leftComparisonDrapePath = document.getElementById('ycs-left-drape-path');
  const rightComparisonDrapePath = document.getElementById('ycs-right-drape-path');
  const leftComparisonSelectedName = document.getElementById('ycs-drape-left-selected-name');
  const rightComparisonSelectedName = document.getElementById('ycs-drape-right-selected-name');
  const saveLeftComparisonBtn = document.getElementById('ycs-save-left-draped-photo');
  const saveRightComparisonBtn = document.getElementById('ycs-save-right-draped-photo');

  const mobileContinueBtn = document.getElementById('ycs-mobile-continue');
  const mobileBackBtn = document.getElementById('ycs-mobile-back');

  const replaceConfirmModal = document.getElementById('ycs-replace-confirm');
  const replaceCancelBtn = document.getElementById('ycs-replace-cancel');
  const replaceConfirmBtn = document.getElementById('ycs-replace-confirm-btn');

  const usageModal = document.getElementById('ycs-usage-modal');
  const usageModalCloseBtn = document.getElementById('ycs-usage-modal-close');

  const swapBtn = document.getElementById('ycs-analysis-swap');

  const replaceButtons = [
    document.getElementById('ycs-replace-photo-mobile'),
    document.getElementById('ycs-replace-photo-desktop')
  ].filter(Boolean);

  const deletePhotoButtons = [
    document.getElementById('ycs-delete-photo-mobile'),
    document.getElementById('ycs-delete-photo-desktop')
  ].filter(Boolean);

  const zoomSliders = [
    document.getElementById('ycs-zoom-slider'),
    document.getElementById('ycs-zoom-slider-desktop'),
    document.getElementById('ycs-zoom-slider-comparison')
  ].filter(Boolean);

  const resetButtons = [
    document.getElementById('ycs-reset-photo'),
    document.getElementById('ycs-reset-photo-desktop')
  ].filter(Boolean);

  const saveButtons = [
  document.getElementById('ycs-save-photo-under-image')
].filter(Boolean);

  const savePositionButtons = [
  document.getElementById('ycs-save-position-mobile'),
  document.getElementById('ycs-save-position-desktop'),
  document.getElementById('ycs-save-position-comparison')
].filter(Boolean);



  const APP_BASE_URL = appEl && appEl.dataset ? (appEl.dataset.appBaseUrl || '') : '';
  const VIEWER_CUSTOMER_ID = appEl && appEl.dataset ? (appEl.dataset.customerId || '') : '';
  const VIEWER_FIRST_NAME = appEl && appEl.dataset ? (appEl.dataset.customerFirstName || '') : '';
  const urlParams = new URLSearchParams(window.location.search);
  const ADMIN_TARGET_CUSTOMER_ID = (urlParams.get('adminCustomerId') || '').trim();
  const SELECTED_PHOTO_ID = (urlParams.get('photoId') || '').trim();
  const SELECTED_PHOTO_SOURCE = (urlParams.get('photoSource') || 'PersonalStudioPhotos').trim();
  const URL_FIRST_NAME = (urlParams.get('firstName') || '').trim();
  const CUSTOMER_ID = ADMIN_TARGET_CUSTOMER_ID || VIEWER_CUSTOMER_ID;

  const IS_ADMIN = appEl && appEl.dataset
    ? (appEl.dataset.isAdmin === 'true')
    : false;

    const IS_STYLE_MASTERS = appEl && appEl.dataset
  ? (appEl.dataset.isStyleMasters === 'true')
  : false;

const HAS_DRAPING_STUDIO = appEl && appEl.dataset
  ? (appEl.dataset.hasDrapingStudio === 'true')
  : false;

const HAS_DRAPING_STUDIO_STARTER = appEl && appEl.dataset
  ? (appEl.dataset.hasDrapingStudioStarter === 'true')
  : false;

const HAS_DRAPING_STUDIO_FULL = appEl && appEl.dataset
  ? (appEl.dataset.hasDrapingStudioFull === 'true')
  : false;

  const photoLoadingTextEl = photoLoadingEl
    ? photoLoadingEl.querySelector('.ycs-drape-loading__text')
    : null;

  const swatchLoadingTextEl = swatchLoadingEl
    ? swatchLoadingEl.querySelector('.ycs-drape-loading__text')
    : null;

  if (!uploadBtn || !fileInput || !previewImg || !photoFrame || !drapePath) return;

  const MIN_SCALE = 0.6;
  const MAX_SCALE = 2.5;
  const REALISTIC_DRAPE_OVERLAY_URL =
    'https://cdn.shopify.com/s/files/1/0623/6284/5408/files/fabric-drape-overlay-550.png?v=1778252521';
  const REALISTIC_DRAPE_OVERLAY_OPACITY = '0.55';
  const DRAPE_TEXTURES = {
    none: {
      url: '',
      opacity: '0',
      scale: 120,
      blend: 'overlay',
      filter: 'none'
    },
    linen: {
      url: 'https://cdn.shopify.com/s/files/1/0623/6284/5408/files/linen-texture.png?v=1778252061',
      opacity: '0.28',
      scale: 120,
      blend: 'overlay',
      filter: 'none'
    },
    wool: {
      url: 'https://cdn.shopify.com/s/files/1/0623/6284/5408/files/linen-texture.png?v=1778252061',
      opacity: '0.38',
      scale: 72,
      blend: 'overlay',
      filter: 'none'
    },
    knit: {
      url: 'https://cdn.shopify.com/s/files/1/0623/6284/5408/files/knit-texture.png?v=1778252764',
      opacity: '0.7',
      scale: 'auto',
      blend: 'multiply',
      filter: 'contrast(2.4)'
    },
    satin: {
      url: 'https://cdn.shopify.com/s/files/1/0623/6284/5408/files/satin-texture.png?v=1778254095',
      opacity: '0.24',
      scale: 220,
      blend: 'soft-light',
      filter: 'none'
    }
  };

  const paletteNames = {
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

  const state = {
    scale: 1,
    x: 0,
    y: 0,
    dragging: false,
    pinching: false,
    startX: 0,
    startY: 0,
    startDistance: 0,
    startScale: 1,
    imgLoaded: false,
    firstName: URL_FIRST_NAME || VIEWER_FIRST_NAME || ''
  };

  let favorites = new Set();
  let activeFilter = 'all';
  let currentPaletteColors = [];
  let ownedPaletteCodes = [];
  let selectedHex = '';
  let cachedProcessedImage = null;
  let uploadsRemaining = null;
  const comparisonState = {
    viewMode: 'single',
    leftPaletteCode: '',
    rightPaletteCode: '',
    leftFilter: 'all',
    rightFilter: 'all',
    leftColors: [],
    rightColors: [],
    leftHex: '',
    rightHex: '',
    leftName: '',
    rightName: ''
  };

  function isMobile() {
    return window.innerWidth <= 900;
  }

  function normalizeHex(hex) {
    const value = String(hex || '').trim().toLowerCase();
    if (!value) return '';
    return value.charAt(0) === '#' ? value : '#' + value;
  }

  function clampScale(value) {
    return Math.max(MIN_SCALE, Math.min(MAX_SCALE, value));
  }

  function syncZoomSliders(value) {
    zoomSliders.forEach(function (slider) {
      slider.value = value;
    });
  }

  function syncDrapeStyleVars(color) {
    if (!drapeWrap) return;

    const drapeColor = normalizeHex(color || drapePath.getAttribute('fill') || '#e8dfd4');
    syncDrapeStyleForWrap(drapeWrap, drapeColor);
  }

  function syncDrapeStyleForWrap(wrapEl, color) {
    if (!wrapEl) return;

    const drapeColor = normalizeHex(color || '#e8dfd4');
    const overlayEnabled = isRealisticDrapeEnabled();
    const textureStyle = getDrapeTextureStyle();
    const texture = DRAPE_TEXTURES[textureStyle] || DRAPE_TEXTURES.none;
    const hasTexture = !!texture.url;

    wrapEl.style.setProperty('--drape-color', drapeColor);
    wrapEl.style.setProperty('--drape-overlay-url', 'url("' + REALISTIC_DRAPE_OVERLAY_URL + '")');
    wrapEl.style.setProperty(
      '--drape-texture-url',
      hasTexture ? 'url("' + texture.url + '")' : 'none'
    );
    wrapEl.style.setProperty('--drape-texture-opacity', hasTexture ? texture.opacity : '0');
    wrapEl.style.setProperty(
      '--drape-texture-size',
      texture.scale === 'auto' ? 'auto' : (texture.scale || 120) + 'px'
    );
    wrapEl.style.setProperty('--drape-texture-blend', texture.blend || 'overlay');
    wrapEl.style.setProperty('--drape-texture-filter', texture.filter || 'none');
    wrapEl.style.setProperty(
      '--drape-overlay-opacity',
      overlayEnabled ? REALISTIC_DRAPE_OVERLAY_OPACITY : '0'
    );

    wrapEl.classList.toggle('drape-texture-active', hasTexture);
    wrapEl.classList.toggle('drape-texture-linen', textureStyle === 'linen' && hasTexture);
    wrapEl.classList.toggle('drape-texture-wool', textureStyle === 'wool' && hasTexture);
  }

  function syncComparisonDrapeStyles() {
    syncDrapeStyleForWrap(leftComparisonDrapeWrap, leftComparisonDrapePath ? leftComparisonDrapePath.getAttribute('fill') : '#e8dfd4');
    syncDrapeStyleForWrap(rightComparisonDrapeWrap, rightComparisonDrapePath ? rightComparisonDrapePath.getAttribute('fill') : '#e8dfd4');
  }

  function setRealisticDrapeEnabled(enabled) {
    if (drapeWrap) drapeWrap.classList.toggle('drape-realistic', !!enabled);
    if (leftComparisonDrapeWrap) leftComparisonDrapeWrap.classList.toggle('drape-realistic', !!enabled);
    if (rightComparisonDrapeWrap) rightComparisonDrapeWrap.classList.toggle('drape-realistic', !!enabled);
    syncDrapeStyleVars();
    syncComparisonDrapeStyles();
  }

  function isRealisticDrapeEnabled() {
    return !!(
      (realisticDrapeToggle && realisticDrapeToggle.checked) ||
      (realisticDrapeToggleComparison && realisticDrapeToggleComparison.checked)
    );
  }

  function syncRealisticToggleControls(enabled) {
    [realisticDrapeToggle, realisticDrapeToggleComparison].forEach(function (toggle) {
      if (toggle) toggle.checked = !!enabled;
    });
  }

  function getDrapeTextureStyle() {
    if (drapeTextureStyleComparisonEl && comparisonState.viewMode === 'comparison') {
      return drapeTextureStyleComparisonEl.value || 'none';
    }

    return drapeTextureStyleEl ? drapeTextureStyleEl.value : 'none';
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

  function buildDrapedPhotoFileName(paletteCode, colorName) {
    const firstName = slugifyFilePart(state.firstName || VIEWER_FIRST_NAME || URL_FIRST_NAME, 'photo');
    const code = String(paletteCode || '')
      .trim()
      .toUpperCase()
      .replace(/[^A-Z0-9]+/g, '') || 'palette';
    const color = slugifyFilePart(colorName, 'color');

    return firstName + '-' + code + '-' + color + '.png';
  }

  function syncTextureControls(value) {
    [drapeTextureStyleEl, drapeTextureStyleComparisonEl].forEach(function (selectEl) {
      if (selectEl) selectEl.value = value || 'none';
    });
  }

  function getActiveDrapeTexture() {
    const textureStyle = getDrapeTextureStyle();
    return DRAPE_TEXTURES[textureStyle] || DRAPE_TEXTURES.none;
  }

  function setDrapeShape(pathD) {
    drapePath.setAttribute('d', pathD);
    if (drapeClipPath) drapeClipPath.setAttribute('d', pathD);
    document.querySelectorAll('.ycs-comparison-drape-path, .ycs-comparison-drape-clip-path').forEach(function (pathEl) {
      pathEl.setAttribute('d', pathD);
    });
    syncDrapeStyleVars();
    syncComparisonDrapeStyles();
  }

  function updateImageTransform() {
    const transform =
      'translate(calc(-50% + ' + state.x + 'px), calc(-50% + ' + state.y + 'px)) scale(' + state.scale + ')';
    previewImg.style.transform = transform;
    [leftComparisonImg, rightComparisonImg].forEach(function (img) {
      if (img) img.style.transform = transform;
    });
  }

  function resetPhotoPosition() {
    state.scale = 1;
    state.x = 0;
    state.y = 0;
    state.dragging = false;
    state.pinching = false;
    syncZoomSliders('1');
    photoFrame.classList.remove('is-dragging');
    updateImageTransform();
  }

  function showPhotoProcessing(message) {
    if (!photoLoadingEl) return;
    photoLoadingEl.hidden = false;
    photoLoadingEl.classList.add('is-photo-processing');
    if (photoLoadingTextEl) {
      photoLoadingTextEl.textContent = message || 'Processing photo…';
    }
  }

  function hidePhotoProcessing() {
    if (!photoLoadingEl) return;
    photoLoadingEl.hidden = true;
    photoLoadingEl.classList.remove('is-photo-processing');
    if (photoLoadingTextEl) {
      photoLoadingTextEl.textContent = 'Loading colors…';
    }
  }

  function showSwatchLoading() {
    if (swatchLoadingEl) swatchLoadingEl.hidden = false;
    if (swatchLoadingTextEl) swatchLoadingTextEl.textContent = 'Loading colors…';
    if (swatchesEl) swatchesEl.innerHTML = '';
    if (filtersEl) filtersEl.classList.add('is-loading');
  }

  function hideSwatchLoading() {
    if (swatchLoadingEl) swatchLoadingEl.hidden = true;
    if (filtersEl) filtersEl.classList.remove('is-loading');
  }

  function hasExistingPhoto() {
    return !!(state.imgLoaded && previewImg.src);
  }

  async function archivePersonalStudioPhoto() {
    if (!CAN_DELETE_PERSONAL_PHOTO || !APP_BASE_URL || !CUSTOMER_ID || !PERSONAL_PHOTO_ID) return;

    if (!confirm('Delete this photo from your gallery?')) {
      return;
    }

    try {
      showPhotoProcessing('Deleting photo...');

      const response = await fetch('/apps/palette-data?action=archivePersonalStudioPhoto', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerId: CUSTOMER_ID,
          photoId: PERSONAL_PHOTO_ID
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Could not delete photo');
      }

      window.location.href = '/pages/photo-prep?mode=personal&workflow=photo-draping';
    } catch (error) {
      hidePhotoProcessing();
      console.error('Failed to delete personal studio photo', error);
      alert(error.message || 'Could not delete photo.');
    }
  }

  function syncComparisonPhotoSource() {
    [leftComparisonImg, rightComparisonImg].forEach(function (img) {
      if (!img) return;

      if (previewImg.src && state.imgLoaded) {
        img.src = previewImg.src;
        img.classList.add('is-visible');
        img.style.display = 'block';
      } else {
        img.removeAttribute('src');
        img.classList.remove('is-visible');
      }
    });

    updateImageTransform();
  }

  function setViewMode(mode) {
    const nextMode = mode === 'comparison' ? 'comparison' : 'single';
    comparisonState.viewMode = nextMode;

    if (studioRoot) {
      studioRoot.classList.toggle('is-comparison-view', nextMode === 'comparison');
      studioRoot.setAttribute('data-view-mode', nextMode);
    }

    if (comparisonLayout) comparisonLayout.hidden = nextMode !== 'comparison';
    if (singleViewBtn) singleViewBtn.classList.toggle('is-active', nextMode === 'single');
    if (comparisonViewBtn) comparisonViewBtn.classList.toggle('is-active', nextMode === 'comparison');

    if (nextMode === 'comparison') {
      syncComparisonPhotoSource();
      renderComparisonPalettes();
    }
  }

  function openReplaceConfirm() {
    if (!replaceConfirmModal) return;
    replaceConfirmModal.hidden = false;
  }

  function closeReplaceConfirm() {
    if (!replaceConfirmModal) return;
    replaceConfirmModal.hidden = true;
  }

  function openUsageModal() {
  if (!usageModal) return;

  const titleEl = usageModal.querySelector('.ycs-usage-modal-title');
  const bodyEl = usageModal.querySelector('.ycs-usage-modal-body');
  const ctaEl = document.getElementById('ycs-usage-modal-cta');
  const secondaryCtaEl = document.getElementById('ycs-usage-modal-secondary-cta');
  const analysisLinkEl = document.getElementById('ycs-usage-modal-analysis-link');

  if (!titleEl || !bodyEl || !ctaEl || !secondaryCtaEl || !analysisLinkEl) return;

  if (IS_SAMPLE_USER) {
    titleEl.textContent = 'Your Free Try Is Complete';

    bodyEl.innerHTML = `
      <p>You’ve used your free photo upload.</p>
      <p><strong>Want to keep trying colors on your own photo?</strong></p>
      <p>Get more uploads to keep exploring, or skip the guesswork and get your personalized colors.</p>
    `;

    ctaEl.href = '/products/photo-draping-studio#order';
    ctaEl.textContent = 'Get More Uploads';
    ctaEl.style.display = 'inline-flex';

    secondaryCtaEl.href = '/products/digital-color-palettes';
    secondaryCtaEl.textContent = 'Get My Digital Color Palette';
    secondaryCtaEl.style.display = 'inline-block';

    analysisLinkEl.href = '/products/online-color-analysis';
    analysisLinkEl.textContent = 'Or get a personal color analysis';
    analysisLinkEl.style.display = 'inline-block';
  } else if (HAS_DRAPING_STUDIO_STARTER) {
  titleEl.textContent = 'You’ve Used Your Starter Uploads';

  bodyEl.innerHTML = `
    <p>You’ve used the 2 uploads included with Starter.</p>
    <p><strong>Want more time to explore?</strong></p>
    <p>Upgrade for more uploads and keep testing colors on your photo.</p>
  `;

  ctaEl.href = '/products/photo-draping-studio#order';
  ctaEl.textContent = 'Get More Uploads';
  ctaEl.style.display = 'inline-flex';

  secondaryCtaEl.style.display = 'none';
  analysisLinkEl.style.display = 'none';
} else if (HAS_DRAPING_STUDIO_FULL) {
  titleEl.textContent = 'You’ve Used Your Studio Uploads';

  bodyEl.innerHTML = `
    <p>You’ve used the 5 uploads included with your Studio access.</p>
    <p><strong>Keep going while it’s fresh.</strong></p>
    <p>Get more uploads and keep testing colors on your photo.</p>
  `;

  ctaEl.href = '/products/photo-draping-studio#order';
  ctaEl.textContent = 'Get More Uploads';
  ctaEl.style.display = 'inline-flex';

  secondaryCtaEl.style.display = 'none';
  analysisLinkEl.style.display = 'none';

    ctaEl.href = '/products/photo-draping-studio#order';
    ctaEl.textContent = 'Buy 2 More Uploads';
    ctaEl.style.display = 'inline-flex';

    secondaryCtaEl.style.display = 'none';
    analysisLinkEl.style.display = 'none';
  } else {
    titleEl.textContent = 'Keep Trying Colors on You';

    bodyEl.innerHTML = `
      <p>Unlock Photo Draping Studio and keep testing colors on your own photo.</p>
      <p><strong>See what works before you buy it or wear it.</strong></p>
    `;

    ctaEl.href = '/products/photo-draping-studio#order';
    ctaEl.textContent = 'Unlock Photo Draping Studio';
    ctaEl.style.display = 'inline-flex';

    secondaryCtaEl.href = '/products/digital-color-palettes';
    secondaryCtaEl.textContent = 'Get My Digital Color Palette';
    secondaryCtaEl.style.display = 'inline-block';

    analysisLinkEl.href = '/products/online-color-analysis';
    analysisLinkEl.textContent = 'Or get a personal color analysis';
    analysisLinkEl.style.display = 'inline-block';
  }

  usageModal.hidden = false;
}

  function closeUsageModal() {
    if (!usageModal) return;
    usageModal.hidden = true;
  }

  function triggerPhotoPickerForReplace() {
    closeReplaceConfirm();
    fileInput.value = '';
    fileInput.click();
  }

  function getTouchDistance(touches) {
    const dx = touches[0].clientX - touches[1].clientX;
    const dy = touches[0].clientY - touches[1].clientY;
    return Math.sqrt(dx * dx + dy * dy);
  }

  function goToMobileStep(stepName) {
    if (!studioRoot || !isMobile()) return;
    studioRoot.setAttribute('data-mobile-step', stepName);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function getPaletteDisplayName(code) {
    if (isCustomPaletteCode(code)) return 'Style Masters Palette';
    return paletteNames[code] || code || '—';
  }

  function updateCurrentPaletteName() {
    if (!paletteSelect || !currentPaletteNameEl) return;
    currentPaletteNameEl.textContent = getPaletteDisplayName(paletteSelect.value);
  }

  function getReturnUrl() {
    const params = new URLSearchParams(window.location.search);
    const returnUrl = params.get('returnUrl');
    if (returnUrl) return returnUrl;

    const sessionReturn = sessionStorage.getItem('ycsPhotoDrapingReturnUrl');
    if (sessionReturn) return sessionReturn;

    return '/pages/my-palettes';
  }

  function loadImage(src) {
    return new Promise(function (resolve, reject) {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = function () { resolve(img); };
      img.onerror = reject;
      img.src = src;
    });
  }

  function loadSavedPhoto(url, savedTransform) {
  if (!url) return;

  showPhotoProcessing('Loading your saved photo…');

    previewImg.onload = function () {
    previewImg.classList.add('is-visible');
    state.imgLoaded = true;

    previewImg.style.display = 'block';
    photoFrame.style.display = 'block';
    if (uploadWrap) uploadWrap.style.display = 'none';

    if (
      savedTransform &&
      typeof savedTransform.x === 'number' &&
      typeof savedTransform.y === 'number' &&
      typeof savedTransform.scale === 'number'
    ) {
      state.x = savedTransform.x;
      state.y = savedTransform.y;
      state.scale = clampScale(savedTransform.scale);
      state.dragging = false;
      state.pinching = false;
      syncZoomSliders(String(state.scale));
      photoFrame.classList.remove('is-dragging');
      updateImageTransform();
    } else {
      resetPhotoPosition();
    }

    hidePhotoProcessing();
    syncComparisonPhotoSource();
  };

  previewImg.onerror = function () {
    hidePhotoProcessing();
    console.error('Saved photo could not be loaded:', url);
    alert('The saved photo could not be displayed.');
  };

  previewImg.src = url;
}

  async function fetchSavedPhoto() {
    if (!CUSTOMER_ID) return;

    try {
      const query = new URLSearchParams({
  customerId: CUSTOMER_ID
});

if (SELECTED_PHOTO_ID) {
  query.set('photoId', SELECTED_PHOTO_ID);
  query.set('photoSource', SELECTED_PHOTO_SOURCE || 'PersonalStudioPhotos');
}

const res = await fetch(
  APP_BASE_URL + '/api/get-photo?' + query.toString()
);
      const data = await res.json();

      if (data && data.activePhotoUrl) {
  state.firstName = data.firstName || state.firstName || '';
  loadSavedPhoto(data.activePhotoUrl, data.photoTransform || null);
}
    } catch (err) {
      console.error('Failed to load saved photo', err);
    }
  }

  async function savePhotoPosition() {
    if (!state.imgLoaded) {
      alert('Upload a photo first.');
      return;
    }

    try {
      let response;

      if (MODE === 'personal') {
        if (!PERSONAL_PHOTO_ID) {
          alert('No personal photo ID found.');
          return;
        }

      response = await fetch(APP_BASE_URL + '/api/save-personal-studio-photo-transform', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
  customerId: CUSTOMER_ID,
  photoId: PERSONAL_PHOTO_ID,
  photoSource: 'PersonalStudioPhotos',
  photoTransform: {
    x: state.x,
    y: state.y,
    scale: state.scale
  }
})
      });
    } else {
      if (!CUSTOMER_ID) {
        alert('No customer ID found.');
        return;
      }

      response = await fetch(APP_BASE_URL + '/api/save-photo-transform', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerId: CUSTOMER_ID,
          photoTransform: {
            x: state.x,
            y: state.y,
            scale: state.scale
          }
        })
      });
    }

    const data = await response.json();

    if (!response.ok || !data.success) {
      throw new Error(data.error || 'Could not save photo position');
    }

    alert('Photo position saved.');
  } catch (error) {
    console.error('Save photo position failed', error);
    alert(error.message || 'Could not save photo position');
  }
} // savephotoposition



savePositionButtons.forEach(function (btn) {
  btn.addEventListener('click', function () {
    savePhotoPosition();
  });
});

  async function loadUploadUsage() {
  if (!uploadUsageMessageEl || !CUSTOMER_ID) return;

  uploadUsageMessageEl.hidden = true;
  uploadUsageMessageEl.textContent = '';

  try {
    const res = await fetch(
  APP_BASE_URL +
    '/api/get-upload-usage?' +
    new URLSearchParams({
      customerId: CUSTOMER_ID,
      tool: 'photo-draping',
      isAdmin: IS_ADMIN ? 'true' : 'false',
      isVip: IS_STYLE_MASTERS ? 'true' : 'false',
      hasDrapingStudio: HAS_DRAPING_STUDIO ? 'true' : 'false',
      hasDrapingStudioStarter: HAS_DRAPING_STUDIO_STARTER ? 'true' : 'false',
      hasDrapingStudioFull: HAS_DRAPING_STUDIO_FULL ? 'true' : 'false',
      isSampleUser: IS_SAMPLE_USER ? 'true' : 'false'
    }).toString()
);

    const data = await res.json();

    if (!res.ok) {
      throw new Error(data.error || 'Could not load upload usage');
    }

    if (data.isAdmin) {
      uploadsRemaining = null;
      uploadUsageMessageEl.textContent = 'Unlimited uploads';
      uploadUsageMessageEl.hidden = false;

      replaceButtons.forEach(function (btn) {
        btn.textContent = 'Replace Photo';
        btn.disabled = false;
      });

      return;
    }

    uploadsRemaining = Number(data.remaining);

    if (IS_SAMPLE_USER) {
  if (uploadsRemaining === 0) {
    uploadUsageMessageEl.textContent = 'Free Trial used';
  } else {
    uploadUsageMessageEl.textContent = 'Free Trial: 1 photo upload';
  }
} else if (HAS_DRAPING_STUDIO_STARTER) {
  uploadUsageMessageEl.textContent =
    uploadsRemaining === 1
      ? 'Starter • 1 upload remaining'
      : `Starter • ${uploadsRemaining} uploads remaining`;
} else if (HAS_DRAPING_STUDIO_FULL) {
  uploadUsageMessageEl.textContent =
    uploadsRemaining === 1
      ? 'Studio • 1 upload remaining'
      : `Studio • ${uploadsRemaining} uploads remaining`;
} else {
  uploadUsageMessageEl.textContent =
    uploadsRemaining === 1
      ? '1 upload remaining'
      : `${uploadsRemaining} uploads remaining`;
}

    uploadUsageMessageEl.hidden = false;

const hasPhoto = hasExistingPhoto();

replaceButtons.forEach(function (btn) {
  // SAMPLE USERS
  if (IS_SAMPLE_USER) {
    if (!hasPhoto) {
      btn.textContent = 'Upload Photo';
    } else if (uploadsRemaining === 0) {
      btn.textContent = 'Unlock Your Colors';
    } else {
      btn.textContent = 'Replace Photo';
    }

  // PERSONAL MODE USERS WITH ACCESS
  } else if (MODE === 'personal' && (IS_STYLE_MASTERS || HAS_DRAPING_STUDIO || IS_ADMIN)) {
  btn.textContent = 'Adjust Photo';

  // TRADE / OTHER PAID USERS
  } else if (IS_STYLE_MASTERS || HAS_DRAPING_STUDIO || IS_ADMIN) {
    if (!hasPhoto) {
      btn.textContent = 'Upload Photo';
    } else if (uploadsRemaining === 0) {
      btn.textContent = 'Buy 2 More Uploads';
    } else {
      btn.textContent = 'Replace Photo';
    }

  // LOCKED USERS
  } else {
    btn.textContent = 'Unlock Studio';
  }

  btn.disabled = false;
});
  } catch (err) {
    console.error('Failed to load upload usage', err);
    uploadUsageMessageEl.hidden = true;
  }
}

  const ACCEPTED_UPLOAD_FORMATS_MESSAGE = 'HEIC/HEIF files are not accepted. Please upload a JPG, PNG, or WebP image.';
  const ACCEPTED_UPLOAD_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
  const ACCEPTED_UPLOAD_EXTENSIONS = ['jpg', 'jpeg', 'png', 'webp'];
  const UNSUPPORTED_HEIC_TYPES = ['image/heic', 'image/heif', 'image/heic-sequence', 'image/heif-sequence'];

  function getFileExtension(file) {
    const name = String(file && file.name ? file.name : '').toLowerCase();
    const parts = name.split('.');
    return parts.length > 1 ? parts.pop() : '';
  }

  function isHeicFile(file) {
    const type = String(file && file.type ? file.type : '').toLowerCase();
    const extension = getFileExtension(file);
    return UNSUPPORTED_HEIC_TYPES.indexOf(type) !== -1 || extension === 'heic' || extension === 'heif';
  }

  function isAcceptedUploadFile(file) {
    const type = String(file && file.type ? file.type : '').toLowerCase();
    const extension = getFileExtension(file);
    return ACCEPTED_UPLOAD_TYPES.indexOf(type) !== -1 || ACCEPTED_UPLOAD_EXTENSIONS.indexOf(extension) !== -1;
  }

  async function resizeImageFile(file, maxWidth, quality) {
    maxWidth = maxWidth || 900;
    quality = quality || 0.72;

    const dataUrl = await new Promise(function (resolve, reject) {
      const reader = new FileReader();
      reader.onload = function () { resolve(reader.result); };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });

    const img = await new Promise(function (resolve, reject) {
      const image = new Image();
      image.onload = function () { resolve(image); };
      image.onerror = function () { reject(new Error(ACCEPTED_UPLOAD_FORMATS_MESSAGE)); };
      image.src = dataUrl;
    });

    const scale = Math.min(1, maxWidth / img.width);
    const width = Math.round(img.width * scale);
    const height = Math.round(img.height * scale);

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;

    const ctx = canvas.getContext('2d');
    ctx.drawImage(img, 0, 0, width, height);

    return canvas.toDataURL('image/jpeg', quality);
  }

  async function compressDataUrlForUpload(dataUrl, maxWidth, quality) {
    maxWidth = maxWidth || 1000;
    quality = quality || 0.8;

    const img = await new Promise(function (resolve, reject) {
      const image = new Image();
      image.onload = function () { resolve(image); };
      image.onerror = reject;
      image.src = dataUrl;
    });

    const scale = Math.min(1, maxWidth / img.width);
    const width = Math.round(img.width * scale);
    const height = Math.round(img.height * scale);

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;

    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, width, height);
    ctx.drawImage(img, 0, 0, width, height);

    return canvas.toDataURL('image/webp', quality);
  }

  async function removeBackgroundFromFile(file) {
    const imageBase64 = await resizeImageFile(file, 900, 0.72);

    const response = await fetch(APP_BASE_URL + '/api/remove-background', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
  imageBase64,
  customerId: CUSTOMER_ID,
  tool: 'photo-draping',
  isAdmin: IS_ADMIN,
  isVip: IS_STYLE_MASTERS,
  hasDrapingStudio: HAS_DRAPING_STUDIO,
  hasDrapingStudioStarter: HAS_DRAPING_STUDIO_STARTER,
  hasDrapingStudioFull: HAS_DRAPING_STUDIO_FULL,
  isSampleUser: IS_SAMPLE_USER
})
    });

    const rawText = await response.text();
    let data = {};

    try {
      data = rawText ? JSON.parse(rawText) : {};
    } catch (parseError) {
      console.error('removeBackground returned non-JSON:', rawText);
      throw new Error('Server returned an invalid response');
    }

    if (!response.ok) {
      if (response.status === 402) {
        throw new Error('Background removal is temporarily unavailable. Please try again shortly.');
      }

      throw new Error(
        data.details ||
        data.error ||
        ('Background removal failed (' + response.status + ')')
      );
    }

    if (!data.image) {
      throw new Error('No processed image was returned');
    }

    return data.image;
  }

  async function saveDrapedPhoto(options) {
    const saveOptions = options || {};
    const targetFrame = saveOptions.frame || photoFrame;
    const targetImg = saveOptions.img || previewImg;
    const targetDrapePath = saveOptions.drapePath || drapePath;
    const targetPaletteCode = saveOptions.paletteCode || (paletteSelect && paletteSelect.value ? paletteSelect.value : 'palette');
    const targetColorName = saveOptions.colorName || '';

    if (!state.imgLoaded || !targetImg || !targetImg.src || !targetFrame || !targetDrapePath) {
      alert('Upload a photo first.');
      return;
    }

    let mobileWindow = null;

    if (isMobile()) {
      mobileWindow = window.open('', '_blank');
      if (!mobileWindow) {
        alert('Please allow pop-ups to save your image on mobile.');
        return;
      }

      mobileWindow.document.open();
      mobileWindow.document.write(
        '<!doctype html><html><head>' +
        '<meta name="viewport" content="width=device-width, initial-scale=1" />' +
        '<title>Preparing image</title>' +
        '<style>body{margin:0;padding:24px;font-family:sans-serif;text-align:center;background:#fff}p{font-size:14px;color:#444}</style>' +
        '</head><body><p>Preparing your image...</p></body></html>'
      );
      mobileWindow.document.close();
    }

    try {
      const frameRect = targetFrame.getBoundingClientRect();
      const frameWidth = Math.round(frameRect.width);
      const frameHeight = Math.round(frameRect.height);

      const canvas = document.createElement('canvas');
      canvas.width = frameWidth * 2;
      canvas.height = frameHeight * 2;

      const ctx = canvas.getContext('2d');
      ctx.scale(2, 2);

      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, frameWidth, frameHeight);

      const uploadedImg = await loadImage(targetImg.src);

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

      ctx.drawImage(uploadedImg, drawX, drawY, drawWidth, drawHeight);

      const pathD = targetDrapePath.getAttribute('d') || '';
      const fillColor = targetDrapePath.getAttribute('fill') || '#e8dfd4';

      const svgMarkup =
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 500" preserveAspectRatio="none">' +
        '<path d="' + pathD + '" fill="' + fillColor + '"/>' +
        '</svg>';

      const svgBlob = new Blob([svgMarkup], { type: 'image/svg+xml;charset=utf-8' });
      const svgUrl = URL.createObjectURL(svgBlob);

      const drapeImg = await loadImage(svgUrl);
      const drapeSvg = targetFrame.querySelector('.ycs-drape-svg');

      let drapeHeight = frameHeight * 0.28;
      let drapeY = frameHeight * 0.72;

      if (drapeSvg) {
        const drapeRect = drapeSvg.getBoundingClientRect();
        const frameRect2 = targetFrame.getBoundingClientRect();
        drapeHeight = drapeRect.height;
        drapeY = drapeRect.top - frameRect2.top;
      }

      ctx.drawImage(drapeImg, 0, drapeY, frameWidth, drapeHeight);
      URL.revokeObjectURL(svgUrl);

      const activeTexture = getActiveDrapeTexture();
      if (activeTexture.url) {
        try {
          const textureImg = await loadImage(activeTexture.url);

          ctx.save();
          ctx.translate(0, drapeY);
          ctx.scale(frameWidth / 1000, drapeHeight / 500);
          ctx.clip(new Path2D(pathD));
          ctx.globalCompositeOperation = activeTexture.blend || 'overlay';
          ctx.globalAlpha = Number(activeTexture.opacity || 0.16);
          ctx.filter = activeTexture.filter || 'none';

          const pattern = ctx.createPattern(textureImg, 'repeat');
          if (pattern && typeof DOMMatrix !== 'undefined' && activeTexture.scale !== 'auto') {
            pattern.setTransform(new DOMMatrix().scale((activeTexture.scale || 120) / textureImg.naturalWidth));
          }

          if (pattern) {
            ctx.fillStyle = pattern;
            ctx.fillRect(0, 0, 1000, 500);
          }

          ctx.restore();
        } catch (error) {
          console.warn('Could not render drape texture in saved image', error);
        }
      }

      if (isRealisticDrapeEnabled()) {
        try {
          const overlayImg = await loadImage(REALISTIC_DRAPE_OVERLAY_URL);

          ctx.save();
          ctx.translate(0, drapeY);
          ctx.scale(frameWidth / 1000, drapeHeight / 500);
          ctx.clip(new Path2D(pathD));
          ctx.globalCompositeOperation = 'multiply';
          ctx.globalAlpha = Number(REALISTIC_DRAPE_OVERLAY_OPACITY);
          ctx.drawImage(overlayImg, 0, 0, 1000, 500);
          ctx.restore();
        } catch (error) {
          console.warn('Could not render realistic drape overlay in saved image', error);
        }
      }

      const colorNameRaw = targetColorName || (selectedColorEl && selectedColorEl.querySelector('.ycs-selected-name')
        ? selectedColorEl.querySelector('.ycs-selected-name').textContent
        : 'color');

      const colorName = String(colorNameRaw || 'color')
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-');

      const fileName = buildDrapedPhotoFileName(targetPaletteCode, colorName);
      const dataUrl = canvas.toDataURL('image/png');

      if (isMobile() && mobileWindow) {
        mobileWindow.document.open();
        mobileWindow.document.write(
          '<!doctype html><html><head>' +
          '<meta name="viewport" content="width=device-width, initial-scale=1" />' +
          '<title>' + fileName + '</title>' +
          '<style>body{margin:0;padding:16px;font-family:sans-serif;background:#fff;text-align:center}img{max-width:100%;height:auto}p{font-size:14px;color:#444}</style>' +
          '</head><body>' +
          '<p>Press and hold the image to save it.</p>' +
          '<img src="' + dataUrl + '" alt="Saved draped photo" />' +
          '</body></html>'
        );
        mobileWindow.document.close();
        return;
      }

      const link = document.createElement('a');
      link.href = dataUrl;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (error) {
      console.error('Save failed', error);

      if (mobileWindow && !mobileWindow.closed) {
        mobileWindow.document.open();
        mobileWindow.document.write(
          '<!doctype html><html><body style="font-family:sans-serif;padding:24px;text-align:center;">' +
          '<p>Could not save the photo. Please go back and try again.</p>' +
          '</body></html>'
        );
        mobileWindow.document.close();
      } else {
        alert('Could not save the photo. Please try again.');
      }
    }
  }

  function getPaletteCodesFromAccessString(accessString) {
    if (!accessString) return [];

    const validPaletteCodes = new Set([
      'SAMPLE',
      'CWL', 'CWM', 'CWD',
      'CCL', 'CCM', 'CCD',
      'SWL', 'SWM', 'SWD',
      'SCL', 'SCM', 'SCD',
      'LO', 'MO', 'DO',
      'CWLG', 'CWMG', 'CWDG',
      'SWLG', 'SWMG', 'SWDG',
      'SCLG', 'SCMG', 'SCDG'
    ]);

    return accessString
      .split(',')
      .map(function (code) { return code.trim().toUpperCase(); })
      .filter(function (code) {
        if (code === 'SAMPLE' && !IS_SAMPLE_USER) return false;
        return validPaletteCodes.has(code);
      });
  }

  function getQueryParams() {
    const params = new URLSearchParams(window.location.search);
    const paletteParam = (params.get('palette') || '').trim();
    return {
      palette: /^CUSTOM_/i.test(paletteParam) ? paletteParam : paletteParam.toUpperCase(),
      hex: normalizeHex(params.get('hex') || ''),
      colorName: (params.get('colorName') || params.get('name') || '').trim()
    };
  }

  function getPaletteFromUrl() {
    const params = new URLSearchParams(window.location.search);
    const paletteParam = (params.get('palette') || '').trim();
    return /^CUSTOM_/i.test(paletteParam) ? paletteParam : paletteParam.toUpperCase();
  }

  function isCustomPaletteCode(code) {
    return /^CUSTOM_/i.test(String(code || '').trim());
  }

  function populatePaletteSelect() {
  if (!appEl || !paletteSelect) return [];

  const accessString = appEl.dataset.paletteAccess || '';
  const paletteFromUrl = getPaletteFromUrl();

  let ownedPalettes = getPaletteCodesFromAccessString(accessString);

  // 🔥 ADMIN OVERRIDE
  if (IS_ADMIN) {
    ownedPalettes = [
      'CWL','CWM','CWD',
      'CCL','CCM','CCD',
      'SWL','SWM','SWD',
      'SCL','SCM','SCD',
      'LO','MO','DO',
      'CWLG','CWMG','CWDG',
      'SWLG','SWMG','SWDG',
      'SCLG','SCMG','SCDG'
    ];
  }

  if (IS_SAMPLE_USER) {
    ownedPalettes = ['SAMPLE'];
  }

  if (
    paletteFromUrl &&
    isCustomPaletteCode(paletteFromUrl) &&
    ownedPalettes.indexOf(paletteFromUrl) === -1
  ) {
    ownedPalettes.unshift(paletteFromUrl);
  }

  ownedPaletteCodes = ownedPalettes.slice();

  if (!ownedPalettes.length) {
    const option = document.createElement('option');
    option.value = '';
    option.textContent = 'Unlock your color palette';
    paletteSelect.appendChild(option);
    return [];
  }

  ownedPalettes.forEach(function (code) {
    const option = document.createElement('option');
    option.value = code;
    option.textContent = isCustomPaletteCode(code) ? 'Style Masters Palette' : code;
    paletteSelect.appendChild(option);
  });

  paletteSelect.value =
    paletteFromUrl && ownedPalettes.indexOf(paletteFromUrl) !== -1
      ? paletteFromUrl
      : ownedPalettes[0];

  return ownedPalettes;
}

  function populateComparisonPaletteSelect(selectEl, savedCode, fallbackIndex) {
    if (!selectEl) return;

    selectEl.innerHTML = '';
    ownedPaletteCodes.forEach(function (code) {
      const option = document.createElement('option');
      option.value = code;
      option.textContent = getPaletteDisplayName(code);
      selectEl.appendChild(option);
    });

    selectEl.value = ownedPaletteCodes.indexOf(savedCode) !== -1
      ? savedCode
      : (ownedPaletteCodes[fallbackIndex] || ownedPaletteCodes[0] || '');
  }

  function renderComparisonPalettes() {
    if (!ownedPaletteCodes.length) return;

    populateComparisonPaletteSelect(leftPaletteSelect, comparisonState.leftPaletteCode, 0);
    populateComparisonPaletteSelect(rightPaletteSelect, comparisonState.rightPaletteCode, 1);

    comparisonState.leftPaletteCode = leftPaletteSelect ? leftPaletteSelect.value : '';
    comparisonState.rightPaletteCode = rightPaletteSelect ? rightPaletteSelect.value : '';

    if (comparisonState.leftPaletteCode) loadComparisonSide('left');
    if (comparisonState.rightPaletteCode) loadComparisonSide('right');
  }

  function getComparisonElements(side) {
    const isRight = side === 'right';
    return {
      paletteSelect: isRight ? rightPaletteSelect : leftPaletteSelect,
      filtersEl: isRight ? rightComparisonFilters : leftComparisonFilters,
      swatchesEl: isRight ? rightComparisonSwatches : leftComparisonSwatches,
      drapePath: isRight ? rightComparisonDrapePath : leftComparisonDrapePath,
      drapeWrap: isRight ? rightComparisonDrapeWrap : leftComparisonDrapeWrap,
      selectedNameEl: isRight ? rightComparisonSelectedName : leftComparisonSelectedName
    };
  }

  function getComparisonFilter(side) {
    return side === 'right' ? comparisonState.rightFilter : comparisonState.leftFilter;
  }

  function setComparisonFilter(side, filter) {
    if (side === 'right') {
      comparisonState.rightFilter = filter || 'all';
    } else {
      comparisonState.leftFilter = filter || 'all';
    }
  }

  function getComparisonColors(side) {
    return side === 'right' ? comparisonState.rightColors : comparisonState.leftColors;
  }

  function getFilteredComparisonColors(side) {
    let colors = getComparisonColors(side).slice();
    colors.sort(function (a, b) {
      return (a.sortOrder || 0) - (b.sortOrder || 0);
    });

    const filter = getComparisonFilter(side);
    if (filter && filter !== 'all') {
      colors = colors.filter(function (color) {
        return String(color.category || '').trim().toLowerCase() === filter;
      });
    }

    return colors;
  }

  function setComparisonColor(side, color) {
    const elements = getComparisonElements(side);
    const hex = normalizeHex(color.hex || color.hexCode || color.colorHex || '');
    const name = color.name || color.colorName || color.title || 'Color';
    if (!hex || !elements.drapePath) return;

    elements.drapePath.setAttribute('fill', hex);
    syncDrapeStyleForWrap(elements.drapeWrap, hex);

    if (side === 'right') {
      comparisonState.rightHex = hex;
      comparisonState.rightName = name;
    } else {
      comparisonState.leftHex = hex;
      comparisonState.leftName = name;
    }

    if (elements.selectedNameEl) elements.selectedNameEl.textContent = name;
    refreshComparisonSwatches(side);
  }

  function renderComparisonFilters(side) {
    const elements = getComparisonElements(side);
    if (!elements.filtersEl) return;

    const categorySet = new Set();
    getComparisonColors(side).forEach(function (color) {
      const category = String(color.category || '').trim();
      if (category) categorySet.add(category);
    });

    const categoryOrder = [
      'Neutrals', 'Reds', 'Oranges', 'Golden Yellows', 'Yellows',
      'Yellow Greens', 'Greens', 'Aquas/Teals', 'Blues', 'Indigos',
      'Purples', 'Magentas', 'Pinks', 'Plums'
    ];

    const categories = Array.from(categorySet).sort(function (a, b) {
      const aIndex = categoryOrder.indexOf(a);
      const bIndex = categoryOrder.indexOf(b);
      if (aIndex === -1 && bIndex === -1) return a.localeCompare(b);
      if (aIndex === -1) return 1;
      if (bIndex === -1) return -1;
      return aIndex - bIndex;
    });

    const filters = [{ key: 'all', label: 'All' }].concat(
      categories.map(function (category) {
        return { key: category.toLowerCase(), label: category };
      })
    );

    if (!filters.some(function (filter) { return filter.key === getComparisonFilter(side); })) {
      setComparisonFilter(side, 'all');
    }

    elements.filtersEl.innerHTML = '';
    filters.forEach(function (filter) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'ycs-drape-filter';
      btn.textContent = filter.label;
      btn.dataset.filter = filter.key;
      btn.classList.toggle('is-active', filter.key === getComparisonFilter(side));

      btn.addEventListener('click', function () {
        setComparisonFilter(side, filter.key);
        if (side === 'right') {
          comparisonState.rightHex = '';
        } else {
          comparisonState.leftHex = '';
        }
        renderComparisonFilters(side);
        renderComparisonSwatches(side);
      });

      elements.filtersEl.appendChild(btn);
    });
  }

  function renderComparisonSwatches(side) {
    const elements = getComparisonElements(side);
    if (!elements.swatchesEl) return;

    const colors = getFilteredComparisonColors(side);
    elements.swatchesEl.innerHTML = '';

    if (!colors.length) {
      elements.swatchesEl.innerHTML = '<p style="font-size:13px;color:#7b746c;">No colors found</p>';
      if (elements.selectedNameEl) elements.selectedNameEl.textContent = '—';
      return;
    }

    colors.forEach(function (color) {
      const hex = normalizeHex(color.hex || color.hexCode || color.colorHex || '');
      const name = color.name || color.colorName || color.title || 'Color';
      if (!hex) return;

      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'ycs-drape-swatch';
      btn.style.background = hex;
      btn.title = name;
      btn.dataset.hex = hex;
      btn.setAttribute('aria-label', name);
      btn.addEventListener('click', function () {
        setComparisonColor(side, color);
      });

      elements.swatchesEl.appendChild(btn);
    });

    const savedHex = normalizeHex(side === 'right' ? comparisonState.rightHex : comparisonState.leftHex);
    const colorToApply = colors.find(function (color) {
      return normalizeHex(color.hex || color.hexCode || color.colorHex || '') === savedHex;
    }) || colors[0];

    setComparisonColor(side, colorToApply);
  }

  function refreshComparisonSwatches(side) {
    const elements = getComparisonElements(side);
    if (!elements.swatchesEl) return;
    const activeHex = normalizeHex(side === 'right' ? comparisonState.rightHex : comparisonState.leftHex);

    Array.from(elements.swatchesEl.querySelectorAll('.ycs-drape-swatch')).forEach(function (btn) {
      btn.classList.toggle('is-active', normalizeHex(btn.dataset.hex || '') === activeHex);
    });
  }

  async function loadComparisonSide(side) {
    const elements = getComparisonElements(side);
    if (!elements.paletteSelect || !elements.paletteSelect.value) return;

    const paletteCode = elements.paletteSelect.value;
    const colors = await fetchPaletteColors(paletteCode);

    if (side === 'right') {
      comparisonState.rightPaletteCode = paletteCode;
      comparisonState.rightColors = colors;
    } else {
      comparisonState.leftPaletteCode = paletteCode;
      comparisonState.leftColors = colors;
    }

    renderComparisonFilters(side);
    renderComparisonSwatches(side);
  }

  const filters = document.getElementById('ycs-drape-filters');
const leftBtn = document.getElementById('ycs-filter-left');
const rightBtn = document.getElementById('ycs-filter-right');

if (filters && leftBtn && rightBtn) {
  leftBtn.addEventListener('click', function () {
    filters.scrollBy({ left: -180, behavior: 'smooth' });
  });

  rightBtn.addEventListener('click', function () {
    filters.scrollBy({ left: 180, behavior: 'smooth' });
  });

  filters.addEventListener('scroll', updateFilterArrows);
  window.addEventListener('resize', updateFilterArrows);
}

function updateFilterArrows() {
  const filters = document.getElementById('ycs-drape-filters');
  const leftBtn = document.getElementById('ycs-filter-left');
  const rightBtn = document.getElementById('ycs-filter-right');

  if (!filters || !leftBtn || !rightBtn) return;

  const scrollLeft = filters.scrollLeft;
  const maxScrollLeft = filters.scrollWidth - filters.clientWidth;
  const canScroll = maxScrollLeft > 2;

  if (!canScroll) {
    leftBtn.classList.add('is-hidden');
    rightBtn.classList.add('is-hidden');
    filters.classList.remove('has-left-fade', 'has-right-fade');
    return;
  }

  if (scrollLeft <= 2) {
    leftBtn.classList.add('is-hidden');
    filters.classList.remove('has-left-fade');
  } else {
    leftBtn.classList.remove('is-hidden');
    filters.classList.add('has-left-fade');
  }

  if (scrollLeft >= maxScrollLeft - 2) {
    rightBtn.classList.add('is-hidden');
    filters.classList.remove('has-right-fade');
  } else {
    rightBtn.classList.remove('is-hidden');
    filters.classList.add('has-right-fade');
  }
}

  async function fetchPaletteColors(paletteCode) {
    try {
      const url = '/apps/palette-data?palette=' + encodeURIComponent(paletteCode);
      const res = await fetch(url);
      const data = await res.json();
      return data.colors || [];
    } catch (err) {
      console.error('Failed to load palette:', err);
      return [];
    }
  }

  async function loadFavorites(paletteCode) {
    if (!CUSTOMER_ID || !paletteCode) return;

    try {
      const response = await fetch(
        '/apps/palette-data?action=getFavorites&customerId=' +
          encodeURIComponent(CUSTOMER_ID) +
          '&palette=' +
          encodeURIComponent(paletteCode),
        { credentials: 'same-origin' }
      );

      const text = await response.text();
      const data = text ? JSON.parse(text) : {};

      if (!response.ok) {
        throw new Error(data.error || 'Could not load favorites');
      }

      favorites = new Set((data.favorites || []).map(normalizeHex));
    } catch (err) {
      console.error('Failed to load favorites', err);
      favorites = new Set();
    }
  }

  function updateFavoriteButton() {
    if (!favBtn) return;

    const hasColor = !!selectedHex;
    favBtn.style.visibility = hasColor ? 'visible' : 'hidden';
    if (!hasColor) return;

    const isFavorite = favorites.has(normalizeHex(selectedHex));
    const wasFavorite = favBtn.classList.contains('is-favorite');

    favBtn.classList.toggle('is-favorite', isFavorite);
    favBtn.setAttribute('aria-label', isFavorite ? 'Remove from favorites' : 'Add to favorites');
    favBtn.setAttribute('title', isFavorite ? 'Remove from favorites' : 'Add to favorites');

    if (isFavorite && !wasFavorite) {
      favBtn.classList.remove('is-popping');
      requestAnimationFrame(function () {
        favBtn.classList.add('is-popping');
      });
      setTimeout(function () {
        favBtn.classList.remove('is-popping');
      }, 350);
    }
  }

  async function toggleFavorite() {
    if (!favBtn || !CUSTOMER_ID || !selectedHex || !paletteSelect || !paletteSelect.value) return;

    const nameEl = selectedColorEl ? selectedColorEl.querySelector('.ycs-selected-name') : null;
    const name = nameEl ? nameEl.textContent : 'Color';
    const normalizedHex = normalizeHex(selectedHex);
    const wasFavorite = favorites.has(normalizedHex);

    if (wasFavorite) {
      favorites.delete(normalizedHex);
    } else {
      favorites.add(normalizedHex);
    }

    updateFavoriteButton();

    try {
      const response = await fetch('/apps/palette-data?action=toggleFavorite', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerId: CUSTOMER_ID,
          paletteCode: paletteSelect.value,
          colorName: name,
          hex: normalizedHex
        })
      });

      const text = await response.text();
      const result = text ? JSON.parse(text) : {};

      if (!response.ok || !result.success) {
        throw new Error(result.error || 'Failed to update favorite');
      }

      if (result.isFavorite) {
        favorites.add(normalizedHex);
      } else {
        favorites.delete(normalizedHex);
      }

      updateFavoriteButton();
    } catch (err) {
      console.error('Favorite toggle failed', err);

      if (wasFavorite) {
        favorites.add(normalizedHex);
      } else {
        favorites.delete(normalizedHex);
      }

      updateFavoriteButton();
    }
  }

  function renderFilterButtons() {
    if (!filtersEl) return;

    const categorySet = new Set();

    currentPaletteColors.forEach(function (color) {
      const category = (color.category || '').trim();
      if (category) categorySet.add(category);
    });

    const categoryOrder = [
      'Neutrals',
      'Reds',
      'Oranges',
      'Golden Yellows',
      'Yellows',
      'Yellow Greens',
      'Greens',
      'Aquas/Teals',
      'Blues',
      'Indigos',
      'Purples',
      'Magentas',
      'Pinks'
    ];

    const categories = Array.from(categorySet).sort(function (a, b) {
      const aIndex = categoryOrder.indexOf(a);
      const bIndex = categoryOrder.indexOf(b);

      if (aIndex === -1 && bIndex === -1) return a.localeCompare(b);
      if (aIndex === -1) return 1;
      if (bIndex === -1) return -1;
      return aIndex - bIndex;
    });

    const hasFavorites = favorites.size > 0;

    const filters = [
      { key: 'all', label: 'All' },
      ...(hasFavorites ? [{ key: 'favorites', label: 'Favorites' }] : []),
      ...categories.map(function (category) {
        return { key: category.toLowerCase(), label: category };
      })
    ];

    filtersEl.innerHTML = '';

    filters.forEach(function (filter) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'ycs-drape-filter';
      if (filter.key === activeFilter) btn.classList.add('is-active');
      btn.dataset.filter = filter.key;

      if (filter.key === 'favorites') {
        btn.classList.add('ycs-drape-filter--icon');
        btn.setAttribute('aria-label', 'Favorites');
        btn.setAttribute('title', 'Favorites');
        btn.innerHTML =
          '<span class="ycs-drape-filter__icon" aria-hidden="true">' +
          '<svg viewBox="0 0 24 24">' +
          '<path d="M12 20.2c-.2 0-.4-.1-.6-.2C10.1 19 4 14.7 4 9.6 4 6.9 5.9 5 8.5 5c1.5 0 2.8.7 3.5 1.8C12.7 5.7 14 5 15.5 5 18.1 5 20 6.9 20 9.6c0 5.1-6.1 9.4-7.4 10.4-.2.1-.4.2-.6.2z"></path>' +
          '</svg></span>';
      } else {
        btn.textContent = filter.label;
      }

      btn.addEventListener('click', function () {
        activeFilter = filter.key;
        filtersEl.querySelectorAll('.ycs-drape-filter').forEach(function (el) {
          el.classList.remove('is-active');
        });
        btn.classList.add('is-active');
        renderFilteredSwatches();
      });

      filtersEl.appendChild(btn);
    });
  }

  function renderFilteredSwatches() {
    if (!swatchesEl) return;

    swatchesEl.innerHTML = '';

    let colors = currentPaletteColors.slice();
    colors.sort(function (a, b) {
      return (a.sortOrder || 0) - (b.sortOrder || 0);
    });

    if (activeFilter === 'favorites') {
      colors = colors.filter(function (color) {
        return favorites.has(normalizeHex(color.hex || color.hexCode || color.colorHex || ''));
      });
    } else if (activeFilter !== 'all') {
      colors = colors.filter(function (color) {
        const category = (color.category || '').trim().toLowerCase();
        return category === activeFilter;
      });
    }

    if (!colors.length) {
      swatchesEl.innerHTML = '<p style="font-size:13px;color:#7b746c;">No colors found</p>';
      if (selectedColorEl) {
        const nameEl = selectedColorEl.querySelector('.ycs-selected-name');
        if (nameEl) nameEl.textContent = '—';
      }
      return;
    }

    colors.forEach(function (color, index) {
      const hex = color.hex || color.hexCode || color.colorHex || '';
      const name = color.name || color.colorName || color.title || '';
      if (!hex) return;

      const normalizedHex = normalizeHex(hex);

      const btn = document.createElement('button');
      btn.className = 'ycs-drape-swatch';
      btn.style.background = normalizedHex;
      btn.title = name;
      btn.setAttribute('aria-label', name || normalizedHex);
      btn.dataset.hex = normalizedHex;
      btn.dataset.name = name || '';

      btn.addEventListener('click', function () {
        drapePath.setAttribute('fill', normalizedHex);
        syncDrapeStyleVars(normalizedHex);
        selectedHex = normalizedHex;

        if (selectedColorEl) {
          const nameEl = selectedColorEl.querySelector('.ycs-selected-name');
          if (nameEl) nameEl.textContent = name || 'Color';
        }

        document.querySelectorAll('.ycs-drape-swatch').forEach(function (el) {
          el.classList.remove('is-active');
        });

        btn.classList.add('is-active');
        updateFavoriteButton();
      });

      if (selectedHex && normalizeHex(selectedHex) === normalizedHex) {
        btn.classList.add('is-active');
      }

      if (!selectedHex && index === 0) {
        drapePath.setAttribute('fill', normalizedHex);
        syncDrapeStyleVars(normalizedHex);
        selectedHex = normalizedHex;

        if (selectedColorEl) {
          const nameEl = selectedColorEl.querySelector('.ycs-selected-name');
          if (nameEl) nameEl.textContent = name || 'Color';
        }

        btn.classList.add('is-active');
      }

      swatchesEl.appendChild(btn);
    });

    const hasActiveSwatch = swatchesEl.querySelector('.ycs-drape-swatch.is-active');
    if (!hasActiveSwatch) {
      const firstBtn = swatchesEl.querySelector('.ycs-drape-swatch');
      if (firstBtn) firstBtn.click();
    }
  }

  function applyDeepLinkedColor() {
    const params = getQueryParams();
    if (!params.hex) return false;

    const swatches = Array.from(document.querySelectorAll('.ycs-drape-swatch'));
    if (!swatches.length) return false;

    const exactMatch = swatches.find(function (btn) {
      const btnHex = normalizeHex(btn.dataset.hex || '');
      const btnName = (btn.dataset.name || '').trim().toLowerCase();
      const wantedName = params.colorName.trim().toLowerCase();

      if (wantedName) {
        return btnHex === params.hex && btnName === wantedName;
      }
      return btnHex === params.hex;
    });

    if (exactMatch) {
      exactMatch.click();
      exactMatch.scrollIntoView({
        block: 'nearest',
        inline: 'nearest',
        behavior: 'smooth'
      });
      return true;
    }

    return false;
  }

  async function renderSwatchesForPalette(paletteCode) {
    if (!swatchesEl) return;

    showSwatchLoading();
    selectedHex = '';

    currentPaletteColors = await fetchPaletteColors(paletteCode);
    await loadFavorites(paletteCode);

    activeFilter = 'all';

    renderFilterButtons();
    renderFilteredSwatches();
    setTimeout(updateFilterArrows, 50);
    applyDeepLinkedColor();
    hideSwatchLoading();
  }

  function updateDrapeShape() {
    if (window.innerWidth <= 900) {
      setDrapeShape('M0,255 Q140,182 305,198 Q500,355 695,198 Q860,182 1000,255 L1000,500 L0,500 Z');
    } else {
      setDrapeShape('M0,235 Q160,170 320,182 Q500,310 680,182 Q840,170 1000,235 L1000,500 L0,500 Z');
    }
  }

  if (backBtn) {
    backBtn.addEventListener('click', function () {
      const returnUrl = getReturnUrl();

      if (document.referrer && document.referrer.indexOf('/pages/') !== -1) {
        window.history.back();
      } else {
        window.location.href = returnUrl;
      }
    });
  }

  if (favBtn) {
    favBtn.addEventListener('click', toggleFavorite);
  }

  replaceButtons.forEach(function (btn) {
  btn.addEventListener('click', function () {
    if (MODE === 'personal' && (IS_STYLE_MASTERS || HAS_DRAPING_STUDIO || IS_ADMIN)) {
      let href = '/pages/photo-prep?mode=personal&workflow=photo-draping';

      if (PERSONAL_PHOTO_ID) {
        href += '&photoId=' + encodeURIComponent(PERSONAL_PHOTO_ID);
      }

      href += '&photoSource=' + encodeURIComponent(SELECTED_PHOTO_SOURCE || 'PersonalStudioPhotos');
      href += '&returnUrl=' + encodeURIComponent(window.location.pathname + window.location.search);

      window.location.href = href;
      return;
    }

    if (!IS_ADMIN && uploadsRemaining !== null && uploadsRemaining === 0) {
      openUsageModal();
      return;
    }

    if (!hasExistingPhoto()) {
      fileInput.value = '';
      fileInput.click();
      return;
    }

    openReplaceConfirm();
  });
});

  if (replaceCancelBtn) {
    replaceCancelBtn.addEventListener('click', closeReplaceConfirm);
  }

  if (replaceConfirmBtn) {
    replaceConfirmBtn.addEventListener('click', triggerPhotoPickerForReplace);
  }

  if (usageModalCloseBtn) {
    usageModalCloseBtn.addEventListener('click', closeUsageModal);
  }

  if (replaceConfirmModal) {
    replaceConfirmModal.addEventListener('click', function (e) {
      if (e.target.classList.contains('ycs-confirm-modal__backdrop')) {
        closeReplaceConfirm();
      }
    });
  }

  if (usageModal) {
    usageModal.addEventListener('click', function (e) {
      if (e.target.classList.contains('ycs-confirm-modal__backdrop')) {
        closeUsageModal();
      }
    });
  }

  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') {
      if (replaceConfirmModal && !replaceConfirmModal.hidden) {
        closeReplaceConfirm();
      }
      if (usageModal && !usageModal.hidden) {
        closeUsageModal();
      }
    }
  });

  uploadBtn.addEventListener('click', function () {
    if (!IS_ADMIN && uploadsRemaining !== null && uploadsRemaining === 0) {
      openUsageModal();
      return;
    }

    if (hasExistingPhoto()) {
      openReplaceConfirm();
      return;
    }

    fileInput.value = '';
    fileInput.click();
  });

  // upload handler
  fileInput.addEventListener('change', async function (e) {
    closeReplaceConfirm();
    if (!CUSTOMER_ID) {
  alert('Please log in before uploading a photo.');
  return;
}

    const file = e.target.files[0];
    if (!file) return;

    const maxFileSizeMB = 10;

    if (isHeicFile(file) || !isAcceptedUploadFile(file)) {
      alert(ACCEPTED_UPLOAD_FORMATS_MESSAGE);
      fileInput.value = '';
      return;
    }

    if (file.size > maxFileSizeMB * 1024 * 1024) {
      alert('Please upload an image smaller than ' + maxFileSizeMB + 'MB.');
      fileInput.value = '';
      return;
    }

    try {
      showPhotoProcessing('Removing background…');

      const cleanedImage = await removeBackgroundFromFile(file);
      const cleanedImageForSave = await compressDataUrlForUpload(cleanedImage, 1000, 0.8);
      const approxSizeMB = cleanedImageForSave.length * 0.75 / 1024 / 1024;

      if (approxSizeMB > 3) {
        alert('Your image is still too large. Try a smaller photo.');
        hidePhotoProcessing();
        fileInput.value = '';
        return;
      }

      showPhotoProcessing('Finalizing your photo…');

      const saveResponse = await fetch(APP_BASE_URL + '/api/save-photo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
        imageBase64: cleanedImageForSave,
        customerId: CUSTOMER_ID
        })
      });

      const saveText = await saveResponse.text();
      let saveData = {};

      try {
        saveData = saveText ? JSON.parse(saveText) : {};
      } catch (err) {
        throw new Error('Photo save returned an invalid response');
      }

      if (!saveResponse.ok || !saveData.imageUrl) {
        throw new Error(saveData.error || 'Could not save your photo');
      }

      cachedProcessedImage = saveData.imageUrl;
      showPhotoProcessing('Preparing your photo…');

      previewImg.onload = function () {
        previewImg.classList.add('is-visible');
        state.imgLoaded = true;
        resetPhotoPosition();
        previewImg.style.display = 'block';
        photoFrame.style.display = 'block';
        if (uploadWrap) uploadWrap.style.display = 'none';
        hidePhotoProcessing();
        syncComparisonPhotoSource();
      };

      previewImg.onerror = function () {
        hidePhotoProcessing();
        console.error('Saved image could not be loaded:', cachedProcessedImage);
        alert('The saved photo could not be displayed.');
      };

      previewImg.src = cachedProcessedImage;
      fileInput.value = '';
      loadUploadUsage();
    } catch (error) {
      console.error('Photo processing failed FULL:', error);
      hidePhotoProcessing();

      const message = error.message || 'We couldn’t process your photo. Try another image.';

      if (
        message.indexOf('used all 3 uploads') !== -1 ||
        message.indexOf('used your free upload') !== -1
      ) {
        openUsageModal();
      } else {
        alert(message);
      }

      fileInput.value = '';
    }
  });

  zoomSliders.forEach(function (slider) {
    slider.addEventListener('input', function () {
      state.scale = clampScale(parseFloat(this.value || '1'));
      syncZoomSliders(String(state.scale));
      updateImageTransform();
    });
  });

  resetButtons.forEach(function (btn) {
    btn.addEventListener('click', function () {
      resetPhotoPosition();
    });
  });

  saveButtons.forEach(function (btn) {
    btn.addEventListener('click', function () {
      saveDrapedPhoto();
    });
  });

  if (saveLeftComparisonBtn) {
    saveLeftComparisonBtn.addEventListener('click', function () {
      saveDrapedPhoto({
        frame: leftComparisonFrame,
        img: leftComparisonImg,
        drapePath: leftComparisonDrapePath,
        paletteCode: comparisonState.leftPaletteCode || 'palette',
        colorName: comparisonState.leftName || 'color'
      });
    });
  }

  if (saveRightComparisonBtn) {
    saveRightComparisonBtn.addEventListener('click', function () {
      saveDrapedPhoto({
        frame: rightComparisonFrame,
        img: rightComparisonImg,
        drapePath: rightComparisonDrapePath,
        paletteCode: comparisonState.rightPaletteCode || 'palette',
        colorName: comparisonState.rightName || 'color'
      });
    });
  }

  if (singleViewBtn) {
    singleViewBtn.addEventListener('click', function () {
      setViewMode('single');
    });
  }

  if (comparisonViewBtn) {
    comparisonViewBtn.addEventListener('click', function () {
      setViewMode('comparison');
    });
  }

  if (mobileContinueBtn) {
    mobileContinueBtn.addEventListener('click', function () {
      if (!state.imgLoaded) return;
      goToMobileStep('colors');
    });
  }

  if (mobileBackBtn) {
    mobileBackBtn.addEventListener('click', function () {
      goToMobileStep('photo');
    });
  }

  [photoFrame, leftComparisonFrame, rightComparisonFrame].filter(Boolean).forEach(function (frameEl) {
    frameEl.addEventListener('mousedown', function (e) {
      if (!state.imgLoaded) return;
      state.dragging = true;
      state.pinching = false;
      state.startX = e.clientX - state.x;
      state.startY = e.clientY - state.y;
      frameEl.classList.add('is-dragging');
    });
  });

  window.addEventListener('mousemove', function (e) {
    if (!state.dragging) return;
    state.x = e.clientX - state.startX;
    state.y = e.clientY - state.startY;
    updateImageTransform();
  });

  window.addEventListener('mouseup', function () {
    state.dragging = false;
    state.pinching = false;
    [photoFrame, leftComparisonFrame, rightComparisonFrame].filter(Boolean).forEach(function (frameEl) {
      frameEl.classList.remove('is-dragging');
    });
  });

  [photoFrame, leftComparisonFrame, rightComparisonFrame].filter(Boolean).forEach(function (frameEl) {
    frameEl.addEventListener('touchstart', function (e) {
      if (!state.imgLoaded) return;

      if (e.touches.length === 2) {
        e.preventDefault();
        state.pinching = true;
        state.dragging = false;
        state.startDistance = getTouchDistance(e.touches);
        state.startScale = state.scale;
        frameEl.classList.add('is-dragging');
        return;
      }

      if (e.touches.length === 1) {
        const touch = e.touches[0];
        state.dragging = true;
        state.pinching = false;
        state.startX = touch.clientX - state.x;
        state.startY = touch.clientY - state.y;
        frameEl.classList.add('is-dragging');
      }
    }, { passive: false });

    frameEl.addEventListener('touchmove', function (e) {
      if (!state.imgLoaded) return;

      if (state.pinching && e.touches.length === 2) {
        e.preventDefault();
        const distance = getTouchDistance(e.touches);
        const scaleRatio = distance / state.startDistance;
        state.scale = clampScale(state.startScale * scaleRatio);
        syncZoomSliders(state.scale.toFixed(2));
        updateImageTransform();
        return;
      }

      if (state.dragging && e.touches.length === 1) {
        e.preventDefault();
        const touch = e.touches[0];
        state.x = touch.clientX - state.startX;
        state.y = touch.clientY - state.startY;
        updateImageTransform();
      }
    }, { passive: false });

    frameEl.addEventListener('touchend', function () {
      state.dragging = false;
      state.pinching = false;
      frameEl.classList.remove('is-dragging');
    });

    frameEl.addEventListener('touchcancel', function () {
      state.dragging = false;
      state.pinching = false;
      frameEl.classList.remove('is-dragging');
    });
  });

  updateDrapeShape();
  setRealisticDrapeEnabled(false);

  if (realisticDrapeToggle) {
    realisticDrapeToggle.checked = false;
    realisticDrapeToggle.addEventListener('change', function () {
      syncRealisticToggleControls(realisticDrapeToggle.checked);
      setRealisticDrapeEnabled(realisticDrapeToggle.checked);
    });
  }

  if (realisticDrapeToggleComparison) {
    realisticDrapeToggleComparison.checked = false;
    realisticDrapeToggleComparison.addEventListener('change', function () {
      syncRealisticToggleControls(realisticDrapeToggleComparison.checked);
      setRealisticDrapeEnabled(realisticDrapeToggleComparison.checked);
    });
  }

  if (drapeTextureStyleEl) {
    drapeTextureStyleEl.value = 'none';
    drapeTextureStyleEl.addEventListener('change', function () {
      syncTextureControls(drapeTextureStyleEl.value);
      syncDrapeStyleVars();
      syncComparisonDrapeStyles();
    });
  }

  if (drapeTextureStyleComparisonEl) {
    drapeTextureStyleComparisonEl.value = 'none';
    drapeTextureStyleComparisonEl.addEventListener('change', function () {
      syncTextureControls(drapeTextureStyleComparisonEl.value);
      syncDrapeStyleVars();
      syncComparisonDrapeStyles();
    });
  }

  populatePaletteSelect();
  renderComparisonPalettes();
  setViewMode('single');
  updateCurrentPaletteName();

  const initialPalette = paletteSelect ? paletteSelect.value : '';
  if (initialPalette) {
    renderSwatchesForPalette(initialPalette);
  }

  const MODE = (urlParams.get('mode') || '').trim().toLowerCase();
const PERSONAL_PHOTO_ID = (urlParams.get('photoId') || '').trim();
const CAN_DELETE_PERSONAL_PHOTO =
  MODE === 'personal' &&
  !!PERSONAL_PHOTO_ID &&
  (IS_ADMIN || IS_STYLE_MASTERS || HAS_DRAPING_STUDIO) &&
  !IS_SAMPLE_USER;

deletePhotoButtons.forEach(function (btn) {
  btn.hidden = !CAN_DELETE_PERSONAL_PHOTO;
  btn.addEventListener('click', archivePersonalStudioPhoto);
});

if (MODE === 'personal' && PERSONAL_PHOTO_ID) {
  fetchSavedPhoto();
} else {
  if (SELECTED_PHOTO_ID) {
  fetch(
    APP_BASE_URL +
      '/api/get-member-photo-by-id?photoId=' +
      encodeURIComponent(SELECTED_PHOTO_ID)
  )
    .then(res => res.json())
    .then(data => {
      if (data && data.activePhotoUrl) {
        state.firstName = data.firstName || state.firstName || '';
        loadSavedPhoto(data.activePhotoUrl, data.photoTransform || null);
      }
    })
    .catch(err => {
      console.error('Failed to load selected photo', err);
    });
} else {
  fetchSavedPhoto();
}
}

loadUploadUsage();

  if (paletteSelect) {
    paletteSelect.addEventListener('change', function () {
      updateCurrentPaletteName();
      renderSwatchesForPalette(this.value);
    });
  }

  if (leftPaletteSelect) {
    leftPaletteSelect.addEventListener('change', function () {
      comparisonState.leftFilter = 'all';
      comparisonState.leftHex = '';
      loadComparisonSide('left');
    });
  }

  if (rightPaletteSelect) {
    rightPaletteSelect.addEventListener('change', function () {
      comparisonState.rightFilter = 'all';
      comparisonState.rightHex = '';
      loadComparisonSide('right');
    });
  }

  window.addEventListener('resize', function () {
    updateDrapeShape();
    if (!studioRoot) return;
    if (!isMobile()) {
      studioRoot.setAttribute('data-mobile-step', 'photo');
    }
  });
})();
