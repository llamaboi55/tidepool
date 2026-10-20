// Settings sheet. Every control writes straight to state, so changes apply live.
import { h, toast, uid } from './h.js';
import { state, update, WIDGETS, replaceAll, KEYS } from './state.js';
import { SCENES, sceneDataUrl } from './scenes.js';
import { ENGINES, normalizeUrl } from './url.js';
import { putImage, deleteImage, clearAll, isExtension } from './store.js';
import { searchPlaces } from './widgets/weather.js';

const sheet = () => document.getElementById('settings');

export function toggleSettings(force) {
  const el = sheet();
  const open = force ?? el.hidden;
  if (open) {
    build();
    el.hidden = false;
    requestAnimationFrame(() => el.classList.add('open'));
    el.querySelector('button, input, select')?.focus();
  } else {
    el.classList.remove('open');
    setTimeout(() => { el.hidden = true; }, 220);
    document.getElementById('btn-settings')?.focus();
  }
}

const set = (fn) => update('settings', fn);

function row(label, control, help) {
  return h('div', { class: 'row' },
    h('div', { class: 'row-text' }, h('span', { class: 'row-label' }, label), help ? h('span', { class: 'row-help' }, help) : null),
    control);
}

function toggle(checked, onChange, label) {
  const input = h('input', { type: 'checkbox', role: 'switch', checked, 'aria-label': label });
  input.addEventListener('change', () => onChange(input.checked));
  return h('label', { class: 'switch' }, input, h('i'));
}

function select(value, options, onChange, label) {
  const el = h('select', { 'aria-label': label }, Object.entries(options).map(([v, text]) => h('option', { value: v, selected: v === value }, text)));
  el.addEventListener('change', () => onChange(el.value));
  return el;
}

function range(value, min, max, onInput, label, suffix = '') {
  const out = h('output', {}, `${value}${suffix}`);
  const el = h('input', { type: 'range', min, max, value, 'aria-label': label });
  el.addEventListener('input', () => { out.textContent = `${el.value}${suffix}`; onInput(Number(el.value)); });
  return h('span', { class: 'range' }, el, out);
}

function section(title, ...rows) {
  return h('section', { class: 'set-section' }, h('h3', {}, title), ...rows);
}

