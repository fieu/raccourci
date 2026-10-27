import { resolveAmount, type AmountResolvedDetail } from 'relative-amount';
import umd = require('relative-amount/umd');
const amount: number | null = resolveAmount('all', 100);
const localized: number | null = umd.resolveAmount('1,5k', 100, { locale: 'de-DE' });
const detail: AmountResolvedDetail = { originalValue: 'half', value: '50', amount: 50, total: 100 };
