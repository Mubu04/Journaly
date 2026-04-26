'use strict';

let progressionPeriod = 'week';
let _trendDots        = [];  /* dot positions for tooltip hit-testing */
let _trendHandlers    = null; /* stored so they can be removed on re-render */

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

      <!-- Mood Trend Line -->
      <div class="chart-card">
        <div class="chart-header">
          <h3>Mood Trend</h3>
          <div class="period-toggle">
            <button class="period-btn ${progressionPeriod === 'week'  ? 'active' : ''}" data-period="week">Week</button>
            <button class="period-btn ${progressionPeriod === 'month' ? 'active' : ''}" data-period="month">Month</button>
            <button class="period-btn ${progressionPeriod === 'all'   ? 'active' : ''}" data-period="all">All</button>
          </div>
        </div>
        <div class="trend-container">
          <canvas id="mood-trend-chart"></canvas>
          <div id="trend-tooltip" class="trend-tooltip" hidden></div>
        </div>
        <div id="trend-empty" class="chart-empty" style="display:none">
          <span>📈</span>
          <p>Tag emotions on entries to see your mood trend.</p>
        </div>
        <div class="trend-scale-legend">
          <span class="trend-scale-pos">+2 Very positive</span>
          <span class="trend-scale-mid">0 Calm</span>
          <span class="trend-scale-neg">−2 Very negative</span>
        </div>
      </div>

      <!-- Emotion Frequency -->
      <div class="chart-card">
        <div class="chart-header">
          <h3>Emotion Frequency</h3>
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

/* ── Update all charts ── */
function updateProgressionData(entries) {
  const filtered = filterByPeriod(entries, progressionPeriod);

  document.getElementById('stat-entries').textContent = entries.length;
  document.getElementById('stat-streak').textContent  = calcStreak(entries);

  const topEm = EMOTIONS.find(e => e.id === getTopEmotion(filtered));
  document.getElementById('stat-top').textContent = topEm ? topEm.emoji : '—';

  updateTrendChart(filtered);
  updateFrequencyChart(filtered);
  renderRecentInsights(
    entries.slice().sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)).slice(0, 5)
  );
}

/* ── Mood trend ── */
function updateTrendChart(entries) {
  const canvas  = document.getElementById('mood-trend-chart');
  const empty   = document.getElementById('trend-empty');
  const tooltip = document.getElementById('trend-tooltip');

  const points = entries
    .filter(e => e.emotions && e.emotions.length > 0)
    .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt))
    .map(e => {
      const scores = e.emotions.map(id => EMOTIONS.find(x => x.id === id)?.score ?? 0);
      const avg    = scores.reduce((a, b) => a + b, 0) / scores.length;
      const label  = e.emotions
        .map(id => { const em = EMOTIONS.find(x => x.id === id); return em ? `${em.emoji} ${em.label}` : id; })
        .join('  ');
      return { score: avg, emotions: e.emotions, label };
    });

  if (!points.length) {
    canvas.style.display = 'none';
    empty.style.display  = 'flex';
    return;
  }

  canvas.style.display = 'block';
  empty.style.display  = 'none';

  /* Draw first, then attach tooltip listeners — never clone the canvas */
  requestAnimationFrame(() => {
    _trendDots = drawMoodTrend(canvas, points);
    setupTrendTooltip(canvas, tooltip);
  });
}

