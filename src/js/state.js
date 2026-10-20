// App state: one object per stored key, saved (debounced) on every change.
import { load, save, setSyncEnabled, onExternalChange } from './store.js';
import { toast, uid } from './h.js';

export const WIDGETS = {
  greeting: 'Greeting',
  search: 'Search',
  dock: 'Favorites',
  date: 'Date',
  weather: 'Weather',
  clock: 'Clock',
  timer: 'Focus timer',
  groups: 'Link groups',
  tasks: 'Tasks',
  notes: 'Notes',
};

const link = (title, url) => ({ id: uid(), title, url });

export function defaults() {
  return {
    settings: {
      version: 1,
      name: '',
      theme: 'auto', // auto | light | dark
      wallpaper: { type: 'scene', scene: 'dawn-fjord', url: '', imageId: '' },
      rotateDaily: false,
      blur: 0,
      dim: 12,
      glass: 55,
      accent: '#7fb8a4',
      clockFormat: 'auto', // auto | 12 | 24
      clockStyle: 'analog', // digital | analog | both
      showSeconds: false,
      engine: 'duckduckgo',
      customEngine: '',
      openInNewTab: false,
      units: 'celsius',
      location: null, // { name, latitude, longitude }
      sync: false,
      showIcons: true,
      widgets: Object.fromEntries(Object.keys(WIDGETS).map((k) => [k, true])),
      layout: { left: ['date', 'weather'], right: ['clock', 'timer'], board: ['groups', 'tasks', 'notes'] },
    },
    dock: [
      link('YouTube', 'https://www.youtube.com/'),
      link('Gmail', 'https://mail.google.com/'),
      link('GitHub', 'https://github.com/'),
      link('Reddit', 'https://www.reddit.com/'),
      link('Wikipedia', 'https://www.wikipedia.org/'),
      link('Maps', 'https://www.openstreetmap.org/'),
    ],
    groups: [
      { id: uid(), title: 'Daily', links: [link('Weather radar', 'https://www.windy.com/'), link('Hacker News', 'https://news.ycombinator.com/'), link('Calendar', 'https://calendar.google.com/')] },
      { id: uid(), title: 'Learn', links: [link('MDN Web Docs', 'https://developer.mozilla.org/'), link('Khan Academy', 'https://www.khanacademy.org/'), link('Project Gutenberg', 'https://www.gutenberg.org/')] },
    ],
    tasks: [
      { id: uid(), text: 'Press / to search from anywhere', done: false },
      { id: uid(), text: 'Click the pencil to rearrange cards', done: false },
      { id: uid(), text: 'Pick a wallpaper in settings', done: true },
    ],
    notes: { text: '' },
    timer: { mode: 'focus', focusMin: 25, breakMin: 5, endsAt: null, remaining: 25 * 60, running: false, sessions: 0 },
  };
}

export const KEYS = Object.keys(defaults());
export const state = defaults();
const listeners = new Map();
const timers = new Map();

/** Fill in fields added in newer versions without losing the user's data. */
export function migrate(stored, base = defaults()) {
  const out = { ...base, ...stored };
  out.settings = { ...base.settings, ...(stored.settings || {}) };
  out.settings.widgets = { ...base.settings.widgets, ...(stored.settings?.widgets || {}) };
  const layout = { ...base.settings.layout, ...(stored.settings?.layout || {}) };
  // Every widget that lives in a zone must appear exactly once.
  const zones = ['left', 'right', 'board'];
  const movable = zones.flatMap((z) => base.settings.layout[z]);
  const placed = new Set();
  for (const zone of zones) {
    layout[zone] = (Array.isArray(layout[zone]) ? layout[zone] : []).filter((w) => {
      if (!movable.includes(w) || placed.has(w)) return false;
      placed.add(w);
      return true;
    });
  }
  for (const zone of zones) {
    for (const w of base.settings.layout[zone]) {
      if (!placed.has(w)) { layout[zone].push(w); placed.add(w); }
    }
  }
  out.settings.layout = layout;
  return out;
}

export async function init() {
  const stored = await load(KEYS);
  Object.assign(state, migrate(stored));
  setSyncEnabled(state.settings.sync);
  onExternalChange((key, value) => {
    if (!KEYS.includes(key) || value === undefined) return;
    if (JSON.stringify(state[key]) === JSON.stringify(value)) return;
    state[key] = key === 'settings' ? migrate({ settings: value }).settings : value;
    emit(key);
  });
}

export function on(key, fn) {
  if (!listeners.has(key)) listeners.set(key, new Set());
  listeners.get(key).add(fn);
}

function emit(key) {
  listeners.get(key)?.forEach((fn) => fn(state[key]));
  listeners.get('*')?.forEach((fn) => fn(key));
}

/** Mutate a key, re-render listeners right away and persist shortly after. */
export function update(key, mutate) {
  const result = mutate(state[key]);
  if (result !== undefined) state[key] = result;
  if (key === 'settings') setSyncEnabled(state.settings.sync);
  emit(key);
  clearTimeout(timers.get(key));
  timers.set(key, setTimeout(async () => {
    const res = await save(key, state[key]);
    if (res.reason === 'sync-quota' && res.error) toast('Too big for browser sync, so this is saved on this device only.');
  }, 250));
}

export function replaceAll(data) {
  const next = migrate(data);
  for (const key of KEYS) update(key, () => next[key]);
}
