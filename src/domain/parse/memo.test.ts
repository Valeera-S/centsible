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

  it('reads a bare year line and bare month headers', () => {
    const result = parseMemo('2025\n6月\n6月16日：Target - 104.52', { defaultYear: 2026 });
    expect(result.entries).toEqual([
      { date: '2025-06-16', description: 'Target', amountCents: 10452 },
    ]);
    expect(result.skipped.filter((s) => s.reason === 'header')).toHaveLength(2);
  });

  it('rolls the year over when the month decreases', () => {
    const memo = `2025
12月31日：Lyft - 9.99
1月2日：买菜 - 72.89
1月
1月5日：话费 - 18.05`;
    const result = parseMemo(memo, { defaultYear: 2020 });
    expect(result.entries.map((e) => e.date)).toEqual(['2025-12-31', '2026-01-02', '2026-01-05']);
  });

  it('accepts 号 as the day suffix', () => {
    const result = parseMemo('6月9号：午餐 - 9.44', { defaultYear: 2026 });
    expect(result.entries).toEqual([{ date: '2026-06-09', description: '午餐', amountCents: 944 }]);
  });

  it('accepts colon-separated items', () => {
    const mixed = parseMemo('7月14日：午餐 - 11.14；买菜：23.79', { defaultYear: 2026 });
    expect(mixed.entries).toEqual([
      { date: '2026-07-14', description: '午餐', amountCents: 1114 },
      { date: '2026-07-14', description: '买菜', amountCents: 2379 },
    ]);
    const western = parseMemo('2月1日：Cursor: 22.13', { defaultYear: 2026 });
    expect(western.entries).toEqual([
      { date: '2026-02-01', description: 'Cursor', amountCents: 2213 },
    ]);
  });

  it('accepts a bare amount as a description-less entry', () => {
    const result = parseMemo('4月5日：18.05', { defaultYear: 2026 });
    expect(result.entries).toEqual([{ date: '2026-04-05', description: '', amountCents: 1805 }]);
  });
});

describe('parseMemo paragraph subtotal checks', () => {
  it('checks each blank-line block against its own 总 line', () => {
    const memo = `6月16日：a - 10
6月17日：b - 20
总：30

6月18日：c - 5
总：5`;
    const result = parseMemo(memo, { defaultYear: 2026 });
    expect(result.subtotalChecks).toEqual([
      { line: '总：30', expectedCents: 3000, actualCents: 3000 },
      { line: '总：5', expectedCents: 500, actualCents: 500 },
    ]);
  });

  it('reports a mismatching block without affecting others', () => {
    const memo = `6月16日：a - 10
总：99

6月18日：c - 5
总：5`;
    const result = parseMemo(memo, { defaultYear: 2026 });
    expect(result.subtotalChecks[0]).toEqual({
      line: '总：99',
      expectedCents: 9900,
      actualCents: 1000,
    });
    expect(result.subtotalChecks[1].expectedCents).toBe(500);
    expect(result.subtotalChecks[1].actualCents).toBe(500);
  });

  it('leaves blocks without a 总 line unchecked', () => {
    const memo = `5月4日：CVS - 33.33
5月5日：午饭 - 46.70

5月11日：午饭 - 32.54
总：32.54`;
    const result = parseMemo(memo, { defaultYear: 2026 });
    expect(result.subtotalChecks).toHaveLength(1);
    expect(result.subtotalChecks[0].actualCents).toBe(3254);
  });

  it('ignores trailing entries after the final 总', () => {
    const memo = `6月1日：a - 10
总：10

6月4日：b - 20
6月5日：c - 30`;
    const result = parseMemo(memo, { defaultYear: 2026 });
    expect(result.subtotalChecks).toHaveLength(1);
    expect(result.entries).toHaveLength(3);
  });
});
