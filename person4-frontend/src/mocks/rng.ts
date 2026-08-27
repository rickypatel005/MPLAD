/**
 * Deterministic pseudo-random number generation for the synthetic dataset.
 *
 * Determinism is a hard requirement, not a convenience: the demo script relies on
 * deep links to specific records, so `/project/UP-LKO-2024-0412` must resolve to the
 * same work on every server start, on every machine, and after every redeploy. A
 * seeded generator gives that without checking a multi-megabyte JSON file into git.
 */

/** mulberry32 — small, fast, and good enough for fixture data. */
export function createRng(seed: number): () => number {
  let a = seed >>> 0;
  return function next(): number {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export interface Rng {
  /** Float in [0, 1). */
  next: () => number;
  /** Float in [min, max). */
  float: (min: number, max: number) => number;
  /** Integer in [min, max] inclusive. */
  int: (min: number, max: number) => number;
  /** True with probability `p`. */
  chance: (p: number) => boolean;
  /** Uniform pick. */
  pick: <T>(items: readonly T[]) => T;
  /** Weighted pick; `weight` maps an item to a non-negative number. */
  pickWeighted: <T>(items: readonly T[], weight: (item: T) => number) => T;
  /** Approximately normal via the central limit theorem, clamped to ±4σ. */
  normal: (mean: number, sd: number) => number;
  /** In-place Fisher-Yates shuffle of a copy. */
  shuffle: <T>(items: readonly T[]) => T[];
}

export function makeRng(seed: number): Rng {
  const next = createRng(seed);

  const float = (min: number, max: number) => min + next() * (max - min);
  const int = (min: number, max: number) => Math.floor(float(min, max + 1));

  return {
    next,
    float,
    int,
    chance: (p: number) => next() < p,
    pick: <T>(items: readonly T[]): T => items[Math.floor(next() * items.length)],
    pickWeighted: <T>(items: readonly T[], weight: (item: T) => number): T => {
      let total = 0;
      for (const item of items) total += Math.max(0, weight(item));
      let roll = next() * total;
      for (const item of items) {
        roll -= Math.max(0, weight(item));
        if (roll <= 0) return item;
      }
      return items[items.length - 1];
    },
    normal: (mean: number, sd: number) => {
      const sum = next() + next() + next() + next() + next() + next();
      const z = Math.min(4, Math.max(-4, (sum - 3) / Math.sqrt(0.5)));
      return mean + z * sd;
    },
    shuffle: <T>(items: readonly T[]): T[] => {
      const out = [...items];
      for (let i = out.length - 1; i > 0; i -= 1) {
        const j = Math.floor(next() * (i + 1));
        const tmp = out[i];
        out[i] = out[j];
        out[j] = tmp;
      }
      return out;
    },
  };
}

// ---------------------------------------------------------------------------
// Date helpers — the dataset works in plain calendar dates
// ---------------------------------------------------------------------------

/** "YYYY-MM-DD" in UTC, matching the wire format in TRD §6. */
export function toISODate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * 86_400_000);
}

export function parseDate(iso: string): Date {
  return new Date(`${iso}T00:00:00.000Z`);
}

/** Financial year label for a date, e.g. 2024-06-01 → "2024-25". */
export function financialYearOf(date: Date): string {
  const year = date.getUTCFullYear();
  const month = date.getUTCMonth(); // 0-indexed; April is 3.
  const startYear = month >= 3 ? year : year - 1;
  return `${startYear}-${String((startYear + 1) % 100).padStart(2, '0')}`;
}

/** Rounds to `places` decimals, avoiding long float tails in the JSON payload. */
export function round(value: number, places = 2): number {
  const factor = 10 ** places;
  return Math.round(value * factor) / factor;
}

export function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}
