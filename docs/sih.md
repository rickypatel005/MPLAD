You are the FRONTEND ENGINEER for our SIH 2026 project:

MPLADS-AUDIT-AI
Problem Statement: SIH26102
Ministry: Ministry of Statistics & Programme Implementation (MoSPI), Government of India

We are building an AI-powered audit-intelligence layer for MPLADS.

IMPORTANT:
I have provided four project documents:
1. Research Report
2. PRD
3. TRD
4. Design Document
5. Implementation Plan

These documents are the SOURCE OF TRUTH.

Before writing significant code, read and understand all of these documents carefully.

Do NOT invent a different product.
Do NOT simplify away important requirements.
Do NOT replace the architecture with your preferred architecture.
Do NOT add unnecessary features.
Do NOT introduce blockchain.
Do NOT build citizen-facing functionality.
Do NOT build eSAKSHI itself.

The frontend must implement the product described in these documents.

==================================================
1. CORE PRODUCT CONCEPT
==================================================

MPLADS-AUDIT-AI sits ON TOP OF eSAKSHI data.

Architecture:

Data Sources
    ↓
Ingestion Pipeline
    ↓
PostgreSQL + PostGIS
    ↓
AI / Risk Engine
    ↓
FastAPI REST API
    ↓
Next.js Frontend
    ↓
MoSPI Officers / Auditors

The frontend is ONLY a consumer of the FastAPI API.

The frontend must NOT:
- calculate risk scores
- implement ML models
- perform anomaly detection
- perform aggregation that belongs to backend
- directly access PostgreSQL
- hardcode fake risk calculations

The frontend renders API results and evidence.

If the backend is not ready, use a MOCK API with the exact proposed API contract from the TRD.

==================================================
2. REQUIRED TECH STACK
==================================================

Use:

- Next.js 14
- App Router
- TypeScript
- Tailwind CSS
- Recharts
- D3.js
- react-leaflet / Leaflet
- TanStack Table
- TanStack Query or SWR
- ESLint
- Prettier

Deployment target:
- Vercel

Backend:
- FastAPI REST API

Database:
- PostgreSQL + PostGIS

The frontend must NEVER communicate directly with PostgreSQL.

==================================================
3. FIRST TASK — INSPECT THE PROJECT
==================================================

Before creating or modifying files:

1. Inspect the existing repository.
2. Determine whether a Next.js application already exists.
3. Inspect package.json.
4. Inspect the existing src/app structure.
5. Inspect Tailwind configuration.
6. Inspect TypeScript configuration.
7. Inspect existing components.
8. Inspect environment files.
9. Determine whether anything already implemented should be preserved.

Do not overwrite existing work blindly.

Then give me a concise report:

- Current project structure
- Existing technologies
- What is already implemented
- What is missing
- Recommended implementation order

Do NOT start a huge rewrite before inspecting the repository.

==================================================
4. ROUTES
==================================================

Implement these routes:

/
    Risk Dashboard

/project/[id]
    Project Investigation

/network
    IA Network Graph

/map
    Map View

/compliance
    Compliance Monitor

/alerts
    Alert Feed

/duplicates
    Duplicate Detection

Project Investigation is reached through dashboard/project drill-down and is not a primary top-navigation item.

==================================================
5. GLOBAL DESIGN PHILOSOPHY
==================================================

The UI must look like a serious government audit/intelligence system.

It should NOT look like:
- a gaming dashboard
- a crypto dashboard
- a generic SaaS template
- a flashy AI startup landing page

Visual direction:

- professional
- trustworthy
- clean
- data-dense but readable
- institutional
- modern
- restrained
- excellent information hierarchy

Primary audience:

- MoSPI officers
- State Nodal Authorities
- District Authorities
- CAG auditors
- Parliamentary Committee users

Desktop-first.

Primary target:
1280–1920px

Minimum supported width:
approximately 1024px.

==================================================
6. RISK COLOR SYSTEM
==================================================

These thresholds are FIXED.

LOW:
0.00–0.25
Green

MEDIUM:
0.25–0.50
Yellow

HIGH:
0.50–0.75
Orange

CRITICAL:
0.75–1.00
Red

