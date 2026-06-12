import { describe, expect, it } from 'vitest';
import { addDays, daysInMonth, isoDate, monthKey, parseIsoDate, yearKey } from './dates';

describe('isoDate', () => {
  it('formats year, month, day with zero padding', () => {
    expect(isoDate(2026, 6, 3)).toBe('2026-06-03');
    expect(isoDate(2026, 12, 25)).toBe('2026-12-25');
  });
});

describe('parseIsoDate', () => {
  it('splits an ISO date into numeric parts', () => {
    expect(parseIsoDate('2026-06-03')).toEqual({ year: 2026, month: 6, day: 3 });
  });

  it('returns null for malformed input', () => {
    expect(parseIsoDate('2026/06/03')).toBeNull();
    expect(parseIsoDate('not a date')).toBeNull();
  });
});

describe('daysInMonth', () => {
  it('knows standard month lengths', () => {
    expect(daysInMonth(2026, 1)).toBe(31);
    expect(daysInMonth(2026, 4)).toBe(30);
  });

  it('handles February and leap years', () => {
    expect(daysInMonth(2026, 2)).toBe(28);
    expect(daysInMonth(2024, 2)).toBe(29);
  });
});

describe('addDays', () => {
  it('adds days within a month', () => {
    expect(addDays('2026-06-03', 4)).toBe('2026-06-07');
  });

  it('rolls over month and year boundaries', () => {
    expect(addDays('2026-06-30', 1)).toBe('2026-07-01');
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
  });

  it('subtracts with negative deltas', () => {
    expect(addDays('2026-06-01', -1)).toBe('2026-05-31');
  });
});

describe('period keys', () => {
  it('derives month and year keys from an ISO date', () => {
    expect(monthKey('2026-06-03')).toBe('2026-06');
    expect(yearKey('2026-06-03')).toBe('2026');
  });
});
