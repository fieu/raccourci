import { resolveAmount } from '../src/index';
import { version } from '../package.json';
import './style.css';

function element<T extends Element>(selector: string): T {
  const node = document.querySelector<T>(selector);
  if (!node) throw new Error(`Missing demo element: ${selector}`);
  return node;
}

const expression = element<HTMLInputElement>('#expression');
const total = element<HTMLInputElement>('#total');
const locale = element<HTMLSelectElement>('#locale');
const result = element<HTMLOutputElement>('#result');
const note = element<HTMLElement>('#result-note');
const examples = document.querySelectorAll<HTMLButtonElement>('[data-example]');

function update(): void {
  const reference = total.value.trim() === '' ? undefined : Number(total.value);
  const badReference = total.validity.badInput || (reference !== undefined && (!Number.isFinite(reference) || reference < 0));
  const amount = badReference ? null : resolveAmount(expression.value, reference,
    locale.value ? { locale: locale.value } : {});
  result.textContent = expression.value.trim() === '' ? '—' : amount === null ? 'Invalid expression' : String(amount);
  note.textContent = badReference ? 'Enter a finite, nonnegative reference amount.' :
    expression.value.trim() === '' ? 'Enter an expression to see the result.' :
    amount === null ? 'Check the expression and number format. Words such as “half” need a reference amount.' :
    reference === undefined ? 'Arithmetic mode. No reference amount.' :
    'Full numeric precision. Clear the reference amount for arithmetic.';
  expression.setAttribute('aria-invalid', String(amount === null && expression.value.trim() !== '' && !badReference));
  total.setAttribute('aria-invalid', String(badReference));
  for (const button of examples) button.setAttribute('aria-pressed', String(button.dataset.example === expression.value));
}

expression.addEventListener('input', update);
total.addEventListener('input', update);
locale.addEventListener('change', update);
element<HTMLFormElement>('#demo-form').addEventListener('submit', event => { event.preventDefault(); update(); });
for (const button of examples) button.addEventListener('click', () => {
  expression.value = button.dataset.example!;
  update();
  expression.focus();
});

element<HTMLElement>('#version').textContent = `v${version}`;
element<HTMLElement>('#install-command').textContent = `npm install ./raccourci-${version}.tgz`;
element<HTMLAnchorElement>('#package-download').href = `./raccourci-${version}.tgz`;

for (const button of document.querySelectorAll<HTMLButtonElement>('[data-copy]')) {
  button.addEventListener('click', async () => {
    const code = element<HTMLElement>(`#${button.dataset.copy}`);
    const status = element<HTMLElement>('#copy-status');
    try {
      await navigator.clipboard.writeText(code.textContent ?? '');
      status.textContent = 'Copied to clipboard.';
    } catch {
      const range = document.createRange();
      range.selectNodeContents(code);
      const selection = window.getSelection();
      selection?.removeAllRanges();
      selection?.addRange(range);
      status.textContent = 'Code selected. Use your keyboard to copy it.';
    }
  });
}

update();
