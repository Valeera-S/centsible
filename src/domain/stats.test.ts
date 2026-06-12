import { describe, expect, it } from 'vitest';
import {
  categoryBreakdown,
  cumulativeDailySpend,
  dailyExpenseMap,
  noSpendStreaks,
  periodRange,
  shiftReference,
  summarize,
  trendSeries,
} from './stats';

// 2026-06-11 is a Thursday.
const REF = '2026-06-11';

const TX = [
  { type: 'expense', amountCents: 1000, categoryId: 'dining', date: '2026-06-08' },
  { type: 'expense', amountCents: 2500, categoryId: 'groceries', date: '2026-06-10' },
  { type: 'expense', amountCents: 500, categoryId: 'dining', date: '2026-06-11' },
  { type: 'expense', amountCents: -200, categoryId: 'dining', date: '2026-06-12' },
  { type: 'expense', amountCents: 90000, categoryId: 'rent', date: '2026-06-01' },
  { type: 'expense', amountCents: 4000, categoryId: 'shopping', date: '2026-05-20' },
  { type: 'income', amountCents: 150000, categoryId: 'stipend', date: '2026-06-01' },
  { type: 'income', amountCents: 8000, categoryId: 'tutoring', date: '2026-06-09' },
] as const;

describe('periodRange', () => {
  it('computes a Monday-start week around the reference', () => {
    expect(periodRange('week', REF)).toEqual({ from: '2026-06-08', to: '2026-06-14' });
  });

  it('computes the calendar month', () => {
    expect(periodRange('month', REF)).toEqual({ from: '2026-06-01', to: '2026-06-30' });
  });

  it('computes the calendar year', () => {
    expect(periodRange('year', REF)).toEqual({ from: '2026-01-01', to: '2026-12-31' });
  });

  it('handles a reference that is itself a Monday', () => {
    expect(periodRange('week', '2026-06-08')).toEqual({ from: '2026-06-08', to: '2026-06-14' });
  });
});

describe('shiftReference', () => {
  it('moves by whole weeks', () => {
    expect(shiftReference('week', REF, -1)).toBe('2026-06-04');
    expect(shiftReference('week', REF, 1)).toBe('2026-06-18');
  });

  it('moves by months with day clamping', () => {
    expect(shiftReference('month', '2026-01-31', 1)).toBe('2026-02-28');
    expect(shiftReference('month', REF, -1)).toBe('2026-05-11');
  });

  it('moves by years with leap-day clamping', () => {
    expect(shiftReference('year', '2024-02-29', 1)).toBe('2025-02-28');
    expect(shiftReference('year', REF, 1)).toBe('2027-06-11');
  });
});

describe('summarize', () => {
  it('nets expenses (refunds subtract) and totals income within the range', () => {
    const result = summarize(TX, { from: '2026-06-01', to: '2026-06-30' });
    expect(result.expenseCents).toBe(1000 + 2500 + 500 - 200 + 90000);
    expect(result.incomeCents).toBe(158000);
    expect(result.netCents).toBe(158000 - 93800);
  });

  it('ignores transactions outside the range', () => {
    const result = summarize(TX, { from: '2026-05-01', to: '2026-05-31' });
    expect(result.expenseCents).toBe(4000);
    expect(result.incomeCents).toBe(0);
  });
});

describe('categoryBreakdown', () => {
  it('nets per category, sorted descending', () => {
    const result = categoryBreakdown(TX, { from: '2026-06-01', to: '2026-06-30' }, 'expense');
    expect(result).toEqual([
      { categoryId: 'rent', totalCents: 90000 },
      { categoryId: 'groceries', totalCents: 2500 },
      { categoryId: 'dining', totalCents: 1300 },
    ]);
  });

  it('breaks down income too', () => {
    const result = categoryBreakdown(TX, { from: '2026-06-01', to: '2026-06-30' }, 'income');
    expect(result).toEqual([
      { categoryId: 'stipend', totalCents: 150000 },
      { categoryId: 'tutoring', totalCents: 8000 },
    ]);
  });
});

