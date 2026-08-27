/**
 * Response helpers for the mock route handlers.
 *
 * Kept out of `src/app/api` so the route directories contain nothing but `route.ts`
 * files, and kept in the mock layer because none of this ships once the real FastAPI
 * service is wired in — at that point `NEXT_PUBLIC_API_BASE_URL` points elsewhere and
 * these handlers are simply never called.
 *
 * The error body deliberately matches FastAPI's `{ "detail": "..." }` convention, which
 * is what `ApiError` in the client already parses. A 404 from the mocks and a 404 from
 * the real backend therefore surface identically in the UI.
 */

const JSON_HEADERS = {
  'Content-Type': 'application/json; charset=utf-8',
  // The dataset is rebuilt per server process, not per request, but responses vary by
  // query string and must never be served from an intermediate cache during a demo.
  'Cache-Control': 'no-store',
} as const;

export function json<T>(data: T, status = 200): Response {
  return new Response(JSON.stringify(data), { status, headers: JSON_HEADERS });
}

export function jsonError(status: number, detail: string): Response {
  return json({ detail }, status);
}

export function notFound(detail: string): Response {
  return jsonError(404, detail);
}

export function badRequest(detail: string): Response {
  return jsonError(400, detail);
}

/**
 * Optional artificial latency, off by default.
 *
 * Set `MOCK_API_DELAY_MS` to exercise skeleton and loading states without editing
 * components — the alternative is commenting out a render branch, which invariably ends
 * up committed.
 */
export async function simulateLatency(): Promise<void> {
  const raw = process.env.MOCK_API_DELAY_MS;
  if (!raw) return;
  const ms = Number(raw);
  if (!Number.isFinite(ms) || ms <= 0) return;
  await new Promise((resolve) => setTimeout(resolve, Math.min(ms, 5_000)));
}

/**
 * Reads the search params off a request.
 *
 * `new URL(request.url)` rather than the `NextRequest.nextUrl` convenience, so these
 * handlers stay plain Web-standard `Request`/`Response` code and can be lifted into any
 * runtime — including being used as the reference implementation the FastAPI team codes
 * the real endpoints against.
 */
export function searchParamsOf(request: Request): URLSearchParams {
  return new URL(request.url).searchParams;
}
