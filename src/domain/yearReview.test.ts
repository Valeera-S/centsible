import { describe, expect, it } from 'vitest';
import { yearReview } from './yearReview';

const EXCLUDED = new Set(['rent']);
const TODAY = '2026-06-12';

const TX = [
  { type: 'expense', amountCents: 90000, categoryId: 'rent', date: '2026-01-01', note: 'rent' },
  { type: 'expense', amountCents: 1738, categoryId: 'dining', date: '2026-01-05', note: '午餐' },
  { type: 'expense', amountCents: 1500, categoryId: 'dining', date: '2026-02-03', note: '午餐' },
  { type: 'expense', amountCents: 1200, categoryId: 'dining', date: '2026-02-03', note: '奶茶' },
  {
    type: 'expense',
    amountCents: 10452,
    categoryId: 'shopping',
    date: '2026-03-10',
    note: 'Target',
  },
  {
    type: 'expense',
    amountCents: 5486,
    categoryId: 'entertainment',
    date: '2026-04-02',
    note: '拳头',
  },
  {
    type: 'expense',
    amountCents: 5486,
    categoryId: 'entertainment',
    date: '2026-05-02',
    note: '拳头',
  },
  { type: 'expense', amountCents: -500, categoryId: 'dining', date: '2026-01-06', note: '退款' },
  {
    type: 'income',
    amountCents: 200000,
    categoryId: 'stipend',
    date: '2026-01-15',
    note: 'TA pay',
  },
  {
    type: 'expense',
    amountCents: 7777,
    categoryId: 'dining',
    date: '2025-12-31',
    note: 'last year',
  },
] as const;

describe('yearReview', () => {
  const review = yearReview(TX, 2026, TODAY, EXCLUDED);

  it('totals budget-relevant spending and income for the year', () => {
    expect(review.expenseCents).toBe(1738 + 1500 + 1200 + 10452 + 5486 + 5486 - 500);
    expect(review.incomeCents).toBe(200000);
    expect(review.transactionCount).toBe(7);
  });

  it('finds the biggest day and the biggest single purchase', () => {
    expect(review.biggestDay).toEqual({ date: '2026-03-10', cents: 10452 });
    expect(review.biggestTransaction).toEqual({
      description: 'Target',
      cents: 10452,
      date: '2026-03-10',
    });
  });

  it('ranks merchants by total with visit counts', () => {
    expect(review.topMerchants[0]).toEqual({ description: '拳头', totalCents: 10972, count: 2 });
    expect(review.topMerchants[1]).toEqual({ description: 'Target', totalCents: 10452, count: 1 });
  });

  it('finds the most frequent purchase, breaking ties by recency', () => {
    // 午餐 and 拳头 both appear twice; 拳头 is more recent.
    expect(review.mostFrequent).toEqual({ description: '拳头', count: 2 });
  });

  it('computes no-spend statistics up to today', () => {
    // Jan 1 - Jun 12 2026 is 163 days; 5 distinct days carry budget-relevant spending.
    expect(review.noSpendDays).toBe(163 - 5);
    expect(review.longestStreak).toBeGreaterThan(30);
  });

  it('produces twelve monthly totals', () => {
    expect(review.monthlyTotals).toHaveLength(12);
    expect(review.monthlyTotals[0]).toBe(1738 - 500);
    expect(review.monthlyTotals[2]).toBe(10452);
    expect(review.monthlyTotals[11]).toBe(0);
  });

  it('names the top category', () => {
    expect(review.topCategory).toEqual({ categoryId: 'entertainment', totalCents: 10972 });
  });

  it('returns an empty review for a year without data', () => {
    const empty = yearReview(TX, 2024, TODAY, EXCLUDED);
    expect(empty.expenseCents).toBe(0);
    expect(empty.biggestDay).toBeNull();
    expect(empty.mostFrequent).toBeNull();
  });
});
