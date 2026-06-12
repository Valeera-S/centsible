import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createDb, type CentsibleDb } from './db';
import {
  addTransaction,
  deleteCategory,
  deleteTransaction,
  getSettings,
  learnMerchantRule,
  listCategories,
  listMerchantRules,
  listTransactions,
  seedDefaults,
  updateSettings,
  updateTransaction,
  upsertCategory,
} from './repo';
import { DEFAULT_CATEGORIES, FALLBACK_EXPENSE_CATEGORY_ID } from '../domain/categories';

let db: CentsibleDb;
let counter = 0;

beforeEach(async () => {
  db = createDb(`test-db-${++counter}`);
  await seedDefaults(db);
});

afterEach(async () => {
  await db.delete();
});

describe('seedDefaults', () => {
  it('seeds default categories, merchant rules, and settings on first run', async () => {
    expect(await db.categories.count()).toBe(DEFAULT_CATEGORIES.length);
    expect(await db.merchantRules.count()).toBeGreaterThan(0);
    const settings = await getSettings(db);
    expect(settings.monthlyBudgetCents).toBe(60000);
    expect(settings.currency).toBe('USD');
  });

  it('is idempotent and preserves user changes', async () => {
    await updateSettings(db, { monthlyBudgetCents: 50000 });
    await seedDefaults(db);
    expect((await getSettings(db)).monthlyBudgetCents).toBe(50000);
    expect(await db.categories.count()).toBe(DEFAULT_CATEGORIES.length);
  });
});

describe('transactions', () => {
  it('adds a transaction with generated id and timestamps', async () => {
    const created = await addTransaction(db, {
      type: 'expense',
      amountCents: 650,
      categoryId: 'dining',
      date: '2026-06-11',
      note: 'coffee',
      source: 'manual',
    });
    expect(created.id).toMatch(/[0-9a-f-]{36}/);
    expect(created.createdAt).toBeGreaterThan(0);
    const all = await listTransactions(db);
    expect(all).toHaveLength(1);
    expect(all[0].note).toBe('coffee');
  });

  it('updates a transaction and bumps updatedAt', async () => {
    const created = await addTransaction(db, {
      type: 'expense',
      amountCents: 650,
      categoryId: 'dining',
      date: '2026-06-11',
      source: 'manual',
    });
    await updateTransaction(db, created.id, { amountCents: 700 });
    const [stored] = await listTransactions(db);
    expect(stored.amountCents).toBe(700);
    expect(stored.updatedAt).toBeGreaterThanOrEqual(created.updatedAt);
  });

  it('deletes a transaction', async () => {
    const created = await addTransaction(db, {
      type: 'expense',
      amountCents: 650,
      categoryId: 'dining',
      date: '2026-06-11',
      source: 'manual',
    });
    await deleteTransaction(db, created.id);
    expect(await listTransactions(db)).toHaveLength(0);
  });

  it('lists transactions filtered by month, newest first', async () => {
    const add = (date: string, amountCents: number) =>
      addTransaction(db, {
        type: 'expense',
        amountCents,
        categoryId: 'dining',
        date,
        source: 'manual',
      });
    await add('2026-06-01', 100);
    await add('2026-06-15', 200);
    await add('2026-05-31', 300);
    const june = await listTransactions(db, { month: '2026-06' });
    expect(june.map((t) => t.amountCents)).toEqual([200, 100]);
  });
});

describe('categories', () => {
  it('adds a custom category', async () => {
    await upsertCategory(db, {
      id: 'pets',
      name: 'Pets',
      type: 'expense',
      color: '#123456',
      excludeFromBudget: false,
      isDefault: false,
      sortOrder: 99,
    });
    const categories = await listCategories(db);
    expect(categories.some((c) => c.id === 'pets')).toBe(true);
  });

  it('reassigns transactions to the fallback category when deleting', async () => {
    await upsertCategory(db, {
      id: 'pets',
      name: 'Pets',
      type: 'expense',
      color: '#123456',
      excludeFromBudget: false,
      isDefault: false,
      sortOrder: 99,
    });
    const created = await addTransaction(db, {
      type: 'expense',
      amountCents: 4000,
      categoryId: 'pets',
      date: '2026-06-11',
      source: 'manual',
    });
    await deleteCategory(db, 'pets');
    const [stored] = await listTransactions(db);
    expect(stored.id).toBe(created.id);
    expect(stored.categoryId).toBe(FALLBACK_EXPENSE_CATEGORY_ID);
    expect((await listCategories(db)).some((c) => c.id === 'pets')).toBe(false);
  });

  it('refuses to delete the fallback categories', async () => {
    await expect(deleteCategory(db, FALLBACK_EXPENSE_CATEGORY_ID)).rejects.toThrow();
  });
});

describe('merchant rules', () => {
  it('learns a new pattern and overwrites an existing one', async () => {
    await learnMerchantRule(db, 'trader joes', 'groceries');
    let rules = await listMerchantRules(db);
    expect(rules.some((r) => r.pattern === 'trader joes' && r.categoryId === 'groceries')).toBe(
      true,
    );
    await learnMerchantRule(db, 'trader joes', 'dining');
    rules = await listMerchantRules(db);
    const matching = rules.filter((r) => r.pattern === 'trader joes');
    expect(matching).toHaveLength(1);
    expect(matching[0].categoryId).toBe('dining');
  });
});
