export type TransactionType = 'expense' | 'income';

export type TransactionSource = 'manual' | 'voice' | 'memo' | 'csv' | 'recurring';

export interface Transaction {
  id: string;
  type: TransactionType;
  /** Integer cents. Negative only for refunds imported from bank data. */
  amountCents: number;
  categoryId: string;
  /** ISO yyyy-mm-dd. */
  date: string;
  note?: string;
  merchant?: string;
  source: TransactionSource;
  recurringId?: string;
  /** Epoch milliseconds. */
  createdAt: number;
  updatedAt: number;
}

export interface Category {
  id: string;
  name: string;
  type: TransactionType;
  /** Hex color used by charts and lists. */
  color: string;
  /** True for categories (e.g. rent) ignored by the monthly budget. */
  excludeFromBudget: boolean;
  isDefault: boolean;
  sortOrder: number;
}

export type RecurringInterval = 'monthly' | 'yearly';

export interface RecurringRule {
  id: string;
  name: string;
  amountCents: number;
  type: TransactionType;
  categoryId: string;
  interval: RecurringInterval;
  /** 1-31; clamped to the last day of shorter months. */
  dayOfMonth: number;
  /** Month 1-12; only used by yearly rules. */
  monthOfYear?: number;
  /** ISO yyyy-mm-dd; first period eligible for posting. */
  startDate: string;
  /** ISO yyyy-mm-dd; no occurrences after this date. */
  endDate?: string;
  /** Period key of the newest posted occurrence: yyyy-mm (monthly) or yyyy (yearly). */
  lastPostedPeriod?: string;
  createdAt: number;
  updatedAt: number;
}

export interface MerchantRule {
  id: string;
  /** Matched case-insensitively as a whole word or substring of the description. */
  pattern: string;
  categoryId: string;
  updatedAt: number;
}

export interface Settings {
  monthlyBudgetCents: number;
  currency: 'USD';
}
