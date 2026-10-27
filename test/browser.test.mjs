import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { Window } from 'happy-dom';

const source = readFileSync(new URL('../dist/umd/index.js', import.meta.url), 'utf8');

function setup(attributes = {}) {
  const window = new Window();
  const context = { document: window.document };
  runInNewContext(source, context);
  const input = window.document.createElement('input');
  window.document.body.append(input);
  for (const [name, value] of Object.entries(attributes)) input.setAttribute(`data-resolve-${name}`, value);
  const blur = () => input.dispatchEvent(new window.Event('focusout', { bubbles: true }));
  const enter = (isComposing = false) => input.dispatchEvent(new window.KeyboardEvent('keydown', {
    key: 'Enter', bubbles: true, isComposing, cancelable: true,
  }));
  const events = [];
  window.document.addEventListener('amountresolved', event => events.push(event));
  return { window, context, input, blur, enter, events };
}

test('defaults: no initialization, four decimals, blur/Enter and IME handling', () => {
  const { input, blur, enter, window } = setup({ amount: '200' });
  input.value = '2/3';
  input.dispatchEvent(new window.Event('input', { bubbles: true }));
  assert.equal(input.value, '2/3');
  blur();
  assert.equal(input.value, '133.3333');
  input.value = 'half';
  enter(true);
  assert.equal(input.value, 'half');
  enter();
  assert.equal(input.value, '100');
});

test('automatic inputs retain all shorthand and expression families', () => {
  const { input, blur, enter } = setup({ amount: '200' });
  for (const [text, expected] of [
    ['max-10', '190'], ['2.5k', '2500'], ['quarter+10%', '70'], ['⅝', '125'],
    ['twice', '400'], ['none', '0'], ['third', '66.6667'], ['-1/6', '-33.3333'],
    ['2k/4k', '100'], ['100-(5*3)', '85'],
  ]) {
    input.value = text;
    enter();
    assert.equal(input.value, expected, text);
    blur();
    assert.equal(input.value, expected, 'Enter then blur stays stable');
  }
});

test('inputs present before loading, dynamic inputs and changing/removing totals', () => {
  const window = new Window();
  window.document.body.innerHTML = '<input data-resolve-amount="200"><input data-resolve-amount="400">';
  runInNewContext(source, { document: window.document });
  const [first, second] = window.document.querySelectorAll('input');
  for (const input of [first, second]) {
    input.value = 'half';
    input.dispatchEvent(new window.Event('focusout', { bubbles: true }));
  }
  assert.equal(first.value, '100');
  assert.equal(second.value, '200');
  first.removeAttribute('data-resolve-amount');
  first.value = 'half';
  first.dispatchEvent(new window.Event('focusout', { bubbles: true }));
  assert.equal(first.value, 'half');
  second.setAttribute('data-resolve-amount', '80.25');
  second.value = 'max';
  second.dispatchEvent(new window.Event('focusout', { bubbles: true }));
  assert.equal(second.value, '80.25');
});

test('unmarked, disabled, read-only and other input types are untouched', () => {
  const { input, blur, events } = setup();
  input.value = 'half';
  blur();
  assert.equal(input.value, 'half');
  input.setAttribute('data-resolve-amount', '200');
  for (const property of ['disabled', 'readOnly']) {
    input[property] = true;
    blur();
    assert.equal(input.value, 'half');
    input[property] = false;
  }
  for (const type of ['search', 'password', 'hidden']) {
    input.type = type;
    input.value = 'half';
    blur();
    assert.equal(input.value, 'half');
  }
  assert.equal(events.length, 0);
});

test('invalid attributes and invalid input never change text or emit an event', () => {
  const { input, blur, events } = setup();
  for (const attribute of ['', ' ', 'abc', '-1', 'Infinity', '2k', 'max', '1/2', '50%', '0x10', '1e2', '9'.repeat(400)]) {
    input.setAttribute('data-resolve-amount', attribute);
    input.value = 'half';
    blur();
    assert.equal(input.value, 'half', attribute);
  }
  input.setAttribute('data-resolve-amount', '200');
  for (const text of ['', '1/0', '1/', '100-']) {
    input.value = text;
    blur();
    assert.equal(input.value, text);
  }
  assert.equal(events.length, 0);
});

test('reloading UMD installs once and never emits synthetic input/change events', () => {
  const { input, enter, window, context } = setup({ amount: '200' });
  let resolutions = 0, synthetic = 0;
  const countCalls = api => {
    const resolve = api.resolveAmount;
    api.resolveAmount = (...args) => { resolutions++; return resolve(...args); };
  };
  countCalls(context.Raccourci);
  runInNewContext(source, context);
  countCalls(context.Raccourci);
  input.addEventListener('change', () => synthetic++);
  input.addEventListener('input', () => synthetic++);
  input.value = 'half';
  enter();
  assert.equal(input.value, '100');
  assert.equal(resolutions, 1);
  assert.equal(synthetic, 0);
  const event = new window.KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true });
  input.dispatchEvent(event);
  assert.equal(event.defaultPrevented, false);
});

test('precision zero through twenty is configurable and strips trailing zeros', () => {
  const { input, blur } = setup({ amount: '200' });
  for (const [precision, expected] of [['0', '133'], ['2', '133.33'], ['6', '133.333333'], ['20', String(Number(((2 / 3) * 200).toFixed(20)))]]) {
    input.setAttribute('data-resolve-precision', precision);
    input.value = '2/3';
    blur();
    assert.equal(input.value, expected);
  }
  input.value = 'half';
  blur();
  assert.equal(input.value, '100');
  input.removeAttribute('data-resolve-precision');
  input.value = '2/3';
  blur();
  assert.equal(input.value, '133.3333');
});

