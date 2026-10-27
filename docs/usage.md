# Raccourci integration guide

The library has one runtime export and no runtime dependencies. ESM and CommonJS core imports never access the DOM. All builds are minified; TypeScript declarations work without requiring DOM libraries in server projects.

## Parsing

```ts
import { resolveAmount } from 'raccourci';

resolveAmount('100 - (5*3)'); // 85
resolveAmount('2.5k'); // 2500
resolveAmount('max - 10', 200); // 190
resolveAmount('half + quarter', 200); // 150
resolveAmount('2/3', 200); // 133.33333333333331
resolveAmount('⅝', 200); // 125
resolveAmount('invalid'); // null
```

Check `amount !== null` rather than `if (amount)`: zero is valid. References must be finite, nonnegative numbers. Negative results and amounts above the reference are allowed; enforce application limits separately. Literal numbers, intermediate results, and final results must be finite. Overflow or division by zero cannot be hidden by a subsequent operation. Negative zero is normalized to positive zero.

## Complete shorthand vocabulary

| Shorthands | Meaning |
| --- | --- |
| `all`, `full`, `max`, `maximum`, `total` | reference × 1 |
| `half` | reference × 1/2 |
| `third` | reference × 1/3 |
| `quarter`, `fourth` | reference × 1/4 |
| `fifth`, `sixth`, `seventh`, `eighth`, `ninth`, `tenth` | reference × corresponding fraction |
| `double`, `twice`; `triple`, `thrice` | reference × 2; reference × 3 |
| `none`, `zero` | reference × 0 |
| suffixes `k`, `m`, `b`, `t` | number × 1e3, 1e6, 1e9, 1e12 |
| `½`, `⅓`, `⅔`, `¼`, `¾`, `⅛`, `⅜`, `⅝`, `⅞` | displayed fraction of the reference, or just the fraction without a reference |

Words require a reference, including `none` and `zero`. Suffixes do not. Words and suffixes ignore case. Suffixes apply only to numbers and can be separated by whitespace: `-.5 K` means `-500`; `halfk` is invalid.

## Arithmetic and relative fractions

Decimals (including `.5` and `1.`), unary signs, binary `+ - * /`, and parentheses follow normal precedence and left associativity. Adjacent values require an operator: `2half`, `2(3)`, and `1½` are rejected.

A simple numeric fraction that occupies the entire trimmed input remains a relative shorthand. Inside a larger expression, division is arithmetic:

```ts
resolveAmount('1/2', 200); // 100
resolveAmount('1k/2k', 200); // 100
resolveAmount('1/2'); // 0.5
resolveAmount('1/2 + 10', 200); // 10.5
resolveAmount('(1/2)', 200); // 0.5
resolveAmount('half + 10', 200); // 110
resolveAmount('all * (1/2)', 200); // 100
```

Each percentage atom is a reference-relative amount when a reference is supplied, and a ratio otherwise. There are no context-sensitive percentage rules:

```ts
resolveAmount('25% + 10', 200); // 60
resolveAmount('25% + 25%', 200); // 100
resolveAmount('50% / 2', 200); // 50
resolveAmount('100 * 50%'); // 50
resolveAmount('all * 50%', 200); // 20000: 200 × 100
resolveAmount('all * .5', 200); // 100
```

The parser never executes JavaScript. Unknown words, comments, assignments, function calls, currencies, exponent notation, exponentiation, and modulo are unsupported. Trimmed input is limited to 4,096 characters before locale normalization and 64 levels of parentheses.

## Explicit locale support

```ts
resolveAmount('1,234.50', undefined, { locale: 'en-US' }); // 1234.5
resolveAmount('1.234,50', undefined, { locale: 'de-DE' }); // 1234.5
resolveAmount('1 234,50', undefined, { locale: 'fr-FR' }); // 1234.5
resolveAmount('1,23,456.75', undefined, { locale: 'hi-IN' }); // 123456.75
resolveAmount('١٬٢٣٤٫٥', undefined, { locale: 'ar-EG' }); // 1234.5
resolveAmount('1,5k + half', 200, { locale: 'de-DE' }); // 1600
resolveAmount('1,5/3', 200, { locale: 'de-DE' }); // 100
```

`locale` must be an explicit supported Intl locale string. Malformed or unsupported locales return `null`, including for numeric arguments. Numeric arguments themselves are not reinterpreted as text. Without a locale, grouping and native digits are rejected, and decimal syntax uses a dot. There is no fallback to browser language or HTML `lang`.

Locale metadata comes from the runtime's built-in `Intl.NumberFormat`; no locale data files or dependencies are bundled. Locale rules therefore track the host's Intl/ICU data. Decimal/group separators, digits, grouping sizes (including Indian grouping), native minus signs, and percent signs are recognized. ASCII digits and ordinary arithmetic signs remain usable. Space-grouped locales accept ordinary, nonbreaking, and narrow nonbreaking spaces. Apostrophe-grouped locales accept straight and typographic apostrophes. Directional formatting marks used by Intl numbers are ignored.

