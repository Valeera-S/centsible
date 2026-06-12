import { useEffect, useState } from 'react';
import type { BudgetSummary } from '../../domain/budget';
import { formatCents } from '../../domain/money';
import { useStrings } from '../../i18n/localeContext';

const SIZE = 220;
const STROKE = 14;
const RADIUS = (SIZE - STROKE) / 2;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

interface BudgetRingProps {
  summary: BudgetSummary;
}

export function BudgetRing({ summary }: BudgetRingProps) {
  const strings = useStrings();
  const over = summary.remainingCents < 0;
  const ratio = summary.budgetCents > 0 ? Math.min(1, summary.spentCents / summary.budgetCents) : 0;

  // Sweep in from zero on mount.
  const [drawn, setDrawn] = useState(0);
  useEffect(() => {
    const frame = requestAnimationFrame(() => setDrawn(ratio));
    return () => cancelAnimationFrame(frame);
  }, [ratio]);

  return (
    <div className={`budget-ring${over ? ' is-over' : ''}`}>
      <svg viewBox={`0 0 ${SIZE} ${SIZE}`} role="presentation" focusable="false">
        <circle
          className="ring-track"
          cx={SIZE / 2}
          cy={SIZE / 2}
          r={RADIUS}
          strokeWidth={STROKE}
        />
        <circle
          className="ring-value"
          cx={SIZE / 2}
          cy={SIZE / 2}
          r={RADIUS}
          strokeWidth={STROKE}
          strokeDasharray={CIRCUMFERENCE}
          strokeDashoffset={CIRCUMFERENCE * (1 - drawn)}
          transform={`rotate(-90 ${SIZE / 2} ${SIZE / 2})`}
        />
      </svg>
      <div className="ring-center">
        <span className="ring-amount">{formatCents(Math.abs(summary.remainingCents))}</span>
        <span className="ring-caption">
          {over ? strings.dashboard.overBy : strings.dashboard.remainingLeft}
        </span>
        <span className="ring-days">{strings.dashboard.daysLeft(summary.daysLeft)}</span>
      </div>
    </div>
  );
}
