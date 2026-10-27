export type Rounding = 'none' | 'floor' | 'ceil' | 'round' | 'trunc';

export interface ResolveOptions {
  rounding?: Rounding;
  /** Explicit Intl locale for numeric input. No locale guessing is performed. */
  locale?: string;
}

/** Detail of the bubbling UMD amountresolved event. No DOM types required. */
export interface AmountResolvedDetail {
  originalValue: string;
  value: string;
  /** Parsed amount after integer rounding, before display precision is applied. */
  amount: number;
  total: number;
}

const decimal = '[+-]?(?:\\d+(?:\\.\\d*)?|\\.\\d+)';
const quantity = `${decimal}(?:\\s*[kmbt])?`;
const fractionPattern = new RegExp(`^${quantity}\\s*/\\s*${quantity}$`);
const scales: Record<string, number | null> = { __proto__: null, k: 1e3, m: 1e6, b: 1e9, t: 1e12 };
const portions: Record<string, number | null> = {
  __proto__: null,
  all: 1, full: 1, max: 1, maximum: 1, total: 1,
  half: .5, third: 1 / 3, quarter: .25, fourth: .25, fifth: .2,
  sixth: 1 / 6, seventh: 1 / 7, eighth: .125, ninth: 1 / 9, tenth: .1,
  double: 2, twice: 2, triple: 3, thrice: 3, none: 0, zero: 0,
};
const fractions: Record<string, number | null> = {
  __proto__: null,
  '½': .5, '⅓': 1 / 3, '⅔': 2 / 3, '¼': .25, '¾': .75,
  '⅛': .125, '⅜': .375, '⅝': .625, '⅞': .875,
};

/** Resolve an amount or arithmetic expression. Invalid input returns null. */
export function resolveAmount(input: string | number, total?: number, options: ResolveOptions = {}): number | null {
  if (total !== undefined && (!Number.isFinite(total) || total < 0)) return null;
  const config = options.locale === undefined ? undefined : localeConfig(options.locale);
  if (config === null) return null;
  let result: number;
  if (typeof input === 'number') {
    result = input;
  } else {
    if (typeof input !== 'string') return null;
    let value = input.trim().toLowerCase();
    if (value.length > 4096) return null;
    if (config) {
      const normalized = normalizeLocale(value, config);
      if (normalized === null) return null;
      value = normalized;
    }
    const calculated = calculate(value, total);
    if (calculated === null) return null;
    result = calculated;
    // Only standalone numeric fractions retain the original share shorthand.
    if (total !== undefined && fractionPattern.test(value)) result *= total;
  }
  if (!Number.isFinite(result)) return null;
  const rounding = options.rounding ?? 'none';
  if (rounding !== 'none') {
    if (!['floor', 'ceil', 'round', 'trunc'].includes(rounding)) return null;
    result = Math[rounding](result);
  }
  return result || 0;
}

function calculate(value: string, total?: number): number | null {
  const tokens = value.match(/\d+(?:\.\d*)?|\.\d+|[a-z]+|\S/g) ?? [];
  let position = 0;
  let valid = true;
  const finite = (value: number): number => {
    if (!Number.isFinite(value)) valid = false;
    return value;
  };
  const primary = (depth: number): number => {
    if (depth > 64) { valid = false; return NaN; }
    let sign = 1;
    while (tokens[position] === '+' || tokens[position] === '-') {
      if (tokens[position++] === '-') sign = -sign;
    }
    const token = tokens[position++];
    if (token === '(') {
      const result = sum(depth + 1);
      if (tokens[position++] !== ')') valid = false;
      return sign * result;
    }
    let result = Number(token);
    if (!Number.isNaN(result)) {
      result = finite(result);
      const scale = scales[tokens[position] ?? ''];
      if (typeof scale === 'number') {
        position++;
        result = finite(result * scale);
      }
      if (tokens[position] === '%') {
        position++;
        result = (result / 100) * (total ?? 1);
      }
    } else {
      const portion = portions[token ?? ''];
      const fraction = fractions[token ?? ''];
      result = typeof portion === 'number' ? portion * (total ?? NaN) :
        typeof fraction === 'number' ? fraction * (total ?? 1) : NaN;
    }
    return finite(sign * result);
  };
  const product = (depth: number): number => {
    let result = primary(depth);
    while (tokens[position] === '*' || tokens[position] === '/') {
      const operator = tokens[position++];
      const right = primary(depth);
      result = finite(operator === '*' ? result * right : result / right);
    }
    return result;
  };
  const sum = (depth: number): number => {
    let result = product(depth);
    while (tokens[position] === '+' || tokens[position] === '-') {
      const operator = tokens[position++];
      const right = product(depth);
      result = finite(operator === '+' ? result + right : result - right);
    }
    return result;
  };
  const result = sum(0);
  return valid && position === tokens.length ? result : null;
}

