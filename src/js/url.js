// URL helpers shared by the dock, link groups and search. Pure functions (unit tested).

const SAFE_PROTOCOLS = new Set(['http:', 'https:']);

/** Turn user input like "github.com" into a safe absolute URL, or null if unsafe/invalid. */
export function normalizeUrl(input) {
  const raw = String(input ?? '').trim();
  if (!raw) return null;
  // "localhost:3000" has no scheme, "javascript:x" does; only "x://" or a known scheme counts.
  const hasScheme = /^[a-z][a-z0-9+.-]*:\/\//i.test(raw) || /^(javascript|data|file|vbscript|blob|about|mailto|chrome|edge):/i.test(raw);
  const withScheme = hasScheme ? raw : `https://${raw}`;
  let url;
  try {
    url = new URL(withScheme);
  } catch {
    return null;
  }
  if (!SAFE_PROTOCOLS.has(url.protocol)) return null;
  if (!url.hostname || (!url.hostname.includes('.') && url.hostname !== 'localhost')) return null;
  return url.href;
}

/** Short, readable title for a URL ("github.com/foo" -> "GitHub"-ish fallback). */
export function titleFromUrl(href) {
  try {
    const host = new URL(href).hostname.replace(/^www\./, '');
    const base = host.split('.').slice(-2, -1)[0] || host;
    return base.charAt(0).toUpperCase() + base.slice(1);
  } catch {
    return 'Link';
  }
}

export function hostOf(href) {
  try {
    return new URL(href).hostname.replace(/^www\./, '');
  } catch {
    return '';
  }
}

/** Stable pleasant hue for monogram tiles. */
export function hueFor(text) {
  let hash = 0;
  for (const ch of String(text)) hash = (hash * 31 + ch.codePointAt(0)) >>> 0;
  return hash % 360;
}

export const ENGINES = {
  duckduckgo: { name: 'DuckDuckGo', url: 'https://duckduckgo.com/?q=%s' },
  google: { name: 'Google', url: 'https://www.google.com/search?q=%s' },
  bing: { name: 'Bing', url: 'https://www.bing.com/search?q=%s' },
  brave: { name: 'Brave Search', url: 'https://search.brave.com/search?q=%s' },
  startpage: { name: 'Startpage', url: 'https://www.startpage.com/do/search?q=%s' },
  ecosia: { name: 'Ecosia', url: 'https://www.ecosia.org/search?q=%s' },
  kagi: { name: 'Kagi', url: 'https://kagi.com/search?q=%s' },
};

export const BANGS = {
  g: 'https://www.google.com/search?q=%s',
  d: 'https://duckduckgo.com/?q=%s',
  b: 'https://search.brave.com/search?q=%s',
  yt: 'https://www.youtube.com/results?search_query=%s',
  w: 'https://en.wikipedia.org/wiki/Special:Search?search=%s',
  gh: 'https://github.com/search?q=%s',
  r: 'https://www.reddit.com/search/?q=%s',
  m: 'https://www.google.com/maps/search/%s',
  a: 'https://www.amazon.com/s?k=%s',
};

/**
 * Resolve what the search box should open.
 * - "!yt lofi" or "lofi !yt" -> bang target
 * - "example.com" / "https://..." -> that URL
 * - anything else -> chosen engine (or a custom template containing %s)
 */
export function resolveQuery(input, engineKey = 'duckduckgo', customTemplate = '') {
  const q = String(input ?? '').trim();
  if (!q) return null;

  const bang = q.match(/(?:^|\s)!([a-z]+)(?=\s|$)/i);
  if (bang && BANGS[bang[1].toLowerCase()]) {
    const rest = q.replace(bang[0], ' ').trim();
    const template = BANGS[bang[1].toLowerCase()];
    if (!rest) return new URL(template.replace('%s', '')).origin;
    return template.replace('%s', encodeURIComponent(rest));
  }

  const looksLikeUrl = /^https?:\/\//i.test(q) || (/^[^\s]+\.[a-z]{2,}(\/\S*)?$/i.test(q) && !q.includes(' '));
  if (looksLikeUrl) {
    const url = normalizeUrl(q);
    if (url) return url;
  }

  const template = engineKey === 'custom' && customTemplate.includes('%s')
    ? customTemplate
    : (ENGINES[engineKey] || ENGINES.duckduckgo).url;
  return template.replace('%s', encodeURIComponent(q));
}
