import { useMemo, useState, type FormEvent } from 'react';
import { parseAmount } from '../../domain/money';
import { todayIso } from '../../domain/dates';
import { FALLBACK_EXPENSE_CATEGORY_ID, FALLBACK_INCOME_CATEGORY_ID } from '../../domain/categories';
import type { Category, Transaction, TransactionType } from '../../domain/types';
import { categoryDisplayName } from '../../i18n/categoryNames';
import { useStrings } from '../../i18n/localeContext';

export interface TransactionFormDraft {
  type: TransactionType;
  amountCents: number;
  categoryId: string;
  date: string;
  note: string;
}

interface TransactionFormProps {
  categories: Category[];
  initial?: Transaction;
  onSave: (draft: TransactionFormDraft) => void | Promise<void>;
  onCancel: () => void;
}

export function TransactionForm({ categories, initial, onSave, onCancel }: TransactionFormProps) {
  const strings = useStrings();
  const f = strings.transactions.form;
  const [type, setType] = useState<TransactionType>(initial?.type ?? 'expense');
  const [amountText, setAmountText] = useState(
    initial ? (Math.abs(initial.amountCents) / 100).toFixed(2) : '',
  );
  const [categoryId, setCategoryId] = useState(initial?.categoryId ?? '');
  const [date, setDate] = useState(initial?.date ?? todayIso());
  const [note, setNote] = useState(initial?.note ?? '');
  const [error, setError] = useState<string | null>(null);

  const typeCategories = useMemo(
    () => categories.filter((c) => c.type === type),
    [categories, type],
  );
  const fallback = type === 'expense' ? FALLBACK_EXPENSE_CATEGORY_ID : FALLBACK_INCOME_CATEGORY_ID;
  const effectiveCategoryId = typeCategories.some((c) => c.id === categoryId)
    ? categoryId
    : (typeCategories[0]?.id ?? fallback);

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const amountCents = parseAmount(amountText);
    if (amountCents === null || amountCents <= 0) {
      setError(f.amountInvalid);
      return;
    }
    void onSave({ type, amountCents, categoryId: effectiveCategoryId, date, note: note.trim() });
  }

  return (
    <form className="transaction-form" onSubmit={handleSubmit}>
      <h2>{initial ? f.editTitle : f.addTitle}</h2>
      <label htmlFor="tx-type">{f.type}</label>
      <select
        id="tx-type"
        value={type}
        onChange={(event) => setType(event.target.value as TransactionType)}
      >
        <option value="expense">{f.expense}</option>
        <option value="income">{f.income}</option>
      </select>

      <label htmlFor="tx-amount">{f.amount}</label>
      <input
        id="tx-amount"
        type="text"
        inputMode="decimal"
        value={amountText}
        onChange={(event) => {
          setAmountText(event.target.value);
          setError(null);
        }}
      />

      <label htmlFor="tx-category">{f.category}</label>
      <select
        id="tx-category"
        value={effectiveCategoryId}
        onChange={(event) => setCategoryId(event.target.value)}
      >
        {typeCategories.map((category) => (
          <option key={category.id} value={category.id}>
            {categoryDisplayName(category, strings)}
          </option>
        ))}
      </select>

      <label htmlFor="tx-date">{f.date}</label>
      <input
        id="tx-date"
        type="date"
        value={date}
        onChange={(event) => setDate(event.target.value)}
      />

      <label htmlFor="tx-note">{f.note}</label>
      <input
        id="tx-note"
        type="text"
        value={note}
        onChange={(event) => setNote(event.target.value)}
      />

      {error && <p role="alert">{error}</p>}
      <div className="form-actions">
        <button type="submit">{f.save}</button>
        <button type="button" onClick={onCancel}>
          {f.cancel}
        </button>
      </div>
    </form>
  );
}
