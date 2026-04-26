'use strict';

/* Cached entries so the edit modal can look up full data without an extra DB call */
let _cachedEntries = [];

function renderHistory() {
  const screen = document.getElementById('screen-history');
  screen.innerHTML = `
    <div class="screen-header">
      <h1>Journal</h1>
      <span class="history-header-meta" id="entry-count">Loading…</span>
    </div>
    <div class="history-content" id="history-content">
      <div class="empty-state">
        <div class="empty-icon">📖</div>
        <h3>Loading entries…</h3>
      </div>
    </div>
  `;

  getAllEntries().then(entries => {
    _cachedEntries = entries;

    const count     = document.getElementById('entry-count');
    const container = document.getElementById('history-content');

    count.textContent = `${entries.length} ${entries.length === 1 ? 'entry' : 'entries'}`;

    if (!entries.length) {
      container.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon">📖</div>
          <h3>No entries yet</h3>
          <p>Head to Home and write your first journal entry.</p>
        </div>
      `;
      return;
    }

    /* Group by date, newest first */
    const groups = {};
    entries.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    entries.forEach(e => {
      if (!groups[e.date]) groups[e.date] = [];
      groups[e.date].push(e);
    });

    container.innerHTML = Object.keys(groups)
      .sort((a, b) => b.localeCompare(a))
      .map(date => `
        <div class="date-group">
          <p class="date-group-label">${formatDate(date)}</p>
          ${groups[date].map(entry => buildEntryCard(entry)).join('')}
        </div>
      `).join('');

    container.addEventListener('click', handleHistoryClick);
  });
}

function buildEntryCard(entry) {
  const emotionsHtml = entry.emotions.map(id => {
    const em = EMOTIONS.find(e => e.id === id);
    if (!em) return '';
    return `<span class="emotion-chip" style="border-color:${em.color};background:${em.bg};color:${em.color}">${em.emoji} ${em.label}</span>`;
  }).join('');

  const previewText = entry.text
    ? entry.text.slice(0, 100) + (entry.text.length > 100 ? '…' : '')
    : '<em style="color:var(--clr-text-muted)">No text — emotions only</em>';

  const goalHtml = entry.goal
    ? `<div class="entry-goal"><strong>${entry.goal}</strong></div>`
    : '';

  const locationHtml = entry.location
    ? `<div class="entry-location">📍 ${escapeHtml(entry.location)}</div>`
    : '';

  const photoHtml = entry.photo
    ? `<img src="${entry.photo}" alt="Entry photo" class="entry-photo" />`
    : '';

  const hasPhoto    = !!entry.photo;
  const hasLocation = !!entry.location;

  return `
    <div class="entry-item" data-id="${entry.id}">
      <div class="entry-item-header" data-action="expand">
        <span class="entry-time">${formatTime(entry.createdAt)}${hasPhoto ? ' 📷' : ''}${hasLocation ? ' 📍' : ''}</span>
        <div class="entry-item-actions">
          <button class="edit-btn"   data-action="edit"   aria-label="Edit entry">✏️</button>
          <button class="delete-btn" data-action="delete" aria-label="Delete entry">🗑</button>
          <span class="entry-expand-icon">⌄</span>
        </div>
      </div>

      ${entry.emotions.length ? `<div class="entry-emotions">${emotionsHtml}</div>` : ''}

      <p class="entry-preview">${previewText}</p>

      <div class="entry-body">
        ${photoHtml}
        ${entry.text ? `<p class="entry-text-full">${escapeHtml(entry.text)}</p>` : ''}
        ${locationHtml}
        ${goalHtml}
      </div>
    </div>
  `;
}

function handleHistoryClick(e) {
  const item   = e.target.closest('.entry-item');
  if (!item) return;

  const action = e.target.closest('[data-action]')?.dataset.action;
  const id     = Number(item.dataset.id);

  if (action === 'delete') {
    handleDelete(e.target.closest('.delete-btn'), id);
    return;
  }

  if (action === 'edit') {
    const entry = _cachedEntries.find(en => en.id === id);
    if (entry) openEditModal(entry);
    return;
  }

  /* Toggle expand */
  item.classList.toggle('expanded');
}

/* ── Delete ── */
function handleDelete(btn, id) {
  if (btn.classList.contains('confirming')) {
    deleteEntry(id).then(() => {
      showToast('Entry deleted', '');
      renderHistory();
    });
  } else {
    btn.classList.add('confirming');
    btn.textContent = 'Sure?';
    setTimeout(() => {
      if (btn.classList.contains('confirming')) {
        btn.classList.remove('confirming');
        btn.textContent = '🗑';
      }
    }, 3000);
  }
}

/* ── Edit modal ── */
function openEditModal(entry) {
  let editEmotions = [...entry.emotions];
  let editPhoto    = entry.photo || null;

  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';

  const dateLabel = new Date(entry.createdAt).toLocaleDateString('en-GB', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
  });

  overlay.innerHTML = `
    <div class="modal edit-modal" role="dialog" aria-modal="true" aria-label="Edit entry">
      <div class="modal-handle"></div>
      <div class="edit-modal-header">
        <h3>Edit Entry</h3>
        <p class="edit-modal-date">${dateLabel}</p>
      </div>

      <div class="edit-field">
        <p class="section-label">What happened</p>
        <textarea
          id="edit-text"
          maxlength="2000"
          placeholder="What happened? How did it make you feel, and why?"
        >${escapeHtml(entry.text || '')}</textarea>
        <p class="char-count"><span id="edit-char-num">${(entry.text || '').length}</span> / 2000</p>
      </div>

      <div class="edit-field">
        <p class="section-label">Emotions</p>
        <div class="emotion-grid" id="edit-emotion-grid">
          ${EMOTIONS.map(em => `
            <button
              class="emotion-btn ${editEmotions.includes(em.id) ? 'selected' : ''}"
              data-emotion="${em.id}"
              style="--emotion-color:${em.color}; --emotion-bg:${em.bg}"
              type="button"
            >
              <span class="emotion-emoji">${em.emoji}</span>
              <span>${em.label}</span>
            </button>
          `).join('')}
        </div>
      </div>

      <div class="edit-field">
        <p class="section-label">Goal <span style="font-weight:400;text-transform:none;font-size:11px">(optional)</span></p>
        <input
          type="text"
          id="edit-goal"
          value="${escapeHtml(entry.goal || '')}"
          placeholder="What was your goal for this day?"
          maxlength="120"
        />
      </div>

      <div class="edit-field">
        <p class="section-label">Location</p>
        <div class="location-row">
          <input
            type="text"
            id="edit-location-input"
            value="${escapeHtml(entry.location || '')}"
            placeholder="Where were you?"
            maxlength="100"
          />
          <button class="location-detect-btn" id="edit-location-detect" type="button" title="Detect my location">📍</button>
        </div>
      </div>

      <div class="edit-field">
        <p class="section-label">Photo</p>
        <div id="edit-photo-area">
          ${entry.photo
            ? `<div class="photo-preview">
                <img src="${entry.photo}" alt="Entry photo" class="photo-thumb" />
                <button class="photo-remove-btn" id="edit-photo-remove" type="button">✕ Remove</button>
               </div>
               <input type="file" id="edit-photo-input" accept="image/*" hidden />
               <button class="photo-attach-btn photo-replace-btn" id="edit-photo-replace" type="button">🔄 Replace</button>`
            : `<input type="file" id="edit-photo-input" accept="image/*" hidden />
               <button class="photo-attach-btn" id="edit-photo-add" type="button">📷 Add Photo</button>`
          }
        </div>
      </div>

      <div class="modal-actions">
        <button class="btn-secondary" id="edit-cancel" type="button">Cancel</button>
        <button class="btn-primary"   id="edit-save"   type="button">Save Changes</button>
      </div>
    </div>
  `;

  document.body.appendChild(overlay);

  /* Auto-resize textarea */
  const textarea = overlay.querySelector('#edit-text');
  const charNum  = overlay.querySelector('#edit-char-num');
  textarea.style.height = textarea.scrollHeight + 'px';
  textarea.addEventListener('input', () => {
    textarea.style.height = 'auto';
    textarea.style.height = textarea.scrollHeight + 'px';
    charNum.textContent = textarea.value.length;
  });

  /* Emotion toggle */
  overlay.querySelector('#edit-emotion-grid').addEventListener('click', e => {
    const btn = e.target.closest('.emotion-btn');
    if (!btn) return;
    const id = btn.dataset.emotion;
    if (editEmotions.includes(id)) {
      editEmotions = editEmotions.filter(x => x !== id);
      btn.classList.remove('selected');
    } else {
      editEmotions.push(id);
      btn.classList.add('selected');
    }
  });

  /* Location detect */
  overlay.querySelector('#edit-location-detect').addEventListener('click', () => {
    detectLocationInto(
      overlay.querySelector('#edit-location-detect'),
      overlay.querySelector('#edit-location-input')
    );
  });

  /* Photo listeners */
  setupEditPhotoListeners(overlay, () => editPhoto, val => { editPhoto = val; });

  /* Close on backdrop tap */
  overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove(); });

  /* Cancel */
  overlay.querySelector('#edit-cancel').addEventListener('click', () => overlay.remove());

  /* Save */
  overlay.querySelector('#edit-save').addEventListener('click', () => {
    const newText = textarea.value.trim();
    const newGoal = overlay.querySelector('#edit-goal').value.trim();

    if (!newText && editEmotions.length === 0) {
      showToast('Add some text or pick an emotion', 'error');
      return;
    }

    const saveBtn       = overlay.querySelector('#edit-save');
    saveBtn.disabled    = true;
    saveBtn.textContent = 'Saving…';

    const newLocation = overlay.querySelector('#edit-location-input').value.trim();

    const updated = {
      ...entry,
      text:     newText,
      emotions: [...editEmotions],
      goal:     newGoal     || null,
      location: newLocation || null,
      photo:    editPhoto,
    };

    updateEntry(updated).then(() => {
      overlay.remove();
      showToast('Entry updated ✓', 'success');
      renderHistory();
    }).catch(() => {
      showToast('Could not save — try again', 'error');
      saveBtn.disabled    = false;
      saveBtn.textContent = 'Save Changes';
    });
  });
}

/* ── Shared location detect (used by both home and edit modal) ── */
function detectLocationInto(btn, input) {
  if (!navigator.geolocation) {
    showToast('Geolocation not supported — enter manually', 'error');
    return;
  }

  btn.textContent = '⏳';
  btn.disabled    = true;

  navigator.geolocation.getCurrentPosition(
    pos => {
      const { latitude, longitude } = pos.coords;
      fetch(
        `https://nominatim.openstreetmap.org/reverse?lat=${latitude}&lon=${longitude}&format=json`,
        { headers: { 'User-Agent': 'Journaly-PWA' } }
      )
        .then(r => r.json())
        .then(data => {
          const a     = data.address || {};
          const parts = [
            a.suburb || a.neighbourhood || a.quarter || a.village || '',
            a.city   || a.town          || a.county  || '',
          ].filter(Boolean);
          input.value     = parts.join(', ') || data.display_name || '';
          btn.textContent = '📍';
          btn.disabled    = false;
          showToast('Location detected ✓', 'success');
        })
        .catch(() => {
          btn.textContent = '📍';
          btn.disabled    = false;
          showToast('Could not fetch place name — enter manually', 'error');
        });
    },
    err => {
      btn.textContent = '📍';
      btn.disabled    = false;
      if (err.code === err.PERMISSION_DENIED) {
        showToast('Location denied — enter it manually', '');
      } else {
        showToast('Could not get location — enter manually', 'error');
      }
    },
    { timeout: 10000 }
  );
}

