# SIH26102 — MPLADS Audit Intelligence Platform

[![Node.js](https://img.shields.io/badge/Node.js-v18%2B-green.svg)](https://nodejs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0%2B-blue.svg)](https://www.typescriptlang.org/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-15-336791.svg)](https://www.postgresql.org/)
[![PostGIS](https://img.shields.io/badge/PostGIS-3.3-green.svg)](https://postgis.net/)
[![Python](https://img.shields.io/badge/Python-3.10%2B-3776AB.svg)](https://www.python.org/)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.112-009688.svg)](https://fastapi.tiangolo.com/)
[![Next.js](https://img.shields.io/badge/Next.js-14-black.svg)](https://nextjs.org/)
[![License](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

> **Enterprise-Grade AI-Powered Forensic Auditing, Anomaly Detection & Geospatial Governance System for the Member of Parliament Local Area Development Scheme (MPLADS)**

---

## 📑 Table of Contents
1. [Executive Overview](#1-executive-overview)
2. [End-to-End System Architecture](#2-end-to-end-system-architecture)
3. [Core Capabilities & Workstream Modules](#3-core-capabilities--workstream-modules)
4. [Directory Structure](#4-directory-structure)
5. [Quick Start & Reproducible Setup](#5-quick-start--reproducible-setup)
6. [API Reference & OpenAPI Specification](#6-api-reference--openapi-specification)
7. [Security & Role-Based Access Control (RBAC)](#7-security--role-based-access-control-rbac)
8. [Machine Learning, NLP & Graph Intelligence](#8-machine-learning-nlp--graph-intelligence)
9. [Human-in-the-Loop Governance & Evidence Dossier](#9-human-in-the-loop-governance--evidence-dossier)
10. [Testing & Verification](#10-testing--verification)
11. [Team & Workstream Allocation](#11-team--workstream-allocation)

---

## 1. Executive Overview

The **Member of Parliament Local Area Development Scheme (MPLADS)** enables Members of Parliament (MPs) to recommend developmental works in their constituencies with an annual allocation of ₹5 Crore per MP. 

Traditional auditing methods face severe challenges in tracking tens of thousands of decentralized civic works across India. The **MPLADS Audit Intelligence Platform (SIH26102)** solves this through automated forensic auditing:

* **Phantom Works & Premature Payments**: Detecting disbursements exceeding physical on-ground progress.
* **Semantic & Geospatial Duplicate Detection**: Uncovering identical or overlapping projects sanctioned under slightly altered descriptions within identical geographical radii.
* **Implementing Agency (IA) Collusion & Monopolies**: Calculating Herfindahl-Hirschman Index (HHI) market concentration scores and detecting agency work-hoarding.
* **Timeline Delay & Cost Escalation**: Flagging severe schedule slippages against CPWD (Central Public Works Department) milestone benchmarks.
* **Human-in-the-Loop Governance**: Immutable audit chronicle (`audit_logs`) and legally structured evidence dossiers citing General Financial Rules (GFR 2017) violations.

---

## 2. End-to-End System Architecture

```text
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                                SIH26102 ARCHITECTURE                                   │
└────────────────────────────────────────────────────────────────────────────────────────┘

 [ PERSON 4: FRONTEND HUD ] ── Next.js 14 + Tailwind CSS + Lucide Icons + Recharts
         │ (HTTP REST / JSON / OpenAPI 3.0)
         ▼
 ┌──────────────────────────────────────────────────────────────────────────────────────┐
 │ PERSON 1: CORE DATA & BACKEND PLATFORM (Node.js + Express + TypeScript)              │
 │                                                                                      │
 │  • Ingestion & Normalization: 543 MPs, 36 States, 543 Constituencies, 543 Districts │
 │  • Synthetic Expansion: 10,000+ Projects, 26,000+ Payment Tranches, PostGIS Geometries│
 │  • Security & RBAC: Salted Scrypt KDF + HMAC-SHA256 JWT Authentication               │
 │  • Relational Storage: PostgreSQL 15 + PostGIS 3.3 (SRID 4326 Point & GIST Indexes) │
 │  • Governance Engine: Human-in-the-loop Reviews, Immutable Audit Logs, Dossier Gen   │
 └────────────────────────────┬─────────────────────────────────┬───────────────────────┘
                              │                                 │
                 (Feature Vectors)               (NLP & Graph Queries)
                              ▼                                 ▼
 ┌────────────────────────────────────────┐   ┌────────────────────────────────────────┐
 │ PERSON 2: ML RISK & ANOMALY ENGINE    │   │ PERSON 3: NLP, GRAPH & GEO SERVICE     │
 │ (Python / Scikit-Learn / XGBoost)      │   │ (Python / FastAPI / Sentence-BERT / Nx)│
 │                                        │   │                                        │
 │ • Isolation Forest Anomaly Detection   │   │ • Sentence-BERT Semantic Matching      │
 │ • Autoencoder Reconstruction Loss      │   │ • PostGIS Spatial Proximity Clustering │
 │ • Multi-Dimensional Risk Scoring (6D)  │   │ • NetworkX IA Collusion Graphs & HHI   │
 │ • POST /api/risk/scores & /flags       │   │ • POST /api/duplicates/submit          │
 └────────────────────────────────────────┘   └────────────────────────────────────────┘
```

---

## 3. Core Capabilities & Workstream Modules

### 🏛️ Person 1 — Data Platform & Backend Core
* **4-Tier Geographic Hierarchy**: Strict administrative provenance ($\text{State} \rightarrow \text{District} \rightarrow \text{Constituency} \rightarrow \text{MP} \rightarrow \text{Projects}$).
* **PostgreSQL 15 + PostGIS 3.3 Relational Storage**: Full schema (`schema.sql`) with spatial indexes, check constraints, foreign keys, and views.
* **Deterministic Idempotent Migrations**: CLI migration tool (`npm run migrate`) recording SHA-256 checksums in `schema_migrations`.
* **12-Check Data Integrity Suite**: Schema validation, foreign key checks, financial non-negativity, coordinate bounding box verification, temporal sequence validation, and anomaly integrity verification.
* **REST API Layer**: 14+ endpoints supporting deterministic pagination, tie-breaker sorting, full-text search, and multi-parameter filters.

### 🤖 Person 2 — Machine Learning & Risk Intelligence
* **Multi-Dimensional Risk Vector**:
  $$\text{Overall Risk} = f(\text{Financial}, \text{Timeline}, \text{Compliance}, \text{IA Workload}, \text{Geospatial}, \text{Evidence})$$
* **Anomaly Detectors**: Unsupervised Isolation Forest, Autoencoder neural networks, and XGBoost classification models.
* **Automated Flagging**: Emits structured flags (`COST_OVERRUN`, `PAYMENT_LEAD_DISCREPANCY`, `TIMELINE_STALL`, `COMPLIANCE_BREACH`).

### 🔍 Person 3 — NLP, Geospatial & Graph Intelligence
* **Semantic Duplicate Detection**: Deep Sentence-BERT embeddings paired with cosine similarity ($> 0.85$) to catch re-worded project titles.
* **PostGIS Spatial Radius Clustering**: `ST_DWithin` proximity detection flagging identical civic works within a $100\text{ m}$ radius.
* **IA Network Analysis**: NetworkX graph computation evaluating Implementing Agency clustering, cross-MP monopolies, and Herfindahl-Hirschman Index (HHI).

### 🖥️ Person 4 — Frontend HUD & Audit Console
* **Interactive Executive Dashboard**: Macro-level national indicators, state comparison matrices, and real-time anomaly feeds.
* **Geospatial Map Viewer**: Clustered project mapping with color-coded risk heatmaps.
* **Duplicate Inspector**: Side-by-side text difference highlights, spatial distance visualizers, and cluster confirmation tools.
* **Forensic Evidence Dossier**: Printable PDF/HTML audit reports detailing non-compliance against CPWD guidelines and GFR 2017 rules.

---

## 4. Directory Structure

```text
d:/MPLAD/
├── backend/                        # Person 3 Python microservice prototypes
│   ├── api_service.py              # FastAPI microservice for NLP & Graph
│   ├── duplicate_detector.py       # Sentence-BERT duplicate detection
│   ├── geo_verifier.py             # Geospatial boundary verifier
│   └── ia_network_graph.py         # NetworkX IA collusion graph builder
│
├── person1/                        # Person 1: Core Data Platform & REST Backend
│   ├── docker-compose.yml          # PostgreSQL 15 + PostGIS 3.3 container definition
│   ├── schema.sql                  # Production DDL schema (16 tables, spatial indexes)
│   ├── server.ts                   # Express.js REST API & Vite HUD mount
│   ├── scripts/
│   │   ├── migrate.ts              # Idempotent PostgreSQL migration runner
│   │   ├── seed-db.ts              # Batch database seeder (10,000+ projects)
│   │   └── export-data.ts          # Parquet/CSV/JSON dataset export script
│   ├── src/
│   │   ├── db/
│   │   │   ├── postgres.ts         # Connection pool & migration executor
│   │   │   ├── queries.ts          # Parameterized SQL query DAO
│   │   │   └── database.ts         # In-memory fast relational engine
│   │   ├── middleware/
│   │   │   └── auth.ts             # Salted scrypt hashing + JWT RBAC middleware
│   │   ├── pipeline/               # 6-phase ETL & synthetic expansion pipeline
│   │   └── routes/                 # Express REST & frontend adapter route handlers
│   ├── docs/
│   │   ├── openapi.json            # OpenAPI 3.0 specification
│   │   ├── api-contract.md         # Frozen API contracts
│   │   ├── architecture.md         # Full system architecture documentation
│   │   └── data-dictionary.md      # Relational schema data dictionary
│   └── tests/                      # Unit & Integration test suites
│
├── person2-risk-pipeline/          # Person 2: ML & Anomaly Detection Pipeline
│   ├── models/                     # Trained ML model weights
│   ├── pipeline/                   # Risk pipeline & feature extractors
│   └── training/                   # Training scripts for Isolation Forest & XGBoost
│
└── person4-frontend/               # Person 4: Next.js Interactive Frontend HUD
    ├── src/
    │   ├── components/             # Reusable UI widgets & charts
    │   ├── pages/ or app/          # Dashboard, Projects, Duplicates, Evidence views
    │   └── services/api.ts         # Typed API client connected to Person 1 backend
    └── tailwind.config.ts          # Styling design system
```

---

## 5. Quick Start & Reproducible Setup

### Prerequisites
* **Docker & Docker Compose** (for PostgreSQL + PostGIS)
* **Node.js $\ge 18.0.0$** and **npm**
* **Python $\ge 3.10$** (for ML & NLP services)

---

### Step-by-Step Instructions

#### 1. Clone & Configure Environment
```bash
git clone https://github.com/rickypatel005/MPLAD.git
cd MPLAD

# Copy environment configuration
cp .env.example .env
cp person1/.env.example person1/.env
```

#### 2. Start PostgreSQL + PostGIS Database
```bash
cd person1
docker compose up -d
```

#### 3. Run Schema Migrations
```bash
npm install
npm run migrate
```

#### 4. Seed Full 10,000+ Dataset
```bash
npm run seed
```

#### 5. Start Person 1 Core Backend Server
```bash
npm run dev
```
* **API Server:** `http://localhost:3000`
* **Swagger UI Documentation:** `http://localhost:3000/api/docs`
* **OpenAPI 3.0 Specification:** `http://localhost:3000/api/openapi.json`

#### 6. Start Person 3 NLP & Graph Microservice (Optional / Standalone)
```bash
# In project root
pip install -r requirements.txt
python api_service.py
```
* **FastAPI Microservice:** `http://localhost:8000`

#### 7. Start Person 4 Next.js Frontend HUD
```bash
cd ../person4-frontend
npm install
npm run dev
```
* **Frontend Web HUD:** `http://localhost:3001` (or `http://localhost:3000` in integrated mode)

---

## 6. API Reference & OpenAPI Specification

All endpoints follow standard REST principles with uniform error responses:

```json
{
  "error": {
    "code": "PROJECT_NOT_FOUND",
    "message": "Project with ID P99999 was not found in the database."
  }
}
```

### Key Endpoints Overview

| Area | Method | Endpoint | Description |
| :--- | :---: | :--- | :--- |
| **Auth** | `POST` | `/api/auth/login` | Login with username/password to receive JWT |
| | `GET` | `/api/auth/me` | Return currently authenticated user profile |
| **System** | `GET` | `/api/health` | Service health, DB connectivity, validation status |
| | `GET` | `/api/pipeline/status` | Pipeline ingestion metrics & validation summary |
| | `POST` | `/api/pipeline/run` | (`ADMIN`) Re-runs pipeline and re-seeds database |
| **Projects** | `GET` | `/api/projects` | Filtered, sorted, paginated projects list |
| | `GET` | `/api/projects/spatial` | PostGIS proximity search (`lat`, `lng`, `radius_km`) |
| | `GET` | `/api/projects/:id` | Project details, embedded payments, risk score & flags |
| | `GET` | `/api/projects/:id/payments`| Paginated payment ledger transactions |
| **Analytics** | `GET` | `/api/dashboard/summary`| National aggregates, status breakdown, category metrics |
| | `GET` | `/api/dashboard/state/:id` | State-level breakdown (`ST21`, `MH`, or state name) |
| **Risk (P2)** | `GET` | `/api/risk/top` | Ranked projects by composite risk score |
| | `GET` | `/api/risk/:id` | 6-dimension risk vector and feature contributions |
| | `POST` | `/api/risk/scores` | (`ADMIN`, `AUDITOR`) Persist ML risk score |
| | `POST` | `/api/risk/flags` | (`ADMIN`, `AUDITOR`) Persist anomaly risk flag |
| **Duplicates (P3)** | `GET` | `/api/duplicates/:id`| Duplicate cluster candidates, semantic similarity, distance |
| | `POST` | `/api/duplicates/submit`| (`ADMIN`, `AUDITOR`) Persist NLP duplicate cluster |
| **Agencies (P3)** | `GET` | `/api/ia/:id` | Implementing Agency workload, HHI index, project list |
| **Governance** | `POST` | `/api/review/action` | (`ADMIN`, `AUDITOR`, `REVIEWER`) Record human audit decision |
| | `GET` | `/api/audit/:id` | Chronological immutable audit trail for a project |
| | `GET` | `/api/evidence/:id` | Structured forensic evidence dossier with GFR citations |
| **Features (P2/P3)**| `GET` | `/api/features/projects`| Normalized feature dataset for model extraction |

---

## 7. Security & Role-Based Access Control (RBAC)

Authentication is secured via salted `scrypt` key derivation and standard HMAC-SHA256 JWT tokens.

### Role Hierarchy & Permissions

$$\mathbf{ADMIN} \quad\succ\quad \mathbf{AUDITOR} \quad\succ\quad \mathbf{REVIEWER} \quad\succ\quad \mathbf{VIEWER}$$

| Role | Permissions |
| :--- | :--- |
| **`ADMIN`** | Superuser; full access to pipeline runs, ML score submissions, review actions, and configuration. |
| **`AUDITOR`** | CAG / State Auditor; can submit review decisions, ML risk scores, and duplicate findings. |
| **`REVIEWER`** | Audit Review Officer; can record human review actions (`ACKNOWLEDGE`, `INVESTIGATE`, `ESCALATE`, `DISMISS`). |
| **`VIEWER`** | Public / Citizen; read-only access to all dashboards, project records, spatial maps, and dossiers. |

### Pre-Configured Demo Credentials

| Username | Password | Role | Description |
| :--- | :--- | :--- | :--- |
| `admin` | `admin123` | **ADMIN** | System Administrator |
| `auditor` | `audit123` | **AUDITOR** | CAG Forensic Auditor |
| `reviewer` | `review123` | **REVIEWER** | Audit Review Officer |
| `viewer` | `view123` | **VIEWER** | Public Transparency Viewer |

---

## 8. Machine Learning, NLP & Graph Intelligence

### Controlled Anomaly Injections
To enable verifiable benchmarking across ML/NLP detectors, the platform incorporates 7 reference synthetic anomaly scenarios:
1. **Cost Overrun & Inflation (`P10342`)**: Sanction inflated $3.8\times$ above CPWD category benchmarks.
2. **Physical-Financial Discrepancy (`P10101`)**: $95\%$ financial disbursement with only $15\%$ physical progress.
3. **Semantic & Spatial Duplication (`P10701` / `P10702`)**: Identical community hall in Rampur Ward 4 sanctioned within 14 days ($44.8\text{ m}$ distance, $>95\%$ text similarity).
4. **Implementing Agency Workload Monopoly (`P10580`)**: Agency managing 142 simultaneous projects ($\text{HHI} = 3890$).
5. **Severe Timeline Delay (`P10450`)**: Project stalled $680+$ days past expected completion.
6. **Milestone Velocity Discrepancy (`P10880`)**: Entire project cost disbursed in 4 payments within 12 days.
7. **Baseline Compliant Project (`P10001`)**: Clean project adhering to all GFR 2017 & CPWD standards.

---

## 9. Human-in-the-Loop Governance & Evidence Dossier

Every high-risk project flagged by AI/ML algorithms can be reviewed by human officers:
* **Review Actions**: `ACKNOWLEDGE` (verified as non-fraudulent), `INVESTIGATE` (dispatched for physical inspection), `ESCALATE` (referred to anti-corruption/CAG), `DISMISS` (false positive).
* **Immutable Audit Trail (`audit_logs`)**: Every ingestion, risk update, and human decision is timestamped and cryptographically preserved.
* **Forensic Evidence Dossier (`/api/evidence/:id`)**: Synthesizes financial metrics, milestone anomalies, spatial coordinates, duplicate findings, and GFR 2017 regulatory infractions into an actionable dossier.

---

## 10. Testing & Verification

The repository includes a comprehensive test suite across unit, integration, and end-to-end layers.

```bash
cd person1

# Run TypeScript type check
npm run lint

# Run all Unit & Integration tests
npm run test

# Run PostgreSQL + PostGIS integration tests specifically
npm run test:integration
```

### Test Coverage Summary
* **Unit Tests (`tests/unit/`)**: Pipeline generation, financial bounds, geographic bounding boxes, salted scrypt password hashing, JWT RBAC rules (83 tests passed).
* **Integration Tests (`tests/integration/`)**: PostgreSQL connectivity, PostGIS spatial queries, REST API endpoints, pagination, and E2E seeder verification (46 tests passed).
* **Overall Status**: **129 / 129 Tests Passed (100%)**.

---

## 11. Team & Workstream Allocation

| Workstream | Lead | Core Focus |
| :--- | :--- | :--- |
| **Person 1** | Data + Backend Platform | Data Ingestion, PostgreSQL/PostGIS, Express REST APIs, RBAC, Governance & Dossier Engine |
| **Person 2** | Machine Learning Intelligence | Isolation Forest, Autoencoders, Multi-Dimensional Risk Scoring, Anomaly Flags |
| **Person 3** | NLP & Graph Analytics | Sentence-BERT Duplicate Detection, PostGIS Radius Matching, NetworkX IA Monopolies |
| **Person 4** | Frontend HUD & Visualization | Next.js 14 Dashboard, Leaflet Geospatial Maps, Graph Visualizers, Evidence UI |

---

## 📄 License
This project is developed as part of the **Smart India Hackathon (SIH 2024 / Problem Statement SIH26102)** and is licensed under the [MIT License](LICENSE).
