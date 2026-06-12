import { describe, expect, it } from 'vitest';
import { frequentEntries } from './frequentEntries';

const TODAY = '2026-06-12';

function tx(
  note: string,
  amountCents: number,
  date: string,
  type: 'expense' | 'income' = 'expense',
) {
  return { type, amountCents, categoryId: 'dining', date, note };
}

describe('frequentEntries', () => {
  it('ranks repeated notes by count and drops one-offs', () => {
    const result = frequentEntries(
      [
        tx('午餐', 1000, '2026-06-01'),
        tx('午餐', 1200, '2026-06-05'),
        tx('午餐', 1500, '2026-06-10'),
        tx('coffee', 650, '2026-06-02'),
        tx('coffee', 650, '2026-06-08'),
        tx('Target', 9999, '2026-06-03'),
      ],
      TODAY,
    );
    expect(result.map((r) => r.description)).toEqual(['午餐', 'coffee']);
  });

  it('uses the most recent amount for each note', () => {
    const result = frequentEntries(
      [tx('午餐', 1000, '2026-06-01'), tx('午餐', 1500, '2026-06-10')],
      TODAY,
    );
    expect(result[0].amountCents).toBe(1500);
  });

  it('breaks count ties by recency', () => {
    const result = frequentEntries(
      [
        tx('older', 100, '2026-05-01'),
        tx('older', 100, '2026-06-10'),
        tx('newer', 200, '2026-05-02'),
        tx('newer', 200, '2026-06-11'),
      ],
      TODAY,
    );
    expect(result.map((r) => r.description)).toEqual(['newer', 'older']);
  });

  it('ignores stale, income, and unnamed transactions', () => {
    const result = frequentEntries(
      [
        tx('ancient', 100, '2026-01-01'),
        tx('ancient', 100, '2026-02-01'),
        tx('pay', 5000, '2026-06-01', 'income'),
        tx('pay', 5000, '2026-06-02', 'income'),
        tx('', 300, '2026-06-03'),
        tx('', 300, '2026-06-04'),
      ],
      TODAY,
    );
    expect(result).toEqual([]);
  });

  it('caps the list at the limit', () => {
    const transactions = ['a', 'b', 'c', 'd', 'e', 'f'].flatMap((note, i) => [
      tx(note, 100, `2026-06-0${i + 1}`),
      tx(note, 100, `2026-06-0${i + 2}`),
    ]);
    expect(frequentEntries(transactions, TODAY, 3)).toHaveLength(3);
  });

  it('groups case-insensitively but shows the latest casing', () => {
    const result = frequentEntries(
      [tx('coffee', 650, '2026-06-01'), tx('Coffee', 700, '2026-06-10')],
      TODAY,
    );
    expect(result).toEqual([{ description: 'Coffee', amountCents: 700 }]);
  });
});
