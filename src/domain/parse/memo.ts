import { daysInMonth, isoDate } from '../dates';
import { parseAmount } from '../money';

export interface MemoEntry {
  date: string;
  description: string;
  amountCents: number;
}

export type MemoSkipReason = 'no-spend' | 'header' | 'unparsed';

export interface MemoSkipped {
  line: string;
  reason: MemoSkipReason;
}

export interface MemoParseOptions {
  /** Year assumed for date lines when the memo has no yyyy年 header. */
  defaultYear: number;
}

export interface MemoParseResult {
  entries: MemoEntry[];
  skipped: MemoSkipped[];
  /** Cents from 总 (total) lines, in order; lets callers cross-check sums. */
  subtotals: number[];
}

const HEADER = /^(\d{4})年(\d{1,2})月$/;
const SUBTOTAL = /^总\s*[:：]\s*(.+)$/;
const DATE_LINE = /^(?:(\d{4})年)?(\d{1,2})月(\d{1,2})日\s*[:：]\s*(.*)$/;
const NO_SPEND = '无';
// Lazy description, so the dash matched is the last one before a trailing amount;
// hyphenated names like 7-eleven stay intact.
const DASH_ITEM = /^(.+?)\s*[-–—]\s*\$?([\d,]+(?:\.\d+)?)\s*$/;
const SPACE_ITEM = /^(.+?)\s+\$?([\d,]+(?:\.\d+)?)\s*$/;

function parseItem(item: string): { description: string; amountCents: number } | null {
  const match = DASH_ITEM.exec(item) ?? SPACE_ITEM.exec(item);
  if (!match) return null;
  const amountCents = parseAmount(match[2]);
  if (amountCents === null) return null;
  return { description: match[1].trim(), amountCents };
}

export function parseMemo(text: string, options: MemoParseOptions): MemoParseResult {
  const entries: MemoEntry[] = [];
  const skipped: MemoSkipped[] = [];
  const subtotals: number[] = [];
  let contextYear = options.defaultYear;

  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line) continue;

    const header = HEADER.exec(line);
    if (header) {
      contextYear = Number(header[1]);
      skipped.push({ line, reason: 'header' });
      continue;
    }

    const subtotal = SUBTOTAL.exec(line);
    if (subtotal) {
      const cents = parseAmount(subtotal[1]);
      if (cents !== null) subtotals.push(cents);
      continue;
    }

    const dateLine = DATE_LINE.exec(line);
    if (!dateLine) {
      skipped.push({ line, reason: 'unparsed' });
      continue;
    }

    const year = dateLine[1] ? Number(dateLine[1]) : contextYear;
    const month = Number(dateLine[2]);
    const day = Number(dateLine[3]);
    if (month < 1 || month > 12 || day < 1 || day > daysInMonth(year, month)) {
      skipped.push({ line, reason: 'unparsed' });
      continue;
    }
    const date = isoDate(year, month, day);

    const content = dateLine[4].trim();
    if (content === NO_SPEND) {
      skipped.push({ line, reason: 'no-spend' });
      continue;
    }

    for (const rawItem of content.split(/[;；]/)) {
      const item = rawItem.trim();
      if (!item) continue;
      const parsed = parseItem(item);
      if (parsed) {
        entries.push({ date, ...parsed });
      } else {
        skipped.push({ line: item, reason: 'unparsed' });
      }
    }
  }

  return { entries, skipped, subtotals };
}
