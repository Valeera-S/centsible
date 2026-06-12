export interface Fingerprintable {
  date: string;
  amountCents: number;
  description: string;
}

export function fingerprint(item: Fingerprintable): string {
  const normalized = item.description.trim().toLowerCase().replace(/\s+/g, ' ');
  return `${item.date}|${item.amountCents}|${normalized}`;
}

/**
 * Flags each draft that duplicates an existing transaction or an earlier draft
 * in the same batch. Returns one boolean per draft, in order.
 */
export function markDuplicates(
  drafts: readonly Fingerprintable[],
  existing: readonly Fingerprintable[],
): boolean[] {
  const seen = new Set(existing.map(fingerprint));
  return drafts.map((draft) => {
    const key = fingerprint(draft);
    if (seen.has(key)) return true;
    seen.add(key);
    return false;
  });
}
