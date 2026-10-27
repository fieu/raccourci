import { resolveAmount, type ResolveOptions, type AmountResolvedDetail } from 'relative-amount';
const options: ResolveOptions = { rounding: 'floor', locale: 'de-DE' };
const amount: number | null = resolveAmount('half', 100, options);
const calculated: number | null = resolveAmount('100-(5*3)');
const eventDetail: AmountResolvedDetail = { originalValue: 'half', value: '50', amount: 50, total: 100 };
// @ts-expect-error locale is an explicit string, not a guessed boolean setting
resolveAmount('1,5', undefined, { locale: true });