function build() {
  const s = state.settings;

  const scenes = h('div', { class: 'scene-grid', role: 'radiogroup', 'aria-label': 'Wallpaper' },
    SCENES.map((scene) => h('button', {
      type: 'button', role: 'radio', class: 'scene-pick',
      'aria-checked': String(s.wallpaper.type === 'scene' && s.wallpaper.scene === scene.id),
      title: scene.name, style: { backgroundImage: `url("${sceneDataUrl(scene)}")` },
      onClick: () => { set((st) => { st.wallpaper = { ...st.wallpaper, type: 'scene', scene: scene.id }; st.rotateDaily = false; }); build(); },
    }, h('span', {}, scene.name))));

  const file = h('input', { type: 'file', accept: 'image/*', hidden: true });
  file.addEventListener('change', async () => {
    const blob = file.files?.[0];
    if (!blob) return;
    if (blob.size > 25 * 1024 * 1024) return toast('That image is over 25 MB. Try a smaller one.');
    const id = `img-${uid()}`;
    await putImage(id, blob);
    const old = state.settings.wallpaper.imageId;
    set((st) => { st.wallpaper = { ...st.wallpaper, type: 'image', imageId: id }; st.rotateDaily = false; });
    if (old) deleteImage(old);
    toast('Wallpaper set. It stays on this device.');
    build();
  });
  const urlInput = h('input', { type: 'url', placeholder: 'https://…/photo.jpg', value: s.wallpaper.type === 'url' ? s.wallpaper.url : '', 'aria-label': 'Wallpaper image address' });
  urlInput.addEventListener('change', () => {
    const href = normalizeUrl(urlInput.value);
    if (!href) return toast('Use an http or https image address.');
    set((st) => { st.wallpaper = { ...st.wallpaper, type: 'url', url: href }; st.rotateDaily = false; });
  });

  const placeInput = h('input', { type: 'search', placeholder: s.location?.name || 'Search a city…', 'aria-label': 'Weather location' });
  const placeList = h('ul', { class: 'wx-results' });
  let pt;
  placeInput.addEventListener('input', () => {
    clearTimeout(pt);
    pt = setTimeout(async () => {
      if (placeInput.value.trim().length < 2) return placeList.replaceChildren();
      try {
        const places = await searchPlaces(placeInput.value.trim());
        placeList.replaceChildren(...places.map((p) => h('li', {}, h('button', { type: 'button', class: 'wx-place', onClick: () => { set((st) => { st.location = p; }); placeInput.value = ''; placeInput.placeholder = p.name; placeList.replaceChildren(); } }, p.name))));
      } catch { placeList.replaceChildren(h('li', { class: 'muted' }, 'Offline.')); }
    }, 300);
  });

  const custom = h('input', { type: 'url', value: s.customEngine, placeholder: 'https://example.com/search?q=%s', 'aria-label': 'Custom search address' });
  custom.addEventListener('change', () => {
    if (custom.value && !custom.value.includes('%s')) return toast('Put %s where the search words go.');
    set((st) => { st.customEngine = custom.value.trim(); if (st.customEngine) st.engine = 'custom'; });
  });

  const name = h('input', { type: 'text', value: s.name, placeholder: 'Your name (optional)', maxlength: 40, 'aria-label': 'Your name' });
  name.addEventListener('input', () => set((st) => { st.name = name.value; }));

  const accent = h('input', { type: 'color', value: s.accent, 'aria-label': 'Accent color' });
  accent.addEventListener('input', () => set((st) => { st.accent = accent.value; }));

  const importInput = h('input', { type: 'file', accept: 'application/json,.json', hidden: true });
  importInput.addEventListener('change', async () => {
    try {
      const data = JSON.parse(await importInput.files[0].text());
      if (data?.app !== 'tidepool') throw new Error('not a Tidepool backup');
      replaceAll(data.data);
      toast('Backup restored.');
      build();
    } catch {
      toast('That file is not a Tidepool backup.');
    }
  });

  const engineOptions = Object.fromEntries(Object.entries(ENGINES).map(([k, v]) => [k, v.name]));
  if (s.customEngine) engineOptions.custom = 'Custom';

  sheet().replaceChildren(
    h('header', { class: 'sheet-head' },
      h('h2', {}, 'Settings'),
      h('button', { type: 'button', class: 'icon-btn', 'aria-label': 'Close settings', onClick: () => toggleSettings(false) }, '✕')),
    h('div', { class: 'sheet-body' },
      section('Wallpaper',
        scenes,
        row('Change daily', toggle(s.rotateDaily, (v) => set((st) => { st.rotateDaily = v; if (v) st.wallpaper.type = 'scene'; })), 'A new landscape every day'),
        row('Your own photo', h('span', {}, h('button', { type: 'button', class: 'btn ghost', onClick: () => file.click() }, 'Upload…'), file), 'Stored only in this browser'),
        row('Image from the web', urlInput),
        row('Blur', range(s.blur, 0, 30, (v) => set((st) => { st.blur = v; }), 'Blur', 'px')),
        row('Dim', range(s.dim, 0, 70, (v) => set((st) => { st.dim = v; }), 'Dim', '%'))),
      section('Look',
        row('Theme', select(s.theme, { auto: 'Match wallpaper', light: 'Light glass', dark: 'Dark glass' }, (v) => set((st) => { st.theme = v; }), 'Theme')),
        row('Glass strength', range(s.glass, 0, 100, (v) => set((st) => { st.glass = v; }), 'Glass strength', '%')),
        row('Accent', accent),
        row('Show site icons', toggle(s.showIcons, (v) => set((st) => { st.showIcons = v; }), 'Show site icons'), isExtension ? 'From your browser’s own cache' : 'Letters are used outside the extension'),
        row('Name', name, 'Used in the greeting')),
      section('Widgets',
        ...Object.entries(WIDGETS).map(([key, label]) => row(label, toggle(s.widgets[key], (v) => set((st) => { st.widgets[key] = v; }), label))),
        h('p', { class: 'row-help' }, 'Tip: the pencil button lets you drag cards between the left, right and bottom areas.')),
      section('Clock',
        row('Style', select(s.clockStyle, { digital: 'Digital', analog: 'Analog', both: 'Both' }, (v) => set((st) => { st.clockStyle = v; }), 'Clock style')),
        row('Format', select(s.clockFormat, { auto: 'Auto', 12: '12-hour', 24: '24-hour' }, (v) => set((st) => { st.clockFormat = v; }), 'Clock format')),
        row('Seconds', toggle(s.showSeconds, (v) => set((st) => { st.showSeconds = v; }), 'Show seconds'))),
      section('Search',
        row('Engine', select(s.engine, engineOptions, (v) => set((st) => { st.engine = v; }), 'Search engine')),
        row('Custom engine', custom, 'Any site: use %s for the words'),
        row('Open results in a new tab', toggle(s.openInNewTab, (v) => set((st) => { st.openInNewTab = v; }), 'Open results in a new tab')),
        h('p', { class: 'row-help' }, 'Shortcuts: !g Google, !d DuckDuckGo, !b Brave, !yt YouTube, !w Wikipedia, !gh GitHub, !r Reddit, !m Maps, !a Amazon.')),
      section('Weather',
        row('Location', h('div', { class: 'stack' }, placeInput, placeList), 'Data from Open-Meteo, no key or account'),
        row('Units', select(s.units, { celsius: '°C, km/h', fahrenheit: '°F, mph' }, (v) => set((st) => { st.units = v; }), 'Units'))),
      section('Your data',
        row('Sync with your browser account', toggle(s.sync, (v) => { set((st) => { st.sync = v; }); toast(v ? 'Syncing through your browser account.' : 'Saved on this device only.'); }, 'Sync'), 'Uses Chrome/Edge/Brave/Firefox sync. No Tidepool server exists.'),
        row('Backup', h('span', { class: 'btn-row' },
          h('button', { type: 'button', class: 'btn ghost', onClick: exportBackup }, 'Export'),
          h('button', { type: 'button', class: 'btn ghost', onClick: () => importInput.click() }, 'Import'), importInput)),
        row('Start over', h('button', { type: 'button', class: 'btn danger', onClick: resetAll }, 'Reset everything'))),
      h('p', { class: 'about' }, 'Tidepool is free and open source (MIT). No ads, no tracking, no account. Everything stays in your browser.')));
}

function exportBackup() {
  const data = Object.fromEntries(KEYS.map((k) => [k, state[k]]));
  const blob = new Blob([JSON.stringify({ app: 'tidepool', version: 1, exportedAt: new Date().toISOString(), data }, null, 2)], { type: 'application/json' });
  const a = h('a', { href: URL.createObjectURL(blob), download: `tidepool-backup-${new Date().toISOString().slice(0, 10)}.json` });
  document.body.append(a);
  a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
}

async function resetAll() {
  const btn = sheet().querySelector('.btn.danger');
  if (btn.dataset.armed !== '1') {
    btn.dataset.armed = '1';
    btn.textContent = 'Click again to confirm';
    setTimeout(() => { btn.dataset.armed = ''; btn.textContent = 'Reset everything'; }, 4000);
    return;
  }
  await clearAll();
  location.reload();
}
