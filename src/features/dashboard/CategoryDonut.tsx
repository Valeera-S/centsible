import { formatCents } from '../../domain/money';
import type { CategoryTotal } from '../../domain/stats';
import type { Category } from '../../domain/types';
import { categoryDisplayName } from '../../i18n/categoryNames';
import { useStrings } from '../../i18n/localeContext';

const SIZE = 200;
const STROKE = 26;
const RADIUS = (SIZE - STROKE) / 2;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;
const GAP = 2;

interface CategoryDonutProps {
  totals: CategoryTotal[];
  categories: Map<string, Category>;
  totalCents: number;
}

/** Donut of positive category totals plus a ranked list with proportional bars. */
export function CategoryDonut({ totals, categories, totalCents }: CategoryDonutProps) {
  const strings = useStrings();
  const positive = totals.filter((t) => t.totalCents > 0);
  const sum = positive.reduce((acc, t) => acc + t.totalCents, 0);
  const max = positive.length > 0 ? positive[0].totalCents : 0;

  const fractions = positive.map((t) => (sum > 0 ? t.totalCents / sum : 0));
  const segments = positive.map((t, index) => {
    const before = fractions.slice(0, index).reduce((acc, f) => acc + f, 0);
    const length = Math.max(0, fractions[index] * CIRCUMFERENCE - GAP);
    return {
      categoryId: t.categoryId,
      color: categories.get(t.categoryId)?.color ?? '#a39e93',
      dasharray: `${length} ${CIRCUMFERENCE - length}`,
      dashoffset: -(before * CIRCUMFERENCE),
    };
  });

  return (
    <div className="category-donut">
      <div className="donut-figure">
        <svg viewBox={`0 0 ${SIZE} ${SIZE}`} role="presentation" focusable="false">
          {segments.map((segment) => (
            <circle
              key={segment.categoryId}
              cx={SIZE / 2}
              cy={SIZE / 2}
              r={RADIUS}
              strokeWidth={STROKE}
              stroke={segment.color}
              strokeDasharray={segment.dasharray}
              strokeDashoffset={segment.dashoffset}
              transform={`rotate(-90 ${SIZE / 2} ${SIZE / 2})`}
              fill="none"
            />
          ))}
        </svg>
        <div className="donut-center">
          <span className="donut-total">{formatCents(totalCents)}</span>
        </div>
      </div>
      <ol className="category-ranking">
        {totals.map((t) => {
          const category = categories.get(t.categoryId);
          const share = max > 0 ? Math.max(0, t.totalCents) / max : 0;
          return (
            <li key={t.categoryId}>
              <span
                className="rank-dot"
                style={{ backgroundColor: category?.color ?? '#a39e93' }}
              />
              <span className="rank-name" data-testid="category-name">
                {category ? categoryDisplayName(category, strings) : t.categoryId}
              </span>
              <span className="rank-bar">
                <span className="rank-bar-fill" style={{ width: `${share * 100}%` }} />
              </span>
              <span className="rank-amount">{formatCents(t.totalCents)}</span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
