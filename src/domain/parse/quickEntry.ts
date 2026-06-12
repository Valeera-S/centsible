import { addDays, daysInMonth, isoDate, parseIsoDate } from '../dates';
import { parseAmount } from '../money';
import type { TransactionType } from '../types';

export interface QuickEntryItem {
  description: string;
  amountCents: number;
  date: string;
  type: TransactionType;
}

export type QuickEntryErrorReason = 'no-amount' | 'no-description' | 'bad-date';

export interface QuickEntryError {
  segment: string;
  reason: QuickEntryErrorReason;
}

export interface QuickEntryResult {
  items: QuickEntryItem[];
  errors: QuickEntryError[];
}

const CN_DATE = /(\d{1,2})月(\d{1,2})日/;
const SLASH_DATE = /(?:^|\s)(\d{1,2})\/(\d{1,2})(?=\s|$)/;
const RELATIVE_WORDS: ReadonlyArray<[RegExp, number]> = [
  [/(?:^|\s)today(?=\s|$)|今天/i, 0],
  [/(?:^|\s)yesterday(?=\s|$)|昨天/i, -1],
  [/前天/, -2],
];
// Marks the boundary between CJK text and a glued number ("午餐17.38").
const CJK_BEFORE_NUMBER = /([一-鿿])(?=[$+\d])/gu;
const NUMBER_BEFORE_CJK = /(\d)(?=[一-鿿])/gu;

type DateExtraction =
  | { kind: 'ok'; date: string; rest: string }
  | { kind: 'none'; rest: string }
  | { kind: 'invalid' };

function extractDate(segment: string, referenceDate: string): DateExtraction {
  const ref = parseIsoDate(referenceDate);
  if (!ref) throw new Error(`Invalid reference date: ${referenceDate}`);

  for (const pattern of [CN_DATE, SLASH_DATE]) {
    const match = pattern.exec(segment);
    if (!match) continue;
    const month = Number(match[1]);
    const day = Number(match[2]);
    if (month < 1 || month > 12 || day < 1 || day > daysInMonth(ref.year, month)) {
      return { kind: 'invalid' };
    }
    return {
      kind: 'ok',
      date: isoDate(ref.year, month, day),
      rest: segment.replace(match[0], ' '),
    };
  }

  for (const [pattern, offset] of RELATIVE_WORDS) {
    const match = pattern.exec(segment);
    if (!match) continue;
    return {
      kind: 'ok',
      date: addDays(referenceDate, offset),
      rest: segment.replace(match[0], ' '),
    };
  }

  return { kind: 'none', rest: segment };
}

function isAmountToken(token: string): boolean {
  return /^\+?\$?\d/.test(token);
}

export function parseQuickEntry(input: string, referenceDate: string): QuickEntryResult {
  const items: QuickEntryItem[] = [];
  const errors: QuickEntryError[] = [];

  for (const rawSegment of input.split(/[;；\n]/)) {
    const segment = rawSegment.trim();
    if (!segment) continue;

    const extraction = extractDate(segment, referenceDate);
    if (extraction.kind === 'invalid') {
      errors.push({ segment, reason: 'bad-date' });
      continue;
    }
    const date = extraction.kind === 'ok' ? extraction.date : referenceDate;

    const tokens = extraction.rest
      .replace(CJK_BEFORE_NUMBER, '$1 ')
      .replace(NUMBER_BEFORE_CJK, '$1 ')
      .split(/\s+/)
      .filter((t) => t.length > 0 && t !== '-' && t !== '–');

    let amountCents: number | null = null;
    let type: TransactionType = 'expense';
    for (let i = tokens.length - 1; i >= 0; i--) {
      const token = tokens[i];
      if (!isAmountToken(token)) continue;
      const parsed = parseAmount(token);
      if (parsed === null) continue;
      amountCents = parsed;
      type = token.startsWith('+') ? 'income' : 'expense';
      tokens.splice(i, 1);
      break;
    }

    if (amountCents === null) {
      errors.push({ segment, reason: 'no-amount' });
      continue;
    }

    const description = tokens.join(' ').trim();
    if (!description) {
      errors.push({ segment, reason: 'no-description' });
      continue;
    }

    items.push({ description, amountCents, date, type });
  }

  return { items, errors };
}
