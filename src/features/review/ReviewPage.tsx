import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { useDb } from '../../db/dbContext';
import { listCategories } from '../../db/repo';
import { todayIso } from '../../domain/dates';
import { formatCents } from '../../domain/money';
import { yearReview } from '../../domain/yearReview';
import { categoryDisplayName } from '../../i18n/categoryNames';
import { useStrings } from '../../i18n/localeContext';

const MONTH_LETTERS = ['J', 'F', 'M', 'A', 'M', 'J', 'J', 'A', 'S', 'O', 'N', 'D'];

export function ReviewPage() {
  const db = useDb();
  const strings = useStrings();
  const r = strings.review;
  const [year, setYear] = useState(() => Number(todayIso().slice(0, 4)));

  const transactions = useLiveQuery(() => db.transactions.toArray(), [db]);
  const categories = useLiveQuery(() => listCategories(db), [db]) ?? [];

  if (!transactions) return null;

  const excludedCategoryIds = new Set(
    categories.filter((c) => c.excludeFromBudget).map((c) => c.id),
  );
  const review = yearReview(transactions, year, todayIso(), excludedCategoryIds);
  const topCategory = review.topCategory
    ? categories.find((c) => c.id === review.topCategory?.categoryId)
    : undefined;
  const maxMonthly = Math.max(1, ...review.monthlyTotals);

  return (
    <div className="review-page">
      <div className="dashboard-masthead reveal">
        <h1>{r.title}</h1>
        <div className="period-nav">
          <button type="button" aria-label={r.prevYear} onClick={() => setYear(year - 1)}>
            {'‹'}
          </button>
          <span className="period-label" data-testid="review-year">
            {year}
          </span>
          <button type="button" aria-label={r.nextYear} onClick={() => setYear(year + 1)}>
            {'›'}
          </button>
        </div>
      </div>

      {review.transactionCount === 0 ? (
        <p className="empty-state">{r.empty}</p>
      ) : (
        <>
          <section className="review-hero reveal" aria-label={r.title}>
            <span className="hero-amount">{formatCents(review.expenseCents)}</span>
            <span className="hero-caption">{r.spentIn(year)}</span>
            <div className="hero-subline">
              <span>{r.purchases(review.transactionCount)}</span>
              <span>
                {r.income} <strong>{formatCents(review.incomeCents)}</strong>
              </span>
              <span>
                {r.net} <strong>{formatCents(review.incomeCents - review.expenseCents)}</strong>
              </span>
            </div>
          </section>

          <div className="review-grid reveal">
            {review.biggestDay && (
              <div className="review-card">
                <span className="flow-caption">{r.biggestDay}</span>
                <span className="review-value">{formatCents(review.biggestDay.cents)}</span>
                <span className="review-detail">{review.biggestDay.date}</span>
              </div>
            )}
            {review.biggestTransaction && (
              <div className="review-card">
                <span className="flow-caption">{r.biggestPurchase}</span>
                <span className="review-value">{formatCents(review.biggestTransaction.cents)}</span>
                <span className="review-detail">
                  {review.biggestTransaction.description} · {review.biggestTransaction.date}
                </span>
              </div>
            )}
            {review.mostFrequent && (
              <div className="review-card">
                <span className="flow-caption">{r.mostFrequent}</span>
                <span className="review-value">{review.mostFrequent.description}</span>
                <span className="review-detail">{r.times(review.mostFrequent.count)}</span>
              </div>
            )}
            <div className="review-card">
              <span className="flow-caption">{r.noSpendDays}</span>
              <span className="review-value">{review.noSpendDays}</span>
              <span className="review-detail">{r.longestStreak(review.longestStreak)}</span>
            </div>
            {review.topCategory && (
              <div className="review-card">
                <span className="flow-caption">{r.topCategory}</span>
                <span className="review-value">
                  {topCategory ? (
                    <>
                      <span
                        className="category-dot"
                        style={{ backgroundColor: topCategory.color }}
                      />{' '}
                      {categoryDisplayName(topCategory, strings)}
                    </>
                  ) : (
                    review.topCategory.categoryId
                  )}
                </span>
                <span className="review-detail">{formatCents(review.topCategory.totalCents)}</span>
              </div>
            )}
          </div>

          <section className="ledger-section reveal" aria-label={r.topMerchants}>
            <h2 className="section-label">{r.topMerchants}</h2>
            <ol className="merchant-ranking">
              {review.topMerchants.map((merchant, index) => (
                <li key={merchant.description}>
                  <span className="rank-index">{index + 1}</span>
                  <span className="rank-name">{merchant.description}</span>
                  <span className="review-detail">{r.visits(merchant.count)}</span>
                  <span className="rank-amount">{formatCents(merchant.totalCents)}</span>
                </li>
              ))}
            </ol>
          </section>

          <section className="ledger-section reveal" aria-label={r.monthly}>
            <h2 className="section-label">{r.monthly}</h2>
            <div className="month-bars">
              {review.monthlyTotals.map((cents, index) => (
                <div key={index} className="month-bar-cell">
                  <span
                    className="month-bar"
                    style={{ height: `${Math.max(2, (Math.max(0, cents) / maxMonthly) * 100)}%` }}
                    title={`${year}-${String(index + 1).padStart(2, '0')} ${formatCents(cents)}`}
                  />
                  <span className="month-letter">{MONTH_LETTERS[index]}</span>
                </div>
              ))}
            </div>
          </section>

          <p className="hint">{r.excludedNote}</p>
        </>
      )}
    </div>
  );
}
