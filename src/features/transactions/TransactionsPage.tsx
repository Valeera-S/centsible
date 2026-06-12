import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { useDb } from '../../db/dbContext';
import {
  addTransaction,
  deleteTransaction,
  listCategories,
  listMerchantRules,
  listTransactions,
  updateTransaction,
} from '../../db/repo';
import { FALLBACK_EXPENSE_CATEGORY_ID, FALLBACK_INCOME_CATEGORY_ID } from '../../domain/categories';
import { monthKey, todayIso } from '../../domain/dates';
import { formatCents } from '../../domain/money';
import { suggestCategory } from '../../domain/merchantMap';
import type { QuickEntryItem } from '../../domain/parse/quickEntry';
import type { Category, Transaction } from '../../domain/types';
import { useStrings } from '../../i18n/localeContext';
import { QuickEntryBox } from './QuickEntryBox';
import { TransactionForm, type TransactionFormDraft } from './TransactionForm';

function shiftMonth(month: string, delta: number): string {
  const [year, m] = month.split('-').map(Number);
  const total = year * 12 + (m - 1) + delta;
  return `${Math.floor(total / 12)}-${String((total % 12) + 1).padStart(2, '0')}`;
}

function monthLabel(month: string): string {
  const [year, m] = month.split('-').map(Number);
  return new Date(year, m - 1, 1).toLocaleString('en-US', { month: 'long', year: 'numeric' });
}

/** Expenses show as -$x (refunds as +$x); income always as +$x. */
function displayAmount(transaction: Transaction): string {
  const abs = formatCents(Math.abs(transaction.amountCents));
  if (transaction.type === 'income') return `+${abs}`;
  return transaction.amountCents < 0 ? `+${abs}` : `-${abs}`;
}

function dateLabel(date: string): string {
  const [year, month, day] = date.split('-').map(Number);
  return new Date(year, month - 1, day).toLocaleString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
}

export function TransactionsPage() {
  const db = useDb();
  const t = useStrings().transactions;
  const [month, setMonth] = useState(() => monthKey(todayIso()));
  const [typeFilter, setTypeFilter] = useState<'all' | 'expense' | 'income'>('all');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState<Transaction | null>(null);
  const [creating, setCreating] = useState(false);

  const categories = useLiveQuery(() => listCategories(db), [db]) ?? [];
  const merchantRules = useLiveQuery(() => listMerchantRules(db), [db]) ?? [];
  const transactions =
    useLiveQuery(
      () =>
        listTransactions(db, {
          month,
          type: typeFilter === 'all' ? undefined : typeFilter,
          categoryId: categoryFilter === 'all' ? undefined : categoryFilter,
          search: search || undefined,
        }),
      [db, month, typeFilter, categoryFilter, search],
    ) ?? [];

  const categoryById = new Map(categories.map((c) => [c.id, c]));

  async function commitQuickEntries(items: QuickEntryItem[]) {
    for (const item of items) {
      const suggested = suggestCategory(item.description, merchantRules);
      const suggestedCategory = suggested ? categoryById.get(suggested) : undefined;
      const fallback =
        item.type === 'expense' ? FALLBACK_EXPENSE_CATEGORY_ID : FALLBACK_INCOME_CATEGORY_ID;
      const categoryId =
        suggestedCategory && suggestedCategory.type === item.type ? suggestedCategory.id : fallback;
      await addTransaction(db, {
        type: item.type,
        amountCents: item.amountCents,
        categoryId,
        date: item.date,
        note: item.description,
        source: 'manual',
      });
    }
  }

  async function handleDelete(transaction: Transaction) {
    if (window.confirm(t.confirmDelete)) {
      await deleteTransaction(db, transaction.id);
    }
  }

  async function saveNew(draft: TransactionFormDraft) {
    await addTransaction(db, { ...draft, source: 'manual' });
    setCreating(false);
  }

  async function saveEdit(draft: TransactionFormDraft) {
    if (editing) await updateTransaction(db, editing.id, draft);
    setEditing(null);
  }

  const byDate = new Map<string, Transaction[]>();
  for (const transaction of transactions) {
    const group = byDate.get(transaction.date) ?? [];
    group.push(transaction);
    byDate.set(transaction.date, group);
  }

  return (
    <section className="transactions-page">
      <h1>{t.title}</h1>
      <QuickEntryBox onCommit={commitQuickEntries} />

      <div className="month-nav">
        <button type="button" onClick={() => setMonth(shiftMonth(month, -1))}>
          {t.prevMonth}
        </button>
        <span className="month-label">{monthLabel(month)}</span>
        <button type="button" onClick={() => setMonth(shiftMonth(month, 1))}>
          {t.nextMonth}
        </button>
      </div>

      <div className="filters">
        <select
          aria-label={t.filterAllTypes}
          value={typeFilter}
          onChange={(event) => setTypeFilter(event.target.value as typeof typeFilter)}
        >
          <option value="all">{t.filterAllTypes}</option>
          <option value="expense">{t.filterExpense}</option>
          <option value="income">{t.filterIncome}</option>
        </select>
        <select
          aria-label={t.filterAllCategories}
          value={categoryFilter}
          onChange={(event) => setCategoryFilter(event.target.value)}
        >
          <option value="all">{t.filterAllCategories}</option>
          {categories.map((category: Category) => (
            <option key={category.id} value={category.id}>
              {category.name}
            </option>
          ))}
        </select>
        <input
          type="search"
          placeholder={t.searchPlaceholder}
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
        <button type="button" onClick={() => setCreating(true)}>
          {t.addManual}
        </button>
      </div>

      {transactions.length === 0 && <p className="empty-state">{t.empty}</p>}

      {[...byDate.entries()].map(([date, group]) => (
        <div key={date} className="day-group">
          <h3>{dateLabel(date)}</h3>
          <ul>
            {group.map((transaction) => {
              const category = categoryById.get(transaction.categoryId);
              return (
                <li key={transaction.id} className="transaction-row">
                  <span
                    className="category-dot"
                    style={{ backgroundColor: category?.color ?? '#888888' }}
                  />
                  <span className="tx-note">{transaction.note || transaction.merchant || ''}</span>
                  {transaction.source === 'recurring' && (
                    <span className="badge">{t.autoBadge}</span>
                  )}
                  <span className="tx-category">{category?.name ?? transaction.categoryId}</span>
                  <span className={`tx-amount tx-${transaction.type}`}>
                    {displayAmount(transaction)}
                  </span>
                  <button type="button" onClick={() => setEditing(transaction)}>
                    {t.edit}
                  </button>
                  <button type="button" onClick={() => handleDelete(transaction)}>
                    {t.delete}
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      ))}

      {(creating || editing) && (
        <div className="modal-backdrop">
          <div className="modal">
            <TransactionForm
              categories={categories}
              initial={editing ?? undefined}
              onSave={editing ? saveEdit : saveNew}
              onCancel={() => {
                setCreating(false);
                setEditing(null);
              }}
            />
          </div>
        </div>
      )}
    </section>
  );
}
