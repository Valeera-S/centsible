import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { DbProvider } from '../../db/DbProvider';
import { createDb, type CentsibleDb } from '../../db/db';
import { getSettings, listCategories, listRecurringRules, seedDefaults } from '../../db/repo';
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

/** Category names also appear as select options; target the list row. */
async function findCategoryRow(name: string): Promise<HTMLElement> {
  const matches = await screen.findAllByText(name);
  const row = matches.map((el) => el.closest('li')).find((li) => li !== null);
  if (!row) throw new Error(`No category row for ${name}`);
  return row;
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

    const row = await findCategoryRow('Pets');
    expect(row).toBeInTheDocument();
    const categories = await listCategories(db);
    expect(categories.some((c) => c.name === 'Pets' && c.type === 'expense')).toBe(true);
  });

  it('deletes a custom category after confirmation', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    const user = userEvent.setup();
    renderPage();

    await user.type(await screen.findByLabelText('Name'), 'Pets');
    await user.click(screen.getByRole('button', { name: 'Add category' }));
    const row = await findCategoryRow('Pets');
    await user.click(within(row).getByRole('button', { name: 'Delete' }));

    await waitFor(async () => {
      expect((await listCategories(db)).some((c) => c.name === 'Pets')).toBe(false);
    });
  });

  it('does not offer delete for fallback categories', async () => {
    renderPage();
    const otherRow = await findCategoryRow('Other');
    expect(within(otherRow).queryByRole('button', { name: 'Delete' })).not.toBeInTheDocument();
  });
});

describe('SettingsPage recurring rules', () => {
  it('adds a recurring rule', async () => {
    const user = userEvent.setup();
    renderPage();

    await user.type(await screen.findByLabelText('Rule name'), 'Spotify');
    await user.type(screen.getByLabelText('Amount'), '9.99');
    await user.selectOptions(screen.getByLabelText('Category'), 'entertainment');
    await user.type(screen.getByLabelText('Day of month'), '1');
    await user.click(screen.getByRole('button', { name: 'Add recurring' }));

    expect(await screen.findByText('Spotify')).toBeInTheDocument();
    const rules = await listRecurringRules(db);
    expect(rules).toHaveLength(1);
    expect(rules[0]).toMatchObject({
      name: 'Spotify',
      amountCents: 999,
      categoryId: 'entertainment',
      interval: 'monthly',
      dayOfMonth: 1,
    });
  });

  it('stops a rule after confirmation', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    const user = userEvent.setup();
    renderPage();

    await user.type(await screen.findByLabelText('Rule name'), 'Spotify');
    await user.type(screen.getByLabelText('Amount'), '9.99');
    await user.type(screen.getByLabelText('Day of month'), '1');
    await user.click(screen.getByRole('button', { name: 'Add recurring' }));
    await screen.findByText('Spotify');

    await user.click(screen.getByRole('button', { name: 'Stop' }));

    await waitFor(async () => {
      expect(await listRecurringRules(db)).toHaveLength(0);
    });
  });
});