function drawMoodTrend(canvas, points) {
  const dpr  = window.devicePixelRatio || 1;
  const rect = canvas.getBoundingClientRect();

  canvas.width  = rect.width  * dpr;
  canvas.height = rect.height * dpr;

  const ctx = canvas.getContext('2d');
  ctx.scale(dpr, dpr);

  const W   = rect.width;
  const H   = rect.height;
  const pad = { top: 20, right: 16, bottom: 36, left: 38 };
  const cW  = W - pad.left - pad.right;
  const cH  = H - pad.top  - pad.bottom;

  const Y_MIN = -2.4;
  const Y_MAX =  2.4;

  /* X position by entry index (0-based) */
  const toX = i  => points.length > 1
    ? pad.left + (i / (points.length - 1)) * cW
    : pad.left + cW / 2;
  const toY = sc => pad.top + ((Y_MAX - sc) / (Y_MAX - Y_MIN)) * cH;

  ctx.clearRect(0, 0, W, H);

  /* ── Horizontal grid lines at -2, -1, 0, +1, +2 ── */
  [-2, -1, 0, 1, 2].forEach(val => {
    const y = toY(val);
    ctx.beginPath();
    ctx.strokeStyle = val === 0 ? '#BEBECF' : '#EEEEF4';
    ctx.lineWidth   = val === 0 ? 1.5 : 1;
    if (val === 0) ctx.setLineDash([5, 4]);
    ctx.moveTo(pad.left, y);
    ctx.lineTo(pad.left + cW, y);
    ctx.stroke();
    ctx.setLineDash([]);

    /* Y-axis labels */
    ctx.fillStyle = val === 0 ? '#6C63FF' : '#AEAEBE';
    ctx.font      = `${val === 0 ? 'bold ' : ''}10px -apple-system, sans-serif`;
    ctx.textAlign = 'right';
    ctx.fillText(val > 0 ? `+${val}` : `${val}`, pad.left - 5, y + 3.5);
  });

  /* ── X-axis entry number labels ── */
  const maxLabels = 8;
  const step      = points.length <= maxLabels ? 1 : Math.ceil((points.length - 1) / (maxLabels - 1));
  const shownIdxs = new Set();

  for (let i = 0; i < points.length; i += step) shownIdxs.add(i);
  shownIdxs.add(points.length - 1); /* always show last */

  shownIdxs.forEach(i => {
    ctx.fillStyle = '#AEAEBE';
    ctx.font      = '10px -apple-system, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(i + 1, toX(i), pad.top + cH + 18);
  });

  /* X-axis title */
  ctx.fillStyle = '#AEAEBE';
  ctx.font      = '10px -apple-system, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('Entry', pad.left + cW / 2, pad.top + cH + 32);

  /* ── Connecting line ── */
  if (points.length > 1) {
    ctx.beginPath();
    ctx.strokeStyle = '#6C63FF';
    ctx.lineWidth   = 2;
    ctx.lineJoin    = 'round';
    ctx.lineCap     = 'round';
    points.forEach((pt, i) => {
      i === 0 ? ctx.moveTo(toX(i), toY(pt.score)) : ctx.lineTo(toX(i), toY(pt.score));
    });
    ctx.stroke();
  }

  /* ── Dots ── */
  const dotPositions = [];

  points.forEach((pt, i) => {
    const x  = toX(i);
    const y  = toY(pt.score);
    const em = EMOTIONS.find(e => e.id === pt.emotions[0]);

    /* White ring */
    ctx.beginPath();
    ctx.arc(x, y, 7, 0, Math.PI * 2);
    ctx.fillStyle = 'white';
    ctx.fill();

    /* Coloured fill */
    ctx.beginPath();
    ctx.arc(x, y, 5.5, 0, Math.PI * 2);
    ctx.fillStyle = em ? em.color : '#6C63FF';
    ctx.fill();

    dotPositions.push({ x, y, label: pt.label });
  });

  return dotPositions;
}

