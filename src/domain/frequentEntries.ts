import { addDays } from './dates';
import type { Transaction } from './types';

export interface FrequentEntry {
  description: string;
  amountCents: number;
}

type FrequentSource = Pick<Transaction, 'type' | 'amountCents' | 'date' | 'note'>;

const LOOKBACK_DAYS = 90;
const MIN_OCCURRENCES = 2;

/**
 * The expenses the user keeps typing: notes repeated at least twice in the
 * last 90 days, ranked by count then recency, each carrying its most recent
 * amount so one tap pre-fills a realistic entry.
 */
export function frequentEntries(
  transactions: readonly FrequentSource[],
  today: string,
  limit = 5,
): FrequentEntry[] {
  const since = addDays(today, -LOOKBACK_DAYS);
  const groups = new Map<
    string,
    { count: number; latestDate: string; description: string; amountCents: number }
  >();

  for (const t of transactions) {
    if (t.type !== 'expense' || t.date < since || t.date > today) continue;
    const note = (t.note ?? '').trim();
    if (!note) continue;
    const key = note.toLowerCase();
    const group = groups.get(key);
    if (!group) {
      groups.set(key, {
        count: 1,
        latestDate: t.date,
        description: note,
        amountCents: t.amountCents,
      });
    } else {
      group.count += 1;
      if (t.date >= group.latestDate) {
        group.latestDate = t.date;
        group.description = note;
        group.amountCents = t.amountCents;
      }
    }
  }

  return [...groups.values()]
    .filter((g) => g.count >= MIN_OCCURRENCES)
    .sort((a, b) =>
      a.count === b.count ? (a.latestDate < b.latestDate ? 1 : -1) : b.count - a.count,
    )
    .slice(0, limit)
    .map((g) => ({ description: g.description, amountCents: g.amountCents }));
}
