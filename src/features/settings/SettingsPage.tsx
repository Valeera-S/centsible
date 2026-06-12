import { useState, type FormEvent } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { useDb } from '../../db/dbContext';
import {
  getSettings,
  listCategories,
  deleteCategory,
  upsertCategory,
  updateSettings,
} from '../../db/repo';
import { FALLBACK_EXPENSE_CATEGORY_ID, FALLBACK_INCOME_CATEGORY_ID } from '../../domain/categories';
import { parseAmount } from '../../domain/money';
import type { Category, TransactionType } from '../../domain/types';
import { strings } from '../../i18n/strings';

const s = strings.settings;
const FALLBACK_IDS = new Set([FALLBACK_EXPENSE_CATEGORY_ID, FALLBACK_INCOME_CATEGORY_ID]);
const NEW_CATEGORY_DEFAULT_COLOR = '#6b7280';

export function SettingsPage() {
  const db = useDb();
  const settings = useLiveQuery(() => getSettings(db), [db]);
  const categories = useLiveQuery(() => listCategories(db), [db]) ?? [];

  const [budgetText, setBudgetText] = useState<string | null>(null);
  const [budgetError, setBudgetError] = useState<string | null>(null);
  const [budgetSaved, setBudgetSaved] = useState(false);

  const [newName, setNewName] = useState('');
  const [newType, setNewType] = useState<TransactionType>('expense');
  const [newColor, setNewColor] = useState(NEW_CATEGORY_DEFAULT_COLOR);

  const budgetValue =
    budgetText ?? (settings ? (settings.monthlyBudgetCents / 100).toFixed(2) : '');

  async function saveBudget(event: FormEvent) {
    event.preventDefault();
    const cents = parseAmount(budgetValue);
    if (cents === null || cents <= 0) {
      setBudgetError(s.budgetInvalid);
      setBudgetSaved(false);
      return;
    }
    await updateSettings(db, { monthlyBudgetCents: cents });
    setBudgetError(null);
    setBudgetSaved(true);
  }

  async function addCategory(event: FormEvent) {
    event.preventDefault();
    const name = newName.trim();
    if (!name) return;
    const sortOrder =
      Math.max(0, ...categories.filter((c) => c.type === newType).map((c) => c.sortOrder)) + 1;
    await upsertCategory(db, {
      id: crypto.randomUUID(),
      name,
      type: newType,
      color: newColor,
      excludeFromBudget: false,
      isDefault: false,
      sortOrder,
    });
    setNewName('');
  }

  async function removeCategory(category: Category) {
    if (window.confirm(s.confirmDeleteCategory(category.name))) {
      await deleteCategory(db, category.id);
    }
  }

  function renderGroup(type: TransactionType, heading: string) {
    return (
      <div className="category-group">
        <h3>{heading}</h3>
        <ul>
          {categories
            .filter((category) => category.type === type)
            .map((category) => (
              <li key={category.id} className="category-row">
                <span className="category-dot" style={{ backgroundColor: category.color }} />
                <span>{category.name}</span>
                {category.excludeFromBudget && <span className="badge">{s.excludedBadge}</span>}
                {!FALLBACK_IDS.has(category.id) && (
                  <button type="button" onClick={() => removeCategory(category)}>
                    {s.deleteCategory}
                  </button>
                )}
              </li>
            ))}
        </ul>
      </div>
    );
  }

  return (
    <section className="settings-page">
      <h1>{s.title}</h1>

      <form onSubmit={saveBudget} className="budget-form">
        <h2>{s.budgetHeading}</h2>
        <label htmlFor="budget-input">{s.budgetLabel}</label>
        <input
          id="budget-input"
          type="text"
          inputMode="decimal"
          value={budgetValue}
          onChange={(event) => {
            setBudgetText(event.target.value);
            setBudgetError(null);
            setBudgetSaved(false);
          }}
        />
        <button type="submit">{s.budgetSave}</button>
        {budgetError && <p role="alert">{budgetError}</p>}
        {budgetSaved && <p className="saved-note">{s.budgetSaved}</p>}
      </form>

      <div className="categories-section">
        <h2>{s.categoriesHeading}</h2>
        {renderGroup('expense', strings.transactions.form.expense)}
        {renderGroup('income', strings.transactions.form.income)}

        <form onSubmit={addCategory} className="add-category-form">
          <label htmlFor="new-category-name">{s.categoryName}</label>
          <input
            id="new-category-name"
            type="text"
            value={newName}
            onChange={(event) => setNewName(event.target.value)}
          />
          <label htmlFor="new-category-type">{s.categoryType}</label>
          <select
            id="new-category-type"
            value={newType}
            onChange={(event) => setNewType(event.target.value as TransactionType)}
          >
            <option value="expense">{strings.transactions.form.expense}</option>
            <option value="income">{strings.transactions.form.income}</option>
          </select>
          <label htmlFor="new-category-color">{s.categoryColor}</label>
          <input
            id="new-category-color"
            type="color"
            value={newColor}
            onChange={(event) => setNewColor(event.target.value)}
          />
          <button type="submit">{s.addCategory}</button>
        </form>
      </div>
    </section>
  );
}
