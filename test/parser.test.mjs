import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resolveAmount as resolve } from '../dist/esm/index.js';

function close(actual, expected, label) {
  assert.notEqual(actual, null, label);
  assert.ok(Number.isFinite(actual), label);
  assert.ok(Math.abs(actual - expected) <= 1e-12 * Math.max(1, Math.abs(expected)), `${label}: ${actual} != ${expected}`);
}

test('original fractions, percentages, ordinary numbers and whitespace', () => {
  for (const [input, total, expected] of [
    ['1/2', 100, 50], ['50%', 100, 50], [' 1 / 4 ', 200, 50], ['12.5 %', 80, 10],
    ['.5', 100, .5], ['42', 100, 42], [42, 100, 42], ['150%', 100, 150],
    ['-50%', 100, -50], ['1/2', 0, 0], ['-0', 100, 0], ['1.5/3', 100, 50],
  ]) assert.equal(resolve(input, total), expected, String(input));
});

const words = [
  ['all', 360], ['full', 360], ['max', 360], ['maximum', 360], ['total', 360],
  ['half', 180], ['third', 120], ['quarter', 90], ['fourth', 90], ['fifth', 72],
  ['sixth', 60], ['seventh', 360 / 7], ['eighth', 45], ['ninth', 40], ['tenth', 36],
  ['double', 720], ['twice', 720], ['triple', 1080], ['thrice', 1080], ['none', 0], ['zero', 0],
];

test('all word aliases, case, whitespace, signs, zero and required reference', () => {
  for (const [word, expected] of words) {
    for (const spelling of [word, word.toUpperCase(), ` \t${word}\n `]) close(resolve(spelling, 360), expected, spelling);
    close(resolve(`-${word}`, 360), -expected, word);
    assert.equal(resolve(word, 0), 0, word);
    assert.equal(resolve(word), null, word);
    assert.equal(resolve(`${word}%`, 360), null, word);
    assert.equal(resolve(`${word}k`, 360), null, word);
  }
});

test('all Unicode fractions work standalone and in expressions', () => {
  for (const [symbol, ratio] of [['½', .5], ['⅓', 1 / 3], ['⅔', 2 / 3], ['¼', .25], ['¾', .75],
    ['⅛', .125], ['⅜', .375], ['⅝', .625], ['⅞', .875]]) {
    close(resolve(symbol), ratio, symbol);
    close(resolve(symbol, 360), ratio * 360, symbol);
    close(resolve(`-${symbol}`, 360), -ratio * 360, symbol);
    close(resolve(`${symbol} + 10`, 360), ratio * 360 + 10, symbol);
    assert.equal(resolve(symbol, 0), 0);
    assert.equal(resolve(`1${symbol}`, 360), null);
  }
});

test('magnitude suffixes with decimals, signs, case, spacing and both modes', () => {
  for (const [suffix, factor] of [['k', 1e3], ['m', 1e6], ['b', 1e9], ['t', 1e12]]) {
    for (const total of [undefined, 0, 360]) {
      for (const [input, expected] of [
        [`1${suffix}`, factor], [`2.5${suffix.toUpperCase()}`, 2.5 * factor],
        [`-.5 ${suffix}`, -.5 * factor], [`+1. ${suffix}`, factor],
        [`1${suffix} + 2${suffix}`, 3 * factor], [`(1${suffix} + 2) * 3`, (factor + 2) * 3],
      ]) close(resolve(input, total), expected, input);
    }
  }
  assert.equal(resolve('1k/2k', 360), 180);
  assert.equal(resolve('1k/2k'), .5);
  assert.equal(resolve('2.5k%'), 25);
  assert.equal(resolve('2.5k%', 360), 9000);
});

test('arithmetic precedence, associativity, parentheses and unary signs', () => {
  for (const [input, expected] of [
    ['100 - (5*3)', 85], ['2 + 3 * 4', 14], ['(2 + 3) * 4', 20], ['8/4/2', 1],
    ['10-3-2', 5], ['-(2+3)*-2', 10], ['1--2', 3], ['-.5+2.5', 2], ['2/3', 2 / 3],
    ['42', 42], [42, 42], ['-0', 0], ['((1+2)*(4-1))', 9],
  ]) assert.equal(resolve(input), expected, String(input));
});

test('relative expression semantics and standalone fraction compatibility', () => {
  for (const [input, expected] of [
    ['all - 10', 190], ['max - 10', 190], ['half + 5', 105], ['25% + 10', 60],
    ['all/2', 100], ['half/2', 50], ['all*.5', 100], ['(all-10)/2', 95],
    ['25%+25%', 100], ['25%*2+10', 110], ['half+quarter', 150], ['2k-max', 1800],
    ['double-half', 300], ['none+10', 10], ['-(all-half)', -100], ['all--half', 300],
    ['100-(5*3)', 85], ['1/2', 100], ['-1/2', -100], ['1/2+10', 10.5], ['(1/2)', .5],
    ['1/2/3', 1 / 6], ['all*(1/2)', 100], ['50%/2', 50], ['1+2', 3],
  ]) close(resolve(input, 200), expected, input);
});

test('percentage atoms have consistent meanings with and without a total', () => {
  for (const [input, expected] of [['50%', .5], ['100*50%', 50], ['25%+25%', .5],
    ['-12.5%', -.125], ['50%/2', .25]]) close(resolve(input), expected, input);
  assert.equal(resolve('all*50%', 200), 20000);
  assert.equal(resolve('1k+10%', 200), 1020);
});

