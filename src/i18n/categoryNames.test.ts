import { describe, expect, it } from 'vitest';
import { DEFAULT_CATEGORIES } from '../domain/categories';
import type { Category } from '../domain/types';
import { en } from './en';
import { zh } from './zh';
import { categoryDisplayName } from './categoryNames';

const dining = DEFAULT_CATEGORIES.find((c) => c.id === 'dining') as Category;
const custom: Category = {
  id: 'custom-1',
  name: 'Pets',
  type: 'expense',
  color: '#123456',
  excludeFromBudget: false,
  isDefault: false,
  sortOrder: 99,
};

describe('categoryDisplayName', () => {
  it('returns the stored name in English', () => {
    expect(categoryDisplayName(dining, en)).toBe('Dining');
  });

  it('translates default categories in Chinese', () => {
    expect(categoryDisplayName(dining, zh)).toBe('餐饮');
  });

  it('keeps custom category names untouched in any locale', () => {
    expect(categoryDisplayName(custom, en)).toBe('Pets');
    expect(categoryDisplayName(custom, zh)).toBe('Pets');
  });

  it('covers every default category in both locales', () => {
    for (const category of DEFAULT_CATEGORIES) {
      expect(en.categoryNames[category.id]).toBeTruthy();
      expect(zh.categoryNames[category.id]).toBeTruthy();
    }
  });
});
