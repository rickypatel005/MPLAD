'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import {
  applyPatch,
  countActiveFilters,
  getListParam,
  getParam,
  resolvedPage,
  resolvedPageSize,
  toQueryString,
  withoutFilters,
  type UrlValue,
} from '@/lib/url-query';

/**
 * Reading and writing the screen's state through the address bar.
 *
 * Every filter, sort and page on every screen goes through this hook (TRD §9.2). Nothing
 * that changes what is on screen is held in local component state, which buys three things
 * that matter for this product: any view can be shared as a link, a reload reproduces the
 * screen exactly, and the browser's Back button behaves the way a user expects instead of
 * leaving the app.
 *
 * Writes default to `replace`. A presenter clicking through six filters should not have to
 * press Back six times to leave the page, and the demo runs on live clicks. Actions that
 * change *what you are looking at* rather than how it is filtered — opening a duplicate
 * pair, focusing an agency in the graph — pass `'push'`, so Back closes the thing that
 * was opened.
 */

export type HistoryMode = 'replace' | 'push';

export interface UrlStateApi {
  /** Live params. Read-only; write through `set`. */
  params: URLSearchParams;
  get: (key: string) => string | undefined;
  /** Multi-select values, whether the URL spells them repeated or comma-joined. */
  list: (key: string) => string[];
  /** True when the key holds this exact value in its list. */
  includes: (key: string, value: string) => boolean;
  /** Resolved page and page size, for the pager's own controls. */
  page: number;
  pageSize: number;
  activeFilterCount: number;
  /** Patch one or more keys. Empty values delete; changing a filter resets the page. */
  set: (patch: Record<string, UrlValue>, mode?: HistoryMode) => void;
  /** Adds or removes one value from a multi-select filter. */
  toggle: (key: string, value: string, mode?: HistoryMode) => void;
  /** Drops every filter, keeping sort and view state. */
  clearFilters: (mode?: HistoryMode) => void;
  /** Href for a patch, so pagers and sortable headers can be real links. */
  hrefFor: (patch: Record<string, UrlValue>) => string;
}

export function useUrlState(): UrlStateApi {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // Snapshot per render, keyed on the serialised string. `useSearchParams` returns a new
  // object identity on every navigation, so memoising on `.toString()` keeps every
  // downstream `useMemo` and query key stable while the URL is unchanged.
  const serialized = searchParams.toString();
  const params = useMemo(() => new URLSearchParams(serialized), [serialized]);

  const navigate = useCallback(
    (next: URLSearchParams, mode: HistoryMode) => {
      const href = `${pathname}${toQueryString(next)}`;
      // `scroll: false` throughout: adjusting a filter must not throw the reader back to
      // the top of a long table.
      if (mode === 'push') router.push(href, { scroll: false });
      else router.replace(href, { scroll: false });
    },
    [pathname, router],
  );

  const set = useCallback(
    (patch: Record<string, UrlValue>, mode: HistoryMode = 'replace') => {
      navigate(applyPatch(params, patch), mode);
    },
    [navigate, params],
  );

  const toggle = useCallback(
    (key: string, value: string, mode: HistoryMode = 'replace') => {
      const current = getListParam(params, key);
      const next = current.includes(value)
        ? current.filter((entry) => entry !== value)
        : [...current, value];
      navigate(applyPatch(params, { [key]: next }), mode);
    },
    [navigate, params],
  );

  const clearFilters = useCallback(
    (mode: HistoryMode = 'replace') => {
      navigate(withoutFilters(params), mode);
    },
    [navigate, params],
  );

  const hrefFor = useCallback(
    (patch: Record<string, UrlValue>) => `${pathname}${toQueryString(applyPatch(params, patch))}`,
    [params, pathname],
  );

  return useMemo(
    () => ({
      params,
      get: (key: string) => getParam(params, key),
      list: (key: string) => getListParam(params, key),
      includes: (key: string, value: string) => getListParam(params, key).includes(value),
      page: resolvedPage(params),
      pageSize: resolvedPageSize(params),
      activeFilterCount: countActiveFilters(params),
      set,
      toggle,
      clearFilters,
      hrefFor,
    }),
    [clearFilters, hrefFor, params, set, toggle],
  );
}

/**
 * A text box bound to a URL parameter, debounced.
 *
 * Search runs server-side over tens of thousands of works, so a request per keystroke is
 * both wasteful and visibly jumpy. The input stays responsive because the draft is local;
 * the URL — and therefore the fetch — updates once the typing settles.
 *
 * While a write is pending the input owns the value, so an in-flight URL update can never
 * reset the cursor or swallow the last characters typed. Once it flushes, changes from
 * elsewhere (Clear filters, the Back button) propagate into the box as normal.
 */
export function useUrlSearch(key = 'q', delay = 300): [string, (next: string) => void] {
  const { get, set } = useUrlState();
  const urlValue = get(key) ?? '';

  const [draft, setDraft] = useState(urlValue);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (timer.current === null) setDraft(urlValue);
  }, [urlValue]);

  useEffect(
    () => () => {
      if (timer.current !== null) clearTimeout(timer.current);
    },
    [],
  );

  const update = useCallback(
    (next: string) => {
      setDraft(next);
      if (timer.current !== null) clearTimeout(timer.current);
      timer.current = setTimeout(() => {
        timer.current = null;
        set({ [key]: next.trim() });
      }, delay);
    },
    [delay, key, set],
  );

  return [draft, update];
}
