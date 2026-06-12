// String-based parsing keeps cents exact; binary floats never touch the digits.
const AMOUNT_PATTERN = /^([+-]?)\$?(\d{1,3}(?:,\d{3})*|\d+)(?:\.(\d+))?$/;

export function parseAmount(input: string): number | null {
  const match = AMOUNT_PATTERN.exec(input.trim());
  if (!match) return null;
  const [, sign, wholePart, fractionPart = ''] = match;
  const whole = Number(wholePart.replace(/,/g, ''));
  const fraction = fractionPart.padEnd(3, '0');
  let cents = whole * 100 + Number(fraction.slice(0, 2));
  if (Number(fraction[2]) >= 5) cents += 1;
  return sign === '-' ? -cents : cents;
}

export function formatCents(cents: number): string {
  const sign = cents < 0 ? '-' : '';
  const abs = Math.abs(cents);
  const dollars = Math.trunc(abs / 100).toLocaleString('en-US');
  const remainder = String(abs % 100).padStart(2, '0');
  return `${sign}$${dollars}.${remainder}`;
}

export function sumCents(values: Iterable<number>): number {
  let total = 0;
  for (const value of values) total += value;
  return total;
}
