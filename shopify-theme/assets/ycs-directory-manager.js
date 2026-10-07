(function () {
  'use strict';

  var root = document.querySelector('[data-directory-manager]');
  if (!root) return;

  var form = root.querySelector('[data-form]');
  var globalStatus = root.querySelector('[data-msg]');
  var formStatus = root.querySelector('[data-form-status]');
  var preview = root.querySelector('[data-preview]');
  var previewCard = root.querySelector('[data-preview-card]');
  var loading = root.querySelector('[data-load]');
  var imagePreview = root.querySelector('[data-image]');
  var endpoint = root.dataset.url + '?action=colorAnalystDirectory';
  var draftKey = 'ycs-directory-draft-' + root.dataset.customerId;
  var listing = null;
  var image = { imageUrl: '', imagePublicId: '' };
  var saveTimer = null;

  function request(body) {
    return fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    }).then(function (response) {
      return response.json().then(function (data) {
        if (!response.ok) {
          var error = new Error(data.error || 'Something went wrong.');
          error.errors = data.errors;
          throw error;
        }
        return data;
      });
    });
  }

  function showMessage(message, isError) {
    globalStatus.hidden = !message;
    globalStatus.textContent = message || '';
    globalStatus.className = isError ? 'error' : '';
  }

  function showFormStatus(message) {
    formStatus.hidden = !message;
    formStatus.textContent = message || '';
  }

  function value(name) {
    return form.elements[name].value.trim();
  }

  function formData() {
    return {
      name: value('name'),
      businessName: value('businessName'),
      city: value('city'),
      stateProvince: value('stateProvince'),
      country: value('country'),
      services: value('services'),
      websiteUrl: value('websiteUrl'),
      contactEmail: value('contactEmail'),
      socialUrl: value('socialUrl'),
      bio: value('bio'),
      imageUrl: image.imageUrl,
      imagePublicId: image.imagePublicId,
      status: listing ? listing.status : 'draft'
    };
  }

  function fill(data) {
    Object.keys(data || {}).forEach(function (key) {
      if (form.elements[key] && key !== 'image') form.elements[key].value = data[key] || '';
    });
    image = { imageUrl: data.imageUrl || '', imagePublicId: data.imagePublicId || '' };
    imagePreview.hidden = !image.imageUrl;
    imagePreview.src = image.imageUrl;
    root.querySelector('[data-count]').textContent = form.elements.bio.value.length;
  }

  function savedDraft() {
    try { return JSON.parse(localStorage.getItem(draftKey) || 'null'); }
    catch (error) { return null; }
  }

  function persistDraft() {
    localStorage.setItem(draftKey, JSON.stringify(formData()));
    showFormStatus('Draft saved automatically.');
  }

  function scheduleDraftSave() {
    showFormStatus('Saving draft...');
    clearTimeout(saveTimer);
    saveTimer = setTimeout(persistDraft, 500);
  }

  function formatsFor(data) {
    if (data.services === 'Both') return ['ONLINE', 'IN PERSON'];
    if (data.services === 'Virtual') return ['ONLINE'];
    if (data.services === 'In-Person') return ['IN PERSON'];
    return [];
  }

  function displayLocation(data) {
    var country = String(data.country || '').trim();
    var isUS = /^(us|usa|u\.s\.|u\.s\.a\.|united states|united states of america)$/i.test(country);
    return [data.city, data.stateProvince, isUS ? '' : country].filter(Boolean).join(', ');
  }

  function safeUrl(value) {
    try {
      var url = new URL(value);
      return url.protocol === 'http:' || url.protocol === 'https:' ? url.href : null;
    } catch (error) { return null; }
  }

  function node(tag, className, text) {
    var element = document.createElement(tag);
    if (className) element.className = className;
    if (text !== undefined) element.textContent = text;
    return element;
  }

  function renderCard(data) {
    var card = node('article', 'analyst-card');
    var media = node('div', 'analyst-card__media');
    if (data.imageUrl) {
      var photo = node('img', 'analyst-card__image');
      photo.src = data.imageUrl;
      photo.alt = data.businessName || data.name || 'Directory listing photo';
      photo.width = 320;
      photo.height = 400;
      media.appendChild(photo);
    }
    var badges = node('div', 'analyst-card__badges');
    formatsFor(data).forEach(function (format) {
      badges.appendChild(node('span', 'analyst-card__badge' + (format === 'ONLINE' ? ' analyst-card__badge--online' : ''), format));
    });
    media.appendChild(badges);
    card.appendChild(media);

    var content = node('div', 'analyst-card__content');
    content.appendChild(node('h2', '', data.businessName || data.name || 'Your Directory Listing'));
    if (data.businessName && data.name) content.appendChild(node('p', 'analyst-card__name', data.name));
    content.appendChild(node('div', 'analyst-card__location', displayLocation(data)));
    content.appendChild(node('p', 'analyst-card__bio', data.bio || 'Your short bio will appear here.'));
    var links = node('div', 'analyst-card__links');
    var website = safeUrl(data.websiteUrl);
    if (website) {
      var websiteLink = node('a', 'preview-button', 'Visit Website');
      websiteLink.href = website;
      websiteLink.target = '_blank';
      websiteLink.rel = 'noopener noreferrer';
      links.appendChild(websiteLink);
    }
    if (data.contactEmail) {
      var firstName = String(data.name || '').trim().split(/\s+/)[0];
      var emailLink = node('a', 'analyst-card__email', (firstName ? 'Email ' + firstName : 'Email Analyst') + ' →');
      emailLink.href = 'mailto:' + data.contactEmail;
      links.appendChild(emailLink);
    }
    content.appendChild(links);
    card.appendChild(content);
    previewCard.replaceChildren(card);
  }

  function comparable(data) {
    var fields = ['name', 'businessName', 'city', 'stateProvince', 'country', 'services', 'websiteUrl', 'contactEmail', 'socialUrl', 'bio', 'imageUrl', 'imagePublicId'];
    return JSON.stringify(fields.map(function (field) { return String((data && data[field]) || '').trim(); }));
  }

  function updateActionLabels(previewData) {
    var published = listing && listing.status === 'published';
    var changed = published && comparable(previewData || savedDraft() || listing) !== comparable(listing);
    root.querySelectorAll('[data-publish]').forEach(function (button) {
      button.textContent = published ? 'Update Listing' : 'Publish Listing';
    });
    root.querySelectorAll('[data-update]').forEach(function (button) {
      button.hidden = !changed;
    });
    root.querySelectorAll('[data-status-action]').forEach(function (button) {
      button.textContent = published ? 'Unpublish' : 'Publish Listing';
    });
  }

  function showPreview(data) {
    clearTimeout(saveTimer);
    if (!form.hidden) persistDraft();
    renderCard(data || formData());
    form.hidden = true;
    preview.hidden = false;
    updateActionLabels(data || formData());
    showFormStatus('');
  }

  function showForm() {
    var draft = savedDraft();
    fill(draft || listing || {});
    preview.hidden = true;
    form.hidden = false;
    form.querySelectorAll('[data-cancel]').forEach(function (button) { button.hidden = !listing; });
    updateActionLabels(draft || listing || {});
    showMessage('');
  }

  function publish() {
    var data = form.hidden ? (savedDraft() || listing) : formData();
    showMessage('Publishing listing...');
    root.querySelectorAll('[data-publish], [data-update], [data-status-action]').forEach(function (button) { button.disabled = true; });
    request({ operation: 'publish', listing: data }).then(function (response) {
      listing = response.listing;
      localStorage.removeItem(draftKey);
      fill(listing);
      form.hidden = true;
      showPreview(listing);
      showMessage('Your listing is published.');
    }).catch(function (error) {
      showMessage(error.message + (error.errors ? ' ' + Object.keys(error.errors).join(', ') + '.' : ''), true);
    }).finally(function () {
      root.querySelectorAll('[data-publish], [data-update], [data-status-action]').forEach(function (button) { button.disabled = false; });
    });
  }

  function unpublish() {
    showMessage('Unpublishing listing...');
    root.querySelectorAll('[data-status-action]').forEach(function (button) { button.disabled = true; });
    request({ operation: 'unpublish' }).then(function (response) {
      listing = response.listing;
      updateActionLabels(listing);
      showMessage('Your listing has been unpublished.');
    }).catch(function (error) {
      showMessage(error.message, true);
    }).finally(function () {
      root.querySelectorAll('[data-status-action]').forEach(function (button) { button.disabled = false; });
    });
  }

  root.querySelectorAll('[data-edit]').forEach(function (button) { button.addEventListener('click', showForm); });
  root.querySelectorAll('[data-preview-button]').forEach(function (button) { button.addEventListener('click', function () { showPreview(formData()); }); });
  root.querySelectorAll('[data-publish]').forEach(function (button) { button.addEventListener('click', publish); });
  root.querySelectorAll('[data-update]').forEach(function (button) { button.addEventListener('click', publish); });
  root.querySelectorAll('[data-status-action]').forEach(function (button) {
    button.addEventListener('click', function () { listing && listing.status === 'published' ? unpublish() : publish(); });
  });
  root.querySelectorAll('[data-cancel]').forEach(function (button) { button.addEventListener('click', function () { showPreview(listing); }); });
  form.addEventListener('input', scheduleDraftSave);
  form.addEventListener('change', scheduleDraftSave);
  form.elements.bio.addEventListener('input', function () { root.querySelector('[data-count]').textContent = this.value.length; });

  form.elements.image.onchange = function () {
    var file = this.files[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) return showMessage('Choose an image up to 5 MB.', true);
    var reader = new FileReader();
    reader.onload = function () {
      showMessage('Uploading image...');
      request({ operation: 'uploadImage', imageBase64: reader.result }).then(function (response) {
        image = { imageUrl: response.imageUrl, imagePublicId: response.imagePublicId };
        imagePreview.src = image.imageUrl;
        imagePreview.hidden = false;
        persistDraft();
        showMessage('Image uploaded.');
      }).catch(function (error) { showMessage(error.message, true); });
    };
    reader.readAsDataURL(file);
  };

  fetch(endpoint).then(function (response) {
    return response.json().then(function (data) {
      if (!response.ok) throw new Error(data.error || 'Unable to load your listing');
      return data;
    });
  }).then(function (data) {
    listing = data.listing;
    loading.hidden = true;
    if (listing) {
      fill(listing);
      showPreview(savedDraft() || listing);
    } else {
      fill(savedDraft() || {});
      showForm();
    }
  }).catch(function (error) {
    loading.hidden = true;
    showMessage(error.message, true);
  });
})();
