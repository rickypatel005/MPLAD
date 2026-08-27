# Technical & Task Requirements Document (TRD)
## MPLADS-AUDIT-AI — Frontend Engineering — SIH26102

**Scope of this document:** Everything the Frontend team member needs to build, integrate, and ship — technical requirements + granular task list.
**Reference Source:** SIH26102 MPLADS Research Report, Phases 11–15, 17, 20.

---

## 1. Purpose

This TRD translates the product requirements into concrete technical specs and a task checklist for the frontend build. It defines: the stack, the pages, the API contract the frontend consumes, the data shapes, the component requirements, and non-functional constraints (performance, accessibility, ethical-copy rules).

---

## 2. Tech Stack (as specified in the research report)

| Layer | Choice | Notes |
|---|---|---|
| Framework | **Next.js 14** | App router; server + client components |
| Styling | **Tailwind CSS** | Utility-first, fast to theme for risk-level colors |
| Charts | **Recharts** | KPI charts, trend lines, treemap |
| Network graph | **D3.js** | Force-directed IA–MP–District graph (also acceptable: Pyvis if backend-rendered) |
| Maps | **react-leaflet** (Leaflet.js) | Free, open-source, strong India map/GeoJSON support |
| Tables | **TanStack Table** | Large ranked project lists — needs sorting/filtering/virtualization |
| Deployment | **Vercel** | Free tier, used for the hackathon build |
| Backend consumed | **FastAPI REST API** | See §5 for contract |
| Database (not owned by FE) | PostgreSQL + PostGIS (via Supabase) | Frontend never talks to DB directly |

Do **not** introduce blockchain libraries or citizen-facing auth flows — explicitly out of scope (see PRD §5.3).

---

## 3. System Context

```
[Data Sources] → [Ingestion Pipeline] → [PostgreSQL+PostGIS] → [AI/Risk Engine]
                                                                       │
                                                                       ▼
                                                        [FastAPI REST API Layer]
                                                                       │
                                                                       ▼
                                                        [Next.js 14 Frontend]  ← YOU ARE HERE
```

The frontend is a pure consumer of the FastAPI layer. It performs **no scoring, no ML, no aggregation** — it renders whatever the API returns, faithfully and with full evidence text. If the API is not ready, build and integrate against a mocked contract (see §9).

---

## 4. Page / Route Inventory

Derived directly from the system architecture diagram and the demo script. Suggested routes:

| # | Page | Suggested route | Primary data need |
|---|---|---|---|
| 1 | Risk Dashboard | `/` or `/dashboard` | `GET /dashboard` |
| 2 | Project Investigation | `/project/[id]` | `GET /project/{id}` |
| 3 | IA Network Graph | `/network` | `GET /network` |
| 4 | Map View | `/map` | `GET /map-data` |
| 5 | Compliance Monitor | `/compliance` | `GET /compliance-summary` |
| 6 | Alert Feed | `/alerts` | `GET /alerts` |
| 7 | Duplicate Detection | `/duplicates` | `GET /duplicates` |
| 8 (stretch) | PDF Report | triggered from Project Investigation | `GET /report/{id}` |

---

## 5. API Contract (frontend-facing)

Endpoints as defined in the architecture (Phase 14). Confirm exact response shapes with the backend teammate — the shapes below are inferred from the database schema (Phase 15) and should be treated as the frontend's proposed contract to negotiate from, not an assumption that backend already matches it exactly.

| Method | Endpoint | Purpose | Consumed by |
|---|---|---|---|
| GET | `/dashboard` | Aggregated risk stats + ranked project list | Risk Dashboard |
| POST | `/analyze` | Trigger/re-run analysis on a dataset (likely admin/demo action) | Dashboard (demo control) |
| GET | `/project/{id}` | Full project record + risk_scores row + evidence text | Project Investigation |
| GET | `/alerts` | List of alerts, filterable | Alert Feed |
| GET | `/network` | Graph nodes/edges for IA–MP–District | IA Network Graph |
| GET | `/map-data` | Geo-tagged project/district risk aggregates | Map View |
| GET | `/report/{id}` | PDF (or PDF-ready payload) for a project | Export button |
| GET | `/duplicates` | List of duplicate project pairs | Duplicate Detection |
| GET | `/compliance-summary` | Rule compliance rates by state/rule | Compliance Monitor |

**Request-side needs frontend should ask backend to support:** pagination (`page`, `page_size`), filtering (`state`, `district`, `risk_level`, `work_type`, `date_range`), and sorting (`sort_by`, `order`) on `/dashboard` and `/alerts` at minimum — the dataset is 10k–50k rows and cannot be shipped to the client unpaginated.

