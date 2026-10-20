import { h, toast } from './h.js';
import { state, init, on, update } from './state.js';
import { SCENES, sceneById, sceneDataUrl, sceneOfTheDay } from './scenes.js';
import { getImage } from './store.js';
import { greeting, clock, date } from './widgets/time.js';
import { weather } from './widgets/weather.js';
import { search, dock, groups } from './widgets/links.js';
import { tasks, notes, timer } from './widgets/focus.js';
import { toggleSettings } from './settings.js';

const BUILDERS = { greeting, search, dock, clock, date, weather, timer, groups, tasks, notes };
const CENTER = ['greeting', 'search', 'dock'];
const els = {};

await init();
document.documentElement.classList.add('ready');

// Build every widget once; layout changes only move these elements around.
for (const [name, build] of Object.entries(BUILDERS)) els[name] = build();

let layoutKey = '';
function layout(force = false) {
  const { widgets, layout: zones } = state.settings;
  const key = JSON.stringify([widgets, zones]);
  if (key === layoutKey && !force) return;
  layoutKey = key;
  document.getElementById('center').replaceChildren(...CENTER.filter((w) => widgets[w]).map((w) => els[w]));
  for (const zone of ['left', 'right', 'board']) {
    const host = document.getElementById(`zone-${zone}`);
    host.replaceChildren(...zones[zone].filter((w) => widgets[w]).map((w) => els[w]));
    host.classList.toggle('empty', !host.children.length);
  }
  document.querySelectorAll('.card').forEach((c) => { c.draggable = document.body.classList.contains('editing'); });
}

// ---- Wallpaper and theme --------------------------------------------------------------

let objectUrl = null;
let wallpaperKey = '';

