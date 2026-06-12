import { describe, expect, it } from 'vitest';
import { daysSince, needsBackupReminder } from './backupReminder';

const DAY = 24 * 60 * 60 * 1000;
const NOW = 1_800_000_000_000;

describe('needsBackupReminder', () => {
  it('stays quiet for small ledgers even without any backup', () => {
    expect(needsBackupReminder(undefined, 9, NOW)).toBe(false);
  });

  it('reminds once the ledger matters and no backup exists', () => {
    expect(needsBackupReminder(undefined, 10, NOW)).toBe(true);
  });

  it('stays quiet shortly after a backup', () => {
    expect(needsBackupReminder(NOW - 29 * DAY, 500, NOW)).toBe(false);
  });

  it('reminds when the last backup is older than 30 days', () => {
    expect(needsBackupReminder(NOW - 31 * DAY, 500, NOW)).toBe(true);
  });
});

describe('daysSince', () => {
  it('floors to whole days', () => {
    expect(daysSince(NOW - 31 * DAY - 7200_000, NOW)).toBe(31);
    expect(daysSince(NOW, NOW)).toBe(0);
  });
});
