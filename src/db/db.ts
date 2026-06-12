import Dexie, { type Table } from 'dexie';
import type { Category, MerchantRule, RecurringRule, Settings, Transaction } from '../domain/types';

export interface SettingsRow extends Settings {
  id: 'singleton';
}

export class CentsibleDb extends Dexie {
  transactions!: Table<Transaction, string>;
  categories!: Table<Category, string>;
  recurringRules!: Table<RecurringRule, string>;
  merchantRules!: Table<MerchantRule, string>;
  settings!: Table<SettingsRow, string>;

  constructor(name = 'centsible') {
    super(name);
    this.version(1).stores({
      transactions: 'id, date, categoryId, type',
      categories: 'id, type',
      recurringRules: 'id',
      merchantRules: 'id, &pattern',
      settings: 'id',
    });
  }
}

export function createDb(name = 'centsible'): CentsibleDb {
  return new CentsibleDb(name);
}

let appDb: CentsibleDb | undefined;

/** The app-wide database; tests use createDb with throwaway names instead. */
export function getDb(): CentsibleDb {
  appDb ??= createDb();
  return appDb;
}
