// Tasks, notes and the focus timer.
import { h, icon, iconButton, uid } from '../h.js';
import { state, on, update } from '../state.js';
import { card } from '../ui.js';

export function tasks() {
  const input = h('input', { type: 'text', class: 'task-input', placeholder: 'Add a task and press Enter', 'aria-label': 'New task', maxlength: 200 });
  const list = h('ul', { class: 'task-list' });
  const count = h('span', { class: 'task-count muted small' });
  const clear = h('button', { type: 'button', class: 'link-btn small', onClick: () => update('tasks', (t) => t.filter((x) => !x.done)) }, 'Clear done');

  const render = () => {
    list.replaceChildren(...state.tasks.map((task, i) => {
      const box = h('input', { type: 'checkbox', checked: task.done, 'aria-label': task.text });
      box.addEventListener('change', () => update('tasks', (t) => { t[i].done = box.checked; }));
      const text = h('span', { class: 'task-text', contenteditable: 'plaintext-only', spellcheck: false }, task.text);
      text.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); text.blur(); } });
      text.addEventListener('blur', () => {
        const v = text.textContent.trim();
        if (!v) update('tasks', (t) => { t.splice(i, 1); });
        else if (v !== task.text) update('tasks', (t) => { t[i].text = v; });
      });
      return h('li', { class: task.done ? 'done' : '' },
        h('label', { class: 'task' }, box, h('i', { class: 'check', 'aria-hidden': 'true' })), text,
        iconButton('x', `Delete ${task.text}`, () => update('tasks', (t) => { t.splice(i, 1); }), { class: 'task-del' }));
    }));
    const open = state.tasks.filter((t) => !t.done).length;
    count.textContent = state.tasks.length ? `${open} open` : 'All clear';
    clear.hidden = !state.tasks.some((t) => t.done);
  };
  input.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter' || !input.value.trim()) return;
    update('tasks', (t) => { t.push({ id: uid(), text: input.value.trim(), done: false }); });
    input.value = '';
  });
  render();
  on('tasks', render);
  return card('tasks', 'Tasks', h('div', { class: 'tasks-body' }, input, list, h('footer', { class: 'task-foot' }, count, clear)));
}

export function notes() {
  const area = h('textarea', { class: 'notes-area', placeholder: 'Jot something down…', 'aria-label': 'Notes', spellcheck: true });
  const meta = h('p', { class: 'muted small notes-meta' });
  area.value = state.notes.text;
  const words = () => {
    const n = area.value.trim() ? area.value.trim().split(/\s+/).length : 0;
    meta.textContent = `${n} word${n === 1 ? '' : 's'} · saved`;
  };
  words();
  area.addEventListener('input', () => {
    update('notes', (n) => { n.text = area.value; });
    words();
  });
  on('notes', (n) => {
    if (document.activeElement !== area && area.value !== n.text) { area.value = n.text; words(); }
  });
  return card('notes', 'Notes', h('div', { class: 'notes-body' }, area, meta));
}

// The timer stores an absolute end time, so it keeps counting across tabs and restarts.
export function timer() {
  const ring = h('div', { class: 'timer-ring' });
  const readout = h('p', { class: 'timer-readout', role: 'timer', 'aria-live': 'off' });
  const label = h('p', { class: 'timer-label' });
  const sessions = h('p', { class: 'muted small timer-sessions' });
  const toggle = h('button', { type: 'button', class: 'btn primary timer-toggle' });
  const reset = iconButton('reset', 'Reset timer', () => update('timer', (t) => Object.assign(t, fresh(t, t.mode))));
  const skip = h('button', { type: 'button', class: 'link-btn small', onClick: () => update('timer', (t) => Object.assign(t, fresh(t, t.mode === 'focus' ? 'break' : 'focus'))) });

  const fresh = (t, mode) => ({ mode, running: false, endsAt: null, remaining: (mode === 'focus' ? t.focusMin : t.breakMin) * 60 });
  const left = (t) => (t.running && t.endsAt ? Math.max(0, Math.round((t.endsAt - Date.now()) / 1000)) : t.remaining);

  toggle.addEventListener('click', () => update('timer', (t) => {
    if (t.running) { t.remaining = left(t); t.running = false; t.endsAt = null; }
    else { t.running = true; t.endsAt = Date.now() + t.remaining * 1000; }
  }));

  let lastTitle = null;
  const render = () => {
    const t = state.timer;
    const secs = left(t);
    if (t.running && secs === 0) return finish();
    const total = (t.mode === 'focus' ? t.focusMin : t.breakMin) * 60;
    const mm = String(Math.floor(secs / 60)).padStart(2, '0');
    const ss = String(secs % 60).padStart(2, '0');
    readout.textContent = `${mm}:${ss}`;
    ring.style.setProperty('--p', `${(1 - secs / total) * 360}deg`);
    label.textContent = t.mode === 'focus' ? 'Focus' : 'Break';
    sessions.textContent = `${t.sessions} focus session${t.sessions === 1 ? '' : 's'} today`;
    toggle.replaceChildren(icon(t.running ? 'pause' : 'play'), t.running ? 'Pause' : 'Start');
    skip.textContent = t.mode === 'focus' ? 'Skip to break' : 'Skip to focus';
    el.classList.toggle('running', t.running);
    // Show the countdown in the tab title while running, so it's visible from other tabs.
    const title = t.running ? `${mm}:${ss} · ${label.textContent}` : 'New Tab';
    if (title !== lastTitle) { document.title = title; lastTitle = title; }
  };

  function finish() {
    const wasFocus = state.timer.mode === 'focus';
    chime();
    update('timer', (t) => Object.assign(t, fresh(t, wasFocus ? 'break' : 'focus'), { sessions: t.sessions + (wasFocus ? 1 : 0) }));
  }

  const el = card('timer', 'Focus timer', h('div', { class: 'timer-body' },
    h('div', { class: 'timer-dial' }, ring, h('div', { class: 'timer-center' }, readout, label)),
    h('div', { class: 'timer-controls' }, toggle, reset), skip, sessions));

  // Reset the session counter on a new day.
  const today = new Date().toDateString();
  if (state.timer.day !== today) update('timer', (t) => { t.day = today; t.sessions = 0; });

  render();
  on('timer', render);
  setInterval(() => { if (state.timer.running) render(); }, 500);
  return el;
}

// Soft two-note chime made with Web Audio (no audio files, no network).
function chime() {
  try {
    const ctx = new AudioContext();
    [[659.25, 0], [880, 0.18]].forEach(([freq, at]) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.0001, ctx.currentTime + at);
      gain.gain.exponentialRampToValueAtTime(0.18, ctx.currentTime + at + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + at + 1.4);
      osc.connect(gain).connect(ctx.destination);
      osc.start(ctx.currentTime + at);
      osc.stop(ctx.currentTime + at + 1.5);
    });
    setTimeout(() => ctx.close(), 2200);
  } catch { /* audio blocked: silent finish */ }
}
