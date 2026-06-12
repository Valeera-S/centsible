import { describe, expect, it } from 'vitest';
import { computeMonthlyBudget } from './budget';

const EXCLUDED = new Set(['rent']);

const JUNE_TRANSACTIONS = [
  { type: 'expense', amountCents: 10000, categoryId: 'dining', date: '2026-06-05' },
  { type: 'expense', amountCents: 5000, categoryId: 'groceries', date: '2026-06-08' },
  { type: 'expense', amountCents: -2000, categoryId: 'dining', date: '2026-06-09' },
  { type: 'expense', amountCents: 90000, categoryId: 'rent', date: '2026-06-01' },
  { type: 'income', amountCents: 200000, categoryId: 'stipend', date: '2026-06-03' },
  { type: 'expense', amountCents: 7777, categoryId: 'dining', date: '2026-05-20' },
] as const;

describe('computeMonthlyBudget mid-month', () => {
  const summary = computeMonthlyBudget({
    transactions: JUNE_TRANSACTIONS,
    year: 2026,
    month: 6,
    monthlyBudgetCents: 60000,
    excludedCategoryIds: EXCLUDED,
    today: '2026-06-10',
  });

  it('sums only in-month, non-excluded expenses (refunds net out)', () => {
    expect(summary.spentCents).toBe(13000);
  });

  it('reports remaining budget', () => {
    expect(summary.remainingCents).toBe(47000);
  });

  it('tracks calendar progress', () => {
    expect(summary.daysInMonth).toBe(30);
    expect(summary.daysElapsed).toBe(10);
    expect(summary.daysLeft).toBe(21);
  });

  it('computes the daily average so far', () => {
    expect(summary.dailyAverageCents).toBe(1300);
  });

  it('projects month-end spending from the daily average', () => {
    expect(summary.projectedCents).toBe(39000);
  });

  it('computes safe-to-spend per remaining day', () => {
    expect(summary.safeToSpendPerDayCents).toBe(2238);
  });
});

describe('computeMonthlyBudget edges', () => {
  const base = {
    transactions: JUNE_TRANSACTIONS,
    year: 2026,
    month: 6,
    monthlyBudgetCents: 60000,
    excludedCategoryIds: EXCLUDED,
  };

  it('treats a past month as fully elapsed with projection equal to actual', () => {
    const summary = computeMonthlyBudget({ ...base, today: '2026-07-15' });
    expect(summary.daysElapsed).toBe(30);
    expect(summary.daysLeft).toBe(0);
    expect(summary.projectedCents).toBe(summary.spentCents);
    expect(summary.safeToSpendPerDayCents).toBe(0);
  });

  it('treats a future month as not yet started but still sums its booked transactions', () => {
    const summary = computeMonthlyBudget({ ...base, today: '2026-05-01' });
    expect(summary.daysElapsed).toBe(0);
    expect(summary.daysLeft).toBe(30);
    expect(summary.dailyAverageCents).toBe(0);
    expect(summary.projectedCents).toBe(0);
    expect(summary.spentCents).toBe(13000);
    expect(summary.safeToSpendPerDayCents).toBe(Math.floor(47000 / 30));
  });

  it('floors safe-to-spend at zero when over budget', () => {
    const summary = computeMonthlyBudget({
      ...base,
      monthlyBudgetCents: 10000,
      today: '2026-06-10',
    });
    expect(summary.remainingCents).toBe(-3000);
    expect(summary.safeToSpendPerDayCents).toBe(0);
  });

  it('handles an empty month', () => {
    const summary = computeMonthlyBudget({
      transactions: [],
      year: 2026,
      month: 6,
      monthlyBudgetCents: 60000,
      excludedCategoryIds: EXCLUDED,
      today: '2026-06-10',
    });
    expect(summary.spentCents).toBe(0);
    expect(summary.remainingCents).toBe(60000);
  });
});
