import { lazy, Suspense, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { useDb } from '../../db/dbContext';
import { getSettings, listCategories } from '../../db/repo';
import { daysSince, needsBackupReminder } from '../../domain/backupReminder';
import { computeMonthlyBudget } from '../../domain/budget';
import { monthKey, parseIsoDate, todayIso } from '../../domain/dates';
import { formatCents } from '../../domain/money';
import {
  categoryBreakdown,
  cumulativeDailySpend,
  dailyExpenseMap,
  periodRange,
  shiftReference,
  summarize,
  trendSeries,
  type Period,
} from '../../domain/stats';
import { useStrings } from '../../i18n/localeContext';
import { BudgetRing } from './BudgetRing';
import { CategoryDonut } from './CategoryDonut';
import { Heatmap } from './Heatmap';

// Recharts is the heaviest dependency; loading it lazily keeps the initial
// bundle (and first paint) lean while the service worker caches the chunk.
const TrendChart = lazy(() =>
  import('./TrendChart').then((module) => ({ default: module.TrendChart })),
);
const PaceChart = lazy(() =>
  import('./PaceChart').then((module) => ({ default: module.PaceChart })),
);

const MONTH_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];
const SHORT_MONTHS = MONTH_NAMES.map((name) => name.slice(0, 3));

function periodLabel(period: Period, reference: string): string {
  const parts = parseIsoDate(reference);
  if (!parts) return reference;
  if (period === 'year') return String(parts.year);
  if (period === 'month') return `${MONTH_NAMES[parts.month - 1]} ${parts.year}`;
  const range = periodRange('week', reference);
  const from = parseIsoDate(range.from);
  const to = parseIsoDate(range.to);
  if (!from || !to) return reference;
  return `${SHORT_MONTHS[from.month - 1]} ${from.day} - ${SHORT_MONTHS[to.month - 1]} ${to.day}, ${to.year}`;
}

