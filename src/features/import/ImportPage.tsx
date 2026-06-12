import { useState, type ChangeEvent } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { useDb } from '../../db/dbContext';
import {
  addTransaction,
  exportBackup,
  importBackup,
  learnMerchantRule,
  listCategories,
  listMerchantRules,
  listTransactions,
} from '../../db/repo';
import { FALLBACK_EXPENSE_CATEGORY_ID } from '../../domain/categories';
import { todayIso } from '../../domain/dates';
import { markDuplicates } from '../../domain/dedup';
import { parseBackup, serializeBackup } from '../../domain/importMerge';
import { formatCents, sumCents } from '../../domain/money';
import { suggestCategory } from '../../domain/merchantMap';
import { parseChaseCsv } from '../../domain/parse/chaseCsv';
import { parseMemo } from '../../domain/parse/memo';
import type { Transaction, TransactionSource } from '../../domain/types';
import { strings } from '../../i18n/strings';

const s = strings.importPage;

type Tab = 'memo' | 'csv' | 'backup';

interface Draft {
  key: string;
  include: boolean;
  date: string;
  description: string;
  amountCents: number;
  categoryId: string;
  /** What the parser suggested; corrections against this are learned. */
  suggestedCategoryId: string;
  duplicate: boolean;
  refund: boolean;
}

interface ParseOutcome {
  drafts: Draft[];
  notices: string[];
  warnings: string[];
}

