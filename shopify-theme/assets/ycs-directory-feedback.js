(function () {
  'use strict';

  var root = document.querySelector('[data-app]');
  if (!root) return;

  var form = root.querySelector('[data-form]');
  var saveButton = root.querySelector('[data-save]');
  var formStatus = root.querySelector('[data-form-status]');
  var globalStatus = root.querySelector('[data-msg]');
  var summary = root.querySelector('[data-summary]');
  var empty = root.querySelector('[data-empty]');
  if (!form || !saveButton || !formStatus || !globalStatus || !summary || !empty || typeof saveButton.onclick !== 'function') return;

  var saveDraft = saveButton.onclick;
  var draftPending = false;

  function showFormStatus(message, isError) {
    formStatus.hidden = !message;
    formStatus.textContent = message || '';
    formStatus.className = 'form-status' + (isError ? ' error' : '');
  }

  saveButton.onclick = function () {
    draftPending = true;
    showFormStatus('Saving draft...', false);
    saveDraft();
  };

  ['[data-create]', '[data-edit]', '[data-cancel]'].forEach(function (selector) {
    var control = root.querySelector(selector);
    if (control) control.addEventListener('click', function () { showFormStatus('', false); });
  });

  new MutationObserver(function () {
    if (!draftPending || globalStatus.hidden || !globalStatus.textContent) return;
    var isError = globalStatus.classList.contains('error');
    var message = globalStatus.textContent;
    globalStatus.hidden = true;
    draftPending = false;
    showFormStatus(message, isError);
    if (!isError) {
      form.hidden = false;
      summary.hidden = true;
      empty.hidden = true;
    }
  }).observe(globalStatus, { attributes: true, childList: true, characterData: true, subtree: true });
})();
