/// <reference path="../../dist/umd/index.d.ts" />
const amount: number | null = RelativeAmount.resolveAmount('half', 100, { locale: 'de-DE' });
const detail: RelativeAmount.AmountResolvedDetail = { originalValue: 'half', value: '50', amount: 50, total: 100 };
