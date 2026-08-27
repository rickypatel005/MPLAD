# Product Requirements Document (PRD)
## MPLADS-AUDIT-AI — SIH26102

**Problem Statement:** SIH26102 — Development of an AI-powered system to detect anomalies, fraud, and inefficiencies in MPLAD Scheme implementation
**Ministry:** Ministry of Statistics & Programme Implementation (MoSPI), Government of India
**Document Owner (this copy):** Frontend Team Member
**Reference Source:** SIH26102 MPLADS Research Report (Aug 2026)
**Status:** Draft for team alignment

---

## 1. Purpose & Background

MPLADS gives every Member of Parliament ₹5 crore/year to recommend local development projects — roughly ₹3,950 crore/year across ~790 MPs. Since April 2023, the entire workflow (recommendation → sanction → payment → completion) runs through **eSAKSHI**, MoSPI's digital portal built with NIC and SBI.

**The gap:** eSAKSHI digitizes the workflow but has **zero intelligence layer** — no anomaly detection, no risk scoring, no cost benchmarking, no duplicate detection, no network analysis. It records *what happened*; it cannot tell an officer *what is suspicious*. MoSPI's oversight staff can manually review only a small fraction of the 50,000+ active projects.

**What we are building:** An AI-powered audit-intelligence layer, **MPLADS-AUDIT-AI**, that sits on top of eSAKSHI data, scores every project across six risk dimensions, and gives MoSPI officers and auditors an explainable, prioritized list of projects to investigate.

We are **not** rebuilding eSAKSHI. We are not adding blockchain (despite the PS being misfiled under "Blockchain & Cybersecurity" — confirmed a categorization error). We are not building citizen-facing tools.

---

## 2. Product Pitch

**One sentence:** MPLADS-AUDIT-AI is an explainable, multi-dimensional AI risk intelligence layer for MPLADS that scores every project across financial, timeline, compliance, contractor, and geospatial dimensions — prioritizing which projects auditors and MoSPI officers should investigate first.

**100-word pitch:** India's MPLADS scheme channels ₹3,950 crore annually through 790 MPs toward grassroots development. The eSAKSHI portal has digitized every transaction — but generates no intelligence. MPLADS-AUDIT-AI is the missing intelligence layer. Using rule-based compliance checking, statistical cost benchmarking against PWD Schedule of Rates, ML-powered delay prediction with SHAP explanations, NLP-based duplicate project detection, IA network graph analysis, and geospatial constituency boundary verification, the system assigns every project a multi-dimensional risk score. MoSPI officers see a ranked list of high-risk projects with full evidence packs. No fraud judgments — actionable intelligence for human auditors.

---

## 3. Goals & Success Metrics

| Goal | Metric | Target |
|---|---|---|
| Help officers triage projects | Top-ranked projects vs. random audit sample | ~4× more likely to surface a real documented issue |
| Detection quality (synthetic validation) | Precision / Recall at HIGH+CRITICAL threshold | ~82% precision, ~78% recall (on injected anomalies) |
| False positive control | FP rate on manually reviewed sample of 50 flagged projects | < 25% at HIGH/CRITICAL |
| Explainability | % of alerts with a full, numbered evidence pack | 100% |
| Judge scorecard (SIH) | Usability score | Must not be the weak link — judges explicitly penalize "backend-brilliant, UI-ugly" submissions |
| Demo readiness | End-to-end click-through of the 5-minute demo script without a dead page | 100% of scripted screens functional |

---

## 4. Users & Personas

| Persona | Role | Primary Need | Key Screens |
|---|---|---|---|
| MoSPI Officer (Central Nodal Agency) | Primary | Daily national risk overview, know what needs attention today | Risk Dashboard, Alert Feed |
| State Nodal Authority (SNA) | Primary | State-level risk overview | Risk Dashboard (state drill-down), Map View |
| District Authority (DA) | Primary | Project-level risk flags before releasing payments | Project Investigation Page |
| CAG Auditor | Secondary | Evidence packages for audit sampling | Project Investigation Page, Export/PDF |
| Parliamentary Committee | Secondary | Policy-level inefficiency summaries | Compliance Monitor |
| MoSPI IPMD | Secondary | Oversight tooling | All screens |

