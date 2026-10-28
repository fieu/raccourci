import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { runInNewContext } from 'node:vm';
import { setImmediate as nextTurn } from 'node:timers/promises';
import { Window } from 'happy-dom';

const directory = fileURLToPath(new URL('../../site/', import.meta.url));
const html = readFileSync(resolve(directory, 'index.html'), 'utf8');
const { version } = JSON.parse(readFileSync(new URL('../../package.json', import.meta.url), 'utf8'));

function setup() {
  const window = new Window({ url: 'https://fieu.github.io/raccourci/', settings: {
    disableCSSFileLoading: true, disableJavaScriptFileLoading: true,
  } });
  window.document.write(html);
  const scriptPath = window.document.querySelector('script[type="module"]').getAttribute('src');
  const script = readFileSync(resolve(directory, scriptPath), 'utf8');
  runInNewContext(script, {
    document: window.document,
    window,
    navigator: window.navigator,
    MutationObserver: window.MutationObserver,
    fetch: () => { throw new Error('Demo must not need external services'); },
  });
  const query = selector => window.document.querySelector(selector);
  const change = (selector, value, event = 'input') => {
    query(selector).value = value;
    query(selector).dispatchEvent(new window.Event(event, { bubbles: true }));
  };
  return { window, query, change };
}

test('built demo resolves fractions, presets and expressions using the bundled library', () => {
  const { query, change } = setup();
  assert.equal(query('#result').textContent, String((2 / 3) * 200));
  query('[data-example="max - 10"]').click();
  assert.equal(query('#expression').value, 'max - 10');
  assert.equal(query('#result').textContent, '190');
  assert.equal(query('[data-example="max - 10"]').getAttribute('aria-pressed'), 'true');
  change('#expression', 'half + quarter');
  assert.equal(query('#result').textContent, '150');
  change('#total', '400');
  assert.equal(query('#result').textContent, '300');
});

test('demo supports reference-free arithmetic, locale changes and invalid input', () => {
  const { query, change, window } = setup();
  change('#total', '');
  change('#expression', '100 - (5*3)');
  assert.equal(query('#result').textContent, '85');
  assert.match(query('#result-note').textContent, /Arithmetic mode/);
  change('#locale', 'de-DE', 'change');
  change('#expression', '1.234,5 + 0,5k');
  assert.equal(query('#result').textContent, '1734.5');
  change('#expression', '1/0');
  assert.equal(query('#result').textContent, 'Invalid expression');
  assert.equal(query('#expression').getAttribute('aria-invalid'), 'true');
  change('#expression', '');
  assert.equal(query('#result').textContent, '—');
  change('#expression', 'half');
  change('#total', '-1');
  assert.equal(query('#total').getAttribute('aria-invalid'), 'true');
  assert.match(query('#result-note').textContent, /nonnegative/);
  const submit = new window.Event('submit', { bubbles: true, cancelable: true });
  query('#demo-form').dispatchEvent(submit);
  assert.equal(submit.defaultPrevented, true);
});

test('copy controls copy the real install command and handle clipboard denial', async () => {
  const { query, window } = setup();
  let copied;
  Object.defineProperty(window.navigator, 'clipboard', { configurable: true, value: {
    async writeText(text) { copied = text; },
  } });
  query('[data-copy="install-command"]').click();
  await nextTurn();
  assert.equal(copied, `npm install ./raccourci-${version}.tgz`);
  assert.match(query('#copy-status').textContent, /Copied/);
  Object.defineProperty(window.navigator, 'clipboard', { configurable: true, value: {
    async writeText() { throw new Error('denied'); },
  } });
  query('[data-copy="esm-example"]').click();
  await nextTurn();
  assert.match(query('#copy-status').textContent, /selected/);
});

test('install downloads and relative assets exist for the GitHub Pages project path', () => {
  const { query, window } = setup();
  const download = query('#package-download');
  assert.equal(download.href, `https://fieu.github.io/raccourci/raccourci-${version}.tgz`);
  assert.ok(existsSync(resolve(directory, `raccourci-${version}.tgz`)));
  assert.ok(existsSync(resolve(directory, 'raccourci.umd.js')));
  assert.ok(existsSync(resolve(directory, '.nojekyll')));
  assert.ok(existsSync(resolve(directory, 'LICENSE')));
  for (const tag of window.document.querySelectorAll('script[src], link[rel="stylesheet"]')) {
    const path = tag.getAttribute('src') ?? tag.getAttribute('href');
    assert.ok(path.startsWith('./'), `asset should be relative: ${path}`);
    assert.ok(existsSync(resolve(directory, path)), path);
  }
  const context = {};
  runInNewContext(readFileSync(resolve(directory, 'raccourci.umd.js'), 'utf8'), context);
  assert.equal(context.Raccourci.resolveAmount('half', 200), 100);
});