/* ── Edit modal photo helpers ── */
function setupEditPhotoListeners(overlay, getPhoto, setPhoto) {
  const area = overlay.querySelector('#edit-photo-area');

  function readFile(file) {
    const reader = new FileReader();
    reader.onload = e => {
      setPhoto(e.target.result);
      refreshEditPhotoArea(area, e.target.result, getPhoto, setPhoto);
    };
    reader.readAsDataURL(file);
  }

  function attachInputListener() {
    const input = area.querySelector('#edit-photo-input');
    if (input) input.addEventListener('change', e => { if (e.target.files[0]) readFile(e.target.files[0]); });
  }

  function attachBtnListeners() {
    const addBtn     = area.querySelector('#edit-photo-add');
    const replaceBtn = area.querySelector('#edit-photo-replace');
    const removeBtn  = area.querySelector('#edit-photo-remove');

    if (addBtn)     addBtn.addEventListener('click',     () => area.querySelector('#edit-photo-input').click());
    if (replaceBtn) replaceBtn.addEventListener('click', () => area.querySelector('#edit-photo-input').click());
    if (removeBtn)  removeBtn.addEventListener('click',  () => {
      setPhoto(null);
      refreshEditPhotoArea(area, null, getPhoto, setPhoto);
    });
  }

  attachInputListener();
  attachBtnListeners();
}

function refreshEditPhotoArea(area, photo, getPhoto, setPhoto) {
  area.innerHTML = photo
    ? `<div class="photo-preview">
        <img src="${photo}" alt="Entry photo" class="photo-thumb" />
        <button class="photo-remove-btn" id="edit-photo-remove" type="button">✕ Remove</button>
       </div>
       <input type="file" id="edit-photo-input" accept="image/*" hidden />
       <button class="photo-attach-btn photo-replace-btn" id="edit-photo-replace" type="button">🔄 Replace</button>`
    : `<input type="file" id="edit-photo-input" accept="image/*" hidden />
       <button class="photo-attach-btn" id="edit-photo-add" type="button">📷 Add Photo</button>`;

  setupEditPhotoListeners(area.closest('.modal-overlay'), getPhoto, setPhoto);
}

/* ── Helpers ── */
function escapeHtml(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
