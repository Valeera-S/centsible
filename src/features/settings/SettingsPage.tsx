import { useEffect, useState, type FormEvent } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { useDb } from '../../db/dbContext';
import {
  addRecurringRule,
  deleteCategory,
  deleteRecurringRule,
  eraseAllData,
  getSettings,
  listCategories,
  listRecurringRules,
  updateSettings,
  upsertCategory,
} from '../../db/repo';
import { FALLBACK_EXPENSE_CATEGORY_ID, FALLBACK_INCOME_CATEGORY_ID } from '../../domain/categories';
import { todayIso } from '../../domain/dates';
import { formatCents, parseAmount } from '../../domain/money';
import type { Category, RecurringRule, TransactionType } from '../../domain/types';
import { categoryDisplayName } from '../../i18n/categoryNames';
import { useStrings } from '../../i18n/localeContext';

const FALLBACK_IDS = new Set([FALLBACK_EXPENSE_CATEGORY_ID, FALLBACK_INCOME_CATEGORY_ID]);
const NEW_CATEGORY_DEFAULT_COLOR = '#6b7280';

function formatBytes(bytes: number): string {
  if (bytes >= 1048576) return `${(bytes / 1048576).toFixed(1)} MB`;
  return `${(bytes / 1024).toFixed(1)} KB`;
}

interface StorageHealth {
  persisted: boolean;
  usageBytes: number | null;
}

async function readStorageHealth(): Promise<StorageHealth | null> {
  const storage = navigator.storage;
  if (!storage?.persisted) return null;
  const persisted = await storage.persisted();
  const estimate = storage.estimate ? await storage.estimate() : undefined;
  return { persisted, usageBytes: estimate?.usage ?? null };
}

