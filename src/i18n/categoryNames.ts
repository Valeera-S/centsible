import type { Category } from '../domain/types';
import type { Strings } from './en';

/**
 * Default categories show a localized name; user-created categories keep
 * whatever the user typed, in every locale.
 */
export function categoryDisplayName(category: Category, strings: Strings): string {
  if (category.isDefault) return strings.categoryNames[category.id] ?? category.name;
  return category.name;
}
