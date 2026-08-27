# SIH26102 — System Architecture & Stack Specification

## 1. Executive Summary & Stack Reconciled Decision

**MPLADS Audit Intelligence** is an enterprise-grade forensic auditing platform for the Government of India's **Member of Parliament Local Area Development Scheme (MPLADS)**.

### Stack Decision Record (Path B: Full-Stack TypeScript & PostGIS)
To ensure cohesive end-to-end type safety, ultra-fast reactive user interfaces, sub-millisecond in-memory cache indexing, and seamless AI agent integrations, the system is architected as:
* **Backend Runtime:** Node.js 20+ with Express 4 and TypeScript 5.8
* **Database & Persistence:** PostgreSQL 15 + PostGIS 3.3 (DDL Schema in `schema.sql`, Containerized in `docker-compose.yml`)
* **High-Performance Query Cache:** In-Memory Multi-Index Relational Engine (`AppDatabase`)
* **Data Processing & Export Pipeline:** Multi-Format Pipeline (JSON, CSV, Snappy Parquet converter in `scripts/convert_to_parquet.py`)
* **Frontend HUD:** React 19, Vite 6, TailwindCSS 4, Recharts, Lucide Icons, Motion
* **AI & Forensic Engine:** Google Gemini 2.5 Flash (`@google/genai`)
* **Security & Auth:** Salted `scrypt` Key Derivation Function (KDF) + JWT + Strict RBAC
* **API Documentation:** OpenAPI 3.0 Specification (`docs/openapi.json`) with embedded Swagger UI at `/api/docs`

---

## 2. Architecture Diagram

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                                 FRONTEND HUD (React 19 + Vite 6)                       │
│  ┌──────────────┐  ┌───────────┐  ┌────────────┐  ┌──────────────┐  ┌──────────────┐ │
│  │Dashboard Tab │  │Projects   │  │Duplicates  │  │Agency Network│  │Pipeline View │ │
│  │& Alert Feed  │  │Registry   │  │Cluster Map │  │& HHI Analysis│  │& Validation  │ │
│  └──────┬───────┘  └─────┬─────┘  └─────┬──────┘  └──────┬───────┘  └──────┬───────┘ │
│         └────────────────┴──────────────┼────────────────┴─────────────────┘         │
│                                         │ HTTP REST (JSON / Bearer JWT)                │
└─────────────────────────────────────────┼──────────────────────────────────────────────┘
                                          │