export function ImportPage() {
  const db = useDb();
  const categories = useLiveQuery(() => listCategories(db), [db]) ?? [];
  const merchantRules = useLiveQuery(() => listMerchantRules(db), [db]) ?? [];

  const [tab, setTab] = useState<Tab>('memo');
  const [memoText, setMemoText] = useState('');
  const [csvText, setCsvText] = useState('');
  const [outcome, setOutcome] = useState<ParseOutcome | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  const expenseCategories = categories.filter((c) => c.type === 'expense');

  function switchTab(next: Tab) {
    setTab(next);
    setOutcome(null);
    setError(null);
    setDone(null);
  }

  function suggest(description: string): string {
    return suggestCategory(description, merchantRules) ?? FALLBACK_EXPENSE_CATEGORY_ID;
  }

  async function withDuplicates(
    rows: Array<Omit<Draft, 'include' | 'duplicate' | 'key'>>,
  ): Promise<Draft[]> {
    const existing = (await listTransactions(db)).map((t: Transaction) => ({
      date: t.date,
      amountCents: t.amountCents,
      description: t.note ?? t.merchant ?? '',
    }));
    const flags = markDuplicates(
      rows.map((r) => ({ date: r.date, amountCents: r.amountCents, description: r.description })),
      existing,
    );
    return rows.map((row, index) => ({
      ...row,
      key: `${row.date}|${row.description}|${row.amountCents}|${index}`,
      duplicate: flags[index],
      include: !flags[index],
    }));
  }

  async function parseMemoInput() {
    setDone(null);
    setError(null);
    const result = parseMemo(memoText, { defaultYear: Number(todayIso().slice(0, 4)) });
    if (result.entries.length === 0) {
      setOutcome(null);
      setError(s.nothingParsed);
      return;
    }

    const notices: string[] = [];
    const warnings: string[] = [];
    if (result.subtotals.length > 0) {
      const parsedTotal = sumCents(result.entries.map((e) => e.amountCents));
      const expectedTotal = sumCents(result.subtotals);
      if (parsedTotal === expectedTotal) {
        notices.push(s.subtotalsMatch);
      } else {
        warnings.push(s.subtotalsMismatch(formatCents(parsedTotal), formatCents(expectedTotal)));
      }
    }
    const unparsed = result.skipped.filter((line) => line.reason === 'unparsed');
    if (unparsed.length > 0) {
      warnings.push(`${s.skippedLines(unparsed.length)} ${unparsed.map((l) => l.line).join('; ')}`);
    }

    const drafts = await withDuplicates(
      result.entries.map((entry) => ({
        date: entry.date,
        description: entry.description,
        amountCents: entry.amountCents,
        categoryId: suggest(entry.description),
        suggestedCategoryId: suggest(entry.description),
        refund: false,
      })),
    );
    setOutcome({ drafts, notices, warnings });
  }

  async function parseCsvInput() {
    setDone(null);
    setError(null);
    const result = parseChaseCsv(csvText);
    if (!result.ok) {
      setOutcome(null);
      setError(s.csvError);
      return;
    }

    const notices: string[] = [];
    const warnings: string[] = [];
    if (result.skippedPayments > 0) notices.push(s.skippedPayments(result.skippedPayments));
    if (result.skippedRows.length > 0) {
      warnings.push(
        `${s.skippedLines(result.skippedRows.length)} ${result.skippedRows.join(', ')}`,
      );
    }

    const drafts = await withDuplicates(
      result.rows.map((row) => {
        const categoryId = row.suggestedCategoryId ?? suggest(row.description);
        return {
          date: row.date,
          description: row.description,
          amountCents: row.amountCents,
          categoryId,
          suggestedCategoryId: categoryId,
          refund: row.kind === 'return',
        };
      }),
    );
    setOutcome({ drafts, notices, warnings });
  }

  async function readCsvFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    setCsvText(await file.text());
  }

  function setDraft(key: string, patch: Partial<Draft>) {
    setOutcome((current) =>
      current
        ? {
            ...current,
            drafts: current.drafts.map((d) => (d.key === key ? { ...d, ...patch } : d)),
          }
        : current,
    );
  }

  async function commit(source: TransactionSource) {
    if (!outcome) return;
    const included = outcome.drafts.filter((d) => d.include);
    for (const draft of included) {
      await addTransaction(db, {
        type: 'expense',
        amountCents: draft.amountCents,
        categoryId: draft.categoryId,
        date: draft.date,
        note: draft.description,
        merchant: draft.description,
        source,
      });
      if (draft.categoryId !== draft.suggestedCategoryId) {
        await learnMerchantRule(db, draft.description, draft.categoryId);
      }
    }
    setOutcome(null);
    setMemoText('');
    setCsvText('');
    setDone(s.imported(included.length));
  }

  async function downloadBackup() {
    const backup = await exportBackup(db);
    const blob = new Blob([serializeBackup(backup)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `centsible-backup-${todayIso()}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  async function readBackupFile(event: ChangeEvent<HTMLInputElement>) {
    setDone(null);
    setError(null);
    const file = event.target.files?.[0];
    if (!file) return;
    const parsed = parseBackup(await file.text());
    if (!parsed.ok) {
      setError(s.backupError);
      return;
    }
    const stats = await importBackup(db, parsed.backup);
    setDone(
      s.backupStats(
        stats.transactions.added + stats.recurringRules.added + stats.categories.added,
        stats.transactions.updated + stats.recurringRules.updated,
      ),
    );
  }

  const includedCount = outcome?.drafts.filter((d) => d.include).length ?? 0;

  return (
    <section className="import-page">
      <h1>{s.title}</h1>

      <div className="tab-bar" role="group">
        <button
          type="button"
          className={tab === 'memo' ? 'is-active' : ''}
          onClick={() => switchTab('memo')}
        >
          {s.tabMemo}
        </button>
        <button
          type="button"
          className={tab === 'csv' ? 'is-active' : ''}
          onClick={() => switchTab('csv')}
        >
          {s.tabCsv}
        </button>
        <button
          type="button"
          className={tab === 'backup' ? 'is-active' : ''}
          onClick={() => switchTab('backup')}
        >
          {s.tabBackup}
        </button>
      </div>

      {tab === 'memo' && (
        <div className="import-pane">
          <p className="hint">{s.memoHint}</p>
          <label htmlFor="memo-input">{s.memoLabel}</label>
          <textarea
            id="memo-input"
            rows={10}
            value={memoText}
            onChange={(event) => setMemoText(event.target.value)}
          />
          <button type="button" onClick={parseMemoInput}>
            {s.parse}
          </button>
        </div>
      )}

      {tab === 'csv' && (
        <div className="import-pane">
          <p className="hint">{s.csvHint}</p>
          <label htmlFor="csv-file">{s.csvFileLabel}</label>
          <input id="csv-file" type="file" accept=".csv,text/csv" onChange={readCsvFile} />
          <label htmlFor="csv-input">{s.csvLabel}</label>
          <textarea
            id="csv-input"
            rows={10}
            value={csvText}
            onChange={(event) => setCsvText(event.target.value)}
          />
          <button type="button" onClick={parseCsvInput}>
            {s.parse}
          </button>
        </div>
      )}

      {tab === 'backup' && (
        <div className="import-pane">
          <p className="hint">{s.backupHint}</p>
          <button type="button" onClick={downloadBackup}>
            {s.exportButton}
          </button>
          <label htmlFor="backup-file">{s.importBackupLabel}</label>
          <input
            id="backup-file"
            type="file"
            accept=".json,application/json"
            onChange={readBackupFile}
          />
        </div>
      )}

      {error && <p role="alert">{error}</p>}
      {done && <p className="saved-note">{done}</p>}

      {outcome && (
        <div className="import-preview">
          <h2>{s.previewHeading}</h2>
          {outcome.notices.map((notice) => (
            <p key={notice} className="saved-note">
              {notice}
            </p>
          ))}
          {outcome.warnings.map((warning) => (
            <p key={warning} role="alert">
              {warning}
            </p>
          ))}
          <table>
            <thead>
              <tr>
                <th>{s.colInclude}</th>
                <th>{s.colDate}</th>
                <th>{s.colDescription}</th>
                <th>{s.colCategory}</th>
                <th>{s.colAmount}</th>
              </tr>
            </thead>
            <tbody>
              {outcome.drafts.map((draft) => (
                <tr key={draft.key} className={draft.include ? '' : 'is-excluded'}>
                  <td>
                    <input
                      type="checkbox"
                      aria-label={s.includeRow(draft.description)}
                      checked={draft.include}
                      onChange={(event) => setDraft(draft.key, { include: event.target.checked })}
                    />
                  </td>
                  <td className="cell-mono">{draft.date}</td>
                  <td>
                    {draft.description}
                    {draft.duplicate && <span className="badge">{s.duplicateTag}</span>}
                    {draft.refund && <span className="badge">{s.refundTag}</span>}
                  </td>
                  <td>
                    <select
                      aria-label={s.categoryForRow(draft.description)}
                      value={draft.categoryId}
                      onChange={(event) => setDraft(draft.key, { categoryId: event.target.value })}
                    >
                      {expenseCategories.map((category) => (
                        <option key={category.id} value={category.id}>
                          {category.name}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="cell-mono">{formatCents(draft.amountCents)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <button
            type="button"
            disabled={includedCount === 0}
            onClick={() => commit(tab === 'csv' ? 'csv' : 'memo')}
          >
            {s.importButton(includedCount)}
          </button>
        </div>
      )}
    </section>
  );
}