test('all rounding modes apply only after the full formula', () => {
  for (const [rounding, positive, negative] of [
    ['none', 2.5, -2.5], ['floor', 2, -3], ['ceil', 3, -2], ['round', 3, -2], ['trunc', 2, -2],
  ]) {
    assert.equal(resolve('half+quarter', 10 / 3, { rounding }), positive);
    assert.equal(resolve('-(half+quarter)', 10 / 3, { rounding }), negative);
  }
  assert.equal(resolve('10/3+10/3', undefined, { rounding: 'floor' }), 6);
  for (const input of ['-0', '-none', '-half+half']) assert.ok(Object.is(resolve(input, 200), 0));
  for (const rounding of ['', 'constructor', '__proto__', 'random', 'ROUND']) assert.equal(resolve('half', 200, { rounding }), null);
});

test('rejects unknown tokens, incomplete expressions and unsupported notation', () => {
  for (const input of [
    '', ' ', 'al', 'maximums', 'HALVES', 'all of it', 'halfway', 'halfall', 'all full', '1max',
    '1kk', '2mb', '1 kilo', '1e3', '1e-3', '0xff', '1_000', '1,000', '$100',
    '1 2', '1 .2', '1..2', '.', 'k', 'm', 'b', 't', '1k2', '1k.5',
    'half%', 'max%', '50%%', '50%k', '50%2', '(50)%', '2(half)', '2half', '2½',
    'half()', '(all)(half)', 'all+', 'half*', 'quarter/', 'all/**2', 'all//2',
    '()', '(half', 'half)', '((all)', 'all+()', 'all?1:2', '2^3', '2**3',
  ]) for (const total of [undefined, 0, 200]) assert.equal(resolve(input, total), null, input);
});

test('rejects nonfinite intermediates and division by zero even if later hidden', () => {
  const huge = '9'.repeat(308);
  for (const input of ['1/0', 'all/none', 'half/zero', '0/0', '1/-0', `${huge}k/1t`,
    `${huge}*1t/1t`, `${huge}+${huge}-${huge}`, '1/0*0', '0*(1/0)', `${'9'.repeat(400)}/2`]) {
    for (const total of [undefined, 0, 200]) assert.equal(resolve(input, total), null, input);
  }
  assert.equal(resolve('double', Number.MAX_VALUE), null);
  assert.equal(resolve('1k/2k', Number.MAX_VALUE), Number.MAX_VALUE / 2);
});

test('runtime validation never coerces objects or executes code', () => {
  const malicious = { toString() { throw new Error('must not coerce'); } };
  for (const input of [null, undefined, false, true, [], {}, malicious, Symbol('x'), NaN, Infinity]) assert.equal(resolve(input, 200), null);
  for (const total of [-1, Infinity, -Infinity, NaN, null, '200', {}, true]) assert.equal(resolve('max', total), null);
  for (const input of ['constructor', '__proto__', 'prototype', 'valueOf', 'toString',
    'globalThis.__amount_test__=1', 'process.exit()', 'alert(1)', '(()=>1)()', '1;throw 2',
    'Math.max(1,2)', 'this', '1/*comment*/+2', '1//comment']) assert.equal(resolve(input, 200), null, input);
  assert.equal(globalThis.__amount_test__, undefined);
});

test('inherited numeric properties never become aliases', () => {
  Object.defineProperty(Object.prototype, 'amountpollution', { value: 2, configurable: true });
  try {
    for (const input of ['amountpollution', '1amountpollution']) {
      assert.equal(resolve(input), null);
      assert.equal(resolve(input, 200), null);
    }
  } finally { delete Object.prototype.amountpollution; }
});

test('length and nesting limits permit long flat calculations', () => {
  const nested = n => '('.repeat(n) + 'half' + ')'.repeat(n);
  assert.equal(resolve(nested(64), 200), 100);
  assert.equal(resolve(nested(65), 200), null);
  assert.equal(resolve('1' + ' '.repeat(4095)), 1);
  assert.equal(resolve('1' + ' '.repeat(4095) + '+1'), null);
  assert.equal(resolve(Array(1000).fill('1').join('+')), 1000);
  assert.equal(resolve('-'.repeat(1000) + '1'), 1);
});

test('1,000 seeded expression trees match an independent numeric oracle', () => {
  let seed = 4591;
  const random = n => (seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) % n;
  const atoms = [['half', 100], ['quarter', 50], ['max', 200], ['10%', 20], ['2k', 2000],
    ['.25', .25], ['3', 3], ['⅛', 25], ['none', 0], ['-5', -5]];
  function formula(depth = 0) {
    if (depth === 4 || random(4) === 0) return atoms[random(atoms.length)];
    const [left, a] = formula(depth + 1), [right, b] = formula(depth + 1);
    let op = ['+', '-', '*', '/'][random(4)];
    if (op === '/' && b === 0) op = '+';
    const value = op === '+' ? a + b : op === '-' ? a - b : op === '*' ? a * b : a / b;
    return [`(${left} ${op} ${right})`, value];
  }
  for (let i = 0; i < 1000; i++) {
    const [input, expected] = formula();
    close(resolve(input, 200), expected, input);
    assert.equal(resolve(input + ';', 200), null);
  }
});
