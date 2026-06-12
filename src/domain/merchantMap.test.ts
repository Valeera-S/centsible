import { describe, expect, it } from 'vitest';
import { SEED_MERCHANT_RULES, suggestCategory } from './merchantMap';
import type { MerchantRule } from './types';

const rule = (pattern: string, categoryId: string, updatedAt = 0): MerchantRule => ({
  id: `rule-${pattern}`,
  pattern,
  categoryId,
  updatedAt,
});

describe('suggestCategory', () => {
  it('matches a pattern as a case-insensitive substring', () => {
    const rules = [rule('target', 'shopping')];
    expect(suggestCategory('TARGET #1234 NASHVILLE', rules)).toBe('shopping');
  });

  it('matches Chinese descriptions', () => {
    const rules = [rule('午餐', 'dining')];
    expect(suggestCategory('午餐', rules)).toBe('dining');
  });

  it('returns null when nothing matches', () => {
    const rules = [rule('target', 'shopping')];
    expect(suggestCategory('uber trip', rules)).toBeNull();
  });

  it('prefers the longest matching pattern', () => {
    const rules = [rule('cvs', 'health'), rule('cvs carepass', 'bills')];
    expect(suggestCategory('CVS CAREPASS MONTHLY', rules)).toBe('bills');
  });

  it('breaks length ties by most recently updated rule', () => {
    const rules = [rule('abc', 'dining', 1), rule('xyz', 'shopping', 5)];
    expect(suggestCategory('abc xyz', rules)).toBe('shopping');
  });
});

describe('SEED_MERCHANT_RULES', () => {
  it("covers the user's memo vocabulary", () => {
    const byPattern = new Map(SEED_MERCHANT_RULES.map((r) => [r.pattern, r.categoryId]));
    expect(byPattern.get('午餐')).toBe('dining');
    expect(byPattern.get('午饭')).toBe('dining');
    expect(byPattern.get('晚饭')).toBe('dining');
    expect(byPattern.get('奶茶')).toBe('dining');
    expect(byPattern.get('夜宵')).toBe('dining');
    expect(byPattern.get('买菜')).toBe('groceries');
    expect(byPattern.get('零食')).toBe('groceries');
    expect(byPattern.get('亚米')).toBe('groceries');
    expect(byPattern.get('wholefoods')).toBe('groceries');
    expect(byPattern.get('话费')).toBe('bills');
    expect(byPattern.get('打车')).toBe('transportation');
    expect(byPattern.get('亚马逊')).toBe('shopping');
    expect(byPattern.get('礼物')).toBe('shopping');
    expect(byPattern.get('购物')).toBe('shopping');
    expect(byPattern.get('拳头')).toBe('entertainment');
    expect(byPattern.get('target')).toBe('shopping');
    expect(byPattern.get('cvs')).toBe('health');
  });

  it('only references default category ids', () => {
    const knownIds = new Set([
      'dining',
      'groceries',
      'shopping',
      'transportation',
      'bills',
      'entertainment',
      'health',
      'education',
      'travel',
      'rent',
      'other',
      'stipend',
      'tutoring',
      'investments',
      'other-income',
    ]);
    for (const r of SEED_MERCHANT_RULES) {
      expect(knownIds.has(r.categoryId)).toBe(true);
    }
  });
});
