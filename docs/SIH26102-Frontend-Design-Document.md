# Design Document
## MPLADS-AUDIT-AI — Frontend UI/UX — SIH26102

**Reference Source:** SIH26102 MPLADS Research Report, Phases 9, 11, 14, 17, 18.
**Purpose:** Defines the design system, page-by-page layout spec, component behavior, and content rules the frontend build must follow.

---

## 1. Design Principles

These come directly from the research report's product philosophy — they are not arbitrary style choices:

1. **Explainability over black-box scores.** Every number on screen must be traceable to a reason. This is the product's core differentiator vs. competitors and vs. eSAKSHI itself.
2. **Evidence, not verdicts.** The system flags for human review; it never accuses. UI copy must reflect this everywhere (see §9).
3. **Government-grade trust.** The audience is MoSPI officers, auditors, and SIH judges evaluating "government readiness." The visual language should read as credible and official, not consumer-flashy.
4. **Frontend polish is a scored dimension, not decoration.** The source report explicitly flags "missing frontend polish" as a top-5 reason teams lose. Budget real design time.

---

## 2. Design System

### 2.1 Risk Color Scale (fixed — do not deviate)

| Level | Score range | Color | Suggested token | Icon |
|---|---|---|---|---|
| LOW | 0.00–0.25 | Green | `--risk-low` (e.g. `#16A34A`) | 🟢 |
| MEDIUM | 0.25–0.50 | Yellow | `--risk-medium` (e.g. `#EAB308`) | 🟡 |
| HIGH | 0.50–0.75 | Orange | `--risk-high` (e.g. `#F97316`) | 🟠 |
| CRITICAL | 0.75–1.00 | Red | `--risk-critical` (e.g. `#DC2626`) | 🔴 |

Rule: color is **always** paired with the text label (LOW/MEDIUM/HIGH/CRITICAL) and/or icon. Never color-only encoding.

### 2.2 Neutral / Base Palette

- Background: neutral off-white/light gray for a document-like, official feel.
- Text: high-contrast dark neutral (avoid pure black for large text blocks).
- Accent (non-risk UI, e.g. primary buttons, links): a single restrained institutional blue — avoid competing with the risk color scale.

### 2.3 Typography

- Clear, legible sans-serif for data-dense screens (tables, cards) — prioritize readability over character.
- Establish a clear type scale: page title > section header > card title > body > caption/meta.
- Numbers (costs, scores, Z-scores, percentages) should use tabular/monospaced figures where they appear in tables, so columns align.

### 2.4 Iconography

- Risk severity icons: 🟢🟡🟠🔴 (or equivalent SVG icon set) — used consistently across dashboard badges, evidence cards, and alert feed.
- Dimension icons for the 6 risk dimensions (Financial, Timeline, Compliance, IA/Contractor, Geospatial, Evidence) — pick one consistent icon per dimension and reuse it everywhere that dimension appears.

### 2.5 Layout & Breakpoints

- Primary target: desktop/laptop, ~1280–1920px (demo is on a laptop/projector).
- Minimum supported width: ~1024px — do not design mobile-first for this build; a government audit tool used in review sessions does not need a phone layout for the hackathon scope.
- Consistent page shell: left/top navigation across the 7 pages (§3), content area with generous whitespace for data-dense tables and cards.

---

## 3. Information Architecture

```
MPLADS-AUDIT-AI
├── Risk Dashboard        (/)              ← landing/home
├── Project Investigation (/project/[id])   ← drill-down, not top-nav
├── IA Network Graph      (/network)
├── Map View              (/map)
├── Compliance Monitor    (/compliance)
├── Alert Feed            (/alerts)
└── Duplicate Detection   (/duplicates)
```

Top-level nav shows 6 items (Dashboard, Network, Map, Compliance, Alerts, Duplicates). Project Investigation is always reached by drilling into a specific project — it is not a nav destination itself.

---

## 4. Page-by-Page Design Spec

