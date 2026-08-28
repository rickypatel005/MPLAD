/**
 * The HTTP client. The *only* place in the application that calls `fetch`.
 *
 * Enforced mechanically: `.eslintrc.json` bans `fetch()` everywhere except
 * `src/lib/api/**`, `src/app/api/**` and `src/mocks/**`. Components import typed
 * functions from `src/lib/api`, never a URL.
 *
 * Two consequences that matter for this project:
 *
 * 1. Swapping the mock route handlers for the real FastAPI service is a change to
 *    NEXT_PUBLIC_API_BASE_URL alone — no component edits (TRD §9.3).
 * 2. The frontend never talks to PostgreSQL, and there is no second code path where
 *    it accidentally could.
 */

/** Base URL. `/api` in local proxy mode; the backend origin in live integrated mode. */
export const API_BASE_URL = (process.env.NEXT_PUBLIC_API_BASE_URL ?? '/api').replace(/\/+$/, '');

/** True only when explicitly configured via NEXT_PUBLIC_MOCK_MODE=true. Defaults to false. */
export const IS_MOCK_MODE = process.env.NEXT_PUBLIC_MOCK_MODE === 'true';


/** Request timeout. Long enough for a cold FastAPI start, short enough to fail visibly. */
const REQUEST_TIMEOUT_MS = 20_000;

/**
 * A failed API call, carrying enough context for `ErrorState` to be specific
 * ("503 from /dashboard") instead of a generic failure message.
 */
export class ApiError extends Error {
  readonly status: number;
  readonly path: string;
  readonly detail?: string;

  constructor(message: string, options: { status: number; path: string; detail?: string }) {
    super(message);
    this.name = 'ApiError';
    this.status = options.status;
    this.path = options.path;
    this.detail = options.detail;
  }

  /** True for network failures, timeouts and 5xx — the cases where retrying helps. */
  get isRetryable(): boolean {
    return this.status === 0 || this.status >= 500;
  }
}

export type QueryValue = string | number | boolean | null | undefined;
export type QueryParams = Record<string, QueryValue>;

/**
 * Serialises params, dropping empty values so the URL stays clean and cache keys
 * stay stable. Keys are sorted, so two logically identical requests produce one
 * cache entry rather than two.
 */
export function buildQueryString(params: QueryParams | undefined): string {
  if (!params) return '';
  const search = new URLSearchParams();
  for (const key of Object.keys(params).sort()) {
    const value = params[key];
    if (value === undefined || value === null || value === '') continue;
    search.set(key, String(value));
  }
  const qs = search.toString();
  return qs ? `?${qs}` : '';
}

function resolveUrl(path: string, params?: QueryParams): string {
  const normalised = path.startsWith('/') ? path : `/${path}`;
  return `${API_BASE_URL}${normalised}${buildQueryString(params)}`;
}

async function readErrorDetail(response: Response): Promise<string | undefined> {
  try {
    const text = await response.text();
    if (!text) return undefined;
    try {
      const parsed: unknown = JSON.parse(text);
      if (parsed && typeof parsed === 'object' && 'detail' in parsed) {
        const detail = (parsed as { detail: unknown }).detail;
        return typeof detail === 'string' ? detail : JSON.stringify(detail);
      }
    } catch {
      // Not JSON — fall through to the raw body.
    }
    return text.slice(0, 300);
  } catch {
    return undefined;
  }
}

export interface RequestOptions {
  params?: QueryParams;
  signal?: AbortSignal;
}

/** GET returning JSON. */
export async function apiGet<T>(path: string, options: RequestOptions = {}): Promise<T> {
  return request<T>('GET', path, undefined, options);
}

/** POST returning JSON. */
export async function apiPost<T>(
  path: string,
  body?: unknown,
  options: RequestOptions = {},
): Promise<T> {
  return request<T>('POST', path, body, options);
}

/** PATCH returning JSON. */
export async function apiPatch<T>(
  path: string,
  body?: unknown,
  options: RequestOptions = {},
): Promise<T> {
  return request<T>('PATCH', path, body, options);
}

async function request<T>(
  method: 'GET' | 'POST' | 'PATCH',
  path: string,
  body: unknown,
  { params, signal }: RequestOptions,
): Promise<T> {
  const url = resolveUrl(path, params);

  // Timeout composed with any caller-supplied signal, so TanStack Query can still
  // cancel a request when a component unmounts mid-flight.
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  const onExternalAbort = () => controller.abort();
  signal?.addEventListener('abort', onExternalAbort);

  let response: Response;
  try {
    response = await fetch(url, {
      method,
      headers: {
        Accept: 'application/json',
        ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
      signal: controller.signal,
      cache: 'no-store',
    });
  } catch (cause) {
    const aborted = cause instanceof Error && cause.name === 'AbortError';
    throw new ApiError(
      aborted
        ? 'The request timed out before the risk engine responded.'
        : 'Could not reach the risk engine.',
      {
        status: 0,
        path,
        detail: cause instanceof Error ? cause.message : undefined,
      },
    );
  } finally {
    clearTimeout(timeout);
    signal?.removeEventListener('abort', onExternalAbort);
  }

  if (!response.ok) {
    throw new ApiError(`Request to ${path} failed with status ${response.status}.`, {
      status: response.status,
      path,
      detail: await readErrorDetail(response),
    });
  }

  if (response.status === 204) {
    return undefined as T;
  }

  try {
    return (await response.json()) as T;
  } catch (cause) {
    throw new ApiError(`Response from ${path} was not valid JSON.`, {
      status: response.status,
      path,
      detail: cause instanceof Error ? cause.message : undefined,
    });
  }
}

/** Fetches a binary body — used when the backend renders the PDF report itself. */
export async function apiGetBlob(path: string, options: RequestOptions = {}): Promise<Blob> {
  const url = resolveUrl(path, options.params);
  let response: Response;
  try {
    response = await fetch(url, {
      method: 'GET',
      headers: { Accept: 'application/pdf' },
      signal: options.signal,
      cache: 'no-store',
    });
  } catch (cause) {
    throw new ApiError('Could not reach the risk engine.', {
      status: 0,
      path,
      detail: cause instanceof Error ? cause.message : undefined,
    });
  }

  if (!response.ok) {
    throw new ApiError(`Request to ${path} failed with status ${response.status}.`, {
      status: response.status,
      path,
      detail: await readErrorDetail(response),
    });
  }

  return response.blob();
}
