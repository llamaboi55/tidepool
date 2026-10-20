import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SCENES, sceneSvg, sceneOfTheDay, sceneById } from '../src/js/scenes.js';

test('every scene renders deterministic, well-formed SVG', () => {
  const ids = new Set();
  for (const s of SCENES) {
    assert.ok(!ids.has(s.id), `duplicate id ${s.id}`);
    ids.add(s.id);
    const a = sceneSvg(s);
    assert.equal(a, sceneSvg(s), `${s.id} is not deterministic`);
    assert.match(a, /^<svg [^>]*viewBox="0 0 1920 1080"/);
    assert.ok(a.endsWith('</svg>'));
    assert.ok(!a.includes('NaN') && !a.includes('undefined'), `${s.id} has bad numbers`);
    assert.ok(a.length < 60000, `${s.id} is too large (${a.length})`);
  }
});

test('scene of the day cycles through scenes and unknown ids fall back', () => {
  const day = 86400000;
  const base = new Date(2026, 0, 1, 12);
  const seen = new Set(SCENES.map((_, i) => sceneOfTheDay(new Date(base.getTime() + i * day)).id));
  assert.equal(seen.size, SCENES.length);
  assert.equal(sceneById('nope').id, SCENES[0].id);
});