---

## 6. Data Models (frontend TypeScript shapes)

Derived from the `projects`, `risk_scores`, `implementing_agencies`, `alerts`, and `duplicate_pairs` tables (Phase 15). Confirm field names 1:1 with backend before building — these are the canonical fields to request.

```ts
interface Project {
  project_id: string;
  mp_id: string;
  mp_house: "LOK_SABHA" | "RAJYA_SABHA" | "NOMINATED";
  constituency_id: string;
  district_id: string;
  state_id: string;
  work_type: string;
  work_description: string;
  estimated_cost_lakhs: number;
  is_sc_area: boolean;
  is_st_area: boolean;
  is_calamity: boolean;
  recommended_date: string; // ISO date
  sanction_status: "PENDING" | "SANCTIONED" | "REJECTED";
  sanction_date: string | null;
  ia_id: string;
  first_installment_dt: string | null;
  first_installment_amt: number | null;
  final_payment_dt: string | null;
  total_paid_lakhs: number;
  completion_date: string | null;
  work_lat: number | null;
  work_lon: number | null;
  photo_count: number;
  fy: string;
}

interface RiskScore {
  project_id: string;
  financial_risk: number;   // 0–1
  timeline_risk: number;
  compliance_risk: number;
  ia_risk: number;
  geo_risk: number;
  evidence_risk: number;
  overall_risk: number;     // 0–1, weighted sum
  risk_level: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  top_risk_factors: RiskFactor[]; // parsed from JSONB
  explanation_text: string;
  scored_at: string;
  model_version: string;
}

interface RiskFactor {
  dimension: "FINANCIAL" | "TIMELINE" | "COMPLIANCE" | "IA" | "GEO" | "EVIDENCE";
  severity: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL"; // maps to 🟢🟡🟠🔴
  text: string;      // e.g. "Cost is 3.4× the state average for road works"
  value?: number;     // e.g. Z-score, HHI, similarity %
}

interface ImplementingAgency {
  ia_id: string;
  ia_name: string;
  ia_type: "GOVT" | "LOCAL_BODY" | "NGO" | "TRUST" | "UNKNOWN";
  total_projects: number;
  completed_projects: number;
  avg_delay_days: number;
  risk_score: number;
  state_id: string;
}

interface Alert {
  alert_id: number;
  project_id: string;
  alert_type: string;
  alert_level: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  alert_message: string;
  is_acknowledged: boolean;
  acknowledged_by: string | null;
  action_taken: string | null;
  created_at: string;
}

interface DuplicatePair {
  pair_id: number;
  project_id_1: string;
  project_id_2: string;
  similarity_score: number;   // 0–1
  geo_distance_km: number;
  detection_method: string;
  reviewed: boolean;
}

interface NetworkGraphData {
  nodes: { id: string; type: "IA" | "MP" | "DISTRICT"; label: string; risk?: number }[];
  edges: { source: string; target: string; weight: number }[];
}
```

---

## 7. Component Requirements (by page)

| Page | Required components |
|---|---|
| Risk Dashboard | `<IndiaRiskMap>` (state choropleth), `<KPISummaryCards>`, `<RankedProjectTable>` (TanStack, paginated), `<RiskLevelFilterBar>`, `<TreemapView>` (Recharts) |
| Project Investigation | `<ProjectHeader>`, `<RiskDimensionCard>` ×6 (icon + severity + evidence text), `<EvidenceTimeline>`, `<PaymentHistoryTable>`, `<PhotoGallery>`, `<RecommendedActionBanner>`, `<ExportReportButton>`, `<DisclaimerFooter>` |
| IA Network Graph | `<ForceDirectedGraph>` (D3), `<GraphLegend>`, `<NodeDetailPanel>` |
| Map View | `<LeafletMapContainer>`, `<DistrictHeatOverlay>`, `<ProjectMarkerCluster>`, `<MapPopupCard>` |
| Compliance Monitor | `<RuleComplianceMatrix>` (red/amber/green grid), `<StateComplianceBarChart>`, `<SCSTMandateTracker>` |
| Alert Feed | `<AlertList>`, `<AlertFilterBar>`, `<AcknowledgeAction>` |
| Duplicate Detection | `<DuplicatePairTable>`, `<SideBySideComparisonModal>`, `<PairDistanceMiniMap>` |
| Shared | `<RiskBadge>`, `<LoadingState>`, `<EmptyState>`, `<ErrorState>`, `<AnonymizeToggle>` |