### 4.1 Risk Dashboard (`/`)

**Purpose:** National/state/district overview; the first thing officers and judges see.

- **Top:** KPI summary row — total projects analyzed, count per risk level (with color chips), top risk district/state.
- **Center-left:** India map, state-level choropleth colored by average risk score (this is minute 0:45–1:30 of the demo script — must load fast and look immediately impressive).
- **Center-right or below map:** Top-10 ranked HIGH/CRITICAL project list (card or table rows), each showing project ID, work type, district, risk level badge, one-line top reason.
- **Toggle:** National → State → District drill-down (clicking a state zooms/filters).
- **Secondary view:** Treemap (Recharts) as an alternate visualization of risk concentration by category/state — toggle between map and treemap.
- **Table below/beside:** Full ranked project table (TanStack Table), sortable and filterable by state, risk level, work type, date range — paginated for the 10k–50k row dataset.

### 4.2 Project Investigation Page (`/project/[id]`)

**Purpose:** The single most important screen in the whole demo (minute 1:30–2:30 of the script) — this is where the "explainability" pitch is proven or lost.

- **Header:** Project ID, overall risk badge (level + score), MP (anonymizable), IA name, district, work type/description, one-line summary.
- **Six Risk Dimension Cards** (Financial, Timeline, Compliance, IA/Contractor, Geospatial, Evidence), each showing:
  - Dimension icon + severity icon/color (🔴🟠🟡🟢)
  - One-line evidence text with a concrete number, e.g.:
    > 🔴 FINANCIAL: Cost is 3.4× the state average for road works (₹12.4L/km vs. avg ₹3.6L/km) — Z-score: +4.8
  - This exact evidence-card format is specified in the source report and should be treated as the canonical template — do not simplify it to a bare label.
- **Evidence Timeline:** recommendation → sanction → payment stages → completion, with dates and any rule breaches marked inline (e.g., "45-day rule breached").
- **Payment History Table:** installment dates/amounts vs. progress.
- **Photo Gallery:** uploaded stage photos (if available); flag if any required stage is missing a photo.
- **Recommended Action banner:** e.g., "Refer to District Authority for field verification and cost justification."
- **Persistent disclaimer footer:** *"NOT A DETERMINATION OF FRAUD. AI-generated risk flag for human review."* — must be visible on every project page, not just in a tooltip.
- **Export Report button:** triggers PDF generation (Strong-version feature) — a judge-favorite, government-readiness signal.

### 4.3 IA Network Graph (`/network`)

**Purpose:** The visual centerpiece feature — described in the source report as a "guaranteed wow moment" and the strongest differentiator vs. any competing team.

- Force-directed graph (D3.js): nodes = Implementing Agencies, MPs, Districts; edges = project relationships, edge weight = project count.
- Node sizing/coloring reflects concentration risk (e.g., HHI-driven) — a large, red-leaning IA node should visually "pop" as suspicious.
- Click a node → side panel with detail (e.g., "Bharat Infrastructure Services: 43/47 of this MP's projects, HHI 0.91") and a link to filter the project list to that node.
- Legend clarifying node types and what size/color encode.

### 4.4 Map View (`/map`)

- Leaflet map of India with district-level risk heat overlay (choropleth).
- Marker clustering for individual projects where GPS is available; falls back to district-centroid placement if project-level coordinates are missing (see TRD Open Questions).
- Popup on click: project ID, risk level, one-line reason, link to full investigation page.
- Used in the demo to show duplicate-pair geography (two markers ~800m apart) — must support two-point distance display cleanly.

### 4.5 Compliance Monitor (`/compliance`)

- Rule-by-rule compliance matrix: rows = MPLADS guideline rules (45-day sanction, 12-month completion, SC/ST 15%/7.5% mandate, photo-stage requirement), columns = states, cells = red/amber/green.
- State-wise compliance bar chart (Recharts).
- Dedicated SC/ST mandate tracker highlighting MPs below the 15%/7.5% threshold — this is a specific demo beat ("3 MPs are currently at less than 10% SC area spend").

