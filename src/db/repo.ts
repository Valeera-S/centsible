import {
  DEFAULT_CATEGORIES,
  FALLBACK_EXPENSE_CATEGORY_ID,
  FALLBACK_INCOME_CATEGORY_ID,
} from '../domain/categories';
import { createBackup, mergeById, type BackupV1, type MergeResult } from '../domain/importMerge';
import { SEED_MERCHANT_RULES } from '../domain/merchantMap';
import { dueOccurrences, periodKeyOf } from '../domain/recurring';
import type { Category, MerchantRule, RecurringRule, Settings, Transaction } from '../domain/types';
import { monthKey } from '../domain/dates';
import type { CentsibleDb, SettingsRow } from './db';

const SETTINGS_ID = 'singleton';

const DEFAULT_SETTINGS: SettingsRow = {
  id: SETTINGS_ID,
  monthlyBudgetCents: 60000,
  currency: 'USD',
};

/**
 * First-run seeding plus additive upgrades; never overwrites data the user
 * already has. Merchant seeds shipped in later versions are added for existing
 * databases too, but a pattern the user has (or has relearned) is left alone.
 */
export async function seedDefaults(db: CentsibleDb): Promise<void> {
  await db.transaction('rw', [db.categories, db.merchantRules, db.settings], async () => {
    if ((await db.categories.count()) === 0) {
      await db.categories.bulkAdd([...DEFAULT_CATEGORIES]);
    }
    const existingPatterns = new Set((await db.merchantRules.toArray()).map((r) => r.pattern));
    const missingSeeds = SEED_MERCHANT_RULES.filter((r) => !existingPatterns.has(r.pattern));
    if (missingSeeds.length > 0) {
      await db.merchantRules.bulkAdd([...missingSeeds]);
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

export type RecurringRuleDraft = Omit<
  RecurringRule,
  'id' | 'createdAt' | 'updatedAt' | 'lastPostedPeriod'
>;

export async function addRecurringRule(
  db: CentsibleDb,
  draft: RecurringRuleDraft,
): Promise<RecurringRule> {
  const now = Date.now();
  const rule: RecurringRule = { ...draft, id: crypto.randomUUID(), createdAt: now, updatedAt: now };
  await db.recurringRules.add(rule);
  return rule;
}

export async function updateRecurringRule(
  db: CentsibleDb,
  id: string,
  patch: Partial<RecurringRuleDraft>,
): Promise<void> {
  await db.recurringRules.update(id, { ...patch, updatedAt: Date.now() });
}

export async function deleteRecurringRule(db: CentsibleDb, id: string): Promise<void> {
  await db.recurringRules.delete(id);
}

export async function listRecurringRules(db: CentsibleDb): Promise<RecurringRule[]> {
  const rules = await db.recurringRules.toArray();
  return rules.sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * Posts every due occurrence of every rule up to `today` and advances each
 * rule's lastPostedPeriod, all in one transaction so reposting is impossible
 * even if the app opens twice. Returns the number of transactions created.
 */
export async function postDueRecurring(db: CentsibleDb, today: string): Promise<number> {
  return db.transaction('rw', [db.recurringRules, db.transactions], async () => {
    let posted = 0;
    const rules = await db.recurringRules.toArray();
    for (const rule of rules) {
      const due = dueOccurrences(rule, today);
      if (due.length === 0) continue;
      const now = Date.now();
      for (const date of due) {
        await db.transactions.add({
          id: crypto.randomUUID(),
          type: rule.type,
          amountCents: rule.amountCents,
          categoryId: rule.categoryId,
          date,
          note: rule.name,
          source: 'recurring',
          recurringId: rule.id,
          createdAt: now,
          updatedAt: now,
        });
        posted += 1;
      }
      await db.recurringRules.update(rule.id, {
        lastPostedPeriod: periodKeyOf(due[due.length - 1], rule.interval),
        updatedAt: now,
      });
    }
    return posted;
  });
}

export async function exportBackup(db: CentsibleDb): Promise<BackupV1> {
  const [transactions, categories, recurringRules, merchantRules, settings] = await Promise.all([
    db.transactions.toArray(),
    db.categories.toArray(),
    db.recurringRules.toArray(),
    db.merchantRules.toArray(),
    getSettings(db),
  ]);
  return createBackup({
    exportedAt: Date.now(),
    transactions,
    categories,
    recurringRules,
    merchantRules,
    settings: { monthlyBudgetCents: settings.monthlyBudgetCents, currency: settings.currency },
  });
}

export interface ImportStats {
  transactions: Omit<MergeResult<Transaction>, 'merged'>;
  recurringRules: Omit<MergeResult<RecurringRule>, 'merged'>;
  merchantRules: Omit<MergeResult<MerchantRule>, 'merged'>;
  categories: { added: number };
}

const dropMerged = <T>({ added, updated, unchanged }: MergeResult<T>) => ({
  added,
  updated,
  unchanged,
});

/**
 * Folds a backup into this database: id-based last-write-wins for
 * transactions, recurring rules, and merchant rules; add-only for categories
 * (local definitions win); local settings are kept untouched.
 */
export async function importBackup(db: CentsibleDb, backup: BackupV1): Promise<ImportStats> {
  return db.transaction(
    'rw',
    [db.transactions, db.categories, db.recurringRules, db.merchantRules],
    async () => {
      const txMerge = mergeById(await db.transactions.toArray(), backup.transactions);
      await db.transactions.bulkPut(txMerge.merged);

      const ruleMerge = mergeById(await db.recurringRules.toArray(), backup.recurringRules);
      await db.recurringRules.bulkPut(ruleMerge.merged);

      const merchantMerge = mergeById(await db.merchantRules.toArray(), backup.merchantRules);
      await db.merchantRules.bulkPut(merchantMerge.merged);

      const existingIds = new Set((await db.categories.toArray()).map((c) => c.id));
      const newCategories = backup.categories.filter((c) => !existingIds.has(c.id));
      await db.categories.bulkAdd(newCategories);

      return {
        transactions: dropMerged(txMerge),
        recurringRules: dropMerged(ruleMerge),
        merchantRules: dropMerged(merchantMerge),
        categories: { added: newCategories.length },
      };
    },
  );
}

/** Deletes everything on this device and restores factory defaults. */
export async function eraseAllData(db: CentsibleDb): Promise<void> {
  await db.transaction(
    'rw',
    [db.transactions, db.categories, db.recurringRules, db.merchantRules, db.settings],
    async () => {
      await Promise.all([
        db.transactions.clear(),
        db.categories.clear(),
        db.recurringRules.clear(),
        db.merchantRules.clear(),
        db.settings.clear(),
      ]);
    },
  );
  await seedDefaults(db);
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
