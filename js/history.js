'use strict';

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
    const count = document.getElementById('entry-count');
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

  return `
    <div class="entry-item" data-id="${entry.id}">
      <div class="entry-item-header" data-action="expand">
        <span class="entry-time">${formatTime(entry.createdAt)}</span>
        <div class="entry-item-actions">
          <button class="delete-btn" data-action="delete" aria-label="Delete entry">🗑</button>
          <span class="entry-expand-icon">⌄</span>
        </div>
      </div>

      ${entry.emotions.length ? `<div class="entry-emotions">${emotionsHtml}</div>` : ''}

      <p class="entry-preview">${previewText}</p>

      <div class="entry-body">
        ${entry.text ? `<p class="entry-text-full">${escapeHtml(entry.text)}</p>` : ''}
        ${goalHtml}
      </div>
    </div>
  `;
}

function handleHistoryClick(e) {
  const item      = e.target.closest('.entry-item');
  if (!item) return;

  const action    = e.target.closest('[data-action]')?.dataset.action;
  const id        = Number(item.dataset.id);

  if (action === 'delete') {
    handleDelete(e.target.closest('.delete-btn'), id);
    return;
  }

  /* Toggle expand */
  item.classList.toggle('expanded');
}

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

function escapeHtml(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