interface LocaleConfig {
  digits: Map<string, string>;
  decimal: string;
  groups: Set<string>;
  spaced: boolean;
  primary: number;
  secondary: number;
  minus: string;
  percent: string;
}

// Bounded cache avoids repeating Intl discovery on each input commit.
const locales = new Map<string, LocaleConfig>();

function localeConfig(locale: string): LocaleConfig | null {
  if (typeof locale !== 'string' || !locale) return null;
  const cached = locales.get(locale);
  if (cached) return cached;
  try {
    if (!Intl.NumberFormat.supportedLocalesOf(locale).length) return null;
    const formatter = new Intl.NumberFormat(locale);
    const parts = formatter.formatToParts(1234567890123.5);
    const digits = new Map<string, string>();
    for (let i = 0; i < 10; i++) {
      digits.set(String(i), String(i));
      digits.set(formatter.format(i), String(i));
    }
    const group = parts.find(part => part.type === 'group')?.value ?? '';
    const integers = parts.filter(part => part.type === 'integer').map(part => Array.from(part.value).length);
    const spaced = /\s/.test(group);
    const config: LocaleConfig = {
      digits,
      decimal: parts.find(part => part.type === 'decimal')?.value ?? '.',
      groups: new Set(spaced ? [group, ' ', '\u00a0', '\u202f'] : /['’]/.test(group) ? ["'", '’'] : [group]),
      spaced,
      primary: integers[integers.length - 1]!,
      secondary: integers[integers.length - 2] ?? integers[0]!,
      minus: formatter.formatToParts(-1).find(part => part.type === 'minusSign')?.value ?? '-',
      percent: new Intl.NumberFormat(locale, { style: 'percent' }).formatToParts(1)
        .find(part => part.type === 'percentSign')?.value ?? '%',
    };
    if (locales.size === 32) locales.delete(locales.keys().next().value!);
    locales.set(locale, config);
    return config;
  } catch {
    return null;
  }
}

/** Normalize each numeric token and validate grouping before removing separators. */
function normalizeLocale(value: string, config: LocaleConfig): string | null {
  const chars = Array.from(value.replace(/[\u061c\u200e\u200f]/g, ''));
  let output = '';
  for (let i = 0; i < chars.length;) {
    const char = chars[i]!;
    if (config.digits.has(char) || char === config.decimal) {
      let token = '';
      while (i < chars.length) {
        const current = chars[i]!;
        const digit = config.digits.get(current);
        if (digit !== undefined) token += digit;
        else if (current === config.decimal) token += '.';
        else if (config.groups.has(current)) token += ',';
        else break;
        i++;
      }
      // Space grouping can also be ordinary whitespace before an operator/suffix.
      if (config.spaced) token = token.replace(/,+$/, '');
      const parts = token.split('.');
      const blocks = parts[0]!.split(',');
      if (parts.length > 2 || (parts[1] !== undefined && !/^\d*$/.test(parts[1]))) return null;
      if (blocks.length > 1 && (
        !blocks[0] || blocks[0].length > config.secondary ||
        blocks[blocks.length - 1]!.length !== config.primary ||
        blocks.slice(1, -1).some(block => block.length !== config.secondary)
      )) return null;
      const normalized = blocks.join('') + (parts[1] === undefined ? '' : '.' + parts[1]);
      if (!/\d/.test(normalized)) return null;
      output += normalized;
    } else {
      // Do not let a foreign dot bypass the explicitly selected decimal separator.
      if (char === '.') return null;
      output += char === config.minus ? '-' : char === config.percent ? '%' : char;
      i++;
    }
  }
  return output;
}
