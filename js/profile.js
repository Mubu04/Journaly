'use strict';

function renderProfile() {
  const screen = document.getElementById('screen-profile');
  const name   = localStorage.getItem('journaly-name') || 'Journaler';
  const initial = name.trim()[0]?.toUpperCase() || 'J';

  screen.innerHTML = `
    <div class="screen-header">
      <h1>Profile</h1>
    </div>
    <div class="profile-content">
      <div class="profile-card">
        <div class="avatar">${initial}</div>
        <div class="profile-info">
          <h2 id="display-name">${name}</h2>
          <p class="profile-subtitle">Journaly user</p>
        </div>
        <button class="profile-edit-btn" id="edit-name-btn" type="button">Edit</button>
      </div>

      <div class="settings-group">
        <p class="settings-group-title">Stats</p>
        <div class="settings-item">
          <span>Total Entries</span>
          <span class="settings-value" id="stat-total">—</span>
        </div>
        <div class="settings-item">
          <span>Current Streak</span>
          <span class="settings-value" id="stat-streak">—</span>
        </div>
        <div class="settings-item">
          <span>Member Since</span>
          <span class="settings-value" id="stat-since">—</span>
        </div>
      </div>

      ${buildReminderSection()}

      <div class="settings-group">
        <p class="settings-group-title">Data</p>
        <div class="settings-item clickable" id="export-btn">
          <span>Export Journal (JSON)</span>
          <span class="settings-chevron">›</span>
        </div>
      </div>

      <button class="btn-danger" id="clear-btn" type="button">Clear All Data</button>
    </div>
  `;

  getAllEntries().then(entries => {
    document.getElementById('stat-total').textContent  = entries.length;
    document.getElementById('stat-streak').textContent = `${calcStreak(entries)} day${calcStreak(entries) !== 1 ? 's' : ''}`;

    if (entries.length) {
      const oldest = entries.slice().sort((a,b) => new Date(a.createdAt) - new Date(b.createdAt))[0];
      const since  = new Date(oldest.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
      document.getElementById('stat-since').textContent = since;
    } else {
      document.getElementById('stat-since').textContent = 'No entries yet';
    }
  });

  document.getElementById('edit-name-btn').addEventListener('click', openNameModal);
  document.getElementById('export-btn').addEventListener('click', exportData);
  document.getElementById('clear-btn').addEventListener('click', confirmClearData);
  setupReminderListeners();
}

/* ── Reminder section builder ── */
function buildReminderSection() {
  if (!('Notification' in window)) return ''; /* Browser doesn't support notifications */

  const enabled = localStorage.getItem('journaly-reminder-enabled') === 'true';
  const time    = localStorage.getItem('journaly-reminder-time') || '20:00';
  const denied  = Notification.permission === 'denied';

  return `
    <div class="settings-group">
      <p class="settings-group-title">Reminders</p>

      <div class="settings-item">
        <div class="settings-item-text">
          <span>Daily Reminder</span>
          <p class="settings-sub">${denied
            ? '⚠️ Notifications blocked — enable in browser settings'
            : "Get notified if you haven't journaled by your set time"
          }</p>
        </div>
        <label class="toggle-switch">
          <input
            type="checkbox"
            id="reminder-toggle"
            ${enabled && !denied ? 'checked' : ''}
            ${denied ? 'disabled' : ''}
          />
          <span class="toggle-slider"></span>
        </label>
      </div>

      <div class="settings-item ${!enabled || denied ? 'settings-item--muted' : ''}" id="reminder-time-row">
        <span>Reminder Time</span>
        <input
          type="time"
          id="reminder-time"
          value="${time}"
          class="time-input"
          ${!enabled || denied ? 'disabled' : ''}
        />
      </div>
    </div>
  `;
}

function setupReminderListeners() {
  const toggle  = document.getElementById('reminder-toggle');
  const timeRow = document.getElementById('reminder-time-row');
  const timeInput = document.getElementById('reminder-time');

  if (!toggle) return;

  toggle.addEventListener('change', () => {
    if (toggle.checked) {
      enableReminder();
    } else {
      localStorage.setItem('journaly-reminder-enabled', 'false');
      timeRow.classList.add('settings-item--muted');
      timeInput.disabled = true;
      showToast('Reminder turned off', '');
    }
  });

  timeInput.addEventListener('change', () => {
    localStorage.setItem('journaly-reminder-time', timeInput.value);
    /* Reset last-notified so the new time is respected today */
    localStorage.removeItem('journaly-last-notified');
    showToast('Reminder time updated ✓', 'success');
  });
}

function enableReminder() {
  const toggle    = document.getElementById('reminder-toggle');
  const timeRow   = document.getElementById('reminder-time-row');
  const timeInput = document.getElementById('reminder-time');

  if (!('Notification' in window)) {
    showToast('Notifications not supported in this browser', 'error');
    toggle.checked = false;
    return;
  }

  if (Notification.permission === 'granted') {
    localStorage.setItem('journaly-reminder-enabled', 'true');
    timeRow.classList.remove('settings-item--muted');
    timeInput.disabled = false;
    showToast('Reminder enabled ✓', 'success');
    return;
  }

  if (Notification.permission === 'denied') {
    toggle.checked = false;
    showToast('Notifications blocked — enable them in your browser settings', 'error');
    return;
  }

  /* 'default' — ask for permission */
  Notification.requestPermission().then(result => {
    if (result === 'granted') {
      localStorage.setItem('journaly-reminder-enabled', 'true');
      showToast('Reminder enabled ✓', 'success');
      renderProfile(); /* Re-render to reflect new state */
    } else {
      toggle.checked = false;
      showToast('Permission denied — reminders won\'t work', 'error');
      renderProfile();
    }
  });
}

function openNameModal() {
  const current = localStorage.getItem('journaly-name') || '';

  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.innerHTML = `
    <div class="modal" role="dialog" aria-modal="true" aria-label="Edit name">
      <h3>Your Name</h3>
      <input type="text" id="name-input" value="${current}" placeholder="Enter your name" maxlength="40" />
      <div class="modal-actions">
        <button class="btn-secondary" id="modal-cancel" type="button">Cancel</button>
        <button class="btn-primary"   id="modal-save"   type="button">Save</button>
      </div>
    </div>
  `;

  document.body.appendChild(overlay);

  const input = overlay.querySelector('#name-input');
  input.focus();
  input.select();

  overlay.querySelector('#modal-cancel').addEventListener('click', () => overlay.remove());
  overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove(); });

  overlay.querySelector('#modal-save').addEventListener('click', () => {
    const val = input.value.trim();
    if (val) {
      localStorage.setItem('journaly-name', val);
      showToast('Name updated ✓', 'success');
      overlay.remove();
      renderProfile();
    } else {
      input.focus();
    }
  });

  input.addEventListener('keydown', e => {
    if (e.key === 'Enter') overlay.querySelector('#modal-save').click();
    if (e.key === 'Escape') overlay.remove();
  });
}

function exportData() {
  getAllEntries().then(entries => {
    if (!entries.length) {
      showToast('No entries to export', '');
      return;
    }
    const json = JSON.stringify({ exported: new Date().toISOString(), entries }, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = `journaly-export-${toISODate(new Date())}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('Export downloaded ✓', 'success');
  });
}

function confirmClearData() {
  const btn = document.getElementById('clear-btn');
  if (btn.dataset.confirming) {
    clearAllEntries().then(() => {
      showToast('All data cleared', '');
      renderProfile();
    });
    return;
  }

  btn.dataset.confirming = '1';
  btn.textContent = 'Tap again to confirm — this cannot be undone';
  setTimeout(() => {
    if (btn.dataset.confirming) {
      delete btn.dataset.confirming;
      btn.textContent = 'Clear All Data';
    }
  }, 4000);
}
