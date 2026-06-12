import { isoDate } from '../dates';
import { parseAmount } from '../money';
import { parseCsv } from './csv';

export interface ChaseCsvRow {
  date: string;
  description: string;
  /** Positive cents for purchases; negative for refunds (returns). */
  amountCents: number;
  chaseCategory: string;
  suggestedCategoryId: string | null;
  kind: 'sale' | 'return';
}

export type ChaseCsvResult =
  | {
      ok: true;
      rows: ChaseCsvRow[];
      skippedPayments: number;
      /** 1-based csv line numbers of rows that could not be parsed. */
      skippedRows: number[];
    }
  | { ok: false; error: 'empty' | 'missing-columns' };

const CHASE_CATEGORY_TO_ID: Readonly<Record<string, string>> = {
  'food & drink': 'dining',
  groceries: 'groceries',
  gas: 'transportation',
  automotive: 'transportation',
  travel: 'travel',
  'health & wellness': 'health',
  shopping: 'shopping',
  'bills & utilities': 'bills',
  entertainment: 'entertainment',
  education: 'education',
};

const US_DATE = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/;

function parseUsDate(value: string): string | null {
  const match = US_DATE.exec(value.trim());
  if (!match) return null;
  return isoDate(Number(match[3]), Number(match[1]), Number(match[2]));
}

export function parseChaseCsv(text: string): ChaseCsvResult {
  const allRows = parseCsv(text).filter((row) => row.some((field) => field.trim() !== ''));
  if (allRows.length === 0) return { ok: false, error: 'empty' };

  const header = allRows[0].map((h) => h.trim().toLowerCase());
  const col = {
    date: header.indexOf('transaction date'),
    description: header.indexOf('description'),
    category: header.indexOf('category'),
    type: header.indexOf('type'),
    amount: header.indexOf('amount'),
  };
  if (col.date < 0 || col.description < 0 || col.type < 0 || col.amount < 0) {
    return { ok: false, error: 'missing-columns' };
  }

  const rows: ChaseCsvRow[] = [];
  const skippedRows: number[] = [];
  let skippedPayments = 0;

  for (let i = 1; i < allRows.length; i++) {
    const raw = allRows[i];
    const type = (raw[col.type] ?? '').trim().toLowerCase();
    if (type === 'payment') {
      skippedPayments += 1;
      continue;
    }

    const date = parseUsDate(raw[col.date] ?? '');
    const csvCents = parseAmount(raw[col.amount] ?? '');
    const description = (raw[col.description] ?? '').trim();
    if (!date || csvCents === null || !description) {
      skippedRows.push(i + 1);
      continue;
    }

    const chaseCategory = col.category >= 0 ? (raw[col.category] ?? '').trim() : '';
    rows.push({
      date,
      description,
      // Chase reports purchases as negative amounts; flip so spending is positive.
      amountCents: -csvCents,
      chaseCategory,
      suggestedCategoryId: CHASE_CATEGORY_TO_ID[chaseCategory.toLowerCase()] ?? null,
      kind: type === 'return' ? 'return' : 'sale',
    });
  }

  return { ok: true, rows, skippedPayments, skippedRows };
}
