import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { DbProvider } from '../../db/DbProvider';
import { createDb, type CentsibleDb } from '../../db/db';
import { addTransaction, listTransactions, seedDefaults } from '../../db/repo';
import { addDays, todayIso } from '../../domain/dates';
import { TransactionsPage } from './TransactionsPage';

let db: CentsibleDb;
let counter = 0;

beforeEach(async () => {
  db = createDb(`tx-page-${++counter}`);
  await seedDefaults(db);
});

afterEach(async () => {
  await db.delete();
});

function renderPage() {
  return render(
    <DbProvider db={db}>
      <TransactionsPage />
    </DbProvider>,
  );
}

describe('TransactionsPage', () => {
  it('lists this month transactions with amounts and category names', async () => {
    await addTransaction(db, {
      type: 'expense',
      amountCents: 1250,
      categoryId: 'dining',
      date: todayIso(),
      note: 'Chipotle',
      source: 'manual',
    });
    await addTransaction(db, {
      type: 'income',
      amountCents: 50000,
      categoryId: 'stipend',
      date: todayIso(),
      note: 'TA pay',
      source: 'manual',
    });
    renderPage();

    const chipotleRow = (await screen.findByText('Chipotle')).closest('li');
    expect(chipotleRow).toHaveTextContent('-$12.50');
    expect(chipotleRow).toHaveTextContent('Dining');
    const taPayRow = screen.getByText('TA pay').closest('li');
    expect(taPayRow).toHaveTextContent('+$500.00');
    expect(taPayRow).toHaveTextContent('Stipend');
  });

  it('adds a transaction through quick entry with a learned category suggestion', async () => {
    const user = userEvent.setup();
    renderPage();

    await user.type(await screen.findByRole('textbox'), 'target 23.45{Enter}');

    expect(await screen.findByText('target')).toBeInTheDocument();
    expect(screen.getByText('-$23.45')).toBeInTheDocument();
    const stored = await listTransactions(db);
    expect(stored).toHaveLength(1);
    expect(stored[0].categoryId).toBe('shopping');
  });

  it('falls back to Other when no merchant rule matches', async () => {
    const user = userEvent.setup();
    renderPage();

    await user.type(await screen.findByRole('textbox'), 'mystery thing 9.99{Enter}');

    await waitFor(async () => {
      const stored = await listTransactions(db);
      expect(stored).toHaveLength(1);
      expect(stored[0].categoryId).toBe('other');
    });
  });

  it('deletes a transaction after confirmation', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    await addTransaction(db, {
      type: 'expense',
      amountCents: 1250,
      categoryId: 'dining',
      date: todayIso(),
      note: 'Chipotle',
      source: 'manual',
    });
    const user = userEvent.setup();
    renderPage();

    await user.click(await screen.findByRole('button', { name: 'Delete' }));

    await waitFor(() => {
      expect(screen.queryByText('Chipotle')).not.toBeInTheDocument();
    });
    expect(await listTransactions(db)).toHaveLength(0);
  });

  it('navigates to the previous month', async () => {
    const lastMonthDate = addDays(todayIso().slice(0, 8) + '01', -1);
    await addTransaction(db, {
      type: 'expense',
      amountCents: 777,
      categoryId: 'dining',
      date: lastMonthDate,
      note: 'old dinner',
      source: 'manual',
    });
    const user = userEvent.setup();
    renderPage();

    await waitFor(() => {
      expect(screen.queryByText('old dinner')).not.toBeInTheDocument();
    });
    await user.click(screen.getByRole('button', { name: 'Previous month' }));
    expect(await screen.findByText('old dinner')).toBeInTheDocument();
  });

  it('edits a transaction through the form', async () => {
    await addTransaction(db, {
      type: 'expense',
      amountCents: 1250,
      categoryId: 'dining',
      date: todayIso(),
      note: 'Chipotle',
      source: 'manual',
    });
    const user = userEvent.setup();
    renderPage();

    await user.click(await screen.findByRole('button', { name: 'Edit' }));
    const amountInput = screen.getByLabelText('Amount');
    await user.clear(amountInput);
    await user.type(amountInput, '15.75');
    await user.click(screen.getByRole('button', { name: 'Save' }));

    expect(await screen.findByText('-$15.75')).toBeInTheDocument();
    const stored = await listTransactions(db);
    expect(stored[0].amountCents).toBe(1575);
  });
});
