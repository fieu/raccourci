import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resolveAmount as resolve } from '../dist/esm/index.js';

const parse = (input, locale, total) => resolve(input, total, { locale });

test('locale is opt-in and never inferred from the runtime', () => {
  for (const input of ['1,234.5', '1,5', '1 234,5', '١٢٣']) assert.equal(resolve(input), null);
  assert.equal(resolve('1.5'), 1.5);
  assert.equal(resolve(1.5, undefined, { locale: 'de-DE' }), 1.5, 'numeric arguments are not localized text');
});

for (const [locale, cases] of [
  ['en-US', [['1,234.50', 1234.5], ['1,234.5 + .5k', 1734.5], ['.5', .5], ['1.', 1]]],
  ['de-DE', [['1.234,50', 1234.5], ['1,5k', 1500], ['1.234,5 + 0,5k', 1734.5], [',5', .5], ['1,', 1]]],
  ['fr-FR', [['1 234,50', 1234.5], ['1\u00a0234,5', 1234.5], ['1\u202f234,5', 1234.5], ['1,5 k + 10', 1510]]],
  ['hi-IN', [['1,23,456.75', 123456.75], ['12,34,56,789', 123456789], ['1,234', 1234]]],
  ['de-CH', [['1’234.5', 1234.5]]],
  ['ar-EG', [['١٬٢٣٤٫٥', 1234.5], ['١٫٥k', 1500], ['\u061c-١٫٥', -1.5], ['123', 123]]],
  ['fa-IR', [['۱۲۳٫۵', 123.5], ['\u200e−۱۲۳٫۵', -123.5]]],
  ['sv-SE', [['−1,5', -1.5], ['1\u00a0234,5', 1234.5]]],
  ['en-US-u-nu-fullwide', [['１２３.５', 123.5]]],
  ['en-US-u-nu-mathbold', [['𝟏𝟐𝟑.𝟓', 123.5]]],
]) test(`parses explicit ${locale} separators, digits and signs`, () => {
  for (const [input, expected] of cases) assert.equal(parse(input, locale), expected, input);
});

test('locale normalization applies to fractions, percentages, words and rounding', () => {
  assert.equal(parse('1,5/3', 'de-DE', 200), 100);
  assert.equal(parse('50,5%', 'de-DE', 200), 101);
  assert.equal(parse('١٫٥/٣', 'ar-EG', 200), 100);
  assert.equal(parse('٥٠٪', 'ar-EG', 200), 100);
  assert.equal(parse('١٬٠٠٠ + half', 'ar-EG', 200), 1100);
  assert.equal(parse('1.000,5 + half', 'de-DE', 200), 1100.5);
  assert.equal(parse('1,5k/3k', 'de-DE', 200), 100);
  assert.equal(resolve('1,5 + half', 5, { locale: 'de-DE', rounding: 'floor' }), 4);
  assert.equal(parse('⅝ + 0,5', 'de-DE', 200), 125.5);
});

test('grouping is validated before separators are removed', () => {
  for (const [locale, invalid] of [
    ['en-US', ['1,5', '1,,234', ',123', '1,234,', '1234,567', '12,34,567', '1,234.5,6', '1.234,5', '1 234']],
    ['de-DE', ['1.5', '1..234', '.123', '1.234.', '1,234.5', '12.34.567', '1234.567']],
    ['fr-FR', ['1 2', '1  234', '1 234 56', '1,5 000', '1 ,5', '1 234 ,5', '1.5']],
    ['hi-IN', ['1,234,567', '123,456', '1,2,345', '1234,567']],
    ['ar-EG', ['١٬٢', '١٬٬٢٣٤', '١٫٢٫٣', '1.5']],
  ]) for (const input of invalid) assert.equal(parse(input, locale), null, `${locale}: ${input}`);
});

test('locale options fail cleanly for malformed and unsupported locales', () => {
  for (const locale of ['', 'not_a_locale', 'zz-ZZ', ' de-DE ', null, 5, {}, []]) {
    assert.equal(parse('100', locale), null, String(locale));
    assert.equal(resolve(100, undefined, { locale }), null, String(locale));
  }
  assert.equal(parse('1,5', 'de-DE'), 1.5, 'an invalid locale does not poison later parses');
});

test('locale parsing retains expression validation and length limits', () => {
  for (const input of ['1,5 +', '1,5;2', '$1,5', 'Math.random()', '1e3', '1,5/0', '1,5**2']) {
    assert.equal(parse(input, 'de-DE'), null, input);
  }
  assert.equal(parse('1' + ' '.repeat(4095) + '+1', 'fr-FR'), null);
  assert.equal(parse('('.repeat(65) + '1,5' + ')'.repeat(65), 'de-DE'), null);
});

test('localized formatting round-trips 1,000 numbers across ten locales', () => {
  const locales = ['en-US', 'de-DE', 'fr-FR', 'hi-IN', 'de-CH', 'ar-EG', 'fa-IR', 'sv-SE',
    'en-US-u-nu-fullwide', 'en-US-u-nu-mathbold'];
  for (const locale of locales) {
    const formatter = new Intl.NumberFormat(locale, { maximumFractionDigits: 3 });
    for (let i = 0; i < 100; i++) {
      const value = (i * 193787 - 9876543) / 8;
      assert.equal(parse(formatter.format(value), locale), value, `${locale}: ${formatter.format(value)}`);
    }
  }
});

test('cached locale metadata is bounded and evicted locales remain usable', () => {
  for (let i = 0; i < 40; i++) assert.equal(parse('1,234.5', `en-US-x-test-${i}`), 1234.5);
  assert.equal(parse('1.234,5', 'de-DE'), 1234.5);
});
