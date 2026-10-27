// Included only inside the UMD factory; ESM and the CommonJS core stay pure.
(function () {
  if (typeof document === 'undefined') return;
  const installed = Symbol.for('raccourci:auto');
  if (document[installed]) return;
  document[installed] = true;

  function commit(event) {
    const input = event.target;
    if (!input || input.tagName !== 'INPUT' || input.type !== 'text' ||
        input.disabled || input.readOnly) return;
    const attribute = input.getAttribute('data-resolve-amount');
    if (attribute === null || !/^\+?(?:\d+(?:\.\d*)?|\.\d+)$/.test(attribute.trim())) return;
    const total = Number(attribute);
    const locale = input.getAttribute('data-resolve-locale') ?? undefined;
    const rounding = input.getAttribute('data-resolve-rounding') ?? undefined;
    const precisionAttribute = input.getAttribute('data-resolve-precision');
    const precision = precisionAttribute === null ? 4 : Number(precisionAttribute);
    if (precisionAttribute !== null && !/^\d{1,2}$/.test(precisionAttribute.trim())) return;
    if (precision > 20) return;
    const originalValue = input.value;
    const amount = exports.resolveAmount(originalValue, total, { locale, rounding });
    if (amount === null) return;
    const rounded = Number(amount.toFixed(precision)) || 0;
    const value = locale === undefined ? String(rounded) :
      rounded.toLocaleString(locale, { useGrouping: false, maximumFractionDigits: precision });
    if (value === originalValue) return;
    input.value = value;
    input.dispatchEvent(new input.ownerDocument.defaultView.CustomEvent('amountresolved', {
      bubbles: true,
      composed: true,
      detail: { originalValue, value, amount, total },
    }));
  }

  document.addEventListener('focusout', commit);
  document.addEventListener('keydown', function (event) {
    if (event.key === 'Enter' && !event.isComposing) commit(event);
  });
})();
