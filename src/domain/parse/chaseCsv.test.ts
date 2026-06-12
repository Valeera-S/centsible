import { describe, expect, it } from 'vitest';
import { parseChaseCsv } from './chaseCsv';

const HEADER = 'Transaction Date,Post Date,Description,Category,Type,Amount,Memo';

describe('parseChaseCsv', () => {
  it('parses a sale into a positive-cent expense draft', () => {
    const csv = `${HEADER}\n06/03/2026,06/04/2026,CHIPOTLE 1234,Food & Drink,Sale,-12.50,`;
    const result = parseChaseCsv(csv);
    if (!result.ok) throw new Error('expected ok');
    expect(result.rows).toEqual([
      {
        date: '2026-06-03',
        description: 'CHIPOTLE 1234',
        amountCents: 1250,
        chaseCategory: 'Food & Drink',
        suggestedCategoryId: 'dining',
        kind: 'sale',
      },
    ]);
  });

  it('parses a return into a negative-cent refund draft', () => {
    const csv = `${HEADER}\n06/05/2026,06/06/2026,TARGET RETURN,Shopping,Return,14.70,`;
    const result = parseChaseCsv(csv);
    if (!result.ok) throw new Error('expected ok');
    expect(result.rows).toEqual([
      {
        date: '2026-06-05',
        description: 'TARGET RETURN',
        amountCents: -1470,
        chaseCategory: 'Shopping',
        suggestedCategoryId: 'shopping',
        kind: 'return',
      },
    ]);
  });

  it('skips card payments and counts them', () => {
    const csv = `${HEADER}\n06/01/2026,06/01/2026,Payment Thank You-Mobile,,Payment,500.00,\n06/03/2026,06/04/2026,KROGER,Groceries,Sale,-50.00,`;
    const result = parseChaseCsv(csv);
    if (!result.ok) throw new Error('expected ok');
    expect(result.rows).toHaveLength(1);
    expect(result.skippedPayments).toBe(1);
  });

  it('handles quoted descriptions containing commas', () => {
    const csv = `${HEADER}\n06/03/2026,06/04/2026,"AMZN Mktp US, Inc",Shopping,Sale,-25.00,`;
    const result = parseChaseCsv(csv);
    if (!result.ok) throw new Error('expected ok');
    expect(result.rows[0].description).toBe('AMZN Mktp US, Inc');
  });

  it('maps known Chase categories and leaves unknown ones null', () => {
    const csv = [
      HEADER,
      '06/03/2026,06/04/2026,SHELL,Gas,Sale,-30.00,',
      '06/03/2026,06/04/2026,MYSTERY,Something New,Sale,-10.00,',
      '06/03/2026,06/04/2026,NOCAT,,Sale,-5.00,',
    ].join('\n');
    const result = parseChaseCsv(csv);
    if (!result.ok) throw new Error('expected ok');
    expect(result.rows.map((r) => r.suggestedCategoryId)).toEqual(['transportation', null, null]);
  });

  it('accepts reordered columns by reading the header', () => {
    const csv =
      'Amount,Type,Description,Transaction Date,Post Date,Category,Memo\n-9.99,Sale,SPOTIFY,06/07/2026,06/08/2026,Bills & Utilities,';
    const result = parseChaseCsv(csv);
    if (!result.ok) throw new Error('expected ok');
    expect(result.rows[0]).toMatchObject({
      date: '2026-06-07',
      description: 'SPOTIFY',
      amountCents: 999,
      suggestedCategoryId: 'bills',
    });
  });

  it('rejects a csv without the required columns', () => {
    const result = parseChaseCsv('Date,Name,Value\n06/03/2026,x,1');
    expect(result).toEqual({ ok: false, error: 'missing-columns' });
  });

  it('rejects an empty file', () => {
    expect(parseChaseCsv('')).toEqual({ ok: false, error: 'empty' });
    expect(parseChaseCsv('\n\n')).toEqual({ ok: false, error: 'empty' });
  });

  it('skips malformed data rows but keeps good ones', () => {
    const csv = `${HEADER}\n06/03/2026,06/04/2026,GOOD,Groceries,Sale,-10.00,\nnot-a-date,x,BAD,Groceries,Sale,abc,`;
    const result = parseChaseCsv(csv);
    if (!result.ok) throw new Error('expected ok');
    expect(result.rows).toHaveLength(1);
    expect(result.skippedRows).toEqual([3]);
  });
});
