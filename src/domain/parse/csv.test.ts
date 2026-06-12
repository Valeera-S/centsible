import { describe, expect, it } from 'vitest';
import { parseCsv } from './csv';

describe('parseCsv', () => {
  it('splits rows and fields', () => {
    expect(parseCsv('a,b,c\nd,e,f')).toEqual([
      ['a', 'b', 'c'],
      ['d', 'e', 'f'],
    ]);
  });

  it('keeps commas inside quoted fields', () => {
    expect(parseCsv('"AMZN Mktp US, Inc",12')).toEqual([['AMZN Mktp US, Inc', '12']]);
  });

  it('unescapes doubled quotes', () => {
    expect(parseCsv('"say ""hi""",x')).toEqual([['say "hi"', 'x']]);
  });

  it('keeps newlines inside quoted fields', () => {
    expect(parseCsv('"line1\nline2",x')).toEqual([['line1\nline2', 'x']]);
  });

  it('handles CRLF line endings', () => {
    expect(parseCsv('a,b\r\nc,d')).toEqual([
      ['a', 'b'],
      ['c', 'd'],
    ]);
  });

  it('preserves empty fields', () => {
    expect(parseCsv('a,,c\n,,')).toEqual([
      ['a', '', 'c'],
      ['', '', ''],
    ]);
  });

  it('skips a trailing newline', () => {
    expect(parseCsv('a,b\n')).toEqual([['a', 'b']]);
  });
});
