# Implementation Plan
## MPLADS-AUDIT-AI — Frontend Build Execution — SIH26102

**Problem Statement:** SIH26102 — AI-powered anomaly, fraud, and inefficiency detection for MPLAD Scheme implementation
**Ministry:** Ministry of Statistics & Programme Implementation (MoSPI), Government of India
**Document Owner (this copy):** Frontend Team Member
**Reference Sources:** SIH26102 MPLADS Research Report (Phases 12, 17, 18, 20) · Frontend PRD · Frontend Design Document · Frontend TRD
**Status:** Execution plan for the 36-hour build window

This document is the operational counterpart to the PRD, Design Document, and TRD. Those three define *what* to build and *how it should look/behave*. This plan defines *in what order, on what timeline, and to what checkpoint* the frontend role executes it, so that a working, demo-ready UI exists at every checkpoint rather than only at the very end.

---

## 1. How to Use This Document

- The PRD, Design Document, and TRD are cross-referenced against **this** plan (e.g. "see Implementation Plan §3" for the demo-script screen mapping). Keep all four open side by side while building.
- Every task below assumes the data shapes in TRD §6, the component list in TRD §7, and the copy/ethics rules in TRD §11 as fixed constraints — this plan does not repeat them, it sequences them.
- Treat §4 (timeline) as the master checklist. If the hackathon clock slips, cut from the bottom of the Strong tier first, never from the MVP tier, and never skip a Definition-of-Done gate (§9) just to add another feature.

---

## 2. Role Scope & Boundaries

The 4-person team splits as: **Data/ML engineer**, **Backend (FastAPI) engineer**, **Frontend engineer (this role)**, **UX/Docs/Demo lead**. Frontend owns:

- Everything under `Next.js 14` app router: all 7 pages, all shared components, all client-side state/URL-param handling.
- The mock API layer used to unblock development before backend endpoints exist (TRD §9).
- Visual fidelity to the Design Document (colors, thresholds, icons, layout) and the ethical copy rules (TRD §11) — these are hard constraints, not style preferences.
- Demo-day screen readiness: every scripted click in §3 below must resolve to a real, working screen.

Frontend does **not** own: risk scoring logic, ML model output, database schema, or synthetic data generation content — it only renders what those layers produce. If a number looks wrong on screen, the fix is a data/backend conversation, not a frontend patch that hardcodes a "nicer" value (except for the deliberately-seeded demo fixtures in §8, which exist for reliability, not correctness).

---

## 3. Demo Script → Screen Ownership Map

The judged walkthrough is a fixed 4:30–5:00 script (Research Report Phase 17). Every beat below must be a real, clickable path in the app — not a slide, not a screenshot. This table is the single source of truth for "what must work" on demo day.

| Time | Demo beat | Screen(s) that must be live | Must-not-fail element |
|---|---|---|---|
| 0:00–0:45 | Problem setup (eSAKSHI has no intelligence layer) | External — no frontend dependency | N/A |
| 0:45–1:30 | National risk dashboard, state choropleth, Top-10 ranked list | `/` (Risk Dashboard) | Map must render in a few seconds; Top-10 list must be visible without scrolling |
| 1:30–2:30 | Drill into the #1 CRITICAL project, read 6 risk-dimension evidence cards | `/project/[id]` (Project Investigation) | Every evidence card shows a concrete number, never a bare label |
| 2:30–3:30 | IA Network Graph — Bharat Infrastructure Services concentration | `/network`, reached via a "View in Network Graph" link from the project page | Graph must jump straight to the flagged IA's node, not require manual search |
| 3:30–4:00 | Duplicate pair at 91% similarity, two markers ~800m apart | `/duplicates` → side-by-side modal → mini-map | Must support jumping directly to this specific pair, not a random one |
| 4:00–4:30 | Compliance: 3 MPs below 10% SC-area spend | `/compliance` (SC/ST Mandate Tracker) | The 3 flagged MPs must be visibly highlighted, not buried in a table |
| Closing | "Force multiplier, not a replacement" | N/A | — |

