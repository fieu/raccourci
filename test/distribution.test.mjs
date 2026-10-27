import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';

const source = readFileSync(new URL('../dist/umd/index.js', import.meta.url), 'utf8');

test('UMD has just the Raccourci global and one runtime export without a DOM', () => {
  const context = {};
  runInNewContext(source, context);
  assert.deepEqual(Object.keys(context), ['Raccourci']);
  assert.deepEqual(Object.keys(context.Raccourci), ['resolveAmount']);
  assert.equal(context.Raccourci.resolveAmount('half', 100), 50);
});

test('AMD loads without creating a browser global', () => {
  const exports = {};
  const define = (dependencies, factory) => {
    assert.deepEqual(Array.from(dependencies), ['exports']);
    factory(exports);
  };
  define.amd = {};
  const context = { define };
  runInNewContext(source, context);
  assert.equal(context.Raccourci, undefined);
  assert.equal(exports.resolveAmount('full', 100), 100);
});

test('CJS, ESM and UMD agree on shorthands and locale parsing', async () => {
  const require = createRequire(import.meta.url);
  const esm = await import('../dist/esm/index.js');
  for (const api of [require('raccourci'), require('raccourci/umd')]) {
    for (const [input, total, options] of [
      ['max-1k', 2500, {}], ['25%+10', 200, {}], ['quarter+third', 360, {}],
      ['⅝', 200, {}], ['2m+.5k', undefined, {}], ['2k/4k', 200, {}], ['1kk', 200, {}],
      ['1.234,5 + half', 200, { locale: 'de-DE' }], ['١٫٥k', undefined, { locale: 'ar-EG' }],
    ]) assert.equal(api.resolveAmount(input, total, options), esm.resolveAmount(input, total, options), input);
  }
});

test('core ESM and CommonJS imports install no DOM listeners', async () => {
  const previous = Object.getOwnPropertyDescriptor(globalThis, 'document');
  Object.defineProperty(globalThis, 'document', { configurable: true, value: {
    addEventListener() { throw new Error('core must not attach listeners'); },
  } });
  try {
    const esm = await import('../dist/esm/index.js?dom-independence');
    const require = createRequire(import.meta.url);
    delete require.cache[require.resolve('raccourci')];
    const cjs = require('raccourci');
    assert.equal(esm.resolveAmount('max-10', 200), 190);
    assert.equal(cjs.resolveAmount('max-10', 200), 190);
  } finally {
    if (previous) Object.defineProperty(globalThis, 'document', previous);
    else delete globalThis.document;
  }
});

test('Intl is not needed for the default parser', () => {
  const context = { Intl: undefined };
  runInNewContext(source, context);
  assert.equal(context.Raccourci.resolveAmount('half+10', 200), 110);
  assert.equal(context.Raccourci.resolveAmount('1,5', 200, { locale: 'de-DE' }), null);
});

test('TypeScript resolves ESM, CommonJS, UMD and event detail types without DOM types', () => {
  for (const [files, module, moduleResolution] of [
    [['test/types/esm.mts', 'test/types/commonjs.cts'], ts.ModuleKind.NodeNext, ts.ModuleResolutionKind.NodeNext],
    [['test/types/global.ts'], ts.ModuleKind.None, ts.ModuleResolutionKind.Node10],
  ]) {
    const program = ts.createProgram(files, { noEmit: true, strict: true, module, moduleResolution,
      lib: ['lib.es2020.d.ts'], types: [] });
    const errors = ts.getPreEmitDiagnostics(program);
    assert.equal(errors.length, 0, ts.formatDiagnosticsWithColorAndContext(errors, {
      getCanonicalFileName: file => file, getCurrentDirectory: () => process.cwd(), getNewLine: () => '\n',
    }));
  }
});
