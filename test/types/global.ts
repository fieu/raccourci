/// <reference path="../../dist/umd/index.d.cts" />
const amount: number | null = Raccourci.resolveAmount('half', 100, { locale: 'de-DE' });
const detail: Raccourci.AmountResolvedDetail = { originalValue: 'half', value: '50', amount: 50, total: 100 };
