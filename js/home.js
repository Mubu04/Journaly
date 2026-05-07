'use strict';

let selectedEmotions = [];
let selectedPhoto    = null;

function renderHome() {
  const screen  = document.getElementById('screen-home');
  const name    = localStorage.getItem('journaly-name') || 'there';
  const today   = new Date();
  const dateStr = today.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' });

  screen.innerHTML = `
    <div class="home-header">
      <div>
        <p class="greeting-time">${getGreeting()},</p>
        <h1 class="greeting-name">${name}</h1>
      </div>
      <div class="home-date">${dateStr}</div>
    </div>

    <div class="home-content">
      <div id="rumination-banner-slot"></div>

      <div class="entry-card">

        <div class="entry-sections">

          <div class="entry-section">
            <p class="section-label">① What happened, and how did it make you feel?</p>
            <textarea id="entry-what" placeholder="Describe what happened and how it made you feel…" maxlength="800"></textarea>
            <p class="char-count"><span id="char-what">0</span> / 800</p>
          </div>

          <div class="entry-section-divider"></div>

          <div class="entry-section">
            <p class="section-label">② Why did you feel that way?</p>
            <textarea id="entry-why" placeholder="e.g. I felt anxious because…" maxlength="800"></textarea>
            <p class="char-count"><span id="char-why">0</span> / 800</p>
          </div>

          <div class="entry-section-divider"></div>

          <div class="entry-section">
            <p class="section-label">③ What did this experience make you realise about yourself?</p>
            <textarea id="entry-realise" placeholder="e.g. I realised that…" maxlength="800"></textarea>
            <p class="char-count"><span id="char-realise">0</span> / 800</p>
          </div>

        </div>

        <div>
          <p class="section-label">How are you feeling?</p>
          <div class="emotion-grid" id="emotion-grid">
            ${EMOTIONS.map(e => `
              <button
                class="emotion-btn"
                data-emotion="${e.id}"
                style="--emotion-color:${e.color}; --emotion-bg:${e.bg}"
                type="button"
              >
                <span class="emotion-emoji">${e.emoji}</span>
                <span>${e.label}</span>
              </button>
            `).join('')}
          </div>
        </div>

        <div>
          <p class="section-label">Today's goal <span style="font-weight:400;text-transform:none;font-size:11px">(optional)</span></p>
          <input
            type="text"
            id="goal-input"
            placeholder="What's one thing you want to achieve today?"
            maxlength="120"
          />
        </div>

        <div>
          <p class="section-label">Location <span style="font-weight:400;text-transform:none;font-size:11px">(optional)</span></p>
          <div class="location-row">
            <input
              type="text"
              id="location-input"
              placeholder="Where are you?"
              maxlength="100"
            />
            <button class="location-detect-btn" id="location-detect-btn" type="button" title="Detect my location">📍</button>
          </div>
        </div>

        <div>
          <p class="section-label">Photo <span style="font-weight:400;text-transform:none;font-size:11px">(optional)</span></p>
          <div id="photo-area">
            <input type="file" id="photo-input" accept="image/*" hidden />
            <button class="photo-attach-btn" id="photo-btn" type="button">📷 Attach Photo</button>
          </div>
        </div>

        <button id="save-btn" class="btn-primary" type="button">Save Entry</button>
      </div>
    </div>
  `;

  selectedEmotions = [];
  selectedPhoto    = null;
  setupHomeListeners();
  checkAndShowRuminationBanner();
}

function setupHomeListeners() {
  const saveBtn     = document.getElementById('save-btn');
  const emotionGrid = document.getElementById('emotion-grid');
  const photoBtn    = document.getElementById('photo-btn');
  const photoInput  = document.getElementById('photo-input');

  /* Auto-resize and char count for all 3 journal sections */
  [['entry-what', 'char-what'], ['entry-why', 'char-why'], ['entry-realise', 'char-realise']].forEach(([taId, countId]) => {
    const ta    = document.getElementById(taId);
    const count = document.getElementById(countId);
    ta.addEventListener('input', () => {
      ta.style.height = 'auto';
      ta.style.height = ta.scrollHeight + 'px';
      count.textContent = ta.value.length;
    });
  });

  emotionGrid.addEventListener('click', e => {
    const btn = e.target.closest('.emotion-btn');
    if (!btn) return;
    const id = btn.dataset.emotion;
    if (selectedEmotions.includes(id)) {
      selectedEmotions = selectedEmotions.filter(x => x !== id);
      btn.classList.remove('selected');
    } else {
      selectedEmotions.push(id);
      btn.classList.add('selected');
    }
  });

  document.getElementById('location-detect-btn').addEventListener('click', detectLocation);

  photoBtn.addEventListener('click', () => photoInput.click());
  photoInput.addEventListener('change', () => {
    const file = photoInput.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = e => { selectedPhoto = e.target.result; renderPhotoPreview(selectedPhoto); };
    reader.readAsDataURL(file);
  });

  saveBtn.addEventListener('click', saveEntry);
}

function renderPhotoPreview(dataUrl) {
  const area = document.getElementById('photo-area');
  area.innerHTML = `
    <div class="photo-preview">
      <img src="${dataUrl}" alt="Entry photo" class="photo-thumb" />
      <button class="photo-remove-btn" id="photo-remove" type="button">✕ Remove</button>
    </div>
  `;
  area.querySelector('#photo-remove').addEventListener('click', () => {
    selectedPhoto = null;
    area.innerHTML = `
      <input type="file" id="photo-input" accept="image/*" hidden />
      <button class="photo-attach-btn" id="photo-btn" type="button">📷 Attach Photo</button>
    `;
    area.querySelector('#photo-btn').addEventListener('click', () => area.querySelector('#photo-input').click());
    area.querySelector('#photo-input').addEventListener('change', e => {
      const file = e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = ev => { selectedPhoto = ev.target.result; renderPhotoPreview(selectedPhoto); };
      reader.readAsDataURL(file);
    });
  });
}

