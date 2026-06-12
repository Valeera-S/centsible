import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { DbProvider } from '../../db/DbProvider';
import { createDb, type CentsibleDb } from '../../db/db';
import { getSettings, listCategories, seedDefaults } from '../../db/repo';
import { SettingsPage } from './SettingsPage';

let db: CentsibleDb;
let counter = 0;

beforeEach(async () => {
  db = createDb(`settings-page-${++counter}`);
  await seedDefaults(db);
});

afterEach(async () => {
  await db.delete();
});

function renderPage() {
  return render(
    <DbProvider db={db}>
      <SettingsPage />
    </DbProvider>,
  );
}

describe('SettingsPage', () => {
  it('shows the current budget and saves a new one', async () => {
    const user = userEvent.setup();
    renderPage();

    const input = await screen.findByLabelText('Budget (USD, rent excluded)');
    await waitFor(() => expect(input).toHaveValue('600.00'));
    await user.clear(input);
    await user.type(input, '750');
    await user.click(screen.getByRole('button', { name: 'Save budget' }));

    expect(await screen.findByText('Budget saved')).toBeInTheDocument();
    expect((await getSettings(db)).monthlyBudgetCents).toBe(75000);
  });

  it('rejects an invalid budget', async () => {
    const user = userEvent.setup();
    renderPage();

    const input = await screen.findByLabelText('Budget (USD, rent excluded)');
    await user.clear(input);
    await user.type(input, 'abc');
    await user.click(screen.getByRole('button', { name: 'Save budget' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Enter a valid dollar amount');
    expect((await getSettings(db)).monthlyBudgetCents).toBe(60000);
  });

  it('adds a custom category', async () => {
    const user = userEvent.setup();
    renderPage();

    await user.type(await screen.findByLabelText('Name'), 'Pets');
    await user.click(screen.getByRole('button', { name: 'Add category' }));

    expect(await screen.findByText('Pets')).toBeInTheDocument();
    const categories = await listCategories(db);
    expect(categories.some((c) => c.name === 'Pets' && c.type === 'expense')).toBe(true);
  });

  it('deletes a custom category after confirmation', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    const user = userEvent.setup();
    renderPage();

    await user.type(await screen.findByLabelText('Name'), 'Pets');
    await user.click(screen.getByRole('button', { name: 'Add category' }));
    const row = (await screen.findByText('Pets')).closest('li');
    if (!row) throw new Error('row not found');
    await user.click(within(row).getByRole('button', { name: 'Delete' }));

    await waitFor(async () => {
      expect((await listCategories(db)).some((c) => c.name === 'Pets')).toBe(false);
    });
  });

  it('does not offer delete for fallback categories', async () => {
    renderPage();
    const otherRow = (await screen.findByText('Other')).closest('li');
    if (!otherRow) throw new Error('row not found');
    expect(within(otherRow).queryByRole('button', { name: 'Delete' })).not.toBeInTheDocument();
  });
});
