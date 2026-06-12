import { addDays, daysInMonth, isoDate, monthKey, parseIsoDate } from './dates';
import type { Transaction } from './types';

export type Period = 'week' | 'month' | 'year';

export interface DateRange {
  /** Inclusive ISO bounds. */
  from: string;
  to: string;
}

export type StatsTransaction = Pick<Transaction, 'type' | 'amountCents' | 'categoryId' | 'date'>;

function mondayOf(date: string): string {
  const parts = parseIsoDate(date);
  if (!parts) throw new Error(`Invalid ISO date: ${date}`);
  const weekday = new Date(Date.UTC(parts.year, parts.month - 1, parts.day)).getUTCDay();
  return addDays(date, -((weekday + 6) % 7));
}

export function periodRange(period: Period, reference: string): DateRange {
  const parts = parseIsoDate(reference);
  if (!parts) throw new Error(`Invalid ISO date: ${reference}`);
  switch (period) {
    case 'week': {
      const from = mondayOf(reference);
      return { from, to: addDays(from, 6) };
    }
    case 'month':
      return {
        from: isoDate(parts.year, parts.month, 1),
        to: isoDate(parts.year, parts.month, daysInMonth(parts.year, parts.month)),
      };
    case 'year':
      return { from: isoDate(parts.year, 1, 1), to: isoDate(parts.year, 12, 31) };
  }
}

/** Moves a reference date by whole periods, clamping short months and leap days. */
export function shiftReference(period: Period, reference: string, delta: number): string {
  const parts = parseIsoDate(reference);
  if (!parts) throw new Error(`Invalid ISO date: ${reference}`);
  switch (period) {
    case 'week':
      return addDays(reference, delta * 7);
    case 'month': {
      const total = parts.year * 12 + (parts.month - 1) + delta;
      const year = Math.floor(total / 12);
      const month = (total % 12) + 1;
      return isoDate(year, month, Math.min(parts.day, daysInMonth(year, month)));
    }
    case 'year': {
      const year = parts.year + delta;
      return isoDate(year, parts.month, Math.min(parts.day, daysInMonth(year, parts.month)));
    }
  }
}

export interface RangeSummary {
  expenseCents: number;
  incomeCents: number;
  netCents: number;
}

function inRange(date: string, range: DateRange): boolean {
  return date >= range.from && date <= range.to;
}

export function summarize(
  transactions: readonly StatsTransaction[],
  range: DateRange,
): RangeSummary {
  let expenseCents = 0;
  let incomeCents = 0;
  for (const t of transactions) {
    if (!inRange(t.date, range)) continue;
    if (t.type === 'expense') expenseCents += t.amountCents;
    else incomeCents += t.amountCents;
  }
  return { expenseCents, incomeCents, netCents: incomeCents - expenseCents };
}

export interface CategoryTotal {
  categoryId: string;
  totalCents: number;
}

export function categoryBreakdown(
  transactions: readonly StatsTransaction[],
  range: DateRange,
  type: Transaction['type'],
): CategoryTotal[] {
  const totals = new Map<string, number>();
  for (const t of transactions) {
    if (t.type !== type || !inRange(t.date, range)) continue;
    totals.set(t.categoryId, (totals.get(t.categoryId) ?? 0) + t.amountCents);
  }
  return [...totals.entries()]
    .map(([categoryId, totalCents]) => ({ categoryId, totalCents }))
    .sort((a, b) => b.totalCents - a.totalCents);
}

export interface TrendBucket {
  /** ISO date for daily buckets, yyyy-mm for monthly buckets. */
  key: string;
  expenseCents: number;
  incomeCents: number;
}

export function trendSeries(
  transactions: readonly StatsTransaction[],
  period: Period,
  reference: string,
): TrendBucket[] {
  const range = periodRange(period, reference);
  const buckets = new Map<string, TrendBucket>();

  if (period === 'year') {
    for (let month = 1; month <= 12; month++) {
      const key = monthKey(isoDate(Number(reference.slice(0, 4)), month, 1));
      buckets.set(key, { key, expenseCents: 0, incomeCents: 0 });
    }
  } else {
    for (let date = range.from; date <= range.to; date = addDays(date, 1)) {
      buckets.set(date, { key: date, expenseCents: 0, incomeCents: 0 });
    }
  }

  for (const t of transactions) {
    if (!inRange(t.date, range)) continue;
    const key = period === 'year' ? monthKey(t.date) : t.date;
    const bucket = buckets.get(key);
    if (!bucket) continue;
    if (t.type === 'expense') bucket.expenseCents += t.amountCents;
    else bucket.incomeCents += t.amountCents;
  }

  return [...buckets.values()];
}
