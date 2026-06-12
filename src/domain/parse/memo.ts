import { daysInMonth, isoDate } from '../dates';
import { parseAmount } from '../money';

export interface MemoEntry {
  date: string;
  /** Empty when the memo line only carried an amount. */
  description: string;
  amountCents: number;
}

export type MemoSkipReason = 'no-spend' | 'header' | 'unparsed';

export interface MemoSkipped {
  line: string;
  reason: MemoSkipReason;
}

export interface MemoParseOptions {
  /** Year assumed when the memo has no year header at all. */
  defaultYear: number;
}

export interface SubtotalCheck {
  line: string;
  /** Cents written on the 总 line. */
  expectedCents: number;
  /** Cents actually parsed in that blank-line-separated block. */
  actualCents: number;
}

export interface MemoParseResult {
  entries: MemoEntry[];
  skipped: MemoSkipped[];
  /** Cents from 总 lines, in order. */
  subtotals: number[];
  /** One per 总 line: the block sum it should equal. */
  subtotalChecks: SubtotalCheck[];
}

const FULL_HEADER = /^(\d{4})年(\d{1,2})月$/;
const YEAR_HEADER = /^(\d{4})年?$/;
const MONTH_HEADER = /^(\d{1,2})月$/;
const SUBTOTAL = /^总\s*[:：]\s*(.+)$/;
const DATE_LINE = /^(?:(\d{4})年)?(\d{1,2})月(\d{1,2})[日号]\s*[:：]\s*(.*)$/;
const NO_SPEND = '无';
// Lazy description, so the dash matched is the last one before a trailing amount;
// hyphenated names like 7-eleven stay intact.
const DASH_ITEM = /^(.+?)\s*[-–—]\s*\$?([\d,]+(?:\.\d+)?)\s*$/;
const COLON_ITEM = /^(.+?)\s*[:：]\s*\$?([\d,]+(?:\.\d+)?)\s*$/;
const SPACE_ITEM = /^(.+?)\s+\$?([\d,]+(?:\.\d+)?)\s*$/;
const BARE_AMOUNT = /^\$?([\d,]+(?:\.\d+)?)$/;

function parseItem(item: string): { description: string; amountCents: number } | null {
  const bare = BARE_AMOUNT.exec(item);
  if (bare) {
    const amountCents = parseAmount(bare[1]);
    return amountCents === null ? null : { description: '', amountCents };
  }
  const match = DASH_ITEM.exec(item) ?? COLON_ITEM.exec(item) ?? SPACE_ITEM.exec(item);
  if (!match) return null;
  const amountCents = parseAmount(match[2]);
  if (amountCents === null) return null;
  return { description: match[1].trim(), amountCents };
}

export function parseMemo(text: string, options: MemoParseOptions): MemoParseResult {
  const entries: MemoEntry[] = [];
  const skipped: MemoSkipped[] = [];
  const subtotals: number[] = [];
  const subtotalChecks: SubtotalCheck[] = [];

  let contextYear = options.defaultYear;
  // Memos are chronological; a month smaller than the last one means the year
  // rolled over (12月 ... 1月).
  let lastMonth: number | null = null;
  let blockSumCents = 0;

  const advanceMonth = (month: number) => {
    if (lastMonth !== null && month < lastMonth) contextYear += 1;
    lastMonth = month;
  };

  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line) {
      blockSumCents = 0;
      continue;
    }

    const fullHeader = FULL_HEADER.exec(line);
    if (fullHeader) {
      contextYear = Number(fullHeader[1]);
      lastMonth = Number(fullHeader[2]);
      skipped.push({ line, reason: 'header' });
      continue;
    }

    const yearHeader = YEAR_HEADER.exec(line);
    if (yearHeader) {
      contextYear = Number(yearHeader[1]);
      lastMonth = null;
      skipped.push({ line, reason: 'header' });
      continue;
    }

    const monthHeader = MONTH_HEADER.exec(line);
    if (monthHeader) {
      advanceMonth(Number(monthHeader[1]));
      skipped.push({ line, reason: 'header' });
      continue;
    }

    const subtotal = SUBTOTAL.exec(line);
    if (subtotal) {
      const cents = parseAmount(subtotal[1]);
      if (cents !== null) {
        subtotals.push(cents);
        subtotalChecks.push({ line, expectedCents: cents, actualCents: blockSumCents });
      }
      blockSumCents = 0;
      continue;
    }

    const dateLine = DATE_LINE.exec(line);
    if (!dateLine) {
      skipped.push({ line, reason: 'unparsed' });
      continue;
    }

    const month = Number(dateLine[2]);
    const day = Number(dateLine[3]);
    let year: number;
    if (dateLine[1]) {
      // An inline year pins this line only; it does not move the running context.
      year = Number(dateLine[1]);
    } else {
      advanceMonth(month);
      year = contextYear;
    }
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
        blockSumCents += parsed.amountCents;
      } else {
        skipped.push({ line: item, reason: 'unparsed' });
      }
    }
  }

  return { entries, skipped, subtotals, subtotalChecks };
}
