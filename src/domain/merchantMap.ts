import type { MerchantRule } from './types';

export function suggestCategory(
  description: string,
  rules: readonly MerchantRule[],
): string | null {
  const haystack = description.toLowerCase();
  let best: MerchantRule | null = null;
  for (const candidate of rules) {
    if (!haystack.includes(candidate.pattern.toLowerCase())) continue;
    if (
      !best ||
      candidate.pattern.length > best.pattern.length ||
      (candidate.pattern.length === best.pattern.length && candidate.updatedAt > best.updatedAt)
    ) {
      best = candidate;
    }
  }
  return best ? best.categoryId : null;
}

const seed = (pattern: string, categoryId: string): MerchantRule => ({
  id: `seed-${pattern}`,
  pattern,
  categoryId,
  updatedAt: 0,
});

export const SEED_MERCHANT_RULES: readonly MerchantRule[] = [
  seed('午餐', 'dining'),
  seed('晚餐', 'dining'),
  seed('早餐', 'dining'),
  seed('饮料', 'dining'),
  seed('买菜', 'groceries'),
  seed('话费', 'bills'),
  seed('房租', 'rent'),
  seed('lunch', 'dining'),
  seed('dinner', 'dining'),
  seed('breakfast', 'dining'),
  seed('coffee', 'dining'),
  seed('target', 'shopping'),
  seed('walmart', 'groceries'),
  seed('kroger', 'groceries'),
  seed('costco', 'groceries'),
  seed('cvs', 'health'),
  seed('walgreens', 'health'),
  seed('uber', 'transportation'),
  seed('lyft', 'transportation'),
  seed('netflix', 'entertainment'),
  seed('spotify', 'entertainment'),
  seed('rent', 'rent'),
];
