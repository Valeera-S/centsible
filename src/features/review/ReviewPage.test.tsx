import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { DbProvider } from '../../db/DbProvider';
import { createDb, type CentsibleDb } from '../../db/db';
import { addTransaction, seedDefaults } from '../../db/repo';
import { todayIso } from '../../domain/dates';
import { ReviewPage } from './ReviewPage';

let db: CentsibleDb;
let counter = 0;
const year = Number(todayIso().slice(0, 4));

beforeEach(async () => {
  db = createDb(`review-${++counter}`);
  await seedDefaults(db);
  await addTransaction(db, {
    type: 'expense',
    amountCents: 10452,
    categoryId: 'shopping',
    date: `${year}-03-10`,
    note: 'Target',
    source: 'manual',
  });
  await addTransaction(db, {
    type: 'expense',
    amountCents: 1738,
    categoryId: 'dining',
    date: `${year}-01-05`,
    note: '午餐',
    source: 'manual',
  });
  await addTransaction(db, {
    type: 'expense',
    amountCents: 1500,
    categoryId: 'dining',
    date: `${year}-02-03`,
    note: '午餐',
    source: 'manual',
  });
  await addTransaction(db, {
    type: 'income',
    amountCents: 200000,
    categoryId: 'stipend',
    date: `${year}-01-15`,
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
      <ReviewPage />
    </DbProvider>,
  );
}

describe('ReviewPage', () => {
  it('shows the hero total, purchase count, income, and net', async () => {
    renderPage();
    const hero = await screen.findByRole('region', { name: 'Year in review' });
    expect(within(hero).getByText('$136.90')).toBeInTheDocument();
    expect(within(hero).getByText('3 purchases')).toBeInTheDocument();
    expect(within(hero).getByText('$2,000.00')).toBeInTheDocument();
  });

  it('shows headline stats and merchant ranking', async () => {
    renderPage();
    expect(await screen.findByText('Biggest single purchase')).toBeInTheDocument();
    expect(screen.getByText('Most frequent purchase')).toBeInTheDocument();

    const merchants = screen.getByRole('region', { name: 'Top merchants' });
    const rows = within(merchants).getAllByRole('listitem');
    expect(rows[0]).toHaveTextContent('Target');
    expect(rows[0]).toHaveTextContent('$104.52');
    expect(rows[0]).toHaveTextContent('1 visit');
    expect(rows[1]).toHaveTextContent('午餐');
    expect(rows[1]).toHaveTextContent('$32.38');
    expect(rows[1]).toHaveTextContent('2 visits');
  });

  it('navigates to an empty previous year', async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByRole('region', { name: 'Year in review' });

    await user.click(screen.getByRole('button', { name: 'Previous year' }));

    expect(await screen.findByText('Nothing recorded for this year yet.')).toBeInTheDocument();
    expect(screen.getByTestId('review-year')).toHaveTextContent(String(year - 1));
  });
});