**Rule:** any page in this table is non-negotiable MVP-adjacent work, even if the PRD lists the underlying feature as "Strong version." A Strong-tier feature that appears in the demo script is effectively MVP for scheduling purposes.

---

## 4. Build Timeline (36-Hour Window)

Times are elapsed hours from hackathon start (T+0). Adjust proportionally if the actual event window differs, but keep the *ratios* — roughly 15% setup, 40% MVP, 35% Strong tier, 10% polish/rehearsal.

### Pre-Hackathon (T-minus, before the clock starts)
- [ ] Scaffold Next.js 14 + Tailwind locally; confirm `nvm`-managed Node version matches teammates'
- [ ] Agree on the API contract (TRD §5/§6) with the backend teammate in writing — this is the single highest-leverage conversation before coding starts
- [ ] Pre-build fixture JSON for all 8 endpoints using the TRD §6 shapes, including the exact demo fixtures in §8 below
- [ ] Confirm design tokens (risk color hex values, type scale) so no time is lost bikeshedding on Hour 0

### T+0 to T+6 — Foundation
- [ ] Project scaffold: Next.js 14 (app router) + Tailwind + ESLint/Prettier
- [ ] Design tokens: `--risk-low/medium/high/critical`, neutral palette, type scale, tabular-figure number styling
- [ ] Shared components: `RiskBadge`, `LoadingState`, `EmptyState`, `ErrorState`
- [ ] Mock API layer (MSW or local Next.js API routes) implementing all 8 endpoints against fixture JSON
- [ ] URL-param-driven filter/sort state pattern established once, reused everywhere later

**Checkpoint at T+6:** app runs, shows placeholder pages for all 7 routes, shared components render in isolation (e.g. a scratch page with all 4 `RiskBadge` states).

### T+6 to T+14 — MVP Pages
- [ ] Risk Dashboard: KPI summary row, `RankedProjectTable` (TanStack, paginated/virtualized), risk-level filter bar
- [ ] India state choropleth (can start as a static SVG/GeoJSON render before the real `/map-data` shape is finalized)
- [ ] Project Investigation page: `ProjectHeader`, 6× `RiskDimensionCard` in the canonical evidence-card format (Design Doc §4.2), `DisclaimerFooter`
- [ ] Wire both pages to mock `/dashboard` and `/project/{id}`
- [ ] Loading/empty/error states implemented on both MVP pages (not deferred to the polish pass)

**Checkpoint at T+14:** MVP is demo-able end to end against mock data. This is the fallback minimum if nothing else ships — treat it as a hard save-point, not a waypoint.

### T+14 to T+16 — Backend Sync Point
- [ ] Compare real FastAPI responses against fixture JSON; reconcile any field-name or shape drift
- [ ] Swap mock base URL for the real API behind a single config flag — no component code should change, only the fetch layer (TRD §9.3)
- [ ] Re-run the MVP checkpoint against live data; fix any silent type mismatches (nulls where a number was expected, date format differences, etc.)

### T+16 to T+26 — Strong-Tier Build
Build in this order — it matches both the demo script's screen order (§3) and each feature's differentiation value (PRD §11):

1. [ ] **IA Network Graph** (`/network`) — D3 force-directed, legend, click-to-filter, "jump to node" deep link from the project page. This is the single highest-value screen (Design Doc §4.3 calls it the "guaranteed wow moment") — do not let it slip to the stretch pile.
2. [ ] **Duplicate Detection** (`/duplicates`) — table sorted by similarity, `SideBySideComparisonModal`, `PairDistanceMiniMap`, deep link to the 91% pair
3. [ ] **Map View** (`/map`) — Leaflet choropleth + marker clustering, district-centroid fallback if GPS is sparse
4. [ ] **Compliance Monitor** (`/compliance`) — rule matrix, state bar chart, SC/ST mandate tracker with the 3 flagged MPs visible by default
5. [ ] **Alert Feed** (`/alerts`) — list, filter bar, `AcknowledgeAction` with visible `acknowledged_by`/`action_taken`
6. [ ] **PDF export button** on Project Investigation — judge-favorite, government-readiness signal (Research Report Phase 18)