function detectLocation() {
  detectLocationInto(
    document.getElementById('location-detect-btn'),
    document.getElementById('location-input')
  );
}

/* ── Save entry ── */
function saveEntry() {
  const what    = document.getElementById('entry-what').value.trim();
  const why     = document.getElementById('entry-why').value.trim();
  const realise = document.getElementById('entry-realise').value.trim();
  const text    = buildEntryText(what, why, realise);
  const goal    = document.getElementById('goal-input').value.trim();

  if (!text && selectedEmotions.length === 0) {
    showToast('Write something or pick an emotion first', 'error');
    return;
  }

  const location = document.getElementById('location-input').value.trim();
  const now      = new Date();
  const entry    = {
    text,
    emotions:  [...selectedEmotions],
    goal:      goal     || null,
    location:  location || null,
    photo:     selectedPhoto || null,
    reframe:   null,
    date:      toISODate(now),
    createdAt: now.toISOString(),
  };

  const btn = document.getElementById('save-btn');
  btn.disabled    = true;
  btn.textContent = 'Saving…';

  addEntry(entry).then(newId => {
    const score = calcEntryScore(entry.emotions);
    if (score !== null && score < 0) {
      /* Net negative — invite reappraisal */
      showReframeModal({ ...entry, id: newId });
    } else {
      showToast('Entry saved ✓', 'success');
      renderHome();
    }
  }).catch(() => {
    showToast('Could not save — please try again', 'error');
    btn.disabled    = false;
    btn.textContent = 'Save Entry';
  });
}

/* ── Helpers ── */
function calcEntryScore(emotions) {
  if (!emotions || !emotions.length) return null;
  const scores = emotions.map(id => EMOTIONS.find(e => e.id === id)?.score ?? 0);
  return scores.reduce((a, b) => a + b, 0) / scores.length;
}

/* ── Cognitive reappraisal modal ── */
function showReframeModal(entry) {
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.innerHTML = `
    <div class="modal reframe-modal" role="dialog" aria-modal="true">
      <div class="modal-handle"></div>
      <div class="reframe-header">
        <span class="reframe-icon">🌱</span>
        <div>
          <h3>One more thought…</h3>
          <p class="reframe-subtitle">Your entry has been saved.</p>
        </div>
      </div>
      <p class="reframe-question">Is there another way to look at what happened today?</p>
      <div id="reframe-input-area">
        <button class="btn-secondary" id="reframe-reflect-btn" type="button">✍️ Add a reflection</button>
      </div>
      <button class="reframe-skip-btn" id="reframe-skip" type="button">Skip for now</button>
    </div>
  `;

  document.body.appendChild(overlay);

  /* Expand to textarea when Reflect is tapped */
  overlay.querySelector('#reframe-reflect-btn').addEventListener('click', () => {
    const area = overlay.querySelector('#reframe-input-area');
    area.innerHTML = `
      <textarea
        id="reframe-text"
        placeholder="Try: 'One good thing was…' or 'Next time I could…'"
        maxlength="500"
      ></textarea>
      <button class="btn-primary" id="reframe-save-btn" type="button">Save reflection</button>
    `;
    const ta = area.querySelector('#reframe-text');
    ta.focus();
    ta.addEventListener('input', () => {
      ta.style.height = 'auto';
      ta.style.height = ta.scrollHeight + 'px';
    });

    area.querySelector('#reframe-save-btn').addEventListener('click', () => {
      const reframe = ta.value.trim();
      if (!reframe) { ta.focus(); return; }
      updateEntry({ ...entry, reframe }).then(() => {
        overlay.remove();
        showToast('Reflection saved 🌱', 'success');
        renderHome();
      });
    });
  });

  overlay.querySelector('#reframe-skip').addEventListener('click', () => {
    overlay.remove();
    showToast('Entry saved ✓', 'success');
    renderHome();
  });
}

/* ── Rumination banner ── */
function checkAndShowRuminationBanner() {
  const today     = toISODate(new Date());
  if (localStorage.getItem('journaly-rumination-dismissed') === today) return;

  getAllEntries().then(entries => {
    if (!hasNegativeStreak(entries)) return;

    const slot = document.getElementById('rumination-banner-slot');
    if (!slot) return;

    slot.innerHTML = `
      <div class="rumination-banner" id="rumination-banner">
        <div class="rumination-banner-body">
          <span class="rumination-banner-icon">💙</span>
          <p>You've been feeling low lately. Try writing about one small positive thing — even something tiny counts.</p>
        </div>
        <button class="rumination-banner-close" id="rumination-dismiss" aria-label="Dismiss">✕</button>
      </div>
    `;

    document.getElementById('rumination-dismiss').addEventListener('click', () => {
      localStorage.setItem('journaly-rumination-dismissed', today);
      slot.innerHTML = '';
    });
  });
}

function hasNegativeStreak(entries) {
  /* Last 3 entries that have emotions tagged — all must be net negative */
  const withEmotions = entries
    .filter(e => e.emotions && e.emotions.length > 0)
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    .slice(0, 3);

  if (withEmotions.length < 3) return false;
  return withEmotions.every(e => calcEntryScore(e.emotions) < 0);
}
