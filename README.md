# raccourci

French for “shortcut”. A dependency-free TypeScript amount parser. Minified ESM, CommonJS, UMD, and type declarations.

```ts
import { resolveAmount } from 'raccourci';

resolveAmount('100 - (5*3)'); // 85
resolveAmount('2.5k'); // 2500
resolveAmount('max - 10', 200); // 190
resolveAmount('25% + 10', 200); // 60
resolveAmount('half + quarter', 200); // 150
resolveAmount('2/3', 200); // 133.33333333333331
resolveAmount('1.234,5', undefined, { locale: 'de-DE' }); // 1234.5
```

## API

`resolveAmount(input: string | number, total?: number, options?: ResolveOptions): number | null`

Options: `rounding` (`none`, `floor`, `ceil`, `round`, `trunc`; default `none`) and an explicit Intl `locale` string. Rounding applies once to the final result. Invalid input, invalid options, division by zero, and non-finite intermediate results return `null`. Totals must be finite and nonnegative. Numeric results are not clamped or formatted. Uses JavaScript floating-point arithmetic, never `eval` or `Function`.

## Shorthands and expressions

Words and suffixes ignore case; whitespace is allowed around tokens.

| Input | Meaning |
| --- | --- |
| `k`, `m`, `b`, `t` after a number | × thousand / million / billion / trillion |
| `all`, `full`, `max`, `maximum`, `total` | Entire reference amount |
| `half`, `third`, `quarter` / `fourth` | 1/2, 1/3, 1/4 of the reference |
| `fifth`, `sixth`, `seventh`, `eighth`, `ninth`, `tenth` | Corresponding share |
| `double` / `twice`, `triple` / `thrice` | 2×, 3× the reference |
| `none`, `zero` | Zero (reference required, as with other words) |
| `½ ⅓ ⅔ ¼ ¾ ⅛ ⅜ ⅝ ⅞` | Fraction of the reference, or numeric fraction without one |
| `50%` | Half the reference, or `0.5` without one |

Supports decimals, `+ - * /`, unary signs, parentheses, and normal precedence. A standalone numeric fraction (`1/2`, `1k/2k`) is a share of the total. In mixed formulas `/` is ordinary division: `1/2 + 10` is `10.5`; use `half + 10` for a relative amount. Parenthesized `(1/2)` is ordinary arithmetic. Percentage atoms always mean shares when a total exists: `all * 50%` of 200 means `200 * 100`; use `all * .5` to halve it. Trimmed input is limited to 4,096 characters and 64 levels of parentheses.

## Locale input

No locale is guessed. Without `locale`, use dot-decimal numbers without grouping. With it, grouping, decimal separators, native digits, minus signs, and percent signs follow the runtime's Intl data. Invalid grouping is rejected; currencies and exponent notation remain unsupported.

```ts
resolveAmount('1,234.5', undefined, { locale: 'en-US' }); // 1234.5
resolveAmount('1,5k + half', 200, { locale: 'de-DE' }); // 1600
resolveAmount('1,5', undefined, { locale: 'en-US' }); // null (bad grouping)
```

## Automatic UMD inputs

ESM and the CommonJS core attach no listeners. To enable automatic text inputs, copy `dist/umd/index.cjs` to your static assets as `/vendor/raccourci.js`:

```html
<script src="/vendor/raccourci.js"></script>
<input type="text" data-resolve-amount="200"
       data-resolve-locale="de-DE"
       data-resolve-precision="2"
       data-resolve-rounding="none">
```

On blur or Enter, `2/3` becomes `133,33`. Only `data-resolve-amount` is required: default precision is four decimal places, rounding is `none`, and locale is unset. Precision accepts integers 0–20 and removes trailing zeros. Integer rounding runs before display precision. Locale output uses native digits/decimal separators without grouping. The amount attribute always uses a plain, finite, nonnegative dot-decimal number, regardless of locale. Invalid attributes or input stay untouched. Attributes are read on every commit; dynamically inserted inputs work. Read-only/disabled fields and IME Enter are ignored.

After a successful replacement changes the text, a non-cancelable `amountresolved` CustomEvent bubbles from the input:

```js
document.addEventListener('amountresolved', event => {
  console.log(event.target, event.detail);
  // { originalValue: '2/3', value: '133,33',
  //   amount: 133.33333333333331, total: 200 }
});
```

`amount` is after integer rounding but before display precision; `value` is the displayed string. No event on invalid or unchanged text, including blur after Enter. No synthetic `input`/`change` events or form submission changes. TypeScript exports the DOM-free `AmountResolvedDetail` type.

UMD exposes `Raccourci.resolveAmount`, or registers with AMD/CommonJS. Global types are in `dist/umd/index.d.cts`. Also exported as `raccourci/umd`.

## Build and install

`npm run build` uses Vite library mode for ESM/CommonJS and a separate UMD entry. `vite-plugin-dts` generates declarations, and Vite runs Terser minification. Build configuration lives in `vite.config.ts`.

Not published to npm. With Node.js 20.19+ or 22.12+:

```sh
npm install
npm test
npm run size
npm pack
# In your app:
npm install /path/to/raccourci-0.1.0.tgz
```

MIT licensed. Independent implementation inspired by the described Torn.com behavior.
