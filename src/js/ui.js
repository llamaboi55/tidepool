// Shared UI pieces: cards, the link/edit dialog, site icons.
import { h, icon, iconButton } from './h.js';
import { hostOf, hueFor } from './url.js';
import { state } from './state.js';

export function card(name, title, body, actions = []) {
  return h('article', { class: `card glass card-${name}`, dataset: { widget: name }, 'aria-label': title },
    h('header', { class: 'card-head' },
      h('span', { class: 'grip', title: 'Drag to move' }, icon('grip')),
      h('h2', { class: 'card-title' }, title),
      h('div', { class: 'card-actions' }, actions)),
    body);
}

const faviconApi = (() => {
  try {
    const perms = globalThis.chrome?.runtime?.getManifest?.().permissions || [];
    return perms.includes('favicon') ? chrome.runtime.getURL('/_favicon/') : null;
  } catch {
    return null;
  }
})();

// Chrome returns a generic globe for sites it has no cached icon for. We fingerprint that
// globe once and keep the monogram whenever a site would only get the globe.
function fingerprint(img) {
  const c = document.createElement('canvas');
  c.width = 16; c.height = 16;
  const ctx = c.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(img, 0, 0, 16, 16);
  return Array.from(ctx.getImageData(0, 0, 16, 16).data, (v) => v >> 4).join('');
}
function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}
const faviconUrl = (url) => `${faviconApi}?pageUrl=${encodeURIComponent(url)}&size=64`;
const genericIcon = faviconApi ? loadImage(faviconUrl('https://tidepool.invalid/')).then(fingerprint).catch(() => null) : null;

/** Site icon: the browser's own cached favicon when it has one (no network), else a monogram. */
export function siteIcon(url, title, size = 'md') {
  const letter = (title || hostOf(url) || '?').trim().charAt(0).toUpperCase();
  const hue = hueFor(hostOf(url) || title);
  const mono = h('span', { class: `site-icon ${size}`, style: { '--hue': hue } }, letter);
  if (!faviconApi || !state.settings.showIcons) return mono;
  Promise.all([loadImage(faviconUrl(url)), genericIcon]).then(([img, generic]) => {
    if (generic && fingerprint(img) === generic) return;
    img.alt = '';
    mono.classList.add('has-img');
    mono.replaceChildren(img);
  }).catch(() => {});
  return mono;
}

/**
 * Small form dialog. fields: [{ name, label, value, type, placeholder, required }]
 * onSubmit(values) may return an error string to keep the dialog open.
 */
export function openDialog({ title, fields, submitLabel = 'Save', onSubmit, onDelete }) {
  const dlg = document.getElementById('dialog');
  const error = h('p', { class: 'form-error', role: 'alert' });
  const inputs = fields.map((f) => {
    const id = `f-${f.name}`;
    const input = f.type === 'textarea'
      ? h('textarea', { id, name: f.name, rows: 4, placeholder: f.placeholder || '' })
      : h('input', { id, name: f.name, type: f.type || 'text', placeholder: f.placeholder || '', required: f.required, autocomplete: 'off', spellcheck: false });
    input.value = f.value ?? '';
    return h('label', { class: 'field', for: id }, h('span', {}, f.label), input);
  });
  const form = h('form', { method: 'dialog', class: 'dialog-form' },
    h('h2', {}, title),
    inputs,
    error,
    h('div', { class: 'dialog-buttons' },
      onDelete ? h('button', { type: 'button', class: 'btn danger', onClick: () => { onDelete(); dlg.close(); } }, 'Delete') : null,
      h('span', { class: 'spacer' }),
      h('button', { type: 'button', class: 'btn ghost', onClick: () => dlg.close() }, 'Cancel'),
      h('button', { type: 'submit', class: 'btn primary' }, submitLabel)));
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const values = Object.fromEntries(new FormData(form));
    const problem = onSubmit(values);
    if (problem) {
      error.textContent = problem;
      return;
    }
    dlg.close();
  });
  dlg.replaceChildren(form);
  dlg.showModal();
  form.querySelector('input,textarea')?.focus();
}

export { iconButton };
