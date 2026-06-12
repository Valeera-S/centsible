import { describe, expect, it } from 'vitest';
import { createBackup, mergeById, parseBackup, serializeBackup } from './importMerge';
import { DEFAULT_CATEGORIES } from './categories';
import type { Settings, Transaction } from './types';

const SETTINGS: Settings = { monthlyBudgetCents: 60000, currency: 'USD' };

function tx(id: string, updatedAt: number, note?: string): Transaction {
  return {
    id,
    type: 'expense',
    amountCents: 1250,
    categoryId: 'dining',
    date: '2026-06-03',
    note,
    source: 'manual',
    createdAt: 1,
    updatedAt,
  };
}

function backupFixture() {
  return createBackup({
    transactions: [tx('a', 1)],
    categories: [...DEFAULT_CATEGORIES],
    recurringRules: [],
    merchantRules: [],
    settings: SETTINGS,
    exportedAt: 1765432100000,
  });
}

describe('backup serialization', () => {
  it('roundtrips through JSON without loss', () => {
    const backup = backupFixture();
    const parsed = parseBackup(serializeBackup(backup));
    expect(parsed).toEqual({ ok: true, backup });
  });

  it('stamps schema version 1', () => {
    expect(backupFixture().schemaVersion).toBe(1);
  });

  it('rejects invalid json', () => {
    expect(parseBackup('{not json')).toEqual({ ok: false, error: 'invalid-json' });
  });

  it('rejects unsupported schema versions', () => {
    const json = serializeBackup(backupFixture()).replace('"schemaVersion":1', '"schemaVersion":2');
    expect(parseBackup(json)).toEqual({ ok: false, error: 'unsupported-version' });
  });

  it('rejects structurally malformed backups', () => {
    expect(parseBackup('{"schemaVersion":1}')).toEqual({ ok: false, error: 'malformed' });
    expect(parseBackup('{"schemaVersion":1,"transactions":"nope"}')).toEqual({
      ok: false,
      error: 'malformed',
    });
  });
});

describe('mergeById', () => {
  it('adds records that only exist in the incoming set', () => {
    const result = mergeById([tx('a', 1)], [tx('b', 1)]);
    expect(result.merged.map((t) => t.id).sort()).toEqual(['a', 'b']);
    expect(result.added).toBe(1);
    expect(result.unchanged).toBe(1);
  });

  it('keeps the local record when it is newer or equal', () => {
    const local = tx('a', 5, 'local wins');
    const result = mergeById([local], [tx('a', 3, 'incoming loses')]);
    expect(result.merged).toEqual([local]);
    expect(result.updated).toBe(0);
    expect(result.unchanged).toBe(1);
  });

  it('takes the incoming record when it is newer', () => {
    const incoming = tx('a', 9, 'incoming wins');
    const result = mergeById([tx('a', 5, 'local loses')], [incoming]);
    expect(result.merged).toEqual([incoming]);
    expect(result.updated).toBe(1);
    expect(result.unchanged).toBe(0);
  });

  it('merges disjoint and overlapping sets in one pass', () => {
    const result = mergeById([tx('a', 1), tx('b', 7)], [tx('b', 2), tx('c', 1)]);
    expect(result.merged.map((t) => t.id).sort()).toEqual(['a', 'b', 'c']);
    expect(result.added).toBe(1);
    expect(result.updated).toBe(0);
    expect(result.unchanged).toBe(2);
    expect(result.merged.find((t) => t.id === 'b')?.updatedAt).toBe(7);
  });
});
