import { daysBetween } from '@/lib/format';
import { round } from '@/mocks/rng';

/**
 * Number-to-words helpers shared by every evidence sentence the mock API emits.
 *
 * These live in one place because the same figure must read identically wherever it
 * appears. If the project page says "800 m apart" and the duplicate table says "0.8 km
 * apart" for the same pair, a judge reasonably concludes one of the two is computed
 * differently — so the formatting is centralised rather than repeated per endpoint.
 *
 * Rupee figures follow Indian convention: MPLADS works are recorded in lakhs, and
 * anything past a crore is quoted in crore because that is how the guidelines and the
 * ministry's own reporting express it.
 */

/** Lakhs → crore, e.g. 1840 → "₹18.4 Cr". */
export const crore = (lakhs: number): string => `₹${round(lakhs / 100, 2)} Cr`;

/** Lakhs, kept in lakhs, e.g. 18.4 → "₹18.4 L". */
export const lakh = (lakhs: number): string => `₹${round(lakhs, 2)} L`;

/**
 * Picks the unit by magnitude, so a ₹4 L work and a ₹40 Cr portfolio both read naturally
 * instead of one of them being quoted in an absurd number of the other's unit.
 */
export const rupees = (lakhs: number): string => (lakhs >= 100 ? crore(lakhs) : lakh(lakhs));

/** Fraction → one-decimal percentage, e.g. 0.062 → "6.2%". */
export const share1dp = (fraction: number): string => `${(fraction * 100).toFixed(1)}%`;

/** Fraction → whole percentage, e.g. 0.91 → "91%". */
export const pct = (fraction: number): string => `${Math.round(fraction * 100)}%`;

/**
 * Metres under a kilometre, kilometres above it.
 *
 * The demo's duplicate pair sits 800 m apart, and "0.8 km" understates how close that is
 * to a reader skimming a table — two works that near each other are plausibly the same
 * stretch of road, which is the whole point of the finding.
 */
export const distanceLabel = (km: number): string =>
  km < 1 ? `${Math.round(km * 1000)} m` : `${round(km, 2)} km`;

/** Whole months between two ISO dates, rounded, positive when `to` is later. */
export function monthsBetween(fromIso: string, toIso: string): number {
  return Math.round((daysBetween(fromIso, toIso) ?? 0) / 30.44);
}

/** "1 month" / "3 months", so evidence sentences do not read "1 months". */
export function monthsLabel(months: number): string {
  const n = Math.abs(months);
  return `${n} ${n === 1 ? 'month' : 'months'}`;
}

/** "1 day" / "12 days". */
export function daysLabel(days: number): string {
  const n = Math.abs(days);
  return `${n} ${n === 1 ? 'day' : 'days'}`;
}

/** "1 work" / "43 works" — MPLADS vocabulary for a sanctioned project. */
export function worksLabel(count: number): string {
  return `${count} ${count === 1 ? 'work' : 'works'}`;
}
