// Weather from Open-Meteo: free, no API key, no account, no tracking.
import { h, icon, toast } from '../h.js';
import { state, on, update } from '../state.js';
import { card, iconButton } from '../ui.js';

const CACHE_KEY = 'tidepool:weather-cache';
const CACHE_MS = 30 * 60 * 1000;
const DEMO = new URLSearchParams(location.search).has('demo');

// WMO weather codes -> label + glyph
const CODES = [
  [[0], 'Clear', 'sun'], [[1], 'Mostly clear', 'sun'], [[2], 'Partly cloudy', 'partly'], [[3], 'Overcast', 'cloud'],
  [[45, 48], 'Fog', 'fog'], [[51, 53, 55, 56, 57], 'Drizzle', 'rain'], [[61, 63, 65, 66, 67, 80, 81, 82], 'Rain', 'rain'],
  [[71, 73, 75, 77, 85, 86], 'Snow', 'snow'], [[95, 96, 99], 'Thunderstorm', 'storm'],
];
export function describe(code) {
  const hit = CODES.find(([codes]) => codes.includes(code));
  return hit ? { label: hit[1], glyph: hit[2] } : { label: 'Weather', glyph: 'cloud' };
}

const GLYPHS = {
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
  moon: '<path d="M20 14.5A8 8 0 0 1 9.5 4 8 8 0 1 0 20 14.5z"/>',
  partly: '<path d="M8 4.5V3M3.5 8H2M4.8 4.8l1 1M12.5 7.2A4 4 0 0 0 5 9"/><path d="M7 20h10a4 4 0 0 0 .5-8 6 6 0 0 0-11.5 2A3 3 0 0 0 7 20z"/>',
  cloud: '<path d="M7 19h10a4.5 4.5 0 0 0 .6-9 6.5 6.5 0 0 0-12.4 2.3A3.4 3.4 0 0 0 7 19z"/>',
  fog: '<path d="M4 10h16M3 14h18M6 18h12M7 6h10"/>',
  rain: '<path d="M7 15h10a4 4 0 0 0 .5-8 6 6 0 0 0-11.5 2A3 3 0 0 0 7 15z"/><path d="M8 18l-1 3M12 18l-1 3M16 18l-1 3"/>',
  snow: '<path d="M7 14h10a4 4 0 0 0 .5-8 6 6 0 0 0-11.5 2A3 3 0 0 0 7 14z"/><path d="M8 18h.01M12 18h.01M16 18h.01M10 21h.01M14 21h.01"/>',
  storm: '<path d="M7 14h10a4 4 0 0 0 .5-8 6 6 0 0 0-11.5 2A3 3 0 0 0 7 14z"/><path d="M12 14l-2 4h4l-2 4"/>',
};

