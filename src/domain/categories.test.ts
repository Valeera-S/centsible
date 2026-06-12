import { describe, expect, it } from 'vitest';
import {
  DEFAULT_CATEGORIES,
  FALLBACK_EXPENSE_CATEGORY_ID,
  FALLBACK_INCOME_CATEGORY_ID,
} from './categories';

describe('DEFAULT_CATEGORIES', () => {
  it('has unique ids', () => {
    const ids = DEFAULT_CATEGORIES.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('contains both expense and income categories', () => {
    expect(DEFAULT_CATEGORIES.some((c) => c.type === 'expense')).toBe(true);
    expect(DEFAULT_CATEGORIES.some((c) => c.type === 'income')).toBe(true);
  });

  it('excludes rent from the budget by default', () => {
    const rent = DEFAULT_CATEGORIES.find((c) => c.id === 'rent');
    expect(rent).toBeDefined();
    expect(rent?.excludeFromBudget).toBe(true);
    expect(rent?.type).toBe('expense');
  });

  it('keeps every other category inside the budget', () => {
    const excluded = DEFAULT_CATEGORIES.filter((c) => c.excludeFromBudget);
    expect(excluded.map((c) => c.id)).toEqual(['rent']);
  });

  it('provides fallback categories for both types', () => {
    const expenseFallback = DEFAULT_CATEGORIES.find((c) => c.id === FALLBACK_EXPENSE_CATEGORY_ID);
    const incomeFallback = DEFAULT_CATEGORIES.find((c) => c.id === FALLBACK_INCOME_CATEGORY_ID);
    expect(expenseFallback?.type).toBe('expense');
    expect(incomeFallback?.type).toBe('income');
  });

  it('marks all defaults as isDefault with distinct sort orders per type', () => {
    expect(DEFAULT_CATEGORIES.every((c) => c.isDefault)).toBe(true);
    for (const type of ['expense', 'income'] as const) {
      const orders = DEFAULT_CATEGORIES.filter((c) => c.type === type).map((c) => c.sortOrder);
      expect(new Set(orders).size).toBe(orders.length);
    }
  });

  it('assigns every category a hex color', () => {
    for (const category of DEFAULT_CATEGORIES) {
      expect(category.color).toMatch(/^#[0-9a-f]{6}$/);
    }
  });
});
