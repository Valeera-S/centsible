import { describe, expect, it } from 'vitest';
import { fingerprint, markDuplicates } from './dedup';

describe('fingerprint', () => {
  it('is identical for the same date, amount, and description', () => {
    expect(fingerprint({ date: '2026-06-03', amountCents: 1250, description: 'Chipotle' })).toBe(
      fingerprint({ date: '2026-06-03', amountCents: 1250, description: 'Chipotle' }),
    );
  });

  it('ignores case and extra whitespace in the description', () => {
    expect(fingerprint({ date: '2026-06-03', amountCents: 1250, description: '  CHIPOTLE ' })).toBe(
      fingerprint({ date: '2026-06-03', amountCents: 1250, description: 'chipotle' }),
    );
  });

  it('differs when any component differs', () => {
    const base = { date: '2026-06-03', amountCents: 1250, description: 'Chipotle' };
    expect(fingerprint({ ...base, amountCents: 1251 })).not.toBe(fingerprint(base));
    expect(fingerprint({ ...base, date: '2026-06-04' })).not.toBe(fingerprint(base));
    expect(fingerprint({ ...base, description: 'Chipotle 2' })).not.toBe(fingerprint(base));
  });
});

describe('markDuplicates', () => {
  const existing = [{ date: '2026-06-03', amountCents: 1250, description: 'Chipotle' }];

  it('flags drafts that match an existing transaction', () => {
    const drafts = [
      { date: '2026-06-03', amountCents: 1250, description: 'chipotle' },
      { date: '2026-06-03', amountCents: 9900, description: 'new thing' },
    ];
    expect(markDuplicates(drafts, existing)).toEqual([true, false]);
  });

  it('flags repeats within the draft batch after the first occurrence', () => {
    const drafts = [
      { date: '2026-06-05', amountCents: 650, description: 'coffee' },
      { date: '2026-06-05', amountCents: 650, description: 'coffee' },
    ];
    expect(markDuplicates(drafts, [])).toEqual([false, true]);
  });
});