Use:

LOW       #16A34A
MEDIUM    #EAB308
HIGH      #F97316
CRITICAL  #DC2626

IMPORTANT:

Never communicate risk using color alone.

Every risk indicator must include:
- color
- text label
- icon or equivalent visual indicator

Example:

🔴 CRITICAL

NOT:

[red circle only]

==================================================
7. MOST IMPORTANT PRODUCT RULE — EXPLAINABILITY
==================================================

This is an explainability-first product.

NEVER show a bare risk score.

Bad:

Risk Score: 0.91

Good:

CRITICAL — 0.91

Financial Risk
Cost is 3.4× the state benchmark.

Z-score: +4.8

Every risk score must have evidence.

The Project Investigation page must show six dimensions:

1. Financial Risk
2. Timeline Risk
3. Compliance Risk
4. IA / Contractor Risk
5. Geospatial Risk
6. Evidence / Data Risk

Each card must contain:

- dimension icon
- severity
- score
- concrete evidence
- relevant metric
- explanation

==================================================
8. ETHICAL LANGUAGE — VERY IMPORTANT
==================================================

The application must NOT make automated accusations.

Do not use these words in SYSTEM-GENERATED UI:

"fraud"
"guilty"
"corrupt"

Use:

"anomaly"
"risk"
"flagged for review"
"requires verification"

The system identifies risk indicators.

It does NOT determine wrongdoing.

Every project investigation page must display:

"AI-generated risk flag for human review. Not a determination of fraud."

Keep this disclaimer visible.

MP identities must support anonymization.

The public/judged demo should default to anonymized MP identifiers.

Create:

<AnonymizeToggle />

This should work consistently across the application.

==================================================
9. API ARCHITECTURE
==================================================

Create a single frontend API layer.

For example:

lib/api.ts

Components must NOT individually call fetch().

Use functions/hooks such as:

getDashboard()
getProject(id)
getNetwork()
getMapData()
getComplianceSummary()
getAlerts()
getDuplicates()
getReport(id)

This is important because we will initially use MOCK DATA and later switch to FastAPI.

The mock → real backend transition should require changing configuration/fetch layer, not rewriting components.

Environment:

NEXT_PUBLIC_API_BASE_URL

==================================================
10. API ENDPOINTS
==================================================

Prepare the frontend for:

GET /dashboard

POST /analyze

GET /project/{id}

GET /alerts

GET /network

GET /map-data

GET /report/{id}

GET /duplicates

GET /compliance-summary

Dashboard and alerts must support:

pagination
filtering
sorting

Examples:

state
district
risk_level
work_type
date_range
sort_by
order
page
page_size

Do not load 10,000–50,000 records into the browser at once.

==================================================
11. TYPESCRIPT DATA MODELS
==================================================

Create proper TypeScript interfaces based on the TRD.

At minimum:

Project

RiskScore

RiskFactor

ImplementingAgency

Alert

DuplicatePair

NetworkGraphData

Do not use "any" unnecessarily.

Keep API types separate from UI-specific types when appropriate.

==================================================
12. SHARED COMPONENT SYSTEM
==================================================

Create reusable components:

RiskBadge
EvidenceCard
KPISummaryCard
RankedProjectTable
DisclaimerFooter
AnonymizeToggle
LoadingState
EmptyState
ErrorState

Additional reusable components:

ProjectHeader
RiskDimensionCard
EvidenceTimeline
PaymentHistoryTable
PhotoGallery
RecommendedActionBanner
ForceDirectedGraph
GraphLegend
NodeDetailPanel
LeafletMapContainer
MapPopupCard
RuleComplianceMatrix
AlertList
AlertFilterBar
SideBySideComparisonModal
PairDistanceMiniMap

Build reusable components instead of duplicating UI.

==================================================
13. DASHBOARD
==================================================

Route:

/

Purpose:

National/state/district overview.

The dashboard must show:

1. KPI summary row

Examples:

Total Projects Analyzed
LOW
MEDIUM
HIGH
CRITICAL
Top Risk District / State

2. India state-level risk map

State choropleth.

3. Top-10 highest-risk projects

Each row should show:

Project ID
Work Type
District
Risk Level
Overall Score
Top Reason

The top project must be clickable.

Clicking it should navigate directly to:

/project/[id]

4. Filters

State
Risk level
Work type
Date range

5. Ranked project table

Use TanStack Table.

Must support:

sorting
filtering
pagination

Do not render the entire dataset.

6. Optional toggle:

Map
Treemap

Use Recharts for treemap.

==================================================
14. PROJECT INVESTIGATION PAGE
==================================================

Route:

/project/[id]

This is the MOST IMPORTANT PAGE.

Header:

Project ID
Overall Risk
Score
MP
IA
District
Work Type
Description

Then six risk cards:

Financial
Timeline
Compliance
IA / Contractor
Geospatial
Evidence / Data

Example evidence style:

FINANCIAL
CRITICAL

Cost is 3.4× the state average for road works.

₹12.4L/km vs ₹3.6L/km average

Z-score: +4.8

Do NOT reduce this to:

Financial Risk: HIGH

We need evidence.

Then:

Evidence Timeline

Recommendation
Sanction
Payments
Completion

Show relevant dates and violations.

Payment History Table.

Photo Gallery.

Recommended Action.

Example:

"Refer to District Authority for field verification and cost justification."

Then persistent disclaimer.

Also include:

"View in Network Graph"

if an IA/network relationship exists.

Include:

Export Report

as a strong-version feature.

==================================================
15. IA NETWORK GRAPH
==================================================

Route:

/network

This is the visual centerpiece.

Use D3.js.

Nodes:

IA
MP
DISTRICT

Edges:

relationships between them.

Edge weight:

project count.

Node size/color:

concentration risk.

Example demo IA:

Bharat Infrastructure Services

43 of 47 projects for one MP

HHI = 0.91

The project investigation page should be able to deep-link to this IA.

Clicking a node should show:

IA details
project count
risk/concentration
related MP
districts

and provide a way to filter related projects.

==================================================
16. MAP
==================================================

Route:

/map

Use:

Leaflet
react-leaflet

Show:

India map
district risk heat
project markers

If GPS exists:

use actual coordinates.

If GPS is unavailable:

fallback to district centroid.

Project popup:

Project ID
Risk
One-line reason
View Investigation

Support duplicate pair visualization.

The demo requires two projects approximately 800m apart.

==================================================
17. DUPLICATE DETECTION
==================================================

Route:

/duplicates

Table:

Project A
Project B
Similarity
Distance
Detection Method
Review Status

Sort by similarity descending.

Clicking a pair opens:

Side-by-side modal

Left:
Project A

Right:
Project B

Show:

description
cost
IA
dates
location

Then mini-map:

Project A marker
Project B marker
distance

The demo fixture must include:

91% similarity

approximately 800m distance.

==================================================
18. COMPLIANCE MONITOR
==================================================

Route:

/compliance

Rules include:

45-day sanction
12-month completion
SC/ST 15% / 7.5% mandate
photo-stage requirement

Build:

Rule Compliance Matrix

Rows:
rules

Columns:
states

Cells:
green / amber / red

Also:

State compliance bar chart.

SC/ST mandate tracker.

The demo fixture must visibly highlight exactly:

3 MPs below the 10% SC-area-spend line.

==================================================
19. ALERT FEED
==================================================

Route:

/alerts

Show chronological alerts.

Each:

Risk level
Project
Alert message
Timestamp
Acknowledgement status

Filters:

Risk type
State
MP
Threshold

Acknowledge action must show:

acknowledged_by
action_taken

Do not silently remove acknowledged alerts.

==================================================
20. LOADING / EMPTY / ERROR STATES
==================================================

Every data-fetching screen/component must have:

Loading state
Empty state
Error state

Never leave a blank screen.

Use skeleton loaders where appropriate.

Error states must have retry actions.

==================================================
21. PERFORMANCE
==================================================

Target dataset:

10,000–50,000 projects.

Never render all rows.

Use:

server-side pagination
TanStack Table
virtualization where necessary
React Query/SWR caching

Cache expensive:

/network
/map-data

per session.

==================================================
22. URL STATE
==================================================

Filters and sorting must live in URL query parameters.

