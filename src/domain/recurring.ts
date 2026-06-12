import { daysInMonth, isoDate, monthKey, parseIsoDate, yearKey } from './dates';
import type { RecurringInterval, RecurringRule } from './types';

export function periodKeyOf(date: string, interval: RecurringInterval): string {
  return interval === 'monthly' ? monthKey(date) : yearKey(date);
}

/**
 * All occurrence dates of a rule that should be posted as of `today`: every
 * period from the start date (or the one after lastPostedPeriod) whose
 * occurrence date has arrived. Callers post these and then advance
 * lastPostedPeriod to the newest one.
 */
export function dueOccurrences(rule: RecurringRule, today: string): string[] {
  const start = parseIsoDate(rule.startDate);
  const now = parseIsoDate(today);
  if (!start || !now) throw new Error('Invalid date input');

  const candidates: string[] = [];
  if (rule.interval === 'monthly') {
    for (let year = start.year; year <= now.year; year++) {
      const firstMonth = year === start.year ? start.month : 1;
      const lastMonth = year === now.year ? now.month : 12;
      for (let month = firstMonth; month <= lastMonth; month++) {
        const day = Math.min(rule.dayOfMonth, daysInMonth(year, month));
        candidates.push(isoDate(year, month, day));
      }
    }
  } else {
    const month = rule.monthOfYear ?? start.month;
    for (let year = start.year; year <= now.year; year++) {
      const day = Math.min(rule.dayOfMonth, daysInMonth(year, month));
      candidates.push(isoDate(year, month, day));
    }
  }

  return candidates.filter((occurrence) => {
    if (occurrence < rule.startDate || occurrence > today) return false;
    if (rule.endDate && occurrence > rule.endDate) return false;
    if (rule.lastPostedPeriod && periodKeyOf(occurrence, rule.interval) <= rule.lastPostedPeriod) {
      return false;
    }
    return true;
  });
}
