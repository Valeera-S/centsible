import { describe, expect, it } from 'vitest';
import { parseQuickEntry } from './quickEntry';

const REF = '2026-06-11';

describe('parseQuickEntry', () => {
  it('parses "description amount" into an expense on the reference date', () => {
    const result = parseQuickEntry('coffee 6.5', REF);
    expect(result.errors).toEqual([]);
    expect(result.items).toEqual([
      { description: 'coffee', amountCents: 650, date: REF, type: 'expense' },
    ]);
  });

  it('understands "yesterday"', () => {
    const result = parseQuickEntry('lunch 12 yesterday', REF);
    expect(result.items).toEqual([
      { description: 'lunch', amountCents: 1200, date: '2026-06-10', type: 'expense' },
    ]);
  });

  it('understands "today" and dollar signs', () => {
    const result = parseQuickEntry('dinner $25 today', REF);
    expect(result.items).toEqual([
      { description: 'dinner', amountCents: 2500, date: REF, type: 'expense' },
    ]);
  });

  it('parses the memo-style dash form', () => {
    const result = parseQuickEntry('Target - 104.52', REF);
    expect(result.items).toEqual([
      { description: 'Target', amountCents: 10452, date: REF, type: 'expense' },
    ]);
  });

  it('splits multiple entries on semicolons and newlines', () => {
    const result = parseQuickEntry('coffee 6.5; lunch 12\nuber 18.07', REF);
    expect(result.items.map((i) => i.description)).toEqual(['coffee', 'lunch', 'uber']);
    expect(result.items.map((i) => i.amountCents)).toEqual([650, 1200, 1807]);
  });

  it('supports the full-width Chinese semicolon', () => {
    const result = parseQuickEntry('午餐 17.38； 饮料 3.84', REF);
    expect(result.items.map((i) => i.amountCents)).toEqual([1738, 384]);
  });

  it('parses Chinese descriptions glued to the amount', () => {
    const result = parseQuickEntry('午餐17.38', REF);
    expect(result.items).toEqual([
      { description: '午餐', amountCents: 1738, date: REF, type: 'expense' },
    ]);
  });

  it('understands Chinese date words', () => {
    const result = parseQuickEntry('昨天 午餐 12', REF);
    expect(result.items).toEqual([
      { description: '午餐', amountCents: 1200, date: '2026-06-10', type: 'expense' },
    ]);
  });

  it('parses M/D dates in the reference year', () => {
    const result = parseQuickEntry('lunch 12 6/3', REF);
    expect(result.items).toEqual([
      { description: 'lunch', amountCents: 1200, date: '2026-06-03', type: 'expense' },
    ]);
  });

  it('parses Chinese M月D日 dates', () => {
    const result = parseQuickEntry('6月3日 买菜 32.54', REF);
    expect(result.items).toEqual([
      { description: '买菜', amountCents: 3254, date: '2026-06-03', type: 'expense' },
    ]);
  });

  it('treats a plus-prefixed amount as income', () => {
    const result = parseQuickEntry('tutoring +100', REF);
    expect(result.items).toEqual([
      { description: 'tutoring', amountCents: 10000, date: REF, type: 'income' },
    ]);
  });

  it('takes the last amount-like token as the amount', () => {
    const result = parseQuickEntry('uber 2 airport 15', REF);
    expect(result.items).toEqual([
      { description: 'uber 2 airport', amountCents: 1500, date: REF, type: 'expense' },
    ]);
  });

  it('reports a segment with no amount', () => {
    const result = parseQuickEntry('coffee', REF);
    expect(result.items).toEqual([]);
    expect(result.errors).toEqual([{ segment: 'coffee', reason: 'no-amount' }]);
  });

  it('reports a segment with no description', () => {
    const result = parseQuickEntry('12.5', REF);
    expect(result.items).toEqual([]);
    expect(result.errors).toEqual([{ segment: '12.5', reason: 'no-description' }]);
  });

  it('reports an invalid calendar date', () => {
    const result = parseQuickEntry('lunch 12 15/40', REF);
    expect(result.items).toEqual([]);
    expect(result.errors).toEqual([{ segment: 'lunch 12 15/40', reason: 'bad-date' }]);
  });

  it('keeps valid segments when a sibling segment fails', () => {
    const result = parseQuickEntry('coffee 6.5; oops', REF);
    expect(result.items).toHaveLength(1);
    expect(result.errors).toEqual([{ segment: 'oops', reason: 'no-amount' }]);
  });

  it('ignores empty segments', () => {
    const result = parseQuickEntry('coffee 6.5;;  ', REF);
    expect(result.items).toHaveLength(1);
    expect(result.errors).toEqual([]);
  });
});
