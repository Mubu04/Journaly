'use strict';

/* ── Emotion definitions ── */
const EMOTIONS = [
  { id: 'happy',       label: 'Happy',       emoji: '😊', color: '#FFD60A', bg: '#FFFBEA', score:  2.0 },
  { id: 'excited',     label: 'Excited',     emoji: '🤩', color: '#FF6B35', bg: '#FFF0EA', score:  2.0 },
  { id: 'grateful',    label: 'Grateful',    emoji: '🙏', color: '#34C759', bg: '#EAFBEE', score:  1.5 },
  { id: 'motivated',   label: 'Motivated',   emoji: '💪', color: '#AF52DE', bg: '#F7EEFF', score:  1.5 },
  { id: 'calm',        label: 'Calm',        emoji: '😌', color: '#5AC8FA', bg: '#EAF8FF', score:  0.0 },
  { id: 'confused',    label: 'Confused',    emoji: '😕', color: '#8E8E9E', bg: '#F2F2F5', score: -0.5 },
  { id: 'anxious',     label: 'Anxious',     emoji: '😰', color: '#FF9F0A', bg: '#FFF6EA', score: -1.5 },
  { id: 'overwhelmed', label: 'Overwhelmed', emoji: '😵', color: '#FF6B9D', bg: '#FFF0F5', score: -1.5 },
  { id: 'sad',         label: 'Sad',         emoji: '😢', color: '#5E5CE6', bg: '#EEEEFF', score: -2.0 },
  { id: 'angry',       label: 'Angry',       emoji: '😤', color: '#FF453A', bg: '#FFF0EF', score: -2.0 },
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

/* ── Daily reminder ── */
function checkReminder() {
  if (localStorage.getItem('journaly-reminder-enabled') !== 'true') return;
  if (!('Notification' in window) || Notification.permission !== 'granted') return;

  const time              = localStorage.getItem('journaly-reminder-time') || '20:00';
  const [rHour, rMin]     = time.split(':').map(Number);
  const now               = new Date();
  const nowMins           = now.getHours() * 60 + now.getMinutes();
  const remMins           = rHour * 60 + rMin;

  /* Only fire at or after the reminder time */
  if (nowMins < remMins) return;

  /* Only fire once per day */
  const today = toISODate(now);
  if (localStorage.getItem('journaly-last-notified') === today) return;

  getAllEntries().then(entries => {
    /* Don't nag if they've already journaled today */
    if (entries.some(e => e.date === today)) {
      localStorage.setItem('journaly-last-notified', today);
      return;
    }

    localStorage.setItem('journaly-last-notified', today);

    const name = localStorage.getItem('journaly-name') || '';
    const body = name
      ? `Hey ${name}, take a moment to reflect on your day.`
      : 'Take a moment to reflect on your day.';

    navigator.serviceWorker.ready
      .then(reg => reg.showNotification('Time to journal 📝', {
        body,
        icon:      './assets/icons/icon.svg',
        badge:     './assets/icons/icon.svg',
        tag:       'daily-reminder',
        renotify:  false,
      }))
      .catch(() => {
        /* Fallback if SW isn't ready */
        new Notification('Time to journal 📝', { body, icon: './assets/icons/icon.svg' });
      });
  });
}

/* ── Boot ── */
document.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('.nav-btn').forEach(btn => {
    btn.addEventListener('click', () => navigateTo(btn.dataset.screen));
  });

  renderHome();

  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./sw.js').catch(() => {});
  }

  /* Check reminder on load, then every 60 seconds */
  setTimeout(checkReminder, 5000);
  setInterval(checkReminder, 60 * 1000);
});