Example:

/?state=Maharashtra&risk=CRITICAL

This makes demo navigation:

bookmarkable
reproducible
reload-safe

Do this from the beginning, not later.

==================================================
23. MOCK DATA
==================================================

Because backend may not be ready, create a realistic mock API.

Do NOT create random meaningless dummy data.

Create synthetic data consistent with MPLADS.

The critical demo fixture MUST include:

1. One CRITICAL project

Cost:
₹18.4L/km

Benchmark:
₹4.1L/km

24 months since sanction

96% predicted delay probability

91% similarity duplicate

duplicate from 3 months earlier

same district

different MP

same IA

2. IA:

Bharat Infrastructure Services

43 of 47 projects for one MP

HHI:
0.91

3. Duplicate pair:

91% similarity

~800m geographic distance

4. Compliance:

Exactly 3 MPs below 10% SC-area spend.

These records must be findable through the UI.

Do not merely display these numbers in static text.

They must exist in the mock data objects.

==================================================
24. DEMO FLOW
==================================================

The complete demo must work:

Dashboard
    ↓
#1 CRITICAL project
    ↓
Project Investigation
    ↓
6 risk evidence cards
    ↓
View IA Network
    ↓
Bharat Infrastructure Services
    ↓
Duplicate Detection
    ↓
91% similarity
    ↓
~800m map distance
    ↓
Compliance
    ↓
3 MPs below threshold

Every transition must be clickable.

No dead ends.

==================================================
25. DEVELOPMENT ORDER
==================================================

Follow this order.

PHASE 1 — FOUNDATION

- inspect repository
- configure Next.js
- configure Tailwind
- configure TypeScript
- create design tokens
- create layout/navigation
- create shared components
- create API layer
- create mock API
- create TypeScript types

PHASE 2 — MVP

Build:

1. Dashboard
2. Project Investigation

Get these completely functional before moving on.

PHASE 3 — HIGH-VALUE STRONG FEATURES

Build:

3. IA Network Graph
4. Duplicate Detection
5. Map
6. Compliance
7. Alerts

PHASE 4 — POLISH

- anonymization
- loading states
- empty states
- error states
- accessibility
- performance
- responsive behavior
- PDF export
- visual polish

==================================================
26. IMPORTANT IMPLEMENTATION RULE
==================================================

Do not try to implement everything in one giant step.

Work incrementally.

After each major phase:

1. implement
2. run the application
3. check for errors
4. fix errors
5. inspect the UI
6. continue

Keep the application runnable throughout development.

==================================================
27. DESIGN QUALITY BAR
==================================================

The final UI should feel like:

"Government audit intelligence platform"

NOT:

"student CRUD project"

NOT:

"generic admin dashboard"

NOT:

"AI SaaS landing page"

Prioritize:

information hierarchy
evidence visibility
trust
clarity
professionalism
visual consistency

Avoid excessive:
gradients
glows
animations
rounded cards everywhere
huge hero sections
unnecessary decorative elements

The user is an auditor/officer trying to investigate projects.

The UI should help them make decisions quickly.

==================================================
28. FINAL QUALITY CHECK
==================================================

Before considering the project complete, verify:

- all 7 routes work
- dashboard works
- project investigation works
- six risk dimensions are visible
- every score has evidence
- network graph works
- duplicate comparison works
- map works
- compliance works
- alerts work
- anonymization works
- loading states work
- empty states work
- error states work
- pagination works
- URL filters work
- no unnecessary "any"
- no direct database access
- API access centralized
- no banned accusation language in system-generated UI
- disclaimer appears where required
- demo fixtures are actually present
- demo path can be completed without dead pages

==================================================
29. START NOW
==================================================

Your FIRST response should NOT contain a huge amount of code.

First:

1. Inspect the repository.
2. Read the available project documents.
3. Summarize what already exists.
4. Identify what needs to be built.
5. Propose the exact Phase 1 implementation steps.
6. Then begin implementing Phase 1.

Do not ask me to repeatedly confirm obvious implementation decisions.

Make reasonable decisions that are consistent with the documents.

Keep me informed after each major milestone.

Start by inspecting the repository now.