**Checkpoint at T+26:** all 7 pages exist and are individually functional against live (or best-available) data.

### T+26 to T+30 — Integration Hardening
- [ ] `AnonymizeToggle` wired session-wide, default **on** for the judged run (Design Doc §8)
- [ ] Loading/empty/error states audited across all 7 pages, not just the two MVP pages
- [ ] Accessibility pass: color-never-alone check on every risk indicator, keyboard reachability on map markers/graph nodes/table rows (TRD §10)
- [ ] Performance check against the full 10k–50k row fixture set — confirm pagination/virtualization actually engages, not just present in code
- [ ] Cross-check every screen against TRD §13 Definition of Done

### T+30 to T+34 — Demo Rehearsal
- [ ] Full run-through of the §3 script, timed, on the actual demo laptop/network
- [ ] Confirm every "must-not-fail element" in §3 in sequence, back to back, twice
- [ ] Fix anything that broke under rehearsal load (don't add new features here)
- [ ] Prepare a static fallback (screen recording or screenshots of the golden path) in case of live-demo network failure

### T+34 to T+36 — Freeze & Polish
- [ ] Code freeze on functionality; only visual polish and copy fixes after this point
- [ ] Final check of banned-vocabulary rule (TRD §11 — no "fraud" anywhere in UI copy)
- [ ] Final check that the disclaimer footer is present on every project/alert view
- [ ] Deploy to Vercel; confirm the deployed build matches what was rehearsed, not an older commit

---

## 5. Environment & Project Setup Checklist

- [ ] Node.js version pinned and shared with the team (via `.nvmrc`) so `nvm` resolves identically on every machine
- [ ] `npx create-next-app@14` with App Router, TypeScript, Tailwind selected at scaffold time
- [ ] Install: `@tanstack/react-table`, `recharts`, `d3`, `react-leaflet` + `leaflet`, a server-state library (`@tanstack/react-query` or `swr`)
- [ ] `.env.local` with `NEXT_PUBLIC_API_BASE_URL` pointing at the mock layer initially, swapped to the FastAPI URL at the T+14 sync point
- [ ] Repo-level lint/format config agreed with the team before Hour 0 so merges don't fight over style
- [ ] Vercel project connected early (even with a placeholder page) so the first real deploy isn't attempted under time pressure

---

## 6. Per-Page Build Sequence & Dependencies

| Page | Depends on | Build order rationale |
|---|---|---|
| Risk Dashboard | `RiskBadge`, mock `/dashboard` | First — it's the landing page and the first demo beat |
| Project Investigation | `RiskBadge`, mock `/project/{id}`, dashboard's row-click link | Second — proves the explainability pitch; most scrutinized screen |
| IA Network Graph | `/network` fixture, a real flagged IA in the fixture data | Third — highest differentiation value, needs the most iteration time |
| Duplicate Detection | `/duplicates` fixture, `LeafletMapContainer` (can share code with Map View) | Fourth — reuses map code already proven in Network/Map work |
| Map View | Same Leaflet setup as Duplicate Detection's mini-map | Build alongside Duplicate Detection to share the map component |
| Compliance Monitor | `Recharts` bar chart (already used on Dashboard) | Reuses existing charting patterns — lower marginal effort |
| Alert Feed | `RiskBadge`, simplest data shape of the 7 pages | Last among Strong tier — lowest risk, can absorb schedule slippage |

Building in this order means that if time runs out, the pages cut are Alert Feed and Compliance Monitor — the two least central to the demo script — rather than Network Graph or Duplicate Detection, which the script depends on directly.

---

## 7. API Integration & Mocking Strategy

1. **Fixture-first.** Write JSON fixtures matching TRD §6 shapes before writing any component. A component built against a shape that later turns out wrong costs more than a fixture written twice.
2. **One fetch layer.** All data access goes through a single `lib/api.ts` (or equivalent) — components call `useProjects()`, `useProject(id)`, etc., never `fetch()` directly. This is what makes the mock→real swap at T+14 a one-file change.
3. **Cache aggressively where the TRD allows it.** `/network` and `/map-data` are expensive and unlikely to change mid-demo (TRD §8) — cache them client-side per session rather than refetching on every navigation.
4. **URL as state.** Filter/sort/pagination state lives in query params from the first page built, not retrofitted later — this is also what makes demo navigation bookmarkable and recoverable if a screen needs to be reloaded live.
5. **Confirm, don't assume, field names.** The TRD explicitly flags its data shapes as a *proposed* contract (TRD §5) — the T+14 sync point exists specifically to catch drift before it compounds across 7 pages.

---

## 8. Demo Data — Fixtures That Must Be Seeded Exactly

These are the specific numbers the demo script (§3) is written around. They must exist as real, findable records in whatever dataset (synthetic or scraped) the team ships — not approximated at demo time:

- One project at **CRITICAL** risk with: cost ₹18.4L/km vs. a ₹4.1L/km benchmark; 24 months since sanction with a 96% predicted delay probability; a 91%-similarity duplicate against another project 3 months earlier in the same district (different MP, same IA)
- Implementing Agency **"Bharat Infrastructure Services"** — 43 of 47 projects for one MP, HHI concentration 0.91 — must be reachable as a single click from that CRITICAL project's page
- The duplicate pair at exactly **91% similarity**, with the two project locations plotted **~800m apart** on the map
- Exactly **3 MPs** sitting below the 10% SC-area-spend line (mandate is 15%) on the Compliance Monitor, visibly distinct from the rest of the table

Coordinate directly with the Data/ML teammate to guarantee these exist in the shipped dataset — do not let this depend on a lucky draw from a random generator.

---

## 9. Definition of Done — QA Checklist (per TRD §13)

Run this checklist per page, not once at the end:

- [ ] Loads from the live (or mocked) API with zero console errors
- [ ] Every risk value on screen has adjacent evidence text — no bare score or badge anywhere
- [ ] Loading, empty, and error states are all implemented (never a blank screen)
- [ ] Colors match the fixed threshold scheme (PRD §7) and are never the sole encoding (icon + text label always present)
- [ ] Reachable in ≤2 clicks from the dashboard, matching the demo flow in §3
- [ ] No instance of "fraud," "guilty," or "corrupt" anywhere in system-generated copy
- [ ] Disclaimer footer visible on every project-level and alert-level view
- [ ] MP identifiers respect the `AnonymizeToggle` state

---

## 10. Risk Mitigation (Frontend-Specific)

| Risk | Mitigation |
|---|---|
| Backend endpoints land late or with a different shape than TRD §6 | Mock layer means every page is demo-able on fixtures alone; T+14 sync point catches drift early instead of on demo day |
| GPS data sparse/missing in the real dataset | Map View designed from the start to fall back to district-centroid placement (PRD Key Product Risk table) |
| 10k–50k row dataset makes tables sluggish | Server-side pagination + virtualization built into `RankedProjectTable` from first implementation, not bolted on later |
| Judges penalize "backend-brilliant, UI-ugly" submissions | ~30% of total build time explicitly reserved for UI polish (§4), matching the Research Report's explicit warning (Phase 18) |
| Live demo network failure | A rehearsed screen recording of the full golden path exists as a fallback (§4, T+30–34) |
| Political sensitivity of showing MP names | `AnonymizeToggle` defaults on for any judged/public run; verified in the T+26–30 hardening pass |

---

## 11. Final Pre-Demo Checklist

- [ ] Anonymize toggle defaulted ON
- [ ] All 7 pages reachable from the top nav, each loading without console errors
- [ ] The exact demo fixtures (§8) are present and the deep links to them work
- [ ] Fallback recording/screenshots ready and accessible offline
- [ ] Deployed Vercel build matches the last rehearsed commit
- [ ] Laptop/browser used for rehearsal is the same one used for the live demo, on the same network conditions if possible

---

*Source: SIH26102 MPLADS Research Report, Phases 12, 17, 18, 20; Frontend PRD; Frontend Design Document; Frontend TRD.*