None of these are citizen users — this is an internal government audit tool. There is no public-facing login flow to design.

---

## 5. Scope

### 5.1 Core Product Features (in scope)

1. **Risk Dashboard** — National/State/District view of projects ranked by overall risk score; heat map + treemap views.
2. **Project Investigation Page** — Single project view: all 6 risk dimensions, evidence timeline, photos, payment history, recommended action.
3. **Cost Anomaly Engine (display layer)** — Shows Z-score deviation vs. PWD-SOR benchmark and comparable projects.
4. **NLP Duplicate Detector (display layer)** — Side-by-side comparison of flagged duplicate project pairs.
5. **IA Network Graph** — Interactive visualization of Implementing-Agency ↔ MP ↔ District relationships; highlights concentration risk.
6. **Compliance Rule Checker** — Red/amber/green status per MPLADS guideline rule, per project.
7. **Alert Feed** — Chronological feed of new high-risk flags; filterable by risk type, state, MP, threshold.

### 5.2 MVP vs. Strong vs. Stretch (build priority)

**MVP (non-negotiable):**
- Risk dashboard table, ranked, with LOW/MEDIUM/HIGH/CRITICAL color coding
- Project investigation page with risk-factor breakdown + explanation text
- Working integration against `/dashboard`, `/project/{id}`, `/analyze` endpoints

**Strong version (target for a competitive submission):**
- NLP duplicate detection view (clustered/paired)
- Delay prediction shown with SHAP-style explanation
- IA concentration scoring + interactive network graph
- Geospatial map view with district risk heat overlay
- Alert feed / notification mockup for CRITICAL projects
- One-click PDF export of a project's risk report

**Stretch (only if time remains):**
- Image reuse (pHash) detection view — only if real photo data is available
- Constituency boundary violation view — only if shapefile integrated
- AI investigation chatbot ("Why is Project X high risk?")
- Live eSAKSHI scraper feed indicator

### 5.3 Explicitly Out of Scope (do not build — duplicates eSAKSHI)

- Project recommendation form
- Sanction approval workflow
- Payment processing interface
- MP login / role-based recommendation tool
- Basic project status tracking (already in eSAKSHI)
- Citizen complaint / grievance portal
- Blockchain anything

---

## 6. Functional Requirements by Feature

### 6.1 Risk Dashboard
- **User story:** As a MoSPI officer, I want to see all projects ranked by risk so I know what to review first.
- Must show: national map (India, state-level risk color coding), drill-down to district, top-N ranked project list, KPI summary (total projects analyzed, count by risk level, top risk district).
- Acceptance: risk level color coding matches the fixed thresholds (§7); list is sortable/filterable by state, risk level, work type, date range.

### 6.2 Project Investigation Page
- **User story:** As a District Authority, I want to see exactly why a specific project is flagged before I approve a payment.
- Must show: all 6 risk dimension scores with icon + severity + one-line evidence text; payment history; photo evidence; recommended action; explicit "not a fraud determination" disclaimer.
- Acceptance: every risk factor shown must trace to a concrete number (Z-score, days overdue, HHI value, similarity %) — never a bare label with no evidence.

### 6.3 Cost Anomaly Display
- Show project cost vs. work-type/state benchmark, with Z-score and 2–3 comparable projects for context.

### 6.4 NLP Duplicate Detector
- **User story:** As an auditor, I want to see two suspiciously similar project descriptions side by side, with their similarity score and geographic distance.
- Acceptance: duplicate pairs sorted by similarity score; clicking a pair opens a side-by-side comparison plus a small map showing both locations.

### 6.5 IA Network Graph
- **User story:** As an officer, I want to visually see if one contractor is unusually concentrated across an MP's projects.
- Acceptance: force-directed graph, nodes = IA/MP/District, edge weight = project count, node size or color = concentration/HHI risk; clicking a node filters the project list.

