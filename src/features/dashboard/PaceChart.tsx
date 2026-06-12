import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { formatCents } from '../../domain/money';
import { useStrings } from '../../i18n/localeContext';

interface PaceChartProps {
  /** Cumulative budget-relevant cents, one entry per day of the month. */
  actual: number[];
  /** Days already elapsed; null means the whole month is in the past. */
  cutoffDay: number | null;
  budgetCents: number;
  lastMonth: number[] | null;
}

interface PaceDatum {
  day: number;
  actual?: number;
  ideal: number;
  last?: number;
  actualCents?: number;
}

interface PaceTooltipProps {
  active?: boolean;
  label?: unknown;
  payload?: ReadonlyArray<{ payload?: unknown }>;
}

function PaceTooltip({ active, payload, label }: PaceTooltipProps) {
  const strings = useStrings();
  const datum = payload?.[0]?.payload as PaceDatum | undefined;
  if (!active || !datum || datum.actualCents === undefined) return null;
  return (
    <div className="chart-tooltip">
      <span className="tooltip-label">{String(label)}</span>
      <span>
        {strings.dashboard.paceActual} {formatCents(datum.actualCents)}
      </span>
    </div>
  );
}

export function PaceChart({ actual, cutoffDay, budgetCents, lastMonth }: PaceChartProps) {
  const strings = useStrings();
  const days = actual.length;
  const data: PaceDatum[] = actual.map((cents, index) => {
    const day = index + 1;
    const datum: PaceDatum = {
      day,
      ideal: (budgetCents * day) / days / 100,
    };
    if (cutoffDay === null || day <= cutoffDay) {
      datum.actual = cents / 100;
      datum.actualCents = cents;
    }
    if (lastMonth && index < lastMonth.length) datum.last = lastMonth[index] / 100;
    return datum;
  });

  return (
    <div className="trend-chart">
      <ResponsiveContainer width="100%" height={240}>
        <LineChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 8 }}>
          <CartesianGrid vertical={false} stroke="var(--rule)" strokeDasharray="2 4" />
          <XAxis
            dataKey="day"
            tickLine={false}
            axisLine={{ stroke: 'var(--rule-strong)' }}
            interval={4}
            tick={{ fontSize: 11, fontFamily: 'var(--font-mono)', fill: 'var(--ink-soft)' }}
          />
          <YAxis
            width={44}
            tickLine={false}
            axisLine={false}
            tickFormatter={(value: number) => `$${value}`}
            tick={{ fontSize: 11, fontFamily: 'var(--font-mono)', fill: 'var(--ink-soft)' }}
          />
          <Tooltip content={PaceTooltip} cursor={{ stroke: 'var(--rule-strong)' }} />
          <Line
            dataKey="ideal"
            name={strings.dashboard.paceIdeal}
            stroke="var(--rule-strong)"
            strokeDasharray="5 4"
            strokeWidth={1.5}
            dot={false}
            isAnimationActive={false}
          />
          {lastMonth && (
            <Line
              dataKey="last"
              name={strings.dashboard.paceLastMonth}
              stroke="var(--accent-amber)"
              strokeWidth={1.5}
              strokeOpacity={0.6}
              dot={false}
              isAnimationActive={false}
            />
          )}
          <Line
            dataKey="actual"
            name={strings.dashboard.paceActual}
            stroke="var(--accent-green)"
            strokeWidth={2.5}
            dot={false}
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
