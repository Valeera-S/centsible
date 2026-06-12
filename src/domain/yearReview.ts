import { categoryBreakdown, dailyExpenseMap, noSpendStreaks } from './stats';
import type { Transaction } from './types';

export interface MerchantStat {
  description: string;
  totalCents: number;
  count: number;
}

export interface YearReview {
  year: number;
  /** Net budget-relevant spending (excluded categories left out, refunds netted). */
  expenseCents: number;
  incomeCents: number;
  transactionCount: number;
  biggestDay: { date: string; cents: number } | null;
  biggestTransaction: { description: string; cents: number; date: string } | null;
  topMerchants: MerchantStat[];
  mostFrequent: { description: string; count: number } | null;
  noSpendDays: number;
  longestStreak: number;
  monthlyTotals: number[];
  topCategory: { categoryId: string; totalCents: number } | null;
}

type ReviewSource = Pick<Transaction, 'type' | 'amountCents' | 'categoryId' | 'date' | 'note'>;

export function yearReview(
  transactions: readonly ReviewSource[],
  year: number,
  today: string,
  excludedCategoryIds: ReadonlySet<string>,
): YearReview {
  const from = `${year}-01-01`;
  const yearEnd = `${year}-12-31`;
  const to = today < yearEnd ? today : yearEnd;
  const range = { from, to: to < from ? yearEnd : to };

  let expenseCents = 0;
  let incomeCents = 0;
  let transactionCount = 0;
  let biggestTransaction: YearReview['biggestTransaction'] = null;
  const merchants = new Map<string, MerchantStat & { latestDate: string }>();
  const monthlyTotals = new Array<number>(12).fill(0);

  for (const t of transactions) {
    if (t.date.slice(0, 4) !== String(year)) continue;
    if (t.type === 'income') {
      incomeCents += t.amountCents;
      continue;
    }
    if (excludedCategoryIds.has(t.categoryId)) continue;

    expenseCents += t.amountCents;
    transactionCount += 1;
    monthlyTotals[Number(t.date.slice(5, 7)) - 1] += t.amountCents;

    if (t.amountCents > 0 && (!biggestTransaction || t.amountCents > biggestTransaction.cents)) {
      biggestTransaction = { description: t.note ?? '', cents: t.amountCents, date: t.date };
    }

    const note = (t.note ?? '').trim();
    if (note) {
      const key = note.toLowerCase();
      const merchant = merchants.get(key);
      if (!merchant) {
        merchants.set(key, {
          description: note,
          totalCents: t.amountCents,
          count: 1,
          latestDate: t.date,
        });
      } else {
        merchant.totalCents += t.amountCents;
        merchant.count += 1;
        if (t.date >= merchant.latestDate) {
          merchant.latestDate = t.date;
          merchant.description = note;
        }
      }
    }
  }

  const spendMap = dailyExpenseMap(transactions, range, excludedCategoryIds);
  let biggestDay: YearReview['biggestDay'] = null;
  for (const [date, cents] of spendMap) {
    if (!biggestDay || cents > biggestDay.cents) biggestDay = { date, cents };
  }

  const streaks = noSpendStreaks(new Set(spendMap.keys()), range);
  const elapsedDays =
    (Date.UTC(
      Number(range.to.slice(0, 4)),
      Number(range.to.slice(5, 7)) - 1,
      Number(range.to.slice(8)),
    ) -
      Date.UTC(year, 0, 1)) /
      86400000 +
    1;

  const ranked = [...merchants.values()].sort((a, b) => b.totalCents - a.totalCents);
  const frequent = [...merchants.values()]
    .filter((m) => m.count >= 2)
    .sort((a, b) =>
      a.count === b.count ? (a.latestDate < b.latestDate ? 1 : -1) : b.count - a.count,
    )[0];

  const breakdown = categoryBreakdown(
    transactions.filter((t) => !excludedCategoryIds.has(t.categoryId)),
    range,
    'expense',
  );

  return {
    year,
    expenseCents,
    incomeCents,
    transactionCount,
    biggestDay,
    biggestTransaction,
    topMerchants: ranked.slice(0, 5).map(({ description, totalCents, count }) => ({
      description,
      totalCents,
      count,
    })),
    mostFrequent: frequent ? { description: frequent.description, count: frequent.count } : null,
    noSpendDays: elapsedDays - spendMap.size,
    longestStreak: streaks.longest,
    monthlyTotals,
    topCategory: breakdown.length > 0 ? breakdown[0] : null,
  };
}
