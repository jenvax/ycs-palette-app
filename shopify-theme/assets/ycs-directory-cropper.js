(function () {
  'use strict';

  var root = document.querySelector('[data-directory-manager], [data-app]');
  if (!root) return;

  var form = root.querySelector('[data-form]');
  var input = form && form.elements.image;
  var preview = root.querySelector('[data-image]');
  var tools = root.querySelector('[data-photo-tools]');
  var changeButton = root.querySelector('[data-change-photo]');
  var adjustButton = root.querySelector('[data-adjust-crop]');
  var dialog = root.querySelector('[data-crop-dialog]');
  var canvas = root.querySelector('[data-crop-canvas]');
  if (!input || !preview || !tools || !changeButton || !adjustButton || !dialog || !canvas) return;

  var context = canvas.getContext('2d');
  var zoom = root.querySelector('[data-zoom]');
  var error = root.querySelector('[data-crop-error]');
  var saveButton = root.querySelector('[data-save-crop]');
  var originalUpload = input.onchange;
  var source = null;
  var baseScale = 1;
  var offsetX = 0;
  var offsetY = 0;
  var pointer = null;

  function showError(message) {
    error.hidden = !message;
    error.textContent = message || '';
  }

  function refreshPreviewTools() {
    var visible = Boolean(preview.src && !preview.hidden);
    tools.hidden = !visible;
    adjustButton.hidden = !visible;
  }

  function clampOffsets() {
    if (!source) return;
    var scale = baseScale * Number(zoom.value);
    var width = source.naturalWidth * scale;
    var height = source.naturalHeight * scale;
    offsetX = Math.max((canvas.width - width) / 2, Math.min((width - canvas.width) / 2, offsetX));
    offsetY = Math.max((canvas.height - height) / 2, Math.min((height - canvas.height) / 2, offsetY));
  }

  function draw() {
    if (!source) return;
    clampOffsets();
    var scale = baseScale * Number(zoom.value);
    var width = source.naturalWidth * scale;
    var height = source.naturalHeight * scale;
    context.clearRect(0, 0, canvas.width, canvas.height);
    context.drawImage(source, (canvas.width - width) / 2 + offsetX, (canvas.height - height) / 2 + offsetY, width, height);
  }

  function openImage(image) {
    if (image.naturalWidth < 600 || image.naturalHeight < 750) {
      source = null;
      showError('Choose a larger photo. It must be at least 600 × 750 pixels for a clear directory image.');
      dialog.showModal();
      return;
    }
    source = image;
    baseScale = Math.max(canvas.width / source.naturalWidth, canvas.height / source.naturalHeight);
    offsetX = 0;
    offsetY = 0;
    zoom.value = '1';
    showError('');
    draw();
    dialog.showModal();
  }

  function loadFile(file) {
    if (!file) return;
    source = null;
    if (!/^image\/(jpeg|png|webp)$/.test(file.type) || file.size > 5 * 1024 * 1024) {
      showError('Choose a JPG, PNG, or WebP image up to 5 MB.');
      dialog.showModal();
      return;
    }
    var reader = new FileReader();
    reader.onload = function () {
      var image = new Image();
      image.onload = function () { openImage(image); };
      image.onerror = function () { showError('This image could not be opened. Choose another photo.'); dialog.showModal(); };
      image.src = reader.result;
    };
    reader.readAsDataURL(file);
  }

  function loadExistingCrop() {
    if (!preview.src) return;
    var image = new Image();
    image.crossOrigin = 'anonymous';
    image.onload = function () { openImage(image); };
    image.onerror = function () { showError('This saved photo could not be reopened. Please choose the photo again.'); dialog.showModal(); };
    image.src = preview.src + (preview.src.includes('?') ? '&' : '?') + 'crop=' + Date.now();
  }

  input.onchange = function () {
    loadFile(input.files && input.files[0]);
    input.value = '';
  };
  changeButton.onclick = function () { input.click(); };
  adjustButton.onclick = loadExistingCrop;

  zoom.oninput = draw;
  root.querySelector('[data-zoom-out]').onclick = function () { zoom.value = String(Math.max(1, Number(zoom.value) - 0.1)); draw(); };
  root.querySelector('[data-zoom-in]').onclick = function () { zoom.value = String(Math.min(3, Number(zoom.value) + 0.1)); draw(); };

  canvas.addEventListener('pointerdown', function (event) {
    pointer = { id: event.pointerId, x: event.clientX, y: event.clientY, offsetX: offsetX, offsetY: offsetY };
    canvas.setPointerCapture(event.pointerId);
  });
  canvas.addEventListener('pointermove', function (event) {
    if (!pointer || pointer.id !== event.pointerId) return;
    var rect = canvas.getBoundingClientRect();
    offsetX = pointer.offsetX + (event.clientX - pointer.x) * canvas.width / rect.width;
    offsetY = pointer.offsetY + (event.clientY - pointer.y) * canvas.height / rect.height;
    draw();
  });
  function endPointer(event) {
    if (pointer && pointer.id === event.pointerId) pointer = null;
  }
  canvas.addEventListener('pointerup', endPointer);
  canvas.addEventListener('pointercancel', endPointer);

  root.querySelectorAll('[data-crop-cancel]').forEach(function (button) {
    button.onclick = function () { dialog.close(); showError(''); };
  });

  saveButton.onclick = function () {
    if (!source) return;
    saveButton.disabled = true;
    canvas.toBlob(function (blob) {
      saveButton.disabled = false;
      if (!blob) return showError('The crop could not be saved. Please try again.');
      dialog.close();
      var croppedFile = new File([blob], 'directory-profile.jpg', { type: 'image/jpeg' });
      originalUpload.call({ files: [croppedFile] });
    }, 'image/jpeg', 0.9);
  };

  var observer = new MutationObserver(refreshPreviewTools);
  observer.observe(preview, { attributes: true, attributeFilter: ['src', 'hidden'] });
  preview.addEventListener('load', refreshPreviewTools);
  refreshPreviewTools();
})();
