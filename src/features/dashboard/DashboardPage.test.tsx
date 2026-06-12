import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { DbProvider } from '../../db/DbProvider';
import { createDb, type CentsibleDb } from '../../db/db';
import { addTransaction, seedDefaults } from '../../db/repo';
import { todayIso } from '../../domain/dates';
import { DashboardPage } from './DashboardPage';

let db: CentsibleDb;
let counter = 0;

beforeEach(async () => {
  db = createDb(`dash-${++counter}`);
  await seedDefaults(db);
  const today = todayIso();
  await addTransaction(db, {
    type: 'expense',
    amountCents: 90000,
    categoryId: 'rent',
    date: today,
    note: 'rent',
    source: 'manual',
  });
  await addTransaction(db, {
    type: 'expense',
    amountCents: 12345,
    categoryId: 'dining',
    date: today,
    note: 'restaurants',
    source: 'manual',
  });
  await addTransaction(db, {
    type: 'expense',
    amountCents: 5000,
    categoryId: 'groceries',
    date: today,
    note: 'food',
    source: 'manual',
  });
  await addTransaction(db, {
    type: 'income',
    amountCents: 200000,
    categoryId: 'stipend',
    date: today,
    note: 'TA pay',
    source: 'manual',
  });
});

afterEach(async () => {
  await db.delete();
});

function renderPage() {
  return render(
    <DbProvider db={db}>
      <DashboardPage />
    </DbProvider>,
  );
}

describe('DashboardPage (month view)', () => {
  it('shows budget figures excluding rent', async () => {
    renderPage();
    const budget = await screen.findByRole('region', { name: 'Monthly budget' });
    expect(within(budget).getByText('$173.45')).toBeInTheDocument();
    expect(within(budget).getByText('$600.00')).toBeInTheDocument();
    expect(within(budget).getByText('$426.55')).toBeInTheDocument();
  });

  it('shows the category breakdown including rent, sorted by size', async () => {
    renderPage();
    const breakdown = await screen.findByRole('region', { name: 'Spending by category' });
    const names = within(breakdown)
      .getAllByTestId('category-name')
      .map((el) => el.textContent);
    expect(names).toEqual(['Rent', 'Dining', 'Groceries']);
    expect(within(breakdown).getByText('$900.00')).toBeInTheDocument();
    expect(within(breakdown).getByText('$123.45')).toBeInTheDocument();
  });

  it('shows income, spending, and net for the period', async () => {
    renderPage();
    const flow = await screen.findByRole('region', { name: 'Cash flow' });
    expect(within(flow).getByText('$2,000.00')).toBeInTheDocument();
    expect(within(flow).getByText('$1,073.45')).toBeInTheDocument();
    expect(within(flow).getByText('$926.55')).toBeInTheDocument();
  });

  it('switches periods and hides the budget ring outside month view', async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByRole('region', { name: 'Monthly budget' });

    await user.click(screen.getByRole('button', { name: 'Week' }));
    expect(screen.queryByRole('region', { name: 'Monthly budget' })).not.toBeInTheDocument();
    expect(screen.getByTestId('period-label').textContent).toMatch(/-/);

    await user.click(screen.getByRole('button', { name: 'Year' }));
    expect(screen.getByTestId('period-label').textContent).toMatch(/^\d{4}$/);

    await user.click(screen.getByRole('button', { name: 'Month' }));
    expect(await screen.findByRole('region', { name: 'Monthly budget' })).toBeInTheDocument();
  });

  it('flags an over-budget month', async () => {
    await addTransaction(db, {
      type: 'expense',
      amountCents: 60000,
      categoryId: 'shopping',
      date: todayIso(),
      note: 'big haul',
      source: 'manual',
    });
    renderPage();
    expect(await screen.findByText('Over budget')).toBeInTheDocument();
  });
});
