import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { DbProvider } from '../../db/DbProvider';
import { createDb, type CentsibleDb } from '../../db/db';
import {
  addTransaction,
  exportBackup,
  getSettings,
  listMerchantRules,
  listTransactions,
  seedDefaults,
} from '../../db/repo';
import { serializeBackup } from '../../domain/importMerge';
import { ImportPage } from './ImportPage';

let db: CentsibleDb;
let counter = 0;

beforeEach(async () => {
  db = createDb(`import-${++counter}`);
  await seedDefaults(db);
});

afterEach(async () => {
  await db.delete();
});

function renderPage() {
  return render(
    <DbProvider db={db}>
      <ImportPage />
    </DbProvider>,
  );
}

const MEMO = `2025年6月
6月16日：Target - 104.52
6月17日：午餐 - 17.38; 饮料 - 3.84
6月20日：无
总：125.74`;

describe('ImportPage memo flow', () => {
  it('parses, suggests categories, verifies subtotals, and imports', async () => {
    const user = userEvent.setup();
    renderPage();

    await user.type(screen.getByLabelText('Memo text'), MEMO);
    await user.click(screen.getByRole('button', { name: 'Parse' }));

    expect(await screen.findByText('Preview')).toBeInTheDocument();
    expect(screen.getByText(/Checksum: .*match.* exactly/)).toBeInTheDocument();

    const targetCategory = screen.getByLabelText('Category for Target') as HTMLSelectElement;
    expect(targetCategory.value).toBe('shopping');
    const lunchCategory = screen.getByLabelText('Category for 午餐') as HTMLSelectElement;
    expect(lunchCategory.value).toBe('dining');

    await user.click(screen.getByRole('button', { name: 'Import 3 transactions' }));

    expect(await screen.findByText('Imported 3 transactions.')).toBeInTheDocument();
    const stored = await listTransactions(db);
    expect(stored).toHaveLength(3);
    expect(stored.every((t) => t.source === 'memo')).toBe(true);
    expect(stored.every((t) => t.date.startsWith('2025-06-'))).toBe(true);
  });

  it('marks duplicates against existing data and excludes them by default', async () => {
    await addTransaction(db, {
      type: 'expense',
      amountCents: 10452,
      categoryId: 'shopping',
      date: '2025-06-16',
      note: 'Target',
      source: 'manual',
    });
    const user = userEvent.setup();
    renderPage();

    await user.type(screen.getByLabelText('Memo text'), MEMO);
    await user.click(screen.getByRole('button', { name: 'Parse' }));

    expect(await screen.findByText('Duplicate')).toBeInTheDocument();
    const checkbox = screen.getByLabelText('Include Target') as HTMLInputElement;
    expect(checkbox.checked).toBe(false);

    await user.click(screen.getByRole('button', { name: 'Import 2 transactions' }));
    await screen.findByText('Imported 2 transactions.');
    expect(await listTransactions(db)).toHaveLength(3);
  });

  it('warns when a block does not reconcile with its subtotal line', async () => {
    const user = userEvent.setup();
    renderPage();

    await user.type(screen.getByLabelText('Memo text'), '6月3日：lunch - 12\n总：99');
    await user.click(screen.getByRole('button', { name: 'Parse' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('but that block parses to $12.00');
  });

  it('learns a corrected category as a merchant rule', async () => {
    const user = userEvent.setup();
    renderPage();

    await user.type(screen.getByLabelText('Memo text'), '6月3日：mystery shop - 12');
    await user.click(screen.getByRole('button', { name: 'Parse' }));
    await user.selectOptions(
      await screen.findByLabelText('Category for mystery shop'),
      'groceries',
    );
    await user.click(screen.getByRole('button', { name: 'Import 1 transaction' }));
    await screen.findByText('Imported 1 transaction.');

    const rules = await listMerchantRules(db);
    expect(rules.some((r) => r.pattern === 'mystery shop' && r.categoryId === 'groceries')).toBe(
      true,
    );
  });
});

describe('ImportPage csv flow', () => {
  const CSV = `Transaction Date,Post Date,Description,Category,Type,Amount,Memo
06/03/2026,06/04/2026,CHIPOTLE 1234,Food & Drink,Sale,-12.50,
06/01/2026,06/01/2026,Payment Thank You-Mobile,,Payment,500.00,
06/05/2026,06/06/2026,TARGET RETURN,Shopping,Return,14.70,`;

  it('parses pasted csv, skips payments, and imports with refunds negative', async () => {
    const user = userEvent.setup();
    renderPage();

    await user.click(screen.getByRole('button', { name: 'Bank CSV' }));
    await user.click(screen.getByLabelText('CSV text'));
    await user.paste(CSV);
    await user.click(screen.getByRole('button', { name: 'Parse' }));

    expect(await screen.findByText(/1 card payment skipped/)).toBeInTheDocument();
    expect(screen.getByText('Refund')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Import 2 transactions' }));
    await screen.findByText('Imported 2 transactions.');

    const stored = await listTransactions(db);
    expect(stored).toHaveLength(2);
    const refund = stored.find((t) => t.note === 'TARGET RETURN');
    expect(refund?.amountCents).toBe(-1470);
    expect(stored.every((t) => t.source === 'csv')).toBe(true);
  });

  it('shows an error for csv without the expected columns', async () => {
    const user = userEvent.setup();
    renderPage();

    await user.click(screen.getByRole('button', { name: 'Bank CSV' }));
    await user.click(screen.getByLabelText('CSV text'));
    await user.paste('a,b\n1,2');
    await user.click(screen.getByRole('button', { name: 'Parse' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(/Chase-style columns/);
  });
});

describe('ImportPage backup flow', () => {
  it('imports a backup file and reports merge stats', async () => {
    const other = createDb(`import-other-${counter}`);
    await seedDefaults(other);
    await addTransaction(other, {
      type: 'expense',
      amountCents: 1200,
      categoryId: 'groceries',
      date: '2026-06-10',
      note: 'phone groceries',
      source: 'manual',
    });
    const json = serializeBackup(await exportBackup(other));
    await other.delete();

    const user = userEvent.setup();
    renderPage();
    await user.click(screen.getByRole('button', { name: 'Backup' }));

    const file = new File([json], 'centsible-backup.json', { type: 'application/json' });
    await user.upload(screen.getByLabelText('Backup file'), file);

    expect(await screen.findByText(/Merged backup: 1 added/)).toBeInTheDocument();
    await waitFor(async () => {
      expect(await listTransactions(db)).toHaveLength(1);
    });
  });

  it('rejects an invalid backup file', async () => {
    const user = userEvent.setup();
    renderPage();
    await user.click(screen.getByRole('button', { name: 'Backup' }));

    const file = new File(['{"nope":true}'], 'bad.json', { type: 'application/json' });
    await user.upload(screen.getByLabelText('Backup file'), file);

    expect(await screen.findByRole('alert')).toHaveTextContent(/not a valid Centsible backup/);
  });

  it('offers an export button', async () => {
    const user = userEvent.setup();
    renderPage();
    await user.click(screen.getByRole('button', { name: 'Backup' }));
    expect(screen.getByRole('button', { name: 'Export backup' })).toBeInTheDocument();
  });

  it('records the export time so reminders can rely on it', async () => {
    const objectUrl = vi.fn(() => 'blob:centsible');
    Object.defineProperty(window.URL, 'createObjectURL', { configurable: true, value: objectUrl });
    Object.defineProperty(window.URL, 'revokeObjectURL', { configurable: true, value: vi.fn() });

    const user = userEvent.setup();
    renderPage();
    await user.click(screen.getByRole('button', { name: 'Backup' }));
    await user.click(screen.getByRole('button', { name: 'Export backup' }));

    await waitFor(async () => {
      const settings = await getSettings(db);
      expect(settings.lastBackupAt).toBeGreaterThan(0);
    });
    expect(objectUrl).toHaveBeenCalled();
  });
});

describe('ImportPage preview details', () => {
  it('keeps memo rows within the preview table scoped and labeled', async () => {
    const user = userEvent.setup();
    renderPage();
    await user.type(screen.getByLabelText('Memo text'), '6月3日：CVS - 7');
    await user.click(screen.getByRole('button', { name: 'Parse' }));

    const table = await screen.findByRole('table');
    const row = within(table).getByText('CVS').closest('tr');
    expect(row).not.toBeNull();
    expect(within(row as HTMLTableRowElement).getByText('$7.00')).toBeInTheDocument();
  });
});