function glyph(name) {
  // Parsed as an SVG document from the static GLYPHS table (never user data).
  const doc = new DOMParser().parseFromString(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">${GLYPHS[name] || GLYPHS.cloud}</svg>`, 'image/svg+xml');
  return h('span', { class: 'wx-glyph', 'aria-hidden': 'true' }, document.importNode(doc.documentElement, true));
}

function readCache() {
  try { return JSON.parse(localStorage.getItem(CACHE_KEY)); } catch { return null; }
}
function writeCache(data) {
  try { localStorage.setItem(CACHE_KEY, JSON.stringify(data)); } catch { /* ignore */ }
}

async function fetchWeather(loc, units) {
  const params = new URLSearchParams({
    latitude: loc.latitude, longitude: loc.longitude,
    current: 'temperature_2m,apparent_temperature,weather_code,is_day,wind_speed_10m',
    daily: 'temperature_2m_max,temperature_2m_min,weather_code',
    forecast_days: '4', timezone: 'auto',
    temperature_unit: units === 'fahrenheit' ? 'fahrenheit' : 'celsius',
    wind_speed_unit: units === 'fahrenheit' ? 'mph' : 'kmh',
  });
  const res = await fetch(`https://api.open-meteo.com/v1/forecast?${params}`);
  if (!res.ok) throw new Error(`Weather ${res.status}`);
  return res.json();
}

export async function searchPlaces(name) {
  const res = await fetch(`https://geocoding-api.open-meteo.com/v1/search?${new URLSearchParams({ name, count: '6', language: navigator.language.slice(0, 2) || 'en' })}`);
  if (!res.ok) throw new Error('Place search failed');
  const data = await res.json();
  return (data.results || []).map((r) => ({
    name: [r.name, r.admin1, r.country_code].filter(Boolean).join(', '),
    latitude: r.latitude,
    longitude: r.longitude,
  }));
}

function demoData() {
  const days = [0, 1, 2, 3].map((i) => new Date(Date.now() + i * 86400000).toISOString().slice(0, 10));
  return {
    current: { temperature_2m: 18, apparent_temperature: 17, weather_code: 2, is_day: 1, wind_speed_10m: 9 },
    current_units: { wind_speed_10m: 'km/h' },
    daily: { time: days, temperature_2m_max: [21, 19, 16, 20], temperature_2m_min: [12, 11, 9, 10], weather_code: [2, 61, 3, 1] },
  };
}

export function weather() {
  const body = h('div', { class: 'wx-body' });
  const refresh = iconButton('reset', 'Refresh weather', () => load(true));
  const el = card('weather', 'Weather', body, [refresh]);

  function askLocation() {
    const input = h('input', { type: 'search', placeholder: 'Search a city…', 'aria-label': 'City', autocomplete: 'off' });
    const list = h('ul', { class: 'wx-results' });
    let t;
    input.addEventListener('input', () => {
      clearTimeout(t);
      t = setTimeout(async () => {
        const q = input.value.trim();
        if (q.length < 2) return list.replaceChildren();
        try {
          const places = await searchPlaces(q);
          list.replaceChildren(...places.map((p) => h('li', {}, h('button', {
            type: 'button', class: 'wx-place',
            onClick: () => update('settings', (s) => { s.location = p; }),
          }, p.name))));
        } catch {
          list.replaceChildren(h('li', { class: 'muted' }, 'Offline? Try again in a moment.'));
        }
      }, 300);
    });
    body.replaceChildren(h('p', { class: 'muted small' }, 'Where are you? Only the city goes to Open-Meteo.'), input, list);
  }

  function render(data) {
    const loc = state.settings.location;
    const c = data.current;
    const { label, glyph: g } = describe(c.weather_code);
    const unit = state.settings.units === 'fahrenheit' ? '°F' : '°C';
    const days = data.daily.time.slice(1, 4).map((d, i) => {
      const k = i + 1;
      return h('li', {},
        h('span', { class: 'wx-dname' }, new Date(`${d}T12:00`).toLocaleDateString(undefined, { weekday: 'short' })),
        glyph(describe(data.daily.weather_code[k]).glyph),
        h('span', {}, `${Math.round(data.daily.temperature_2m_max[k])}°`),
        h('span', { class: 'muted' }, `${Math.round(data.daily.temperature_2m_min[k])}°`));
    });
    body.replaceChildren(
      h('div', { class: 'wx-now' },
        glyph(g === 'sun' && !c.is_day ? 'moon' : g),
        h('p', { class: 'wx-temp' }, `${Math.round(c.temperature_2m)}${unit}`)),
      h('p', { class: 'wx-label' }, `${label} · feels ${Math.round(c.apparent_temperature)}°`),
      h('button', { type: 'button', class: 'wx-loc', title: 'Change location', onClick: askLocation }, icon('pin'), DEMO ? 'Bergen, NO' : (loc?.name || '')),
      h('ul', { class: 'wx-days' }, days));
  }

  async function load(force = false) {
    if (DEMO) return render(demoData());
    const loc = state.settings.location;
    if (!loc) return askLocation();
    const key = `${loc.latitude},${loc.longitude},${state.settings.units}`;
    const cached = readCache();
    if (!force && cached?.key === key && Date.now() - cached.at < CACHE_MS) return render(cached.data);
    if (cached?.key === key) render(cached.data);
    try {
      const data = await fetchWeather(loc, state.settings.units);
      writeCache({ key, at: Date.now(), data });
      render(data);
    } catch {
      if (!cached) body.replaceChildren(h('p', { class: 'muted' }, 'Weather is offline right now.'));
      if (force) toast('Could not reach the weather service.');
    }
  }

  let last = JSON.stringify([state.settings.location, state.settings.units]);
  on('settings', (s) => {
    const now = JSON.stringify([s.location, s.units]);
    if (now !== last) { last = now; load(true); }
  });
  load();
  setInterval(() => !document.hidden && load(), CACHE_MS);
  return el;
}