describe('cumulativeDailySpend', () => {
  const EXCLUDED = new Set(['rent']);
  const tx = [
    { type: 'expense', amountCents: 90000, categoryId: 'rent', date: '2026-06-01' },
    { type: 'expense', amountCents: 1000, categoryId: 'dining', date: '2026-06-02' },
    { type: 'expense', amountCents: 2000, categoryId: 'groceries', date: '2026-06-05' },
    { type: 'expense', amountCents: -500, categoryId: 'dining', date: '2026-06-06' },
    { type: 'income', amountCents: 99999, categoryId: 'stipend', date: '2026-06-03' },
  ] as const;

  it('accumulates budget-relevant spending day by day', () => {
    const series = cumulativeDailySpend(tx, 2026, 6, EXCLUDED);
    expect(series).toHaveLength(30);
    expect(series[0]).toBe(0);
    expect(series[1]).toBe(1000);
    expect(series[3]).toBe(1000);
    expect(series[4]).toBe(3000);
    expect(series[5]).toBe(2500);
    expect(series[29]).toBe(2500);
  });
});

describe('dailyExpenseMap', () => {
  it('nets daily expense totals, skipping excluded categories and income', () => {
    const map = dailyExpenseMap(
      [
        { type: 'expense', amountCents: 1000, categoryId: 'dining', date: '2026-06-02' },
        { type: 'expense', amountCents: 500, categoryId: 'dining', date: '2026-06-02' },
        { type: 'expense', amountCents: 90000, categoryId: 'rent', date: '2026-06-01' },
        { type: 'income', amountCents: 7777, categoryId: 'stipend', date: '2026-06-02' },
        { type: 'expense', amountCents: 300, categoryId: 'other', date: '2026-07-01' },
      ],
      { from: '2026-06-01', to: '2026-06-30' },
      new Set(['rent']),
    );
    expect(map.get('2026-06-02')).toBe(1500);
    expect(map.has('2026-06-01')).toBe(false);
    expect(map.has('2026-07-01')).toBe(false);
  });
});

describe('noSpendStreaks', () => {
  it('finds the longest and current runs of no-spend days', () => {
    const spendDays = new Set(['2026-06-02', '2026-06-05']);
    const result = noSpendStreaks(spendDays, { from: '2026-06-01', to: '2026-06-11' });
    expect(result.longest).toBe(6);
    expect(result.current).toBe(6);
  });

  it('resets the current streak when the last day has spending', () => {
    const spendDays = new Set(['2026-06-11']);
    const result = noSpendStreaks(spendDays, { from: '2026-06-01', to: '2026-06-11' });
    expect(result.current).toBe(0);
    expect(result.longest).toBe(10);
  });

  it('handles an all-quiet range', () => {
    const result = noSpendStreaks(new Set(), { from: '2026-06-01', to: '2026-06-11' });
    expect(result.current).toBe(11);
    expect(result.longest).toBe(11);
  });
});

describe('trendSeries', () => {
  it('returns one bucket per day across a week', () => {
    const buckets = trendSeries(TX, 'week', REF);
    expect(buckets).toHaveLength(7);
    expect(buckets[0]).toEqual({ key: '2026-06-08', expenseCents: 1000, incomeCents: 0 });
    expect(buckets[3]).toEqual({ key: '2026-06-11', expenseCents: 500, incomeCents: 0 });
    expect(buckets[4]).toEqual({ key: '2026-06-12', expenseCents: -200, incomeCents: 0 });
  });

  it('returns one bucket per day across a month', () => {
    const buckets = trendSeries(TX, 'month', REF);
    expect(buckets).toHaveLength(30);
    expect(buckets[0]).toEqual({ key: '2026-06-01', expenseCents: 90000, incomeCents: 150000 });
  });

  it('returns one bucket per month across a year', () => {
    const buckets = trendSeries(TX, 'year', REF);
    expect(buckets).toHaveLength(12);
    expect(buckets[4]).toEqual({ key: '2026-05', expenseCents: 4000, incomeCents: 0 });
    expect(buckets[5]).toEqual({ key: '2026-06', expenseCents: 93800, incomeCents: 158000 });
  });
});
