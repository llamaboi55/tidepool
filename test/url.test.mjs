import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalizeUrl, resolveQuery, titleFromUrl, hueFor } from '../src/js/url.js';

test('normalizeUrl adds https and rejects unsafe schemes', () => {
  assert.equal(normalizeUrl('github.com'), 'https://github.com/');
  assert.equal(normalizeUrl(' http://example.org/a?b=1 '), 'http://example.org/a?b=1');
  assert.equal(normalizeUrl('javascript:alert(1)'), null);
  assert.equal(normalizeUrl('data:text/html,hi'), null);
  assert.equal(normalizeUrl('file:///etc/passwd'), null);
  assert.equal(normalizeUrl('not a url'), null);
  assert.equal(normalizeUrl(''), null);
  assert.equal(normalizeUrl('localhost:3000'), 'https://localhost:3000/');
});

test('resolveQuery searches, opens addresses and understands bangs', () => {
  assert.equal(resolveQuery('hello world', 'duckduckgo'), 'https://duckduckgo.com/?q=hello%20world');
  assert.equal(resolveQuery('cats', 'google'), 'https://www.google.com/search?q=cats');
  assert.equal(resolveQuery('example.com'), 'https://example.com/');
  assert.equal(resolveQuery('https://example.com/x'), 'https://example.com/x');
  assert.equal(resolveQuery('!yt lofi beats'), 'https://www.youtube.com/results?search_query=lofi%20beats');
  assert.equal(resolveQuery('lofi beats !yt'), 'https://www.youtube.com/results?search_query=lofi%20beats');
  assert.equal(resolveQuery('!gh'), 'https://github.com');
  assert.equal(resolveQuery('!nope test', 'duckduckgo'), 'https://duckduckgo.com/?q=!nope%20test');
  assert.equal(resolveQuery('q', 'custom', 'https://s.example/?k=%s'), 'https://s.example/?k=q');
  assert.equal(resolveQuery('   '), null);
  assert.equal(resolveQuery('version 2.0 notes', 'duckduckgo'), 'https://duckduckgo.com/?q=version%202.0%20notes');
});

test('titleFromUrl and hueFor are stable', () => {
  assert.equal(titleFromUrl('https://www.github.com/x'), 'Github');
  assert.equal(titleFromUrl('nonsense'), 'Link');
  assert.equal(hueFor('github.com'), hueFor('github.com'));
  assert.ok(hueFor('a') >= 0 && hueFor('a') < 360);
});