/* ── Tooltip — no canvas cloning, uses stored handler refs ── */
function setupTrendTooltip(canvas, tooltip) {
  /* Remove previous listeners if they exist */
  if (_trendHandlers) {
    canvas.removeEventListener('mousemove',  _trendHandlers.move);
    canvas.removeEventListener('mouseleave', _trendHandlers.leave);
    canvas.removeEventListener('touchstart', _trendHandlers.touch);
    canvas.removeEventListener('touchend',   _trendHandlers.end);
  }

  function show(clientX, clientY) {
    const rect = canvas.getBoundingClientRect();
    const mx   = clientX - rect.left;
    const my   = clientY - rect.top;

    let nearest = null;
    let minDist = 22;
    _trendDots.forEach(dot => {
      const d = Math.hypot(dot.x - mx, dot.y - my);
      if (d < minDist) { minDist = d; nearest = dot; }
    });

    if (!nearest) { tooltip.hidden = true; return; }

    tooltip.textContent = nearest.label;
    tooltip.hidden      = false;

    /* Clamp horizontally so tooltip doesn't overflow the card */
    const cw   = tooltip.parentElement.offsetWidth;
    const tw   = tooltip.offsetWidth;
    let   left = nearest.x - tw / 2;
    left = Math.max(4, Math.min(left, cw - tw - 4));
    tooltip.style.left = `${left}px`;
    tooltip.style.top  = `${nearest.y - 40}px`;
  }

  _trendHandlers = {
    move:  e => show(e.clientX, e.clientY),
    leave: ()  => { tooltip.hidden = true; },
    touch: e  => { e.preventDefault(); show(e.touches[0].clientX, e.touches[0].clientY); },
    end:   ()  => { setTimeout(() => { tooltip.hidden = true; }, 1200); },
  };

  canvas.addEventListener('mousemove',  _trendHandlers.move);
  canvas.addEventListener('mouseleave', _trendHandlers.leave);
  canvas.addEventListener('touchstart', _trendHandlers.touch, { passive: false });
  canvas.addEventListener('touchend',   _trendHandlers.end);
}

/* ── Frequency chart ── */
function updateFrequencyChart(filtered) {
  const counts  = countEmotions(filtered);
  const hasData = Object.values(counts).some(v => v > 0);
  const canvas  = document.getElementById('emotion-chart');
  const empty   = document.getElementById('chart-empty');

  if (!hasData) {
    canvas.style.display = 'none';
    empty.style.display  = 'flex';
  } else {
    canvas.style.display = 'block';
    empty.style.display  = 'none';
    requestAnimationFrame(() => drawEmotionChart(canvas, counts));
  }
}

function filterByPeriod(entries, period) {
  if (period === 'all') return entries;
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - (period === 'week' ? 7 : 30));
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

  const W   = rect.width;
  const H   = rect.height;
  const pad = { top: 24, right: 8, bottom: 52, left: 28 };
  const cW  = W - pad.left - pad.right;
  const cH  = H - pad.top  - pad.bottom;

  const active  = EMOTIONS.filter(e => counts[e.id] > 0);
  if (!active.length) return;

  const maxVal  = Math.max(...active.map(e => counts[e.id]));
  const barSlot = cW / active.length;
  const barPad  = barSlot * 0.25;
  const barW    = barSlot - barPad;

  ctx.clearRect(0, 0, W, H);

  const steps = Math.min(maxVal, 4);
  for (let i = 0; i <= steps; i++) {
    const y = pad.top + cH - (cH / steps) * i;
    ctx.beginPath();
    ctx.strokeStyle = '#E8E8F0';
    ctx.lineWidth   = 1;
    ctx.moveTo(pad.left, y);
    ctx.lineTo(pad.left + cW, y);
    ctx.stroke();
    ctx.fillStyle = '#8E8E9E';
    ctx.font      = '10px -apple-system, sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText(Math.round(maxVal / steps * i), pad.left - 4, y + 4);
  }

  active.forEach((em, i) => {
    const val  = counts[em.id];
    const x    = pad.left + i * barSlot + barPad / 2;
    const barH = (val / maxVal) * cH;
    const y    = pad.top + cH - barH;

    ctx.fillStyle = em.color;
    ctx.beginPath();
    ctx.roundRect ? ctx.roundRect(x, y, barW, barH, [5, 5, 0, 0]) : ctx.rect(x, y, barW, barH);
    ctx.fill();

    ctx.fillStyle = '#1C1C2E';
    ctx.font      = 'bold 11px -apple-system, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(val, x + barW / 2, y - 6);

    ctx.font      = '16px sans-serif';
    ctx.fillText(em.emoji, x + barW / 2, pad.top + cH + 22);

    ctx.fillStyle = '#8E8E9E';
    ctx.font      = '9px -apple-system, sans-serif';
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
    const em         = EMOTIONS.find(x => x.id === e.emotions[0]);
    const color      = em ? em.color : '#6C63FF';
    const emotionStr = e.emotions.map(id => EMOTIONS.find(x => x.id === id)?.emoji || '').join(' ') || '—';
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
