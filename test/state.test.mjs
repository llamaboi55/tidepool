import { test } from 'node:test';
import assert from 'node:assert/strict';

// state.js imports the DOM helper for ids/toasts; stub the tiny bit of DOM it touches.
globalThis.document = { getElementById: () => null };
const { migrate, defaults } = await import('../src/js/state.js');

test('migrate keeps user data and fills new fields', () => {
  const out = migrate({ settings: { name: 'Sam', widgets: { notes: false } }, tasks: [{ id: 'a', text: 'x', done: false }] });
  assert.equal(out.settings.name, 'Sam');
  assert.equal(out.settings.widgets.notes, false);
  assert.equal(out.settings.widgets.tasks, true);
  assert.equal(out.tasks.length, 1);
  assert.ok(Array.isArray(out.dock));
});

test('migrate repairs a broken layout so every card appears exactly once', () => {
  const out = migrate({ settings: { layout: { left: ['clock', 'clock', 'bogus'], right: 'oops', board: ['tasks'] } } });
  const all = [...out.settings.layout.left, ...out.settings.layout.right, ...out.settings.layout.board];
  const expected = Object.values(defaults().settings.layout).flat();
  assert.deepEqual([...all].sort(), [...expected].sort());
  assert.deepEqual(out.settings.layout.left.slice(0, 1), ['clock']);
});
