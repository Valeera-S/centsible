import { addDays } from '../../domain/dates';
import { formatCents } from '../../domain/money';
import { noSpendStreaks, type DateRange } from '../../domain/stats';
import { useStrings } from '../../i18n/localeContext';

interface HeatmapProps {
  /** Net spend cents per day with any spending. */
  spendMap: Map<string, number>;
  /** Elapsed range to draw (typically Jan 1 through today). */
  range: DateRange;
}

function mondayOf(date: string): string {
  const [y, m, d] = date.split('-').map(Number);
  const weekday = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  return addDays(date, -((weekday + 6) % 7));
}

/** 0 for a no-spend day; 1-4 by quartile of the period's non-zero days. */
function levelFor(cents: number | undefined, thresholds: number[]): number {
  if (!cents || cents <= 0) return 0;
  let level = 1;
  for (const threshold of thresholds) {
    if (cents > threshold) level += 1;
  }
  return level;
}

export function Heatmap({ spendMap, range }: HeatmapProps) {
  const d = useStrings().dashboard;

  const nonZero = [...spendMap.values()].sort((a, b) => a - b);
  const quartile = (p: number) => nonZero[Math.floor(nonZero.length * p)] ?? Infinity;
  const thresholds = [quartile(0.25), quartile(0.5), quartile(0.75)];

  const cells: Array<{ date: string; level: number; cents: number } | null> = [];
  for (let date = mondayOf(range.from); date <= range.to; date = addDays(date, 1)) {
    if (date < range.from) {
      cells.push(null);
    } else {
      const cents = spendMap.get(date) ?? 0;
      cells.push({ date, level: levelFor(cents, thresholds), cents });
    }
  }

  const streaks = noSpendStreaks(new Set(spendMap.keys()), range);

  return (
    <div className="heatmap-block">
      <div className="streak-row">
        <div className="streak-cell">
          <span className="flow-caption">{d.streakCurrent}</span>
          <span className="flow-amount flow-in">{d.streakDays(streaks.current)}</span>
        </div>
        <div className="streak-cell">
          <span className="flow-caption">{d.streakLongest}</span>
          <span className="flow-amount">{d.streakDays(streaks.longest)}</span>
        </div>
      </div>
      <div className="heatmap-scroll">
        <div className="heatmap-grid">
          {cells.map((cell, index) =>
            cell === null ? (
              <span key={`pad-${index}`} className="heatmap-cell is-pad" />
            ) : (
              <span
                key={cell.date}
                data-testid="heatmap-cell"
                className={`heatmap-cell level-${cell.level}`}
                title={cell.cents > 0 ? `${cell.date} ${formatCents(cell.cents)}` : cell.date}
              />
            ),
          )}
        </div>
      </div>
    </div>
  );
}