async function applyWallpaper() {
  const s = state.settings;
  const wp = s.wallpaper;
  const key = JSON.stringify([wp, s.rotateDaily, s.rotateDaily && new Date().toDateString()]);
  if (key === wallpaperKey) return;
  wallpaperKey = key;
  const bg = document.getElementById('wallpaper');
  const credit = document.getElementById('credit');
  let url;
  let mode = null;
  if (wp.type === 'image' && wp.imageId) {
    const blob = await getImage(wp.imageId);
    if (blob) {
      if (objectUrl) URL.revokeObjectURL(objectUrl);
      objectUrl = URL.createObjectURL(blob);
      url = objectUrl;
      mode = await brightness(url);
      credit.textContent = '';
    }
  } else if (wp.type === 'url' && wp.url) {
    url = wp.url;
    mode = await brightness(url);
    credit.textContent = '';
  }
  if (!url) {
    const scene = s.rotateDaily ? sceneOfTheDay() : sceneById(wp.scene);
    url = sceneDataUrl(scene);
    mode = scene.mode;
    credit.textContent = scene.name;
  }
  bg.style.backgroundImage = `url("${url}")`;
  document.documentElement.dataset.wallpaperMode = mode || (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
  applyTheme();
}

/** Average brightness of an image → 'light' | 'dark' (null if the image can't be read). */
function brightness(src) {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      try {
        const c = document.createElement('canvas');
        c.width = 32; c.height = 18;
        const ctx = c.getContext('2d', { willReadFrequently: true });
        ctx.drawImage(img, 0, 0, 32, 18);
        const px = ctx.getImageData(0, 0, 32, 18).data;
        let sum = 0;
        for (let i = 0; i < px.length; i += 4) sum += 0.2126 * px[i] + 0.7152 * px[i + 1] + 0.0722 * px[i + 2];
        resolve(sum / (px.length / 4) > 140 ? 'light' : 'dark');
      } catch {
        resolve(null);
      }
    };
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

function applyTheme() {
  const s = state.settings;
  const root = document.documentElement;
  const theme = s.theme === 'auto' ? root.dataset.wallpaperMode || 'light' : s.theme;
  root.dataset.theme = theme;
  root.style.setProperty('--accent', s.accent);
  root.style.setProperty('--glass', (s.glass / 100).toFixed(2));
  root.style.setProperty('--wp-blur', `${s.blur}px`);
  root.style.setProperty('--wp-dim', (s.dim / 100).toFixed(2));
}

// ---- Edit mode: drag cards between zones ----------------------------------------------

function setEditing(on) {
  document.body.classList.toggle('editing', on);
  document.getElementById('btn-edit').setAttribute('aria-pressed', String(on));
  document.querySelectorAll('.card').forEach((c) => { c.draggable = on; });
  document.dispatchEvent(new CustomEvent('tidepool:editing', { detail: on }));
  if (on) toast('Edit mode: drag cards, click links to edit. Press E or Esc when done.');
}

let dragged = null;
document.addEventListener('dragstart', (e) => {
  const c = e.target.closest?.('.card');
  if (!c || !document.body.classList.contains('editing') || e.target !== c) return;
  dragged = c;
  c.classList.add('dragging');
  e.dataTransfer.effectAllowed = 'move';
  e.dataTransfer.setData('text/x-tidepool-card', c.dataset.widget);
});
document.addEventListener('dragend', () => {
  if (!dragged) return;
  dragged.classList.remove('dragging');
  dragged = null;
  document.querySelectorAll('.zone.over').forEach((z) => z.classList.remove('over'));
  layout(true); // snap back to the saved layout if the card was dropped outside a zone
});
document.querySelectorAll('.zone').forEach((zone) => {
  zone.addEventListener('dragover', (e) => {
    if (!dragged) return;
    e.preventDefault();
    zone.classList.add('over');
    const after = [...zone.querySelectorAll('.card:not(.dragging)')].find((c) => {
      const r = c.getBoundingClientRect();
      return zone.dataset.zone === 'board' ? e.clientX < r.left + r.width / 2 : e.clientY < r.top + r.height / 2;
    });
    if (after) zone.insertBefore(dragged, after); else zone.append(dragged);
  });
  zone.addEventListener('dragleave', (e) => { if (!zone.contains(e.relatedTarget)) zone.classList.remove('over'); });
  zone.addEventListener('drop', (e) => {
    if (!dragged) return;
    e.preventDefault();
    update('settings', (s) => {
      const hidden = Object.fromEntries(['left', 'right', 'board'].map((z) => [z, s.layout[z].filter((w) => !s.widgets[w])]));
      for (const z of ['left', 'right', 'board']) {
        const visible = [...document.getElementById(`zone-${z}`).querySelectorAll('.card')].map((c) => c.dataset.widget);
        s.layout[z] = [...visible, ...hidden[z]];
      }
    });
  });
});

// ---- Controls and keyboard -------------------------------------------------------------

function nextScene() {
  const s = state.settings;
  const i = SCENES.findIndex((x) => x.id === s.wallpaper.scene);
  const next = SCENES[(i + 1) % SCENES.length];
  update('settings', (st) => { st.wallpaper = { ...st.wallpaper, type: 'scene', scene: next.id }; st.rotateDaily = false; });
  toast(next.name);
}

function setCalm(on) {
  document.body.classList.toggle('calm', on);
  document.getElementById('btn-calm').setAttribute('aria-pressed', String(on));
}

function showHelp() {
  const keys = [['/', 'Search'], ['E', 'Edit mode'], ['W', 'Next wallpaper'], ['C', 'Calm mode'], ['S', 'Settings'], ['T', 'New task'], ['N', 'Notes'], ['Space', 'Start or pause focus timer'], ['Esc', 'Close or leave a mode'], ['!yt cats', 'Search YouTube (also !g !d !b !w !gh !r !m !a)']];
  const dlg = document.getElementById('dialog');
  dlg.replaceChildren(h('div', { class: 'dialog-form' },
    h('h2', {}, 'Keyboard shortcuts'),
    h('dl', { class: 'keys' }, keys.flatMap(([k, v]) => [h('dt', {}, h('kbd', {}, k)), h('dd', {}, v)])),
    h('div', { class: 'dialog-buttons' }, h('span', { class: 'spacer' }), h('button', { type: 'button', class: 'btn primary', onClick: () => dlg.close() }, 'Got it'))));
  dlg.showModal();
}

document.getElementById('btn-edit').addEventListener('click', () => setEditing(!document.body.classList.contains('editing')));
document.getElementById('btn-scene').addEventListener('click', nextScene);
document.getElementById('btn-calm').addEventListener('click', () => setCalm(!document.body.classList.contains('calm')));
document.getElementById('btn-settings').addEventListener('click', () => toggleSettings());
document.getElementById('btn-help').addEventListener('click', showHelp);

document.addEventListener('keydown', (e) => {
  const typing = e.target.closest?.('input, textarea, select, [contenteditable]');
  const dialogOpen = document.getElementById('dialog').open;
  if (e.key === 'Escape') {
    if (!document.getElementById('settings').hidden) return toggleSettings(false);
    if (typing) return e.target.blur();
    if (document.body.classList.contains('editing')) return setEditing(false);
    if (document.body.classList.contains('calm')) return setCalm(false);
    return;
  }
  if (typing || dialogOpen || e.ctrlKey || e.metaKey || e.altKey) return;
  const actions = {
    '/': () => document.getElementById('search')?.focus(),
    e: () => setEditing(!document.body.classList.contains('editing')),
    w: nextScene,
    c: () => setCalm(!document.body.classList.contains('calm')),
    s: () => toggleSettings(),
    t: () => document.querySelector('.task-input')?.focus(),
    n: () => document.querySelector('.notes-area')?.focus(),
    '?': showHelp,
    ' ': () => document.querySelector('.timer-toggle')?.click(),
  };
  const fn = actions[e.key.toLowerCase()] || actions[e.key];
  if (fn) { e.preventDefault(); fn(); }
});

on('settings', () => { layout(); applyWallpaper(); applyTheme(); });
matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => { wallpaperKey = ''; applyWallpaper(); });

layout();
await applyWallpaper();
document.body.classList.add('loaded');

// First run: a gentle hint instead of a tour.
if (!state.settings.seenWelcome) {
  setTimeout(() => toast('Welcome to Tidepool. Press ? for shortcuts, S for settings.'), 900);
  update('settings', (s) => { s.seenWelcome = true; });
}