export function SettingsPage() {
  const db = useDb();
  const strings = useStrings();
  const s = strings.settings;
  const r = strings.recurring;
  const settings = useLiveQuery(() => getSettings(db), [db]);
  const categories = useLiveQuery(() => listCategories(db), [db]) ?? [];
  const recurringRules = useLiveQuery(() => listRecurringRules(db), [db]) ?? [];

  const [budgetText, setBudgetText] = useState<string | null>(null);
  const [budgetError, setBudgetError] = useState<string | null>(null);
  const [budgetSaved, setBudgetSaved] = useState(false);

  const [newName, setNewName] = useState('');
  const [newType, setNewType] = useState<TransactionType>('expense');
  const [newColor, setNewColor] = useState(NEW_CATEGORY_DEFAULT_COLOR);

  const [ruleName, setRuleName] = useState('');
  const [ruleAmount, setRuleAmount] = useState('');
  const [ruleCategoryId, setRuleCategoryId] = useState('');
  const [ruleInterval, setRuleInterval] = useState<RecurringRule['interval']>('monthly');
  const [ruleDay, setRuleDay] = useState('');
  const [ruleStart, setRuleStart] = useState(() => todayIso());
  const [ruleError, setRuleError] = useState<string | null>(null);
  const [erased, setErased] = useState(false);
  const [storageHealth, setStorageHealth] = useState<StorageHealth | null>(null);

  useEffect(() => {
    let cancelled = false;
    readStorageHealth().then((health) => {
      if (!cancelled) setStorageHealth(health);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const expenseCategories = categories.filter((c) => c.type === 'expense');
  const effectiveRuleCategory = expenseCategories.some((c) => c.id === ruleCategoryId)
    ? ruleCategoryId
    : (expenseCategories[0]?.id ?? FALLBACK_EXPENSE_CATEGORY_ID);

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
    if (window.confirm(s.confirmDeleteCategory(categoryDisplayName(category, strings)))) {
      await deleteCategory(db, category.id);
    }
  }

  async function addRule(event: FormEvent) {
    event.preventDefault();
    const amountCents = parseAmount(ruleAmount);
    const day = Number(ruleDay);
    const name = ruleName.trim();
    if (
      !name ||
      amountCents === null ||
      amountCents <= 0 ||
      !Number.isInteger(day) ||
      day < 1 ||
      day > 31
    ) {
      setRuleError(r.amountInvalid);
      return;
    }
    await addRecurringRule(db, {
      name,
      amountCents,
      type: 'expense',
      categoryId: effectiveRuleCategory,
      interval: ruleInterval,
      dayOfMonth: day,
      startDate: ruleStart,
    });
    setRuleName('');
    setRuleAmount('');
    setRuleDay('');
    setRuleError(null);
  }

  async function stopRule(rule: RecurringRule) {
    if (window.confirm(r.confirmStop(rule.name))) {
      await deleteRecurringRule(db, rule.id);
    }
  }

  async function eraseEverything() {
    if (window.confirm(s.confirmErase)) {
      await eraseAllData(db);
      setBudgetText(null);
      setErased(true);
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
                <span>{categoryDisplayName(category, strings)}</span>
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

      <div className="recurring-section">
        <h2>{r.heading}</h2>
        <p className="hint">{r.hint}</p>
        <ul>
          {recurringRules.map((rule) => (
            <li key={rule.id} className="category-row">
              <span>{rule.name}</span>
              <span className="tx-amount">{formatCents(rule.amountCents)}</span>
              <span className="tx-category">
                {r.every(rule.interval === 'monthly' ? r.monthly : r.yearly, rule.dayOfMonth)}
              </span>
              <button type="button" onClick={() => stopRule(rule)}>
                {r.stop}
              </button>
            </li>
          ))}
        </ul>

        <form onSubmit={addRule} className="add-category-form">
          <label htmlFor="rule-name">{r.name}</label>
          <input
            id="rule-name"
            type="text"
            value={ruleName}
            onChange={(event) => setRuleName(event.target.value)}
          />
          <label htmlFor="rule-amount">{r.amount}</label>
          <input
            id="rule-amount"
            type="text"
            inputMode="decimal"
            value={ruleAmount}
            onChange={(event) => {
              setRuleAmount(event.target.value);
              setRuleError(null);
            }}
          />
          <label htmlFor="rule-category">{r.category}</label>
          <select
            id="rule-category"
            value={effectiveRuleCategory}
            onChange={(event) => setRuleCategoryId(event.target.value)}
          >
            {expenseCategories.map((category) => (
              <option key={category.id} value={category.id}>
                {categoryDisplayName(category, strings)}
              </option>
            ))}
          </select>
          <label htmlFor="rule-interval">{r.interval}</label>
          <select
            id="rule-interval"
            value={ruleInterval}
            onChange={(event) => setRuleInterval(event.target.value as RecurringRule['interval'])}
          >
            <option value="monthly">{r.monthly}</option>
            <option value="yearly">{r.yearly}</option>
          </select>
          <label htmlFor="rule-day">{r.dayOfMonth}</label>
          <input
            id="rule-day"
            type="number"
            min={1}
            max={31}
            value={ruleDay}
            onChange={(event) => {
              setRuleDay(event.target.value);
              setRuleError(null);
            }}
          />
          <label htmlFor="rule-start">{r.startDate}</label>
          <input
            id="rule-start"
            type="date"
            value={ruleStart}
            onChange={(event) => setRuleStart(event.target.value)}
          />
          {ruleError && <p role="alert">{ruleError}</p>}
          <button type="submit">{r.add}</button>
        </form>
      </div>

      <div className="storage-section">
        <h2>{s.storageHeading}</h2>
        {storageHealth && (
          <p className="hint">
            {storageHealth.persisted ? s.storagePersisted : s.storageNotPersisted}
          </p>
        )}
        {storageHealth?.usageBytes != null && (
          <p className="hint">{s.storageUsage(formatBytes(storageHealth.usageBytes))}</p>
        )}
        <p className="hint">
          {settings?.lastBackupAt
            ? s.lastBackup(new Date(settings.lastBackupAt).toISOString().slice(0, 10))
            : s.lastBackupNever}
        </p>
      </div>

      <div className="danger-section">
        <h2>{s.dangerHeading}</h2>
        <p className="hint">{s.dangerHint}</p>
        <button type="button" className="danger-button" onClick={eraseEverything}>
          {s.eraseButton}
        </button>
        {erased && <p className="saved-note">{s.erased}</p>}
      </div>
    </section>
  );
}
