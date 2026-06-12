import { describe, expect, it } from 'vitest';
import { parseIsoDate, todayIso } from './dates';

describe('todayIso', () => {
  it('returns a valid ISO date for the local calendar day', () => {
    const today = todayIso();
    const parts = parseIsoDate(today);
    expect(parts).not.toBeNull();
    const now = new Date();
    expect(parts?.year).toBe(now.getFullYear());
    expect(parts?.month).toBe(now.getMonth() + 1);
    expect(parts?.day).toBe(now.getDate());
  });
});
