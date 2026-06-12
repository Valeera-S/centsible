import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from './App';
import { createDb, type CentsibleDb } from './db/db';
import { seedDefaults } from './db/repo';

let db: CentsibleDb;
let counter = 0;

beforeEach(async () => {
  db = createDb(`app-${++counter}`);
  await seedDefaults(db);
  window.location.hash = '';
});

afterEach(async () => {
  await db.delete();
});

describe('App', () => {
  it('renders the dashboard by default with navigation', () => {
    render(<App db={db} />);
    expect(screen.getByText('Centsible')).toBeInTheDocument();
    expect(screen.getByText('Dashboard arrives in the next phase.')).toBeInTheDocument();
  });

  it('navigates to transactions and settings', async () => {
    const user = userEvent.setup();
    render(<App db={db} />);

    await user.click(screen.getByRole('link', { name: 'Transactions' }));
    expect(await screen.findByPlaceholderText(/Quick add/)).toBeInTheDocument();

    await user.click(screen.getByRole('link', { name: 'Settings' }));
    expect(await screen.findByText('Monthly budget')).toBeInTheDocument();
  });
});
