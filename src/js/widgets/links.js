// Search box, favorites dock and link groups.
import { h, icon, iconButton, toast, uid } from '../h.js';
import { state, on, update } from '../state.js';
import { card, openDialog, siteIcon } from '../ui.js';
import { ENGINES, BANGS, normalizeUrl, resolveQuery, titleFromUrl } from '../url.js';

function go(url, newTab) {
  if (newTab) window.open(url, '_blank', 'noopener');
  else window.location.assign(url);
}

function linkDialog({ title, item, onSave, onDelete }) {
  openDialog({
    title,
    fields: [
      { name: 'url', label: 'Address', value: item?.url || '', placeholder: 'example.com', required: true },
      { name: 'title', label: 'Name (optional)', value: item?.title || '', placeholder: 'Example' },
    ],
    onSubmit: ({ url, title: name }) => {
      const href = normalizeUrl(url);
      if (!href) return 'That address does not look right. Only http and https links are allowed.';
      onSave({ id: item?.id || uid(), url: href, title: name.trim() || titleFromUrl(href) });
      return null;
    },
    onDelete,
  });
}

// ---- Search -------------------------------------------------------------------------

export function search() {
  const input = h('input', {
    type: 'search', id: 'search', name: 'q', autocomplete: 'off', spellcheck: false,
    'aria-label': 'Search the web or type an address', enterkeyhint: 'search',
  });
  const engineBtn = h('button', { type: 'button', class: 'engine-btn', title: 'Search engine (click to switch)' });
  const hint = h('p', { class: 'search-hint', 'aria-live': 'polite' });

  const render = () => {
    const { engine } = state.settings;
    const name = engine === 'custom' ? 'Custom' : (ENGINES[engine] || ENGINES.duckduckgo).name;
    engineBtn.textContent = name;
    input.placeholder = `Search with ${name} or type an address`;
  };
  render();
  on('settings', render);

  engineBtn.addEventListener('click', () => {
    const keys = Object.keys(ENGINES);
    const next = keys[(keys.indexOf(state.settings.engine) + 1) % keys.length];
    update('settings', (s) => { s.engine = next; });
    toast(`Searching with ${ENGINES[next].name}`);
    input.focus();
  });

  input.addEventListener('input', () => {
    const m = input.value.match(/(?:^|\s)!([a-z]+)$/i);
    hint.textContent = m && BANGS[m[1].toLowerCase()] ? `!${m[1]} → ${new URL(BANGS[m[1].toLowerCase()].replace('%s', '')).hostname.replace(/^www\./, '')}` : '';
  });

  const form = h('form', { class: 'search glass', role: 'search' },
    h('span', { class: 'search-icon', 'aria-hidden': 'true' }, searchGlyph()),
    input, engineBtn);
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const url = resolveQuery(input.value, state.settings.engine, state.settings.customEngine);
    if (url) go(url, state.settings.openInNewTab || e.submitter?.dataset.newtab);
  });
  return h('div', { class: 'search-wrap', dataset: { widget: 'search' } }, form, hint);
}

function searchGlyph() {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  path.setAttribute('d', 'M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14zM20 20l-4-4');
  svg.append(path);
  return svg;
}

// ---- Favorites dock ---------------------------------------------------------------------

export function dock() {
  const list = h('ul', { class: 'dock glass', role: 'list', 'aria-label': 'Favorites' });
  const render = () => {
    const items = state.dock.map((item, i) => {
      const a = h('a', { href: item.url, class: 'dock-item', title: item.title, draggable: 'false' },
        siteIcon(item.url, item.title, 'lg'), h('span', { class: 'dock-label' }, item.title));
      a.addEventListener('click', (e) => {
        if (!document.body.classList.contains('editing')) return;
        e.preventDefault();
        linkDialog({
          title: 'Edit favorite', item,
          onSave: (next) => update('dock', (d) => { d[i] = next; }),
          onDelete: () => update('dock', (d) => { d.splice(i, 1); }),
        });
      });
      return h('li', { dataset: { index: i } }, a);
    });
    const add = h('li', { class: 'dock-add' }, h('button', {
      type: 'button', class: 'dock-item', title: 'Add favorite',
      onClick: () => linkDialog({ title: 'Add favorite', onSave: (item) => update('dock', (d) => { d.push(item); }) }),
    }, h('span', { class: 'site-icon lg add' }, icon('plus')), h('span', { class: 'dock-label' }, 'Add')));
    list.replaceChildren(...items, add);
    enableReorder(list, 'dock');
  };
  render();
  on('dock', render);
  on('settings', render);
  document.addEventListener('tidepool:editing', render);
  return h('nav', { class: 'dock-wrap', dataset: { widget: 'dock' }, 'aria-label': 'Favorites' }, list);
}

