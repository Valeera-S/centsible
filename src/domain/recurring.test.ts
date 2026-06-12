import { describe, expect, it } from 'vitest';
import { dueOccurrences, periodKeyOf } from './recurring';
import type { RecurringRule } from './types';

function rule(overrides: Partial<RecurringRule>): RecurringRule {
  return {
    id: 'r1',
    name: 'Spotify',
    amountCents: 999,
    type: 'expense',
    categoryId: 'entertainment',
    interval: 'monthly',
    dayOfMonth: 1,
    startDate: '2026-01-01',
    createdAt: 0,
    updatedAt: 0,
    ...overrides,
  };
}

describe('dueOccurrences (monthly)', () => {
  it('catches up every missed month since the start date', () => {
    const r = rule({ startDate: '2026-04-10' });
    expect(dueOccurrences(r, '2026-06-11')).toEqual(['2026-05-01', '2026-06-01']);
  });

  it('clamps day 31 to the end of shorter months', () => {
    const r = rule({ dayOfMonth: 31, startDate: '2026-01-01' });
    expect(dueOccurrences(r, '2026-03-05')).toEqual(['2026-01-31', '2026-02-28']);
  });

  it('resumes after the last posted period', () => {
    const r = rule({ lastPostedPeriod: '2026-05' });
    expect(dueOccurrences(r, '2026-06-11')).toEqual(['2026-06-01']);
  });

  it('returns nothing when this month is not yet due', () => {
    const r = rule({ dayOfMonth: 15, lastPostedPeriod: '2026-05' });
    expect(dueOccurrences(r, '2026-06-11')).toEqual([]);
  });

  it('stops at the end date', () => {
    const r = rule({ endDate: '2026-05-31', lastPostedPeriod: '2026-04' });
    expect(dueOccurrences(r, '2026-06-11')).toEqual(['2026-05-01']);
  });

  it('returns nothing before the start date', () => {
    const r = rule({ startDate: '2026-07-01' });
    expect(dueOccurrences(r, '2026-06-11')).toEqual([]);
  });
});

describe('dueOccurrences (yearly)', () => {
  const yearly = rule({
    interval: 'yearly',
    monthOfYear: 9,
    dayOfMonth: 1,
    startDate: '2025-09-01',
  });

  it('is not due before the anniversary month', () => {
    expect(dueOccurrences({ ...yearly, lastPostedPeriod: '2025' }, '2026-06-11')).toEqual([]);
  });

  it('is due once the anniversary passes', () => {
    expect(dueOccurrences({ ...yearly, lastPostedPeriod: '2025' }, '2026-09-02')).toEqual([
      '2026-09-01',
    ]);
  });

  it('catches up multiple missed years', () => {
    expect(dueOccurrences(yearly, '2027-10-01')).toEqual([
      '2025-09-01',
      '2026-09-01',
      '2027-09-01',
    ]);
  });
});

describe('periodKeyOf', () => {
  it('uses yyyy-mm for monthly and yyyy for yearly', () => {
    expect(periodKeyOf('2026-06-01', 'monthly')).toBe('2026-06');
    expect(periodKeyOf('2026-06-01', 'yearly')).toBe('2026');
  });
});