---

## 8. State Management & Data Fetching

- Use a server-state library (React Query / SWR) for all API calls — do not hand-roll fetch + useState for paginated/filterable data.
- Keep filter/sort state in the URL (query params) so demo navigation is bookmarkable and reproducible during judging.
- Cache `/network` and `/map-data` responses client-side per session — they are expensive to compute and unlikely to change mid-demo.

---

## 9. Mocking Strategy (unblock frontend before backend is ready)

Because the backend/ML pipeline is being built in parallel, the frontend should:
1. Build fixture JSON files matching the shapes in §6 (a few hundred synthetic rows is enough for UI dev).
2. Stand up a thin mock layer (e.g., MSW or a local Next.js API route) implementing the §5 contract.
3. Swap the mock base URL for the real FastAPI URL once available — no component code should change, only the fetch layer.

---

## 10. Non-Functional Requirements

- **Performance:** Dashboard/alert tables must handle 10,000–50,000 rows via server-side pagination + virtualized rendering (TanStack Table + windowing) — never render the full set client-side.
- **Responsiveness:** Primary demo target is a laptop/projector screen, but layouts should not break below ~1024px width.
- **Accessibility:** Risk levels must never rely on color alone — pair every color with a text label/icon (🟢🟡🟠🔴 + LOW/MEDIUM/HIGH/CRITICAL text), for both accessibility and because judges/officers may not know the color convention.
- **Browser support:** Evergreen Chrome/Edge (hackathon demo environment) — no legacy browser requirement.

---

## 11. Ethical / Explainability UI Requirements (hard constraints, not style preferences)

- **Never render the word "fraud"** in any system-generated label, badge, or auto-text. Approved vocabulary: "anomaly," "risk," "requires verification," "flagged for review."
- Every risk score shown must be adjacent to its evidence (`top_risk_factors` / `explanation_text`) — a bare number or badge with no reason is not acceptable anywhere in the app.
- Every project or IA detail view must include a visible, permanent disclaimer: *"AI-generated risk flag for human review. Not a determination of fraud."*
- MP identifiers must be anonymizable (toggle or default-anonymized mode) given the political sensitivity noted in the source report.
- Any alert acknowledgment/action must be visibly attributable (`acknowledged_by`, `action_taken`) to support the audit-trail requirement.

---

## 12. Task Breakdown (checklist)

### MVP
- [ ] Project scaffold: Next.js 14 + Tailwind + ESLint/Prettier
- [ ] Design tokens: risk-level color scale, typography, spacing
- [ ] Shared components: `RiskBadge`, `LoadingState`, `EmptyState`, `ErrorState`
- [ ] Mock API layer matching §5/§6 contract
- [ ] Risk Dashboard: ranked table (TanStack) + KPI cards + risk-level filter
- [ ] Project Investigation page: 6 risk-dimension cards + evidence text + disclaimer
- [ ] Wire both pages to `/dashboard` and `/project/{id}`

### Strong version
- [ ] Duplicate Detection page (table + side-by-side modal)
- [ ] IA Network Graph (D3 force-directed) + legend + click-to-filter
- [ ] Map View (react-leaflet) with district risk overlay
- [ ] Alert Feed with filters + acknowledge action
- [ ] Compliance Monitor (rule matrix + state bar chart)
- [ ] PDF export button on Project Investigation page

### Stretch
- [ ] Image reuse detection view (only if photo data available)
- [ ] Constituency boundary violation overlay (only if shapefile integrated)
- [ ] AI investigation chatbot panel
- [ ] Live data-source indicator (scraped vs. synthetic)

---

## 13. Definition of Done (per page)

A page is demo-ready only when: it loads from the real (or mocked) API without console errors; every risk value has accompanying evidence text; loading/empty/error states are implemented (not blank screens); it matches the color/threshold scheme in PRD §7; and it can be reached in ≤2 clicks from the dashboard, matching the demo script flow (see Implementation Plan §3).

---

## 14. Open Questions for the Team

- Exact `/dashboard` and `/alerts` filter/pagination params — confirm with backend before building the filter bar.
- Whether `top_risk_factors` will arrive as structured JSON (§6 shape) or pre-formatted text — structured is strongly preferred for consistent card rendering.
- Whether GPS (`work_lat`/`work_lon`) will be populated for the demo dataset, or whether Map View needs a district-centroid fallback.

---

*Source: SIH26102 MPLADS Research Report, Phases 11–15, 17, 19, 20.*
