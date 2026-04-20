'use strict';

let progressionPeriod = 'week';

function renderProgression() {
  const screen = document.getElementById('screen-progression');
  screen.innerHTML = `
    <div class="screen-header">
      <h1>Progress</h1>
    </div>
    <div class="progression-content">
      <div class="stats-row">
        <div class="stat-card">
          <span class="stat-value" id="stat-entries">—</span>
          <span class="stat-label">Entries</span>
        </div>
        <div class="stat-card">
          <span class="stat-value" id="stat-streak">—</span>
          <span class="stat-label">Day Streak</span>
        </div>
        <div class="stat-card">
          <span class="stat-value" id="stat-top">—</span>
          <span class="stat-label">Top Mood</span>
        </div>
      </div>

      <div class="chart-card">
        <div class="chart-header">
          <h3>Emotion Frequency</h3>
          <div class="period-toggle">
            <button class="period-btn ${progressionPeriod === 'week'  ? 'active' : ''}" data-period="week">Week</button>
            <button class="period-btn ${progressionPeriod === 'month' ? 'active' : ''}" data-period="month">Month</button>
            <button class="period-btn ${progressionPeriod === 'all'   ? 'active' : ''}" data-period="all">All</button>
          </div>
        </div>
        <canvas id="emotion-chart"></canvas>
        <div id="chart-empty" class="chart-empty" style="display:none">
          <span>📊</span>
          <p>No entries in this period yet.</p>
        </div>
      </div>

      <div class="insights-card">
        <h3>Recent Entries</h3>
        <div id="recent-list"></div>
      </div>
    </div>
  `;

  document.querySelector('.period-toggle').addEventListener('click', e => {
    const btn = e.target.closest('.period-btn');
    if (!btn) return;
    progressionPeriod = btn.dataset.period;
    document.querySelectorAll('.period-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    getAllEntries().then(entries => updateProgressionData(entries));
  });

  getAllEntries().then(entries => updateProgressionData(entries));
}

function updateProgressionData(entries) {
  const filtered = filterByPeriod(entries, progressionPeriod);

  /* Stats */
  document.getElementById('stat-entries').textContent = entries.length;
  document.getElementById('stat-streak').textContent  = calcStreak(entries);

  const topEmotion = getTopEmotion(filtered);
  const topEm = EMOTIONS.find(e => e.id === topEmotion);
  document.getElementById('stat-top').textContent = topEm ? topEm.emoji : '—';

  /* Chart */
  const counts = countEmotions(filtered);
  const hasData = Object.values(counts).some(v => v > 0);

  const canvas = document.getElementById('emotion-chart');
  const empty  = document.getElementById('chart-empty');

  if (!hasData) {
    canvas.style.display = 'none';
    empty.style.display  = 'flex';
  } else {
    canvas.style.display = 'block';
    empty.style.display  = 'none';
    requestAnimationFrame(() => drawEmotionChart(canvas, counts));
  }

  /* Recent insights */
  renderRecentInsights(entries.slice().sort((a,b) => new Date(b.createdAt) - new Date(a.createdAt)).slice(0, 5));
}

function filterByPeriod(entries, period) {
  if (period === 'all') return entries;
  const now  = new Date();
  const days = period === 'week' ? 7 : 30;
  const cutoff = new Date(now);
  cutoff.setDate(now.getDate() - days);
  return entries.filter(e => new Date(e.createdAt) >= cutoff);
}

function countEmotions(entries) {
  const counts = {};
  EMOTIONS.forEach(e => { counts[e.id] = 0; });
  entries.forEach(e => e.emotions.forEach(id => { if (counts[id] !== undefined) counts[id]++; }));
  return counts;
}

function getTopEmotion(entries) {
  const counts = countEmotions(entries);
  return Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0] || null;
}

function drawEmotionChart(canvas, counts) {
  const dpr  = window.devicePixelRatio || 1;
  const rect = canvas.getBoundingClientRect();

  canvas.width  = rect.width  * dpr;
  canvas.height = rect.height * dpr;

  const ctx = canvas.getContext('2d');
  ctx.scale(dpr, dpr);

  const W = rect.width;
  const H = rect.height;
  const pad = { top: 24, right: 8, bottom: 52, left: 28 };
  const cW  = W - pad.left - pad.right;
  const cH  = H - pad.top  - pad.bottom;

  const active = EMOTIONS.filter(e => counts[e.id] > 0);
  if (!active.length) return;

  const maxVal    = Math.max(...active.map(e => counts[e.id]));
  const barSlot   = cW / active.length;
  const barPad    = barSlot * 0.25;
  const barW      = barSlot - barPad;

  ctx.clearRect(0, 0, W, H);

  /* Grid lines */
  const steps = Math.min(maxVal, 4);
  for (let i = 0; i <= steps; i++) {
    const y = pad.top + cH - (cH / steps) * i;
    ctx.beginPath();
    ctx.strokeStyle = '#E8E8F0';
    ctx.lineWidth   = 1;
    ctx.moveTo(pad.left, y);
    ctx.lineTo(pad.left + cW, y);
    ctx.stroke();

    ctx.fillStyle  = '#8E8E9E';
    ctx.font       = `${10 * dpr / dpr}px -apple-system, sans-serif`;
    ctx.textAlign  = 'right';
    ctx.fillText(Math.round(maxVal / steps * i), pad.left - 4, y + 4);
  }

  /* Bars */
  active.forEach((em, i) => {
    const val  = counts[em.id];
    const x    = pad.left + i * barSlot + barPad / 2;
    const barH = (val / maxVal) * cH;
    const y    = pad.top + cH - barH;

    ctx.fillStyle = em.color;
    ctx.beginPath();
    if (ctx.roundRect) {
      ctx.roundRect(x, y, barW, barH, [5, 5, 0, 0]);
    } else {
      ctx.rect(x, y, barW, barH);
    }
    ctx.fill();

    /* Count above bar */
    ctx.fillStyle  = '#1C1C2E';
    ctx.font       = `bold ${11}px -apple-system, sans-serif`;
    ctx.textAlign  = 'center';
    ctx.fillText(val, x + barW / 2, y - 6);

    /* Emoji below */
    ctx.font      = `${16}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.fillText(em.emoji, x + barW / 2, pad.top + cH + 22);

    /* Label */
    ctx.fillStyle  = '#8E8E9E';
    ctx.font       = `${9}px -apple-system, sans-serif`;
    ctx.textAlign  = 'center';
    ctx.fillText(em.label, x + barW / 2, pad.top + cH + 38);
  });
}

function renderRecentInsights(entries) {
  const list = document.getElementById('recent-list');
  if (!entries.length) {
    list.innerHTML = `<p style="color:var(--clr-text-muted);font-size:14px;padding:8px 0">No entries yet — start journaling!</p>`;
    return;
  }

  list.innerHTML = entries.map(e => {
    const em    = EMOTIONS.find(x => x.id === e.emotions[0]);
    const color = em ? em.color : '#6C63FF';
    const emotionStr = e.emotions.map(id => {
      const found = EMOTIONS.find(x => x.id === id);
      return found ? found.emoji : '';
    }).join(' ') || '—';

    return `
      <div class="insight-row">
        <div class="insight-dot" style="background:${color}"></div>
        <div class="insight-content">
          <p class="insight-date">${formatDate(e.date)} · ${formatTime(e.createdAt)}</p>
          <p class="insight-emotions">${emotionStr}</p>
          ${e.text ? `<p class="insight-preview">${escapeHtml(e.text)}</p>` : ''}
        </div>
      </div>
    `;
  }).join('');
}
