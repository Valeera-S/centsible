import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { formatCents } from '../../domain/money';
import type { Period, TrendBucket } from '../../domain/stats';
import { useStrings } from '../../i18n/localeContext';

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

interface TrendChartProps {
  buckets: TrendBucket[];
  period: Period;
}

interface ChartDatum {
  label: string;
  expense: number;
  income: number;
  expenseCents: number;
  incomeCents: number;
}

function bucketLabel(bucket: TrendBucket, period: Period, index: number): string {
  if (period === 'week') return WEEKDAYS[index] ?? bucket.key.slice(8);
  if (period === 'year') return MONTHS[Number(bucket.key.slice(5, 7)) - 1] ?? bucket.key;
  return String(Number(bucket.key.slice(8)));
}

// Loosely typed on purpose: Recharts v3 tooltip content generics are not
// assignable across ValueType/NameType instantiations.
interface TrendTooltipProps {
  active?: boolean;
  label?: unknown;
  payload?: ReadonlyArray<{ payload?: unknown }>;
}

function TrendTooltip({ active, payload, label }: TrendTooltipProps) {
  const strings = useStrings();
  const datum = payload?.[0]?.payload as ChartDatum | undefined;
  if (!active || !datum) return null;
  return (
    <div className="chart-tooltip">
      <span className="tooltip-label">{String(label)}</span>
      <span>
        {strings.dashboard.trendExpense} {formatCents(datum.expenseCents)}
      </span>
      {datum.incomeCents !== 0 && (
        <span>
          {strings.dashboard.trendIncome} {formatCents(datum.incomeCents)}
        </span>
      )}
    </div>
  );
}

export function TrendChart({ buckets, period }: TrendChartProps) {
  const data: ChartDatum[] = buckets.map((bucket, index) => ({
    label: bucketLabel(bucket, period, index),
    expense: Math.max(0, bucket.expenseCents) / 100,
    income: Math.max(0, bucket.incomeCents) / 100,
    expenseCents: bucket.expenseCents,
    incomeCents: bucket.incomeCents,
  }));
  const hasIncome = data.some((d) => d.income > 0);

  return (
    <div className="trend-chart">
      <ResponsiveContainer width="100%" height={240}>
        <BarChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 8 }} barGap={1}>
          <CartesianGrid vertical={false} stroke="var(--rule)" strokeDasharray="2 4" />
          <XAxis
            dataKey="label"
            tickLine={false}
            axisLine={{ stroke: 'var(--rule-strong)' }}
            interval={period === 'month' ? 4 : 0}
            tick={{ fontSize: 11, fontFamily: 'var(--font-mono)', fill: 'var(--ink-soft)' }}
          />
          <YAxis
            width={44}
            tickLine={false}
            axisLine={false}
            tickFormatter={(value: number) => `$${value}`}
            tick={{ fontSize: 11, fontFamily: 'var(--font-mono)', fill: 'var(--ink-soft)' }}
          />
          <Tooltip content={TrendTooltip} cursor={{ fill: 'var(--paper-shade)' }} />
          <Bar dataKey="expense" fill="var(--ink)" radius={[2, 2, 0, 0]} maxBarSize={26} />
          {hasIncome && (
            <Bar
              dataKey="income"
              fill="var(--accent-amber)"
              radius={[2, 2, 0, 0]}
              maxBarSize={26}
            />
          )}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
