import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createDb, type CentsibleDb } from './db';
import {
  addRecurringRule,
  addTransaction,
  deleteRecurringRule,
  exportBackup,
  importBackup,
  listRecurringRules,
  listTransactions,
  postDueRecurring,
  seedDefaults,
  updateRecurringRule,
} from './repo';
import { parseBackup, serializeBackup } from '../domain/importMerge';

let db: CentsibleDb;
let counter = 0;

beforeEach(async () => {
  db = createDb(`rb-${++counter}`);
  await seedDefaults(db);
});

afterEach(async () => {
  await db.delete();
});

describe('recurring rules', () => {
  it('creates, updates, lists, and deletes rules', async () => {
    const rule = await addRecurringRule(db, {
      name: 'Spotify',
      amountCents: 999,
      type: 'expense',
      categoryId: 'entertainment',
      interval: 'monthly',
      dayOfMonth: 1,
      startDate: '2026-01-01',
    });
    expect((await listRecurringRules(db)).map((r) => r.name)).toEqual(['Spotify']);

    await updateRecurringRule(db, rule.id, { amountCents: 1099 });
    expect((await listRecurringRules(db))[0].amountCents).toBe(1099);

    await deleteRecurringRule(db, rule.id);
    expect(await listRecurringRules(db)).toEqual([]);
  });

  it('posts all due occurrences once and advances the cursor', async () => {
    await addRecurringRule(db, {
      name: 'Spotify',
      amountCents: 999,
      type: 'expense',
      categoryId: 'entertainment',
      interval: 'monthly',
      dayOfMonth: 1,
      startDate: '2026-04-01',
    });

    const first = await postDueRecurring(db, '2026-06-11');
    expect(first).toBe(3);
    const posted = await listTransactions(db);
    expect(posted.map((t) => t.date).sort()).toEqual(['2026-04-01', '2026-05-01', '2026-06-01']);
    expect(posted.every((t) => t.source === 'recurring' && t.recurringId)).toBe(true);
    expect(posted.every((t) => t.note === 'Spotify')).toBe(true);

    const second = await postDueRecurring(db, '2026-06-11');
    expect(second).toBe(0);
    expect(await listTransactions(db)).toHaveLength(3);

    const third = await postDueRecurring(db, '2026-07-02');
    expect(third).toBe(1);
  });

  it('does not post rules whose start date is in the future', async () => {
    await addRecurringRule(db, {
      name: 'Gym',
      amountCents: 3000,
      type: 'expense',
      categoryId: 'health',
      interval: 'monthly',
      dayOfMonth: 1,
      startDate: '2026-08-01',
    });
    expect(await postDueRecurring(db, '2026-06-11')).toBe(0);
  });
});

describe('backup export and import', () => {
  it('exports a backup that survives a serialize-parse roundtrip', async () => {
    await addTransaction(db, {
      type: 'expense',
      amountCents: 650,
      categoryId: 'dining',
      date: '2026-06-11',
      note: 'coffee',
      source: 'manual',
    });
    const backup = await exportBackup(db);
    expect(backup.schemaVersion).toBe(1);
    expect(backup.transactions).toHaveLength(1);
    expect(backup.categories.length).toBeGreaterThan(0);
    expect(backup.settings.monthlyBudgetCents).toBe(60000);

    const parsed = parseBackup(serializeBackup(backup));
    expect(parsed.ok).toBe(true);
  });

  it('merges a backup into an existing database without duplicating', async () => {
    const local = await addTransaction(db, {
      type: 'expense',
      amountCents: 650,
      categoryId: 'dining',
      date: '2026-06-11',
      note: 'coffee',
      source: 'manual',
    });

    const other = createDb(`rb-other-${counter}`);
    await seedDefaults(other);
    await addTransaction(other, {
      type: 'expense',
      amountCents: 1200,
      categoryId: 'groceries',
      date: '2026-06-10',
      note: 'phone groceries',
      source: 'manual',
    });
    const backup = await exportBackup(other);
    await other.delete();

    const stats = await importBackup(db, backup);
    expect(stats.transactions.added).toBe(1);
    expect(stats.transactions.updated).toBe(0);

    const all = await listTransactions(db);
    expect(all).toHaveLength(2);
    expect(all.some((t) => t.id === local.id)).toBe(true);

    const again = await importBackup(db, backup);
    expect(again.transactions.added).toBe(0);
    expect(await listTransactions(db)).toHaveLength(2);
  });

  it('adds unknown categories from the backup but keeps local ones', async () => {
    const other = createDb(`rb-other2-${counter}`);
    await seedDefaults(other);
    await other.categories.add({
      id: 'pets',
      name: 'Pets',
      type: 'expense',
      color: '#123456',
      excludeFromBudget: false,
      isDefault: false,
      sortOrder: 50,
    });
    const backup = await exportBackup(other);
    await other.delete();

    const stats = await importBackup(db, backup);
    expect(stats.categories.added).toBe(1);
    expect(await db.categories.get('pets')).toBeDefined();
    expect((await db.categories.count()) > 1).toBe(true);
  });
});