/** Drag to reorder items of an array-valued state key (edit mode only). */
function enableReorder(listEl, key, groupIndex = null) {
  let from = null;
  listEl.querySelectorAll('li[data-index]').forEach((li) => {
    li.draggable = document.body.classList.contains('editing');
    li.addEventListener('dragstart', (e) => {
      from = Number(li.dataset.index);
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/x-tidepool-item', String(from));
      e.stopPropagation();
    });
    li.addEventListener('dragover', (e) => {
      if (from == null) return;
      e.preventDefault();
      e.stopPropagation();
    });
    li.addEventListener('drop', (e) => {
      if (from == null) return;
      e.preventDefault();
      e.stopPropagation();
      const to = Number(li.dataset.index);
      update(key, (arr) => {
        const list = groupIndex == null ? arr : arr[groupIndex].links;
        const [moved] = list.splice(from, 1);
        list.splice(to, 0, moved);
      });
      from = null;
    });
    li.addEventListener('dragend', () => { from = null; });
  });
}

// ---- Link groups (unlimited, free) ----------------------------------------------------

export function groups() {
  const body = h('div', { class: 'groups' });
  const addGroup = iconButton('plus', 'Add group', () => openDialog({
    title: 'New group',
    fields: [{ name: 'title', label: 'Group name', placeholder: 'Work, Class, Recipes…', required: true }],
    onSubmit: ({ title }) => {
      update('groups', (g) => { g.push({ id: uid(), title: title.trim() || 'Untitled', links: [] }); });
      return null;
    },
  }));

  const render = () => {
    if (!state.groups.length) {
      body.replaceChildren(h('p', { class: 'muted empty' }, 'No groups yet. Turn on edit mode and press + to add one.'));
      return;
    }
    body.replaceChildren(...state.groups.map((group, gi) => {
      const links = h('ul', { class: 'group-links' }, group.links.map((item, li) => {
        const a = h('a', { href: item.url, class: 'group-link', title: item.url }, siteIcon(item.url, item.title, 'sm'), h('span', {}, item.title));
        a.addEventListener('click', (e) => {
          if (!document.body.classList.contains('editing')) return;
          e.preventDefault();
          linkDialog({
            title: 'Edit link', item,
            onSave: (next) => update('groups', (g) => { g[gi].links[li] = next; }),
            onDelete: () => update('groups', (g) => { g[gi].links.splice(li, 1); }),
          });
        });
        return h('li', { dataset: { index: li } }, a);
      }));
      enableReorder(links, 'groups', gi);
      const openAll = iconButton('open', `Open all ${group.links.length} links in ${group.title}`, () => {
        if (!group.links.length) return;
        group.links.forEach((l) => window.open(l.url, '_blank', 'noopener'));
      }, { class: 'view-only' });
      const add = iconButton('plus', `Add link to ${group.title}`, () => linkDialog({
        title: `Add link to ${group.title}`,
        onSave: (item) => update('groups', (g) => { g[gi].links.push(item); }),
      }), { class: 'edit-only' });
      const rename = iconButton('edit', `Rename ${group.title}`, () => openDialog({
        title: 'Rename group',
        fields: [{ name: 'title', label: 'Group name', value: group.title, required: true }],
        onSubmit: ({ title }) => { update('groups', (g) => { g[gi].title = title.trim() || g[gi].title; }); return null; },
        onDelete: () => update('groups', (g) => { g.splice(gi, 1); }),
      }), { class: 'edit-only' });
      return h('section', { class: 'group' },
        h('header', { class: 'group-head' }, h('h3', {}, group.title), h('span', { class: 'group-actions' }, openAll, add, rename)),
        group.links.length ? links : h('p', { class: 'muted small' }, 'Empty. Edit mode → + adds a link.'));
    }));
  };
  render();
  on('groups', render);
  on('settings', render);
  document.addEventListener('tidepool:editing', render);
  return card('groups', 'Link groups', body, [h('span', { class: 'edit-only' }, addGroup)]);
}
