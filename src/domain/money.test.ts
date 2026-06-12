import { describe, expect, it } from 'vitest';
import { formatCents, parseAmount, sumCents } from './money';

describe('parseAmount', () => {
  it('parses a plain decimal string to integer cents', () => {
    expect(parseAmount('104.52')).toBe(10452);
  });

  it('parses whole numbers', () => {
    expect(parseAmount('7')).toBe(700);
  });

  it('parses a single decimal digit', () => {
    expect(parseAmount('6.5')).toBe(650);
  });

  it('accepts dollar sign and thousands separators', () => {
    expect(parseAmount('$1,234.56')).toBe(123456);
  });

  it('parses negative amounts', () => {
    expect(parseAmount('-3.84')).toBe(-384);
  });

  it('rounds beyond-cent precision half away from zero', () => {
    expect(parseAmount('1.005')).toBe(101);
    expect(parseAmount('1.004')).toBe(100);
  });

  it('avoids binary float rounding errors', () => {
    expect(parseAmount('0.29')).toBe(29);
    expect(parseAmount('19.99')).toBe(1999);
  });

  it('returns null for non-numeric input', () => {
    expect(parseAmount('abc')).toBeNull();
    expect(parseAmount('')).toBeNull();
    expect(parseAmount('1.2.3')).toBeNull();
    expect(parseAmount('12abc')).toBeNull();
  });
});

describe('formatCents', () => {
  it('formats cents as dollars with two decimals', () => {
    expect(formatCents(10452)).toBe('$104.52');
  });

  it('pads cents and shows zero', () => {
    expect(formatCents(700)).toBe('$7.00');
    expect(formatCents(0)).toBe('$0.00');
  });

  it('formats negative amounts with a leading minus', () => {
    expect(formatCents(-384)).toBe('-$3.84');
  });

  it('groups thousands', () => {
    expect(formatCents(123456789)).toBe('$1,234,567.89');
  });
});

describe('sumCents', () => {
  it('sums an array of cent values', () => {
    expect(sumCents([10452, 700, -384])).toBe(10768);
  });

  it('sums an empty array to zero', () => {
    expect(sumCents([])).toBe(0);
  });
});
