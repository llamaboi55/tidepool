// Storage layer. Inside a browser extension it uses chrome.storage (local, or the
// browser's own account sync when enabled). Opened as a plain web page it falls back
// to localStorage, so the dashboard also works as a standalone page.

const ext = globalThis.chrome?.storage?.local ? globalThis.chrome : null;
const PREFIX = 'tidepool:';
// Keys small enough for the browser's sync quota (8 KB per item, 100 KB total).
const SYNCABLE = new Set(['settings', 'dock', 'groups', 'tasks', 'notes']);

export const isExtension = Boolean(ext);

let useSync = false;
let syncWarned = false;

export function setSyncEnabled(on) {
  useSync = Boolean(on) && Boolean(ext?.storage?.sync);
}

function areaFor(key) {
  return useSync && SYNCABLE.has(key) ? ext.storage.sync : ext.storage.local;
}

export async function load(keys) {
  if (!ext) {
    const out = {};
    for (const key of keys) {
      try {
        const raw = localStorage.getItem(PREFIX + key);
        if (raw != null) out[key] = JSON.parse(raw);
      } catch { /* private mode or corrupt value: use defaults */ }
    }
    return out;
  }
  const local = await ext.storage.local.get(keys);
  if (!ext.storage.sync) return local;
  // Sync wins for syncable keys when it holds a value, so a second computer picks up your setup.
  const synced = await ext.storage.sync.get(keys.filter((k) => SYNCABLE.has(k))).catch(() => ({}));
  return { ...local, ...synced };
}

export async function save(key, value) {
  if (!ext) {
    try { localStorage.setItem(PREFIX + key, JSON.stringify(value)); } catch { /* quota: ignore */ }
    return { ok: true };
  }
  try {
    await areaFor(key).set({ [key]: value });
    if (useSync && SYNCABLE.has(key)) await ext.storage.local.set({ [key]: value });
    return { ok: true };
  } catch (err) {
    // Over the sync quota (for example a very long note): keep it locally instead.
    await ext.storage.local.set({ [key]: value });
    if (!syncWarned) {
      syncWarned = true;
      return { ok: false, reason: 'sync-quota', error: err };
    }
    return { ok: false, reason: 'sync-quota' };
  }
}

export async function clearAll() {
  if (!ext) {
    Object.keys(localStorage).filter((k) => k.startsWith(PREFIX)).forEach((k) => localStorage.removeItem(k));
  } else {
    await ext.storage.local.clear();
    await ext.storage.sync?.clear().catch(() => {});
  }
  await idbClear();
}

/** Call cb(key, newValue) when another tab changes a stored key. */
export function onExternalChange(cb) {
  if (ext?.storage?.onChanged) {
    ext.storage.onChanged.addListener((changes) => {
      for (const [key, { newValue }] of Object.entries(changes)) cb(key, newValue);
    });
  } else {
    window.addEventListener('storage', (e) => {
      if (!e.key?.startsWith(PREFIX)) return;
      try { cb(e.key.slice(PREFIX.length), e.newValue == null ? undefined : JSON.parse(e.newValue)); } catch { /* ignore */ }
    });
  }
}

// ---- IndexedDB for large blobs (uploaded wallpapers) -------------------------------

function idb() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open('tidepool', 1);
    req.onupgradeneeded = () => req.result.createObjectStore('images');
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function tx(mode, fn) {
  const db = await idb();
  return new Promise((resolve, reject) => {
    const t = db.transaction('images', mode);
    const req = fn(t.objectStore('images'));
    t.oncomplete = () => resolve(req?.result);
    t.onerror = () => reject(t.error);
  });
}

export const putImage = (id, blob) => tx('readwrite', (s) => s.put(blob, id));
export const getImage = (id) => tx('readonly', (s) => s.get(id)).catch(() => null);
export const deleteImage = (id) => tx('readwrite', (s) => s.delete(id)).catch(() => {});
function idbClear() {
  return tx('readwrite', (s) => s.clear()).catch(() => {});
}
