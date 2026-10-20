// Greeting, clock and date widgets.
import { h } from '../h.js';
import { state, on } from '../state.js';
import { card } from '../ui.js';

const ticks = new Set();
setInterval(() => ticks.forEach((fn) => fn(new Date())), 1000);
document.addEventListener('visibilitychange', () => {
  if (!document.hidden) ticks.forEach((fn) => fn(new Date()));
});

function uses24h() {
  const f = state.settings.clockFormat;
  if (f === '24') return true;
  if (f === '12') return false;
  return !new Intl.DateTimeFormat(undefined, { hour: 'numeric' }).resolvedOptions().hour12;
}

export function formatTime(date, { h24, seconds }) {
  return new Intl.DateTimeFormat(undefined, {
    hour: h24 ? '2-digit' : 'numeric',
    minute: '2-digit',
    second: seconds ? '2-digit' : undefined,
    hour12: !h24,
  }).format(date).replace(/\s?[AP]M$/i, '');
}

export function greetingFor(hour) {
  if (hour < 5) return 'Good night';
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
}

export function greeting() {
  const line = h('p', { class: 'greeting' });
  const time = h('p', { class: 'hero-time', 'aria-live': 'off' });
  const render = (now = new Date()) => {
    const name = state.settings.name.trim();
    line.textContent = name ? `${greetingFor(now.getHours())}, ${name}` : greetingFor(now.getHours());
    time.textContent = formatTime(now, { h24: uses24h(), seconds: false });
  };
  render();
  ticks.add(render);
  on('settings', () => render());
  return h('div', { class: 'hero', dataset: { widget: 'greeting' } }, time, line);
}

export function clock() {
  const digital = h('div', { class: 'clock-digital' });
  const ampm = h('span', { class: 'clock-ampm' });
  const hands = {
    h: h('i', { class: 'hand hour' }),
    m: h('i', { class: 'hand minute' }),
    s: h('i', { class: 'hand second' }),
  };
  const face = h('div', { class: 'clock-analog', role: 'img' },
    ...Array.from({ length: 12 }, (_, i) => h('b', { class: 'tick', style: { transform: `rotate(${i * 30}deg)` } })),
    hands.h, hands.m, hands.s, h('i', { class: 'pin' }));
  const zone = h('p', { class: 'clock-zone' });
  const body = h('div', { class: 'clock-body' }, face, h('div', { class: 'clock-digital-wrap' }, digital, ampm), zone);

  const render = (now = new Date()) => {
    const { clockStyle, showSeconds } = state.settings;
    body.dataset.style = clockStyle;
    const h24 = uses24h();
    digital.textContent = formatTime(now, { h24, seconds: showSeconds });
    ampm.textContent = h24 ? '' : (now.getHours() < 12 ? 'AM' : 'PM');
    const s = now.getSeconds();
    const m = now.getMinutes() + s / 60;
    const hr = (now.getHours() % 12) + m / 60;
    hands.h.style.transform = `rotate(${hr * 30}deg)`;
    hands.m.style.transform = `rotate(${m * 6}deg)`;
    hands.s.style.transform = `rotate(${s * 6}deg)`;
    hands.s.hidden = !showSeconds;
    face.setAttribute('aria-label', `Time ${digital.textContent}`);
    zone.textContent = Intl.DateTimeFormat().resolvedOptions().timeZone.replace(/_/g, ' ');
  };
  render();
  ticks.add(render);
  on('settings', () => render());
  return card('clock', 'Clock', body);
}

export function date() {
  const day = h('p', { class: 'date-day' });
  const big = h('p', { class: 'date-big' });
  const month = h('p', { class: 'date-month' });
  const progress = h('div', { class: 'year-bar', title: '' }, h('i'));
  const render = (now = new Date()) => {
    day.textContent = now.toLocaleDateString(undefined, { weekday: 'long' });
    big.textContent = now.getDate();
    month.textContent = now.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
    const start = new Date(now.getFullYear(), 0, 1);
    const end = new Date(now.getFullYear() + 1, 0, 1);
    const pct = ((now - start) / (end - start)) * 100;
    progress.firstChild.style.width = `${pct.toFixed(1)}%`;
    progress.title = `${Math.floor(pct)}% of ${now.getFullYear()} done`;
  };
  render();
  ticks.add((now) => { if (now.getSeconds() === 0) render(now); });
  return card('date', 'Date', h('div', { class: 'date-body' }, day, big, month, progress));
}
