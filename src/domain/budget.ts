import { daysInMonth, isoDate, monthKey, parseIsoDate } from './dates';
import type { Transaction } from './types';

export type BudgetTransaction = Pick<Transaction, 'type' | 'amountCents' | 'categoryId' | 'date'>;

export interface BudgetInput {
  transactions: readonly BudgetTransaction[];
  year: number;
  /** 1-12. */
  month: number;
  monthlyBudgetCents: number;
  /** Categories flagged excludeFromBudget (e.g. rent). */
  excludedCategoryIds: ReadonlySet<string>;
  /** ISO yyyy-mm-dd; anchors elapsed/remaining-day math. */
  today: string;
}

export interface BudgetSummary {
  budgetCents: number;
  spentCents: number;
  remainingCents: number;
  daysInMonth: number;
  daysElapsed: number;
  /** Remaining spending days; includes today while the month is current. */
  daysLeft: number;
  dailyAverageCents: number;
  /** Expected month-end spend at the current daily pace. */
  projectedCents: number;
  safeToSpendPerDayCents: number;
}

export function computeMonthlyBudget(input: BudgetInput): BudgetSummary {
  const { year, month, monthlyBudgetCents, excludedCategoryIds, today } = input;
  const now = parseIsoDate(today);
  if (!now) throw new Error(`Invalid today date: ${today}`);

  const key = monthKey(isoDate(year, month, 1));
  const totalDays = daysInMonth(year, month);

  let spentCents = 0;
  for (const t of input.transactions) {
    if (t.type !== 'expense') continue;
    if (monthKey(t.date) !== key) continue;
    if (excludedCategoryIds.has(t.categoryId)) continue;
    spentCents += t.amountCents;
  }

  const todayKey = monthKey(today);
  let daysElapsed: number;
  if (todayKey > key) daysElapsed = totalDays;
  else if (todayKey < key) daysElapsed = 0;
  else daysElapsed = now.day;

  const daysLeft = todayKey > key ? 0 : totalDays - daysElapsed + (todayKey === key ? 1 : 0);

  const remainingCents = monthlyBudgetCents - spentCents;
  const dailyAverageCents = daysElapsed > 0 ? Math.round(spentCents / daysElapsed) : 0;

  let projectedCents: number;
  if (todayKey > key) projectedCents = spentCents;
  else if (todayKey < key) projectedCents = 0;
  else projectedCents = Math.round(dailyAverageCents * totalDays);

  const safeToSpendPerDayCents =
    daysLeft > 0 ? Math.max(0, Math.floor(remainingCents / daysLeft)) : 0;

  return {
    budgetCents: monthlyBudgetCents,
    spentCents,
    remainingCents,
    daysInMonth: totalDays,
    daysElapsed,
    daysLeft,
    dailyAverageCents,
    projectedCents,
    safeToSpendPerDayCents,
  };
}
