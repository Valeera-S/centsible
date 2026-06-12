import type { Category } from './types';

export const FALLBACK_EXPENSE_CATEGORY_ID = 'other';
export const FALLBACK_INCOME_CATEGORY_ID = 'other-income';

export type CategorySeed = Omit<Category, 'isDefault'>;

const seed = (
  id: string,
  name: string,
  type: Category['type'],
  color: string,
  sortOrder: number,
  excludeFromBudget = false,
): Category => ({ id, name, type, color, excludeFromBudget, isDefault: true, sortOrder });

export const DEFAULT_CATEGORIES: readonly Category[] = [
  seed('dining', 'Dining', 'expense', '#e4572e', 0),
  seed('groceries', 'Groceries', 'expense', '#76b041', 1),
  seed('shopping', 'Shopping', 'expense', '#f3a712', 2),
  seed('transportation', 'Transportation', 'expense', '#4f86c6', 3),
  seed('bills', 'Bills & Utilities', 'expense', '#5d576b', 4),
  seed('entertainment', 'Entertainment', 'expense', '#b568c9', 5),
  seed('health', 'Health & Pharmacy', 'expense', '#2bb3a3', 6),
  seed('education', 'Education', 'expense', '#3d6b9b', 7),
  seed('travel', 'Travel', 'expense', '#d96aa7', 8),
  seed('rent', 'Rent', 'expense', '#8a8d91', 9, true),
  seed('other', 'Other', 'expense', '#a8a29e', 10),
  seed('stipend', 'Stipend', 'income', '#2e9e5b', 0),
  seed('tutoring', 'Tutoring', 'income', '#4ea5d9', 1),
  seed('investments', 'Investments', 'income', '#c98c2e', 2),
  seed('other-income', 'Other Income', 'income', '#7f9183', 3),
];
