'use strict';

let selectedEmotions = [];

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
      <div class="entry-card">
        <div class="textarea-wrapper">
          <textarea
            id="entry-text"
            placeholder="What happened today? How did it make you feel, and why?"
            rows="5"
            maxlength="2000"
          ></textarea>
          <p class="char-count"><span id="char-num">0</span> / 2000</p>
        </div>

        <div class="causal-hint">
          Try writing: "I felt [emotion] because [reason]…"
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

        <button id="save-btn" class="btn-primary" type="button">Save Entry</button>
      </div>
    </div>
  `;

  selectedEmotions = [];
  setupHomeListeners();
}

function setupHomeListeners() {
  const textarea  = document.getElementById('entry-text');
  const charNum   = document.getElementById('char-num');
  const saveBtn   = document.getElementById('save-btn');
  const emotionGrid = document.getElementById('emotion-grid');

  /* Auto-resize textarea */
  textarea.addEventListener('input', () => {
    textarea.style.height = 'auto';
    textarea.style.height = textarea.scrollHeight + 'px';
    charNum.textContent = textarea.value.length;
  });

  /* Emotion toggle */
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

  /* Save */
  saveBtn.addEventListener('click', saveEntry);
}

function saveEntry() {
  const text = document.getElementById('entry-text').value.trim();
  const goal = document.getElementById('goal-input').value.trim();

  if (!text && selectedEmotions.length === 0) {
    showToast('Write something or pick an emotion first', 'error');
    return;
  }

  const now   = new Date();
  const entry = {
    text,
    emotions:  [...selectedEmotions],
    goal:      goal || null,
    date:      toISODate(now),
    createdAt: now.toISOString(),
  };

  const btn = document.getElementById('save-btn');
  btn.disabled    = true;
  btn.textContent = 'Saving…';

  addEntry(entry)
    .then(() => {
      showToast('Entry saved ✓', 'success');
      renderHome();
    })
    .catch(() => {
      showToast('Could not save — please try again', 'error');
      btn.disabled    = false;
      btn.textContent = 'Save Entry';
    });
}