test('integer rounding precedes precision and can change at runtime', () => {
  const { input, blur } = setup({ amount: '200', precision: '2' });
  for (const [rounding, expected] of [['floor', '133'], ['ceil', '134'], ['round', '133'], ['trunc', '133'], ['none', '133.33']]) {
    input.setAttribute('data-resolve-rounding', rounding);
    input.value = '2/3';
    blur();
    assert.equal(input.value, expected);
  }
  input.setAttribute('data-resolve-rounding', 'floor');
  input.value = '-2/3';
  blur();
  assert.equal(input.value, '-134');
});

test('invalid precision, rounding and locale configuration leaves input untouched', () => {
  const { input, blur, events } = setup({ amount: '200' });
  for (const [name, values] of [
    ['precision', ['', ' ', '-1', '21', '100', '1.5', 'foo', 'Infinity']],
    ['rounding', ['', 'FLOOR', 'random', '__proto__']],
    ['locale', ['', 'not_a_locale', 'zz-ZZ']],
  ]) {
    for (const value of values) {
      input.setAttribute(`data-resolve-${name}`, value);
      input.value = 'half';
      blur();
      assert.equal(input.value, 'half', `${name}=${value}`);
    }
    input.removeAttribute(`data-resolve-${name}`);
  }
  assert.equal(events.length, 0);
});

test('locale parses and formats automatic values, with stable Enter then blur', () => {
  const { input, enter, blur, events } = setup({ amount: '200', locale: 'de-DE', precision: '2' });
  input.value = '2/3';
  enter();
  assert.equal(input.value, '133,33');
  assert.equal(events.length, 1);
  blur();
  assert.equal(input.value, '133,33');
  assert.equal(events.length, 1);
  input.value = '1.234,5 + half';
  blur();
  assert.equal(input.value, '1334,5', 'localized output is ungrouped');
  input.setAttribute('data-resolve-locale', 'en-US');
  input.value = '2/3';
  blur();
  assert.equal(input.value, '133.33');
});

test('native-digit output is valid input on the next commit', () => {
  for (const locale of ['ar-EG', 'fa-IR', 'en-US-u-nu-mathbold']) {
    const { input, blur, events } = setup({ amount: '200', locale, precision: '2' });
    input.value = '-2/3';
    blur();
    const formatted = (-133.33).toLocaleString(locale, { useGrouping: false, maximumFractionDigits: 2 });
    assert.equal(input.value, formatted, locale);
    assert.equal(events.length, 1);
    blur();
    assert.equal(input.value, formatted);
    assert.equal(events.length, 1);
  }
});

test('HTML totals stay canonical decimal numbers even with a selected locale', () => {
  const { input, blur } = setup({ amount: '1.500', locale: 'de-DE' });
  input.value = 'max';
  blur();
  assert.equal(input.value, '1,5', 'machine attribute 1.500 means 1.5');
  input.setAttribute('data-resolve-amount', '1,500');
  input.value = 'half';
  blur();
  assert.equal(input.value, 'half', 'localized totals are not accepted in machine attributes');
});

test('amountresolved bubbles after replacement with original, formatted and numeric values', () => {
  const { input, enter, events, window } = setup({ amount: '200', precision: '2' });
  let valueAtDispatch;
  window.document.addEventListener('amountresolved', () => { valueAtDispatch = input.value; });
  input.value = '2/3';
  enter();
  assert.equal(events.length, 1);
  const event = events[0];
  assert.ok(event instanceof window.CustomEvent);
  assert.equal(event.target, input);
  assert.equal(event.bubbles, true);
  assert.equal(event.composed, true);
  assert.equal(event.cancelable, false);
  assert.equal(valueAtDispatch, '133.33');
  assert.deepEqual({ ...event.detail }, { originalValue: '2/3', value: '133.33', amount: (2 / 3) * 200, total: 200 });
});

test('events report integer rounding but retain full precision before display formatting', () => {
  const { input, blur, events } = setup({ amount: '200', locale: 'de-DE', precision: '2', rounding: 'ceil' });
  input.value = '2/3';
  blur();
  assert.deepEqual({ ...events[0].detail }, { originalValue: '2/3', value: '134', amount: 134, total: 200 });
  input.setAttribute('data-resolve-rounding', 'none');
  input.value = 'none';
  blur();
  assert.equal(events[1].detail.amount, 0, 'zero emits a valid resolution');
});

test('no event on unchanged text, Enter followed by blur, invalid input or unrelated keys', () => {
  const { input, enter, blur, events, window } = setup({ amount: '200' });
  input.value = '100';
  enter(); blur();
  assert.equal(events.length, 0);
  input.value = 'half';
  input.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
  assert.equal(input.value, 'half');
  enter(); blur();
  assert.equal(events.length, 1);
  input.value = '1/0';
  enter(); blur();
  assert.equal(events.length, 1);
});

test('display precision never leaves negative zero in default or locale output', () => {
  for (const locale of [undefined, 'de-DE', 'ar-EG']) {
    const { input, blur } = setup({ amount: '200', precision: '0', ...(locale ? { locale } : {}) });
    input.value = '-0';
    blur();
    assert.equal(input.value, locale ? (0).toLocaleString(locale) : '0');
  }
});