┌─────────────────────────────────────────┼──────────────────────────────────────────────┐
│                                  BACKEND SERVICE LAYER                                 │
│  ┌──────────────────────────────────────┴───────────────────────────────────────────┐  │
│  │                            Express.js REST API Layer                             │  │
│  │  • Auth:       POST /api/auth/login, GET /api/auth/me                            │  │
│  │  • Projects:   GET /api/projects, GET /api/projects/:id                          │  │
│  │  • Analytics:  GET /api/dashboard/summary, GET /api/dashboard/state/:id         │  │
│  │  • Risk/ML:    GET /api/risk/top, GET /api/risk/:id, POST /api/risk/scores (P2)  │  │
│  │  • Geo/NLP:    GET /api/duplicates/:id, POST /api/duplicates/submit (P3)         │  │
│  │  • Agencies:   GET /api/ia/:id, GET /api/features/projects (P2/P3 Features)      │  │
│  │  • Governance: POST /api/review/action, GET /api/audit/:id, GET /api/evidence/:id│  │
│  │  • AI Studio:  POST /api/ai/analyze (Gemini 2.5 Flash)                           │  │
│  │  • Docs:       GET /api/docs (Swagger UI), GET /api/openapi.json                 │  │
│  └──────────────────────────────────────┬───────────────────────────────────────────┘  │
│                                         │                                              │
│  ┌──────────────────────────────────────┴───────────────────────────────────────────┐  │
│  │                       Security & RBAC Middleware Layer                           │  │
│  │  • Salted Scrypt KDF Password Hashing (64-byte derived keys with random salt)   │  │
│  │  • Role Hierarchy: ADMIN (Superuser) > AUDITOR > REVIEWER / INVESTIGATOR > VIEWER│  │
│  │  • Constant-time HMAC-SHA256 Token Verification                                  │  │
│  └──────────────────────────────────────┬───────────────────────────────────────────┘  │
│                                         │                                              │
│  ┌──────────────────────────────────────┴───────────────────────────────────────────┐  │
│  │                    In-Memory Relational Engine (AppDatabase)                     │  │
│  │  • Project Index by ID (O(1) lookup)     • Payments Ledger Map by Project        │  │
│  │  • State / MP / Agency Secondary Maps    • Audit Chronicle & Review Decisions    │  │
│  └──────────────────────────────────────┬───────────────────────────────────────────┘  │
│                                         │                                              │
│  ┌──────────────────────────────────────┴───────────────────────────────────────────┐  │
│  │                       Persistence & External Databases                           │  │
│  │  ┌──────────────────────────────────────┐  ┌───────────────────────────────────┐  │  │
│  │  │ PostgreSQL 15 + PostGIS 3.3          │  │ Processed Data Lake               │  │  │
│  │  │ • schema.sql (12 DDL sections)       │  │ • 7 Datasets (projects, payments, │  │  │
│  │  │ • PostGIS Point (SRID 4326) & GIST   │  │   agencies, mps, constituencies,  │  │  │
│  │  │ • docker-compose.yml + migrations    │  │   districts, states)              │  │  │
│  │  │ • Spatial views (v_duplicate_cands)  │  │ • Parquet / CSV / JSON + Manifest │  │  │
│  │  └──────────────────────────────────────┘  └───────────────────────────────────┘  │  │
│  └──────────────────────────────────────────────────────────────────────────────────┘  │
└────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Data Pipeline & Canonical Geography Model

### 4-Tier Canonical Geographic Hierarchy
Every civic project strictly inherits its administrative provenance through canonical reference tables:
$$\text{State (36)} \longrightarrow \text{District (543)} \longrightarrow \text{Constituency (543)} \longrightarrow \text{MP (543)} \longrightarrow \text{Projects (10,000+)}$$

```text
Raw CSV (34.5 KB)
   ↓
Phase 1: Ingestion & Profiling (detects Grand Total & missing allocation row 343)
   ↓
Phase 2: Master Normalization (543 MPs, 36 States, 543 Constituencies, 543 Districts)
   ↓
Phase 3: Synthetic Project Expansion (10,000+ projects, Seed: 26102)
   ↓
Phase 3A: Payment Ledger Generation (20,000+ payment tranches)
   ↓
Phase 3B: Controlled Anomaly Injections (7 known demo cases: P10342, P10101, P10701/02, P10580, P10450, P10880)
   ↓
Phase 4: 12-Check Data Integrity & Validation Suite (Schema, Referential, Bounds, Geography, Temporal, Anomalies)
   ↓
Export: 7 Canonical Datasets to data/processed/ (Parquet / CSV / JSON)
```

---

## 4. Cross-Team Integration Boundaries

| Workstream | Integration Contract | Endpoints & Artifacts |
| :--- | :--- | :--- |
| **Person 1 (Data + Backend)** | Core data platform, PostGIS persistence, REST APIs, RBAC governance. | `GET /api/projects`, `GET /api/health`, `POST /api/review/action` |
| **Person 2 (ML / Risk Intelligence)** | Feature extraction input $\rightarrow$ Persisted multi-dimensional risk scores & flags. | `GET /api/features/projects`, `POST /api/risk/scores`, `POST /api/risk/flags` |
| **Person 3 (NLP / Geo / Graph)** | Description & coordinate extraction $\rightarrow$ Persisted duplicate clusters & IA networks. | `GET /api/duplicates/:id`, `POST /api/duplicates/submit`, `GET /api/ia/:id` |
| **Person 4 (Frontend HUD)** | Standard HTTP JSON REST APIs (Zero direct database dependency). | `GET /api/dashboard/summary`, `GET /api/evidence/:id`, `POST /api/auth/login` |

---

## 5. Security & Role-Based Access Control (RBAC) Matrix

