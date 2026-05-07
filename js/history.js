'use strict';

/* Cached entries so the edit modal can look up full data without an extra DB call */
let _cachedEntries = [];

/* Set by the progression screen when a dot is tapped — auto-expands that entry on render */
let _pendingExpandId = null;
function setExpandOnRender(id) { _pendingExpandId = id; }

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

    /* Auto-expand a specific entry if navigated here from the progression chart */
    if (_pendingExpandId !== null) {
      const targetId = _pendingExpandId;
      _pendingExpandId = null;
      requestAnimationFrame(() => {
        const card = container.querySelector(`.entry-item[data-id="${targetId}"]`);
        if (card) {
          card.classList.add('expanded');
          card.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      });
    }
  });
}

function buildEntryCard(entry) {
  const emotionsHtml = entry.emotions.map(id => {
    const em = EMOTIONS.find(e => e.id === id);
    if (!em) return '';
    return `<span class="emotion-chip" style="border-color:${em.color};background:${em.bg};color:${em.color}">${em.emoji} ${em.label}</span>`;
  }).join('');

  /* Strip the "What happened:\n" section header for a cleaner preview */
  const previewSource = entry.text ? entry.text.replace(/^What happened:\n/, '') : '';
  const previewText   = previewSource
    ? previewSource.slice(0, 100) + (previewSource.length > 100 ? '…' : '')
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
        ${entry.text ? renderStructuredText(entry.text) : ''}
        ${locationHtml}
        ${goalHtml}
        ${entry.reframe ? `
          <div class="entry-reframe">
            <p class="entry-reframe-label">🌱 Reflection</p>
            <p class="entry-reframe-text">${escapeHtml(entry.reframe)}</p>
          </div>` : ''}
      </div>
    </div>
  `;
}

/* ── Render journal text with structured section labels ── */
function renderStructuredText(text) {
  const { what, why, realise } = parseEntryText(text);

  /* Old-format entry — no section structure, render as a single block */
  if (!why && !realise) {
    return `<p class="entry-text-full">${escapeHtml(what || text)}</p>`;
  }

  let html = '';
  if (what) {
    html += `<p class="entry-section-display-label">① What happened</p>
             <p class="entry-text-full">${escapeHtml(what)}</p>`;
  }
  if (why) {
    html += `<p class="entry-section-display-label">② Why I felt that way</p>
             <p class="entry-text-full">${escapeHtml(why)}</p>`;
  }
  if (realise) {
    html += `<p class="entry-section-display-label">③ What I realised</p>
             <p class="entry-text-full">${escapeHtml(realise)}</p>`;
  }
  return html;
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

  const parsed = parseEntryText(entry.text || '');

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
        <p class="section-label">① What happened, and how did it make you feel?</p>
        <textarea id="edit-what" maxlength="800" placeholder="Describe what happened and how it made you feel…">${escapeHtml(parsed.what)}</textarea>
        <p class="char-count"><span id="edit-char-what">${parsed.what.length}</span> / 800</p>
      </div>

      <div class="edit-field">
        <p class="section-label">② Why did you feel that way?</p>
        <textarea id="edit-why" maxlength="800" placeholder="e.g. I felt anxious because…">${escapeHtml(parsed.why)}</textarea>
        <p class="char-count"><span id="edit-char-why">${parsed.why.length}</span> / 800</p>
      </div>

      <div class="edit-field">
        <p class="section-label">③ What did this experience make you realise about yourself?</p>
        <textarea id="edit-realise" maxlength="800" placeholder="e.g. I realised that…">${escapeHtml(parsed.realise)}</textarea>
        <p class="char-count"><span id="edit-char-realise">${parsed.realise.length}</span> / 800</p>
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
        <p class="section-label">🌱 Reflection <span style="font-weight:400;text-transform:none;font-size:11px">(optional)</span></p>
        <textarea
          id="edit-reframe"
          placeholder="Is there another way to look at what happened? Try: 'One good thing was…'"
          maxlength="500"
          style="min-height:72px"
        >${escapeHtml(entry.reframe || '')}</textarea>
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

  /* Auto-resize all three text sections */
  [['edit-what', 'edit-char-what'], ['edit-why', 'edit-char-why'], ['edit-realise', 'edit-char-realise']].forEach(([taId, countId]) => {
    const ta    = overlay.querySelector(`#${taId}`);
    const count = overlay.querySelector(`#${countId}`);
    if (!ta) return;
    ta.style.height = ta.scrollHeight + 'px';
    ta.addEventListener('input', () => {
      ta.style.height = 'auto';
      ta.style.height = ta.scrollHeight + 'px';
      if (count) count.textContent = ta.value.length;
    });
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
    const newWhat    = overlay.querySelector('#edit-what').value.trim();
    const newWhy     = overlay.querySelector('#edit-why').value.trim();
    const newRealise = overlay.querySelector('#edit-realise').value.trim();
    const newText    = buildEntryText(newWhat, newWhy, newRealise);
    const newGoal    = overlay.querySelector('#edit-goal').value.trim();

    if (!newText && editEmotions.length === 0) {
      showToast('Add some text or pick an emotion', 'error');
      return;
    }

    const saveBtn       = overlay.querySelector('#edit-save');
    saveBtn.disabled    = true;
    saveBtn.textContent = 'Saving…';

    const newLocation = overlay.querySelector('#edit-location-input').value.trim();
    const newReframe  = overlay.querySelector('#edit-reframe').value.trim();

    const updated = {
      ...entry,
      text:     newText,
      emotions: [...editEmotions],
      goal:     newGoal     || null,
      location: newLocation || null,
      reframe:  newReframe  || null,
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