### 6.6 Compliance Rule Checker
- Rule-by-rule (45-day sanction, 12-month completion, SC/ST 15%/7.5% mandate, photo-stage requirement) status per project, and aggregated by state.

### 6.7 Alert Feed
- Chronological, filterable list of new HIGH/CRITICAL flags; supports acknowledge/action-taken state per the `alerts` data model.

---

## 7. Risk Model Overview (what the UI must faithfully represent)

The system computes an **Overall Risk Score** as a weighted sum of six dimensions. The frontend does not compute this — it only renders it — but every screen must be consistent with this model:

| Dimension | Weight |
|---|---|
| Financial Risk | 0.25 |
| Timeline Risk | 0.20 |
| Compliance Risk | 0.20 |
| IA/Contractor Risk | 0.20 |
| Geospatial Risk | 0.10 |
| Evidence/Data Risk | 0.05 |

**Risk level thresholds (fixed — used for all color coding):**

| Score range | Level | Color |
|---|---|---|
| 0.00–0.25 | LOW | Green |
| 0.25–0.50 | MEDIUM | Yellow |
| 0.50–0.75 | HIGH | Orange |
| 0.75–1.00 | CRITICAL | Red |

Every risk score displayed must be accompanied by its `top_risk_factors` explanation — this is the product's core differentiator, and skipping it anywhere in the UI undermines the entire pitch.

---

## 8. Non-Functional Requirements

- **Explainability-first:** No screen may show a bare score without a reason. This is the single most important product-level UI rule.
- **Ethical language:** The word **"fraud" must never appear in system-generated UI copy.** Use "anomaly," "risk," "requires verification." Always show a human-review call to action, never an automated determination.
- **Political sensitivity:** MP names must be **anonymizable** in the demo build (e.g., "MP: [Anonymized]") — flag projects and IAs, not individuals, by default.
- **Performance:** Dashboard and tables must remain usable against a 10,000–50,000 row synthetic dataset (pagination/virtualization required, not client-side rendering of the full set).
- **Usability:** Explicitly called out in the SIH judge scorecard as a risk area ("missing frontend polish" is listed as a top-5 reason submissions lose) — budget real design effort, not an afterthought.
- **Auditability:** Any acknowledge/action taken on an alert should be visibly logged (supports the `audit_log` table).

---

## 9. Assumptions & Dependencies

- No official SIH26102 dataset exists as of the report date; the team will use a synthetic dataset (10,000–50,000 records) calibrated to real MPLADS parameters, plus scraped public eSAKSHI aggregate data where possible.
- Backend team exposes a FastAPI REST layer (see TRD for the full contract) — frontend work can and should proceed against a mocked version of this contract before backend endpoints are live.
- No real fraud labels exist anywhere — this shapes UI copy (§8) as much as it shapes the ML approach.

---

## 10. Key Product Risks (frontend-relevant subset)

| Risk | Impact on frontend | Mitigation |
|---|---|---|
| Missing frontend polish | Directly named as a top-5 reason SIH teams lose | Treat UI as ~30% of total build effort, not a wrapper around the API |
| GPS/location data not in public eSAKSHI data | Map view may need district-level fallback instead of point-level | Design map view to degrade gracefully to district centroid if lat/lon missing |
| Political sensitivity of naming MPs | Legal/PR risk if mishandled in UI | Build an anonymize toggle/default into every screen that shows an MP identifier |
| Government trust in AI judgments | Judges and personas will distrust a "black box" score | Evidence-first design is a hard requirement, not a nice-to-have |

---

## 11. SIH Judge Scorecard Context

| Dimension | Target score | Frontend's role |
|---|---|---|
| Usability | 7/10 baseline, aim higher | Owns this dimension almost entirely |
| Differentiation | 9/10 | IA network graph is the single most visually differentiating screen |
| Explainability | 9/10 | Evidence card design carries this |
| Demo Quality | 8/10 | Screens must map cleanly to the scripted 5-minute demo (see Implementation Plan) |

---

*Source: SIH26102 MPLADS Research Report, Phases 1, 5, 6, 9, 11, 12, 18, 19.*