Grouping is checked before separators are removed: `1,5` is valid in German and invalid in US English; `1,234,567` is valid in US English and invalid in Indian grouping. Group separators are not allowed after a decimal point. Locale metadata is cached for at most 32 locale strings. The default parser still works if Intl is unavailable; locale parsing returns `null` in that case.

Core results are always numbers, never localized strings. Format output in your app, or use the UMD automatic fields.

## Rounding

```ts
resolveAmount('half', 5); // 2.5
resolveAmount('half', 5, { rounding: 'floor' }); // 2
resolveAmount('10/3 + 10/3', undefined, { rounding: 'floor' }); // 6
resolveAmount('1,5 + half', 5, { locale: 'de-DE', rounding: 'floor' }); // 4
```

Rounding accepts `none` (default), `floor`, `ceil`, `round`, or `trunc`, follows the corresponding JavaScript Math function, and applies once to the final calculation. This is a JavaScript-number library, not an exact decimal money implementation.

## React / ESM

```tsx
import { useState } from 'react';
import { resolveAmount } from 'raccourci';

export function AmountInput({ total }: { total: number }) {
  const [value, setValue] = useState('');
  return (
    <input type="text" value={value}
      onChange={event => setValue(event.currentTarget.value)}
      onBlur={event => {
        const amount = resolveAmount(event.currentTarget.value, total, { locale: 'de-DE' });
        if (amount !== null) setValue(amount.toLocaleString('de-DE', { useGrouping: false }));
      }}
    />
  );
}
```

The app owns input state and timing. Use a text input so words, arithmetic operators, and percent signs can be entered.

## Automatic UMD inputs

Copy `dist/umd/index.js` to your static assets:

```html
<script src="/vendor/raccourci.js"></script>
<input type="text" data-resolve-amount="200"
       data-resolve-locale="de-DE"
       data-resolve-precision="2"
       data-resolve-rounding="none">
```

No initialization is required. On blur or Enter, `2/3` becomes `133,33` and `1,5k + half` becomes `1600`. Enter during IME composition is ignored. Only editable text inputs with the amount attribute are handled. Dynamic inputs are supported, attributes are read at every commit, and removing the amount attribute opts a field out. Repeated script loads do not add duplicate handlers.

| Attribute | Values and default |
| --- | --- |
| `data-resolve-amount` | Required canonical dot-decimal, finite, nonnegative number. Not localized, even when a locale is set. |
| `data-resolve-locale` | Optional supported Intl locale. Unset uses the original dot-decimal syntax and output. |
| `data-resolve-precision` | Integer 0–20; default 4. Maximum fractional digits with trailing zeros removed. |
| `data-resolve-rounding` | `none`, `floor`, `ceil`, `round`, `trunc`; default `none`. |

Integer rounding runs first, then display precision is applied using JavaScript `toFixed`, converted back to a number to remove trailing zeros. With a locale, output uses its digits and decimal separator with grouping disabled. Negative zero is removed. Core numeric results retain full precision unless integer rounding is requested. Invalid attributes or input leave the field untouched and emit no resolution event. Defaults remain unchanged when the new attributes are absent.

## Resolution event

The UMD handler dispatches a bubbling, composed, non-cancelable `amountresolved` CustomEvent after changing the displayed value. It dispatches no synthetic `input` or `change` events and does not prevent form submission.

```js
document.addEventListener('amountresolved', event => {
  const { originalValue, value, amount, total } = event.detail;
  console.log(event.target, originalValue, value, amount, total);
});
```

For `2/3` with total 200 and German locale/precision 2:

```js
{
  originalValue: '2/3',
  value: '133,33',
  amount: 133.33333333333331,
  total: 200
}
```

`amount` includes integer rounding, if configured, but precedes display precision. `value` is the actual displayed string, and the input is already updated when the listener runs. Zero is a valid amount. Unchanged text does not emit an event, so pressing Enter and then blurring does not notify twice. Invalid input, ignored keys, and disabled/read-only inputs also emit nothing.

For TypeScript listeners, import the type without introducing runtime dependencies:

```ts
import type { AmountResolvedDetail } from 'raccourci';

document.addEventListener('amountresolved', event => {
  const detail = (event as CustomEvent<AmountResolvedDetail>).detail;
  console.log(detail.amount, detail.value);
});
```

The DOM event map is not modified globally; server consumers do not need DOM types.

## Global and CommonJS imports

For a vanilla TypeScript script without imports or exports, copy the UMD declaration file too:

```ts
/// <reference path="./vendor/raccourci.d.ts" />
Raccourci.resolveAmount('max - 10', 200);
```

UMD supports AMD and CommonJS and is available at `raccourci/umd`. `require('raccourci')` loads the core without automatic DOM handling.

## Build and package

Node.js 20+ is needed for development. Run `npm install`, `npm test`, `npm run size`, and `npm pack`. The tarball contains minified distributions, declarations, a compact README, and the MIT license. Tests, full documentation, and source stay in the development checkout. The package has not been published to npm; install the generated local tarball in your app.
