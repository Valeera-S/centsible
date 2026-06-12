import { describe, expect, it } from 'vitest';
import { parseMemo } from './memo';

// The user's real memo, verbatim structure. The two 总 (total) lines are the
// user's own hand-computed weekly sums and anchor the end-to-end check.
const JUNE_MEMO = `2025年6月
6月16日：Target - 104.52
6月17日：午餐 - 17.38; 饮料 - 3.84
6月18日：午餐 - 12.68; CVS - 7；买菜 - 6.98
6月19日：午餐 - 18.07
6月20日：无
6月21日：买菜 - 103.76
6月22日：无
总：274.23
6月23日：午餐 - 16.5
6月24日：午餐 - 12.28
6月25日：午餐 - 80
6月26日：无
6月27日：话费 - 5.1
6月28日：无
6月29日：Target - 14.7; 买菜 - 32.54
总：161.12`;

describe('parseMemo on the real June fixture', () => {
  const result = parseMemo(JUNE_MEMO, { defaultYear: 2026 });

  it('parses all 14 purchases', () => {
    expect(result.entries).toHaveLength(14);
  });

  it('takes the year from the memo header, not the default', () => {
    expect(result.entries.every((e) => e.date.startsWith('2025-06-'))).toBe(true);
  });

  it('parses single-item lines', () => {
    expect(result.entries[0]).toEqual({
      date: '2025-06-16',
      description: 'Target',
      amountCents: 10452,
    });
  });

  it('splits multi-item lines on both semicolon variants', () => {
    const june18 = result.entries.filter((e) => e.date === '2025-06-18');
    expect(june18).toEqual([
      { date: '2025-06-18', description: '午餐', amountCents: 1268 },
      { date: '2025-06-18', description: 'CVS', amountCents: 700 },
      { date: '2025-06-18', description: '买菜', amountCents: 698 },
    ]);
  });

  it('reproduces the hand-computed weekly subtotals exactly', () => {
    const week1 = result.entries
      .filter((e) => e.date >= '2025-06-16' && e.date <= '2025-06-22')
      .reduce((sum, e) => sum + e.amountCents, 0);
    const week2 = result.entries
      .filter((e) => e.date >= '2025-06-23' && e.date <= '2025-06-29')
      .reduce((sum, e) => sum + e.amountCents, 0);
    expect(week1).toBe(27423);
    expect(week2).toBe(16112);
    expect(result.subtotals).toEqual([27423, 16112]);
  });

  it('records no-spend days as skipped, not as entries', () => {
    const noSpend = result.skipped.filter((s) => s.reason === 'no-spend');
    expect(noSpend).toHaveLength(4);
  });

  it('records the header as skipped context', () => {
    expect(result.skipped.some((s) => s.reason === 'header')).toBe(true);
  });
});

describe('parseMemo edge cases', () => {
  it('uses the default year when there is no header', () => {
    const result = parseMemo('6月3日：lunch - 12', { defaultYear: 2026 });
    expect(result.entries).toEqual([
      { date: '2026-06-03', description: 'lunch', amountCents: 1200 },
    ]);
  });

  it('accepts half-width colons and no space around the dash', () => {
    const result = parseMemo('6月3日: lunch-12.5', { defaultYear: 2026 });
    expect(result.entries).toEqual([
      { date: '2026-06-03', description: 'lunch', amountCents: 1250 },
    ]);
  });

  it('keeps hyphenated merchant names intact', () => {
    const result = parseMemo('6月3日：7-eleven - 12', { defaultYear: 2026 });
    expect(result.entries).toEqual([
      { date: '2026-06-03', description: '7-eleven', amountCents: 1200 },
    ]);
  });

  it('falls back to space-separated amounts without a dash', () => {
    const result = parseMemo('6月3日：午餐 17.38', { defaultYear: 2026 });
    expect(result.entries).toEqual([
      { date: '2026-06-03', description: '午餐', amountCents: 1738 },
    ]);
  });

  it('marks unrecognized lines as unparsed', () => {
    const result = parseMemo('random note line', { defaultYear: 2026 });
    expect(result.entries).toEqual([]);
    expect(result.skipped).toEqual([{ line: 'random note line', reason: 'unparsed' }]);
  });

  it('marks items without an amount as unparsed but keeps siblings', () => {
    const result = parseMemo('6月3日：lunch - 12; mystery', { defaultYear: 2026 });
    expect(result.entries).toHaveLength(1);
    expect(result.skipped).toEqual([{ line: 'mystery', reason: 'unparsed' }]);
  });

  it('rejects impossible calendar dates', () => {
    const result = parseMemo('2月30日：lunch - 12', { defaultYear: 2026 });
    expect(result.entries).toEqual([]);
    expect(result.skipped).toEqual([{ line: '2月30日：lunch - 12', reason: 'unparsed' }]);
  });

  it('ignores blank lines silently', () => {
    const result = parseMemo('\n\n6月3日：lunch - 12\n\n', { defaultYear: 2026 });
    expect(result.entries).toHaveLength(1);
    expect(result.skipped).toEqual([]);
  });

  it('honors an inline year on a date line', () => {
    const result = parseMemo('2024年12月31日：dinner - 50', { defaultYear: 2026 });
    expect(result.entries).toEqual([
      { date: '2024-12-31', description: 'dinner', amountCents: 5000 },
    ]);
  });
});