### 4.6 Alert Feed (`/alerts`)

- Chronological list, newest first, each row: alert level badge, project link, alert message, timestamp, acknowledge state.
- Filter bar: risk type, state, MP, threshold.
- Acknowledge action stores `acknowledged_by` + `action_taken` — surface this visibly once acknowledged (do not just remove the item silently).

### 4.7 Duplicate Detection (`/duplicates`)

- Table of duplicate pairs sorted by similarity score (descending), with geo distance column.
- Click a pair → side-by-side comparison modal showing both project descriptions, cost, IA, and dates.
- Mini-map inside the modal showing both project locations and the distance between them (per demo script: "map view showing both projects plotted 800m apart").

---

## 5. Reusable Component Library

| Component | Behavior notes |
|---|---|
| `RiskBadge` | Color + icon + text label, never color-only; used everywhere a risk level appears |
| `EvidenceCard` | Icon + severity + one-line evidence text with a concrete metric — canonical template from §4.2 |
| `RankedProjectTable` | Server-paginated, sortable, filterable; virtualized for large row counts |
| `KPISummaryCard` | Single stat + label + optional trend |
| `ForceDirectedGraph` | D3-based, click-to-filter, legend required |
| `LeafletMapContainer` | Choropleth + marker cluster + popup |
| `SideBySideComparisonModal` | Used by Duplicate Detection; reusable wherever two records need comparing |
| `DisclaimerFooter` | Fixed copy, appears on every project-level and alert-level view |
| `AnonymizeToggle` | Session-level toggle that masks MP identifiers across all screens |
| `LoadingState` / `EmptyState` / `ErrorState` | Every data-fetching component must implement all three — no blank screens during the live demo |

---

## 6. Interaction States

- **Loading:** skeleton loaders on tables/cards, not spinners-only, so layout doesn't jump.
- **Empty:** explicit "No projects match these filters" messaging, not a blank table.
- **Error:** explicit retry affordance; never a silent failure, especially important since the demo depends on live clicks.

---

## 7. Accessibility Notes

- Color is never the sole risk indicator (icon + text label always present).
- Sufficient contrast for all risk-level colors against their backgrounds.
- All interactive elements (map markers, graph nodes, table rows) must be reachable and operable via keyboard for judged accessibility, even if the primary demo is mouse-driven.

---

## 8. Demo-Mode Considerations

The UI should directly support the scripted 5-minute demo flow (see Implementation Plan for the full script). Concretely:

- Dashboard must be able to load and render the India risk map within a few seconds — this is the very first thing judges see after the problem-setup slide.
- The demo's "click the #1 highest-risk project" step means the ranked list on the dashboard must link directly to `/project/[id]` in one click.
- The IA Network Graph must support jumping directly to the flagged IA's node (e.g., via a "View in Network Graph" link from the Project Investigation page) rather than requiring the presenter to search for it manually.
- The Duplicate Detection page must support jumping straight to the specific 91%-similarity pair featured in the script.
- Anonymization toggle must default to **on** for the public/judged demo, per the source report's political-sensitivity mitigation ("anonymize in demo").

---

## 9. Content & Copy Guidelines

- Approved vocabulary: "anomaly," "risk," "flagged for review," "requires verification."
- Banned vocabulary in any system-generated text: "fraud," "guilty," "corrupt," or any language implying a determination rather than a flag.
- Every automated flag's copy should read like an auditor's working note, not an accusation — e.g., *"Cost is 3.4× the state average — requires field verification"* rather than *"This project is fraudulent."*
- The disclaimer text (§4.2) is not optional boilerplate — it is a product requirement grounded in the report's explicit government-trust rationale (Phase 9.4).

---

*Source: SIH26102 MPLADS Research Report, Phases 9, 11, 14, 17, 18.*
