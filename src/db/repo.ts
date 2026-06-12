import {
  DEFAULT_CATEGORIES,
  FALLBACK_EXPENSE_CATEGORY_ID,
  FALLBACK_INCOME_CATEGORY_ID,
} from '../domain/categories';
import { SEED_MERCHANT_RULES } from '../domain/merchantMap';
import type { Category, MerchantRule, Settings, Transaction } from '../domain/types';
import { monthKey } from '../domain/dates';
import type { CentsibleDb, SettingsRow } from './db';

const SETTINGS_ID = 'singleton';

const DEFAULT_SETTINGS: SettingsRow = {
  id: SETTINGS_ID,
  monthlyBudgetCents: 60000,
  currency: 'USD',
};

/** First-run seeding; never overwrites data the user already has. */
export async function seedDefaults(db: CentsibleDb): Promise<void> {
  await db.transaction('rw', [db.categories, db.merchantRules, db.settings], async () => {
    if ((await db.categories.count()) === 0) {
      await db.categories.bulkAdd([...DEFAULT_CATEGORIES]);
    }
    if ((await db.merchantRules.count()) === 0) {
      await db.merchantRules.bulkAdd([...SEED_MERCHANT_RULES]);
    }
    if (!(await db.settings.get(SETTINGS_ID))) {
      await db.settings.add(DEFAULT_SETTINGS);
    }
  });
}

export type TransactionDraft = Omit<Transaction, 'id' | 'createdAt' | 'updatedAt'>;

export async function addTransaction(
  db: CentsibleDb,
  draft: TransactionDraft,
): Promise<Transaction> {
  const now = Date.now();
  const transaction: Transaction = {
    ...draft,
    id: crypto.randomUUID(),
    createdAt: now,
    updatedAt: now,
  };
  await db.transactions.add(transaction);
  return transaction;
}

export async function updateTransaction(
  db: CentsibleDb,
  id: string,
  patch: Partial<TransactionDraft>,
): Promise<void> {
  await db.transactions.update(id, { ...patch, updatedAt: Date.now() });
}

export async function deleteTransaction(db: CentsibleDb, id: string): Promise<void> {
  await db.transactions.delete(id);
}

export interface TransactionFilter {
  /** yyyy-mm */
  month?: string;
  type?: Transaction['type'];
  categoryId?: string;
  /** Case-insensitive substring of note or merchant. */
  search?: string;
}

export async function listTransactions(
  db: CentsibleDb,
  filter: TransactionFilter = {},
): Promise<Transaction[]> {
  let all = await db.transactions.toArray();
  if (filter.month) all = all.filter((t) => monthKey(t.date) === filter.month);
  if (filter.type) all = all.filter((t) => t.type === filter.type);
  if (filter.categoryId) all = all.filter((t) => t.categoryId === filter.categoryId);
  if (filter.search) {
    const needle = filter.search.toLowerCase();
    all = all.filter(
      (t) =>
        (t.note ?? '').toLowerCase().includes(needle) ||
        (t.merchant ?? '').toLowerCase().includes(needle),
    );
  }
  return all.sort((a, b) =>
    a.date === b.date ? b.createdAt - a.createdAt : a.date < b.date ? 1 : -1,
  );
}

export async function listCategories(db: CentsibleDb): Promise<Category[]> {
  const all = await db.categories.toArray();
  return all.sort((a, b) =>
    a.type === b.type ? a.sortOrder - b.sortOrder : a.type === 'expense' ? -1 : 1,
  );
}

export async function upsertCategory(db: CentsibleDb, category: Category): Promise<void> {
  await db.categories.put(category);
}

/**
 * Deletes a category and repoints its transactions and recurring rules at the
 * type-appropriate fallback; merchant rules for it are dropped. The fallback
 * categories themselves cannot be deleted.
 */
export async function deleteCategory(db: CentsibleDb, id: string): Promise<void> {
  if (id === FALLBACK_EXPENSE_CATEGORY_ID || id === FALLBACK_INCOME_CATEGORY_ID) {
    throw new Error('Cannot delete a fallback category');
  }
  await db.transaction(
    'rw',
    [db.categories, db.transactions, db.recurringRules, db.merchantRules],
    async () => {
      const category = await db.categories.get(id);
      if (!category) return;
      const fallback =
        category.type === 'expense' ? FALLBACK_EXPENSE_CATEGORY_ID : FALLBACK_INCOME_CATEGORY_ID;
      await db.transactions.where('categoryId').equals(id).modify({ categoryId: fallback });
      await db.recurringRules.filter((r) => r.categoryId === id).modify({ categoryId: fallback });
      await db.merchantRules.filter((r) => r.categoryId === id).delete();
      await db.categories.delete(id);
    },
  );
}

export async function getSettings(db: CentsibleDb): Promise<Settings> {
  return (await db.settings.get(SETTINGS_ID)) ?? DEFAULT_SETTINGS;
}

export async function updateSettings(db: CentsibleDb, patch: Partial<Settings>): Promise<void> {
  const current = (await db.settings.get(SETTINGS_ID)) ?? DEFAULT_SETTINGS;
  await db.settings.put({ ...current, ...patch, id: SETTINGS_ID });
}

export async function listMerchantRules(db: CentsibleDb): Promise<MerchantRule[]> {
  return db.merchantRules.toArray();
}

/** Remembers (or re-learns) which category a description pattern belongs to. */
export async function learnMerchantRule(
  db: CentsibleDb,
  pattern: string,
  categoryId: string,
): Promise<void> {
  const normalized = pattern.trim().toLowerCase();
  if (!normalized) return;
  const existing = await db.merchantRules.where('pattern').equals(normalized).first();
  if (existing) {
    await db.merchantRules.update(existing.id, { categoryId, updatedAt: Date.now() });
  } else {
    await db.merchantRules.add({
      id: crypto.randomUUID(),
      pattern: normalized,
      categoryId,
      updatedAt: Date.now(),
    });
  }
}