| Endpoint | Method | Required Role | Unauthenticated | Insufficient Role |
| :--- | :---: | :---: | :---: | :---: |
| `/api/auth/login` | POST | Public | Allowed | Allowed |
| `/api/projects`, `/api/dashboard/*` | GET | Public / All | 200 OK | 200 OK |
| `/api/risk/top`, `/api/risk/:id` | GET | Public / All | 200 OK | 200 OK |
| `/api/evidence/:id`, `/api/audit/:id` | GET | Public / All | 200 OK | 200 OK |
| `/api/features/projects` | GET | Public / All | 200 OK | 200 OK |
| `/api/review/action` | POST | `ADMIN`, `AUDITOR`, `REVIEWER`, `INVESTIGATOR` | **401 Unauthorized** | **403 Forbidden** |
| `/api/risk/scores`, `/api/risk/flags` | POST | `ADMIN`, `AUDITOR` | **401 Unauthorized** | **403 Forbidden** |
| `/api/duplicates/submit` | POST | `ADMIN`, `AUDITOR` | **401 Unauthorized** | **403 Forbidden** |
| `/api/pipeline/run` | POST | `ADMIN` (Superuser) | **401 Unauthorized** | **403 Forbidden** |

---

## 6. Directory Layout

```text
d:/person1/MPLAD/
├── data/
│   ├── raw/
│   │   └── Allocated Limit for Honble MPs.csv   # Immutable raw CSV source
│   └── processed/
│       ├── projects.parquet / .csv / .json      # 10,000+ civic projects
│       ├── payments.parquet / .csv / .json      # 20,000+ payment ledger
│       ├── implementing_agencies.*              # 252 executive divisions
│       ├── mps.*                                # 543 normalized MPs
│       ├── constituencies.*                     # 543 Lok Sabha constituencies
│       ├── districts.*                          # 543 administrative districts
│       ├── states.*                             # 36 States & UTs
│       ├── validation_report.json               # 12-check validation report
│       └── manifest.json                        # Dataset manifest & checksums
├── docs/
│   ├── architecture.md                          # This architecture specification
│   ├── openapi.json                             # OpenAPI 3.0 REST specification
│   ├── api-contract.md                          # Data contract specifications
│   └── data-dictionary.md                       # Entity relationship dictionary
├── src/
│   ├── middleware/
│   │   └── auth.ts                              # Salted scrypt hashing + RBAC middleware
│   ├── db/
│   │   ├── database.ts                          # In-memory relational engine (O(1) indexes)
│   │   └── postgres.ts                          # PostgreSQL + PostGIS client & migrations
│   ├── pipeline/
│   │   ├── ingestAndClean.ts                    # CSV profiling & master cleaning
│   │   ├── syntheticGenerator.ts                # 10k+ project generator & anomaly injector
│   │   └── validationSuite.ts                   # 12-check integrity verification suite
│   ├── data/
│   │   └── masterLocations.ts                   # 36 States & UTs reference data
│   ├── App.tsx                                  # Full React interactive HUD
│   └── types.ts                                 # Strict domain TypeScript definitions
├── scripts/
│   ├── export-processed.ts                      # 7-dataset export pipeline runner
│   ├── convert_to_parquet.py                    # Apache Parquet dataset converter
│   ├── migrate.ts                               # PostgreSQL schema migration runner
│   └── seed-db.ts                               # PostgreSQL batch database seeder
├── tests/
│   ├── unit/
│   │   ├── auth.test.ts                         # Scrypt KDF, timing-safe & RBAC tests
│   │   ├── pipeline.test.ts                     # Canonical geography & 12 validation tests
│   │   └── database.test.ts                     # Query engine, P2/P3 intelligence tests
│   └── integration/
│       └── api.test.ts                          # End-to-end REST API & security tests
├── docker-compose.yml                           # PostgreSQL 15 + PostGIS 3.3 container
├── schema.sql                                   # Full DDL schema (12 sections, triggers, views)
├── server.ts                                    # Express REST API backend entry
├── package.json
└── vitest.config.ts
```
