// All dates are ISO yyyy-mm-dd strings; arithmetic goes through Date.UTC so the
// host timezone can never shift a calendar day.
const ISO_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

export interface DateParts {
  year: number;
  month: number;
  day: number;
}

export function isoDate(year: number, month: number, day: number): string {
  const mm = String(month).padStart(2, '0');
  const dd = String(day).padStart(2, '0');
  return `${year}-${mm}-${dd}`;
}

export function parseIsoDate(value: string): DateParts | null {
  const match = ISO_PATTERN.exec(value);
  if (!match) return null;
  return { year: Number(match[1]), month: Number(match[2]), day: Number(match[3]) };
}

export function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

export function addDays(date: string, delta: number): string {
  const parts = parseIsoDate(date);
  if (!parts) throw new Error(`Invalid ISO date: ${date}`);
  const shifted = new Date(Date.UTC(parts.year, parts.month - 1, parts.day + delta));
  return isoDate(shifted.getUTCFullYear(), shifted.getUTCMonth() + 1, shifted.getUTCDate());
}

export function monthKey(date: string): string {
  return date.slice(0, 7);
}

export function yearKey(date: string): string {
  return date.slice(0, 4);
}
