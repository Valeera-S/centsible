import type { Category, MerchantRule, RecurringRule, Settings, Transaction } from './types';

export interface BackupV1 {
  schemaVersion: 1;
  /** Epoch milliseconds. */
  exportedAt: number;
  transactions: Transaction[];
  categories: Category[];
  recurringRules: RecurringRule[];
  merchantRules: MerchantRule[];
  settings: Settings;
}

export type BackupParseResult =
  | { ok: true; backup: BackupV1 }
  | { ok: false; error: 'invalid-json' | 'unsupported-version' | 'malformed' };

export function createBackup(data: Omit<BackupV1, 'schemaVersion'>): BackupV1 {
  return { schemaVersion: 1, ...data };
}

export function serializeBackup(backup: BackupV1): string {
  return JSON.stringify(backup);
}

export function parseBackup(json: string): BackupParseResult {
  let raw: unknown;
  try {
    raw = JSON.parse(json);
  } catch {
    return { ok: false, error: 'invalid-json' };
  }
  if (typeof raw !== 'object' || raw === null) return { ok: false, error: 'malformed' };

  const candidate = raw as Record<string, unknown>;
  if (candidate.schemaVersion !== 1) return { ok: false, error: 'unsupported-version' };

  const arrays = ['transactions', 'categories', 'recurringRules', 'merchantRules'] as const;
  for (const key of arrays) {
    if (!Array.isArray(candidate[key])) return { ok: false, error: 'malformed' };
  }
  if (typeof candidate.settings !== 'object' || candidate.settings === null) {
    return { ok: false, error: 'malformed' };
  }
  if (typeof candidate.exportedAt !== 'number') return { ok: false, error: 'malformed' };

  return { ok: true, backup: candidate as unknown as BackupV1 };
}

export interface MergeResult<T> {
  merged: T[];
  added: number;
  updated: number;
  unchanged: number;
}

/**
 * Last-write-wins merge keyed by id: incoming records replace local ones only
 * when strictly newer (updatedAt). Used to fold a phone backup into desktop data.
 */
export function mergeById<T extends { id: string; updatedAt: number }>(
  local: readonly T[],
  incoming: readonly T[],
): MergeResult<T> {
  const byId = new Map(local.map((record) => [record.id, record]));
  let added = 0;
  let updated = 0;

  for (const record of incoming) {
    const current = byId.get(record.id);
    if (!current) {
      byId.set(record.id, record);
      added += 1;
    } else if (record.updatedAt > current.updatedAt) {
      byId.set(record.id, record);
      updated += 1;
    }
  }

  const merged = [...byId.values()];
  return { merged, added, updated, unchanged: merged.length - added - updated };
}
