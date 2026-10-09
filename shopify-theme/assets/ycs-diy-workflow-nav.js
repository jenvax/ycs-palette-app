(function () {
  const navs = Array.from(document.querySelectorAll('[data-ycs-diy-workflow-nav]'));
  if (!navs.length) return;

  const APP_BASE_URL = 'https://ycs-palette-app.vercel.app';

  function buildAnalysisHref(customerId, photo, requestedStep) {
    const url = new URL('/pages/diy-structured-analysis', window.location.origin);
    url.searchParams.set('mode', 'diy');
    url.searchParams.set('customerId', customerId);
    // Structured Analysis applies prerequisite rules against the latest saved decisions.
    url.searchParams.set('returnStep', requestedStep);
    if (photo.photoId) url.searchParams.set('photoId', photo.photoId);
    if (photo.photoSource) url.searchParams.set('photoSource', photo.photoSource);
    return url.pathname + url.search;
  }

  function syncActiveState(nav) {
    const currentPage = nav.dataset.currentPage || '';
    const requested = new URLSearchParams(window.location.search).get('returnStep') || '';
    let currentStep = requested;

    if (currentPage === 'structured-analysis') {
      const depth = document.getElementById('ycs-analysis-depth-step');
      const undertone = document.getElementById('ycs-analysis-undertone-step');
      const chroma = document.getElementById('ycs-analysis-chroma-step');
      if (depth && !depth.hidden) currentStep = 'depth';
      else if (undertone && !undertone.hidden) currentStep = 'undertone';
      else if (chroma && !chroma.hidden) currentStep = 'chroma';
    }

    nav.querySelectorAll('a').forEach(function (link) {
      const isActive =
        (currentPage === 'photo-prep' && link.dataset.diyNavPage === 'photo-prep') ||
        (currentPage === 'structured-analysis' && link.dataset.diyNavStep === currentStep);
      link.classList.toggle('is-active', isActive);
      if (isActive) link.setAttribute('aria-current', 'page');
      else link.removeAttribute('aria-current');
    });
  }

  async function refreshNav(nav) {
    const customerId = String(nav.dataset.customerId || '').trim();
    syncActiveState(nav);
    if (!customerId) return;

    try {
      const response = await fetch(
        APP_BASE_URL + '/api/get-photo?customerId=' + encodeURIComponent(customerId)
      );
      if (!response.ok) return;
      const photo = await response.json();
      if (!photo || !photo.activePhotoUrl) return;

      nav.querySelectorAll('[data-diy-nav-step]').forEach(function (link) {
        link.hidden = false;
        link.href = buildAnalysisHref(customerId, photo, link.dataset.diyNavStep);
      });
      syncActiveState(nav);
    } catch (error) {
      console.warn('Could not load DIY workflow navigation state', error);
    }
  }

  navs.forEach(function (nav) {
    refreshNav(nav);
    const observer = new MutationObserver(function () { syncActiveState(nav); });
    ['ycs-analysis-depth-step', 'ycs-analysis-undertone-step', 'ycs-analysis-chroma-step'].forEach(function (id) {
      const step = document.getElementById(id);
      if (step) observer.observe(step, { attributes: true, attributeFilter: ['hidden'] });
    });
  });

  window.YcsDiyWorkflowNav = {
    refresh: function () { navs.forEach(refreshNav); },
    buildAnalysisHref: buildAnalysisHref
  };
})();
