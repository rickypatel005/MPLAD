'use client';

import { createContext, useCallback, useContext, useMemo, useState } from 'react';
import type { ReactNode } from 'react';

/**
 * Session-wide MP anonymisation.
 *
 * Defaults to ON, from NEXT_PUBLIC_DEFAULT_ANONYMIZE, because the toggle must
 * default on for any public or judged run (Design Doc §8) — the source report's
 * political-sensitivity mitigation.
 *
 * Deliberately not persisted to browser storage. The provider sits above the
 * router, so the choice survives all in-app navigation, while a hard reload
 * returns to the safe default rather than silently leaving identities exposed. It
 * also keeps server and client render output identical, avoiding a hydration
 * mismatch on the first paint of the demo.
 *
 * Masking is *pseudonymous, not random*: a given mp_id always maps to the same
 * alias. The demo depends on being able to say "same district, different MP" with
 * the toggle on, which only works if aliases are stable and comparable.
 */

const DEFAULT_ANONYMIZE = process.env.NEXT_PUBLIC_DEFAULT_ANONYMIZE !== 'false';

export interface MPIdentity {
  mp_id: string;
  mp_name?: string | null;
  constituency_name?: string | null;
}

export interface AnonymizeContextValue {
  anonymized: boolean;
  setAnonymized: (next: boolean) => void;
  toggle: () => void;
  /** Display label for an MP — an alias when masked, the name when not. */
  mpLabel: (mp: MPIdentity) => string;
  /** Constituency names identify an MP, so they are masked alongside the name. */
  constituencyLabel: (mp: MPIdentity) => string;
  /** Stable alias for an mp_id, independent of the toggle. */
  aliasFor: (mpId: string) => string;
}

const AnonymizeContext = createContext<AnonymizeContextValue | null>(null);

/**
 * Deterministic FNV-1a hash. Small, dependency-free, and stable across reloads and
 * between server and client — all that matters for alias generation.
 */
function hash32(input: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < input.length; i += 1) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

const ALIAS_LETTERS = 'ABCDEFGHJKLMNPQRSTUVWXYZ'; // I and O omitted — ambiguous with 1 and 0.

/** "MP-K42" — short enough for a table cell, distinct enough to compare at a glance. */
export function mpAlias(mpId: string): string {
  const h = hash32(mpId);
  const letter = ALIAS_LETTERS[h % ALIAS_LETTERS.length];
  const digits = String(Math.floor(h / ALIAS_LETTERS.length) % 100).padStart(2, '0');
  return `MP-${letter}${digits}`;
}

export function AnonymizeProvider({ children }: { children: ReactNode }) {
  const [anonymized, setAnonymized] = useState(DEFAULT_ANONYMIZE);

  const toggle = useCallback(() => setAnonymized((prev) => !prev), []);

  const value = useMemo<AnonymizeContextValue>(
    () => ({
      anonymized,
      setAnonymized,
      toggle,
      aliasFor: mpAlias,
      mpLabel: (mp) => (anonymized ? mpAlias(mp.mp_id) : mp.mp_name || mpAlias(mp.mp_id)),
      constituencyLabel: (mp) =>
        anonymized ? 'Constituency withheld' : mp.constituency_name || 'Unknown constituency',
    }),
    [anonymized, toggle],
  );

  return <AnonymizeContext.Provider value={value}>{children}</AnonymizeContext.Provider>;
}

export function useAnonymize(): AnonymizeContextValue {
  const ctx = useContext(AnonymizeContext);
  if (!ctx) {
    throw new Error('useAnonymize must be used inside <AnonymizeProvider>.');
  }
  return ctx;
}
