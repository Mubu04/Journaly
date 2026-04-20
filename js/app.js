'use strict';

/* ── Emotion definitions ── */
const EMOTIONS = [
  { id: 'happy',       label: 'Happy',       emoji: '😊', color: '#FFD60A', bg: '#FFFBEA' },
  { id: 'excited',     label: 'Excited',     emoji: '🤩', color: '#FF6B35', bg: '#FFF0EA' },
  { id: 'calm',        label: 'Calm',        emoji: '😌', color: '#5AC8FA', bg: '#EAF8FF' },
  { id: 'grateful',    label: 'Grateful',    emoji: '🙏', color: '#34C759', bg: '#EAFBEE' },
  { id: 'motivated',   label: 'Motivated',   emoji: '💪', color: '#AF52DE', bg: '#F7EEFF' },
  { id: 'anxious',     label: 'Anxious',     emoji: '😰', color: '#FF9F0A', bg: '#FFF6EA' },
  { id: 'sad',         label: 'Sad',         emoji: '😢', color: '#5E5CE6', bg: '#EEEEFF' },
  { id: 'angry',       label: 'Angry',       emoji: '😤', color: '#FF453A', bg: '#FFF0EF' },
  { id: 'overwhelmed', label: 'Overwhelmed', emoji: '😵', color: '#FF6B9D', bg: '#FFF0F5' },
  { id: 'confused',    label: 'Confused',    emoji: '😕', color: '#8E8E9E', bg: '#F2F2F5' },
];

/* ── Navigation ── */
let activeScreen = 'home';

function navigateTo(screen) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));

  document.getElementById(`screen-${screen}`).classList.add('active');
  document.querySelector(`.nav-btn[data-screen="${screen}"]`).classList.add('active');

  activeScreen = screen;

  if (screen === 'home')        renderHome();
  if (screen === 'history')     renderHistory();
  if (screen === 'progression') renderProgression();
  if (screen === 'profile')     renderProfile();
}

/* ── Toast ── */
let toastTimer = null;

function showToast(message, type = '') {
  const el = document.getElementById('toast');
  el.textContent = message;
  el.className   = `toast ${type ? 't-' + type : ''} show`;

  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), 2800);
}

/* ── Greeting ── */
function getGreeting() {
  const h = new Date().getHours();
  if (h >= 5  && h < 12) return 'Good morning';
  if (h >= 12 && h < 17) return 'Good afternoon';
  if (h >= 17 && h < 21) return 'Good evening';
  return 'Good night';
}

/* ── Format helpers ── */
function formatDate(isoDate) {
  const d     = new Date(isoDate + 'T00:00:00');
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);

  if (isoDate === toISODate(today))     return 'Today';
  if (isoDate === toISODate(yesterday)) return 'Yesterday';

  return d.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' });
}

function toISODate(d) {
  return d.toISOString().slice(0, 10);
}

function formatTime(isoString) {
  return new Date(isoString).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
}

/* ── Streak calculator ── */
function calcStreak(entries) {
  if (!entries.length) return 0;
  const days   = [...new Set(entries.map(e => e.date))].sort().reverse();
  const today  = toISODate(new Date());
  let streak   = 0;
  let expected = today;

  for (const day of days) {
    if (day === expected) {
      streak++;
      const d = new Date(expected + 'T00:00:00');
      d.setDate(d.getDate() - 1);
      expected = toISODate(d);
    } else break;
  }
  return streak;
}

/* ── Boot ── */
document.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('.nav-btn').forEach(btn => {
    btn.addEventListener('click', () => navigateTo(btn.dataset.screen));
  });

  renderHome();

  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/sw.js').catch(() => {});
  }
});