export function DashboardPage() {
  const db = useDb();
  const d = useStrings().dashboard;
  const [period, setPeriod] = useState<Period>('month');
  const [reference, setReference] = useState(() => todayIso());
  // Stable per mount; the reminder only needs day-level resolution.
  const [now] = useState(() => Date.now());

  const transactions = useLiveQuery(() => db.transactions.toArray(), [db]);
  const categories = useLiveQuery(() => listCategories(db), [db]) ?? [];
  const settings = useLiveQuery(() => getSettings(db), [db]);

  if (!transactions || !settings) return null;

  const categoryById = new Map(categories.map((c) => [c.id, c]));
  const range = periodRange(period, reference);
  const flow = summarize(transactions, range);
  const breakdown = categoryBreakdown(transactions, range, 'expense');
  const buckets = trendSeries(transactions, period, reference);

  const refParts = parseIsoDate(reference);
  const today = todayIso();
  const excludedCategoryIds = new Set(
    categories.filter((c) => c.excludeFromBudget).map((c) => c.id),
  );
  const budget =
    period === 'month' && refParts
      ? computeMonthlyBudget({
          transactions,
          year: refParts.year,
          month: refParts.month,
          monthlyBudgetCents: settings.monthlyBudgetCents,
          excludedCategoryIds,
          today,
        })
      : null;

  let pace: { actual: number[]; cutoffDay: number | null; lastMonth: number[] } | null = null;
  if (budget && refParts) {
    const key = monthKey(reference);
    const todayKey = monthKey(today);
    const cutoffDay = todayKey > key ? null : todayKey === key ? Number(today.slice(8)) : 0;
    const prev = parseIsoDate(shiftReference('month', reference, -1));
    pace = {
      actual: cumulativeDailySpend(
        transactions,
        refParts.year,
        refParts.month,
        excludedCategoryIds,
      ),
      cutoffDay,
      lastMonth: prev
        ? cumulativeDailySpend(transactions, prev.year, prev.month, excludedCategoryIds)
        : [],
    };
  }

  const heatmapRange = refParts
    ? {
        from: `${refParts.year}-01-01`,
        to: today < `${refParts.year}-12-31` ? today : `${refParts.year}-12-31`,
      }
    : null;
  const heatmap =
    heatmapRange && heatmapRange.to >= heatmapRange.from
      ? {
          range: heatmapRange,
          spendMap: dailyExpenseMap(transactions, heatmapRange, excludedCategoryIds),
        }
      : null;

  const showBackupReminder = needsBackupReminder(settings.lastBackupAt, transactions.length, now);

  return (
    <div className="dashboard">
      {showBackupReminder && (
        <div className="backup-banner" role="status">
          <span>
            {d.backupReminder(
              settings.lastBackupAt === undefined ? null : daysSince(settings.lastBackupAt, now),
            )}
          </span>
          <a href="#/import">{d.backupReminderAction}</a>
        </div>
      )}
      <div className="dashboard-masthead reveal">
        <div className="period-switcher" role="group">
          {(['week', 'month', 'year'] as const).map((option) => (
            <button
              key={option}
              type="button"
              className={period === option ? 'is-active' : ''}
              onClick={() => {
                setPeriod(option);
                setReference(todayIso());
              }}
            >
              {option === 'week' ? d.periodWeek : option === 'month' ? d.periodMonth : d.periodYear}
            </button>
          ))}
        </div>
        <div className="period-nav">
          <button
            type="button"
            aria-label={d.prevPeriod}
            onClick={() => setReference(shiftReference(period, reference, -1))}
          >
            {'‹'}
          </button>
          <span className="period-label" data-testid="period-label">
            {periodLabel(period, reference)}
          </span>
          <button
            type="button"
            aria-label={d.nextPeriod}
            onClick={() => setReference(shiftReference(period, reference, 1))}
          >
            {'›'}
          </button>
        </div>
      </div>

      {budget && (
        <section className="ledger-section reveal" aria-label={d.budgetRegion}>
          <h2 className="section-label">{d.budgetRegion}</h2>
          <div className="budget-layout">
            <BudgetRing summary={budget} />
            <dl className="ledger-table">
              <div className="ledger-row">
                <dt>{d.spent}</dt>
                <dd>{formatCents(budget.spentCents)}</dd>
              </div>
              <div className="ledger-row">
                <dt>{d.budget}</dt>
                <dd>{formatCents(budget.budgetCents)}</dd>
              </div>
              <div className="ledger-row">
                <dt>{d.dailyAverage}</dt>
                <dd>{formatCents(budget.dailyAverageCents)}</dd>
              </div>
              <div className="ledger-row">
                <dt>{d.projected}</dt>
                <dd>{formatCents(budget.projectedCents)}</dd>
              </div>
              <div className="ledger-row">
                <dt>{d.safePerDay}</dt>
                <dd>{formatCents(budget.safeToSpendPerDayCents)}</dd>
              </div>
            </dl>
          </div>
          {budget.remainingCents < 0 && <span className="over-stamp">{d.overBudget}</span>}
        </section>
      )}

      {pace && (
        <section className="ledger-section reveal" aria-label={d.paceRegion}>
          <h2 className="section-label">{d.paceRegion}</h2>
          <Suspense fallback={<div className="trend-chart" aria-hidden="true" />}>
            <PaceChart
              actual={pace.actual}
              cutoffDay={pace.cutoffDay}
              budgetCents={settings.monthlyBudgetCents}
              lastMonth={pace.lastMonth.length > 0 ? pace.lastMonth : null}
            />
          </Suspense>
        </section>
      )}

      <section className="ledger-section reveal" aria-label={d.flowRegion}>
        <h2 className="section-label">{d.flowRegion}</h2>
        <div className="flow-strip">
          <div className="flow-cell">
            <span className="flow-caption">{d.flowIn}</span>
            <span className="flow-amount flow-in">{formatCents(flow.incomeCents)}</span>
          </div>
          <div className="flow-cell">
            <span className="flow-caption">{d.flowOut}</span>
            <span className="flow-amount">{formatCents(flow.expenseCents)}</span>
          </div>
          <div className="flow-cell">
            <span className="flow-caption">{d.flowNet}</span>
            <span className={`flow-amount${flow.netCents < 0 ? ' flow-negative' : ' flow-in'}`}>
              {formatCents(flow.netCents)}
            </span>
          </div>
        </div>
      </section>

      <section className="ledger-section reveal" aria-label={d.breakdownRegion}>
        <h2 className="section-label">{d.breakdownRegion}</h2>
        {breakdown.length === 0 ? (
          <p className="empty-state">{d.noSpending}</p>
        ) : (
          <CategoryDonut
            totals={breakdown}
            categories={categoryById}
            totalCents={flow.expenseCents}
          />
        )}
      </section>

      <section className="ledger-section reveal" aria-label={d.trendRegion}>
        <h2 className="section-label">{d.trendRegion}</h2>
        <Suspense fallback={<div className="trend-chart" aria-hidden="true" />}>
          <TrendChart buckets={buckets} period={period} />
        </Suspense>
      </section>

      {heatmap && (
        <section className="ledger-section reveal" aria-label={d.heatmapRegion}>
          <h2 className="section-label">{d.heatmapRegion}</h2>
          <Heatmap spendMap={heatmap.spendMap} range={heatmap.range} />
        </section>
      )}
    </div>
  );
}
