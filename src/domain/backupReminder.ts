const DAY_MS = 24 * 60 * 60 * 1000;
const REMINDER_AGE_DAYS = 30;
const MIN_TRANSACTIONS = 10;

export function daysSince(then: number, now: number): number {
  return Math.floor((now - then) / DAY_MS);
}

/**
 * A ledger worth protecting (10+ transactions) with no backup, or a backup
 * older than 30 days, deserves a nudge.
 */
export function needsBackupReminder(
  lastBackupAt: number | undefined,
  transactionCount: number,
  now: number,
): boolean {
  if (transactionCount < MIN_TRANSACTIONS) return false;
  if (lastBackupAt === undefined) return true;
  return daysSince(lastBackupAt, now) > REMINDER_AGE_DAYS;
}
