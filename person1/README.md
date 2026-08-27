# SIH26102 — MPLADS Audit Intelligence Platform

**Enterprise-Grade Forensic Auditing & Anomaly Detection System for the Member of Parliament Local Area Development Scheme (MPLADS)**

---

## 1. Quick Start & Fresh Environment Setup

To run the entire system from a completely fresh clone with zero manual SQL commands:

```bash
# 1. Start PostgreSQL 15 + PostGIS 3.3 container
docker compose up -d

# 2. Execute idempotent database migrations
npm run migrate

# 3. Seed full synthetic dataset (10,000+ projects with PostGIS geometries)
npm run seed

# 4. Export 7 canonical datasets to JSON, CSV, and Apache Parquet
npm run export

# 5. Run full test suite (Unit, PostgreSQL + PostGIS integration, and E2E)
npm test

# 6. Start the Express API & React HUD dev server
npm run dev
```

The system will be accessible at:
- **Web HUD & Dashboard:** http://localhost:3000
- **Swagger UI Interactive API Docs:** http://localhost:3000/api/docs
- **Raw OpenAPI 3.0 Specification:** http://localhost:3000/api/openapi.json

---

## 2. System Architecture & Database Layer

The platform uses **PostgreSQL 15 + PostGIS 3.3** as its authoritative runtime database with parameterized queries (`$1, $2, ...`):

- **Database Pool (`src/db/postgres.ts`):** Connection pool (`pg.Pool`) configured via `DATABASE_URL` or discrete `POSTGRES_HOST`, `POSTGRES_PORT`, `POSTGRES_DB`, `POSTGRES_USER`, `POSTGRES_PASSWORD`.
- **Query DAO (`src/db/queries.ts`):** Parameterized data access methods for all REST API endpoints.
- **Idempotent Migrations (`scripts/migrate.ts`):** Executes `schema.sql` and tracks applied versions in `schema_migrations`.
- **Full 10k+ Seeder (`scripts/seed-db.ts`):** Populates all 10,000+ projects, 26,000+ payments, 36 states, districts, constituencies, MPs, agencies, and demo users inside a transaction (`BEGIN` / `COMMIT`).
- **PostGIS Geometries (`geom geometry(Point, 4326)`):** Every state and project is mapped with spatial coordinates (`ST_SetSRID(ST_MakePoint(lng, lat), 4326)`).

---

## 3. Core API Endpoints

### Health & System Status
- `GET /api/health` — Verifies database connectivity (`SELECT 1`) and live entity counts. Returns 503 if DB is unreachable.
- `GET /api/pipeline/status` — Pipeline and database engine metrics.
- `POST /api/pipeline/run` (Protected: `ADMIN`) — Re-runs pipeline and re-seeds database.

### Projects & Geospatial Intelligence
- `GET /api/projects` — Filter projects with pagination and sorting.
  - **Query Filters:** `state_id`, `district_id`, `agency` (by ID or name), `status`, `risk_level`, `scenario`, `search`, `date_from`, `date_to`, `sort_by` (`risk`, `amount`, `date`, `progress`), `sort_order` (`asc`, `desc`).
- `GET /api/projects/spatial` — PostGIS proximity search (`ST_DWithin` / `ST_Distance`).
  - **Query Parameters:** `lat`, `lng`, `radius_km` (e.g. `50`), `radius_meters`, `category`, `limit`.
- `GET /api/projects/:id` — Full project details with payments, flags, review actions, and coordinates.

### Dashboard & Analytics
- `GET /api/dashboard/summary` — National overview metrics, category aggregates, state summaries, and recent alerts.
- `GET /api/dashboard/state/:id` — State-level analytics, active MPs, and implementing agencies.

### Risk & ML Anomaly Detection (Person 2 Integration)
- `GET /api/risk/top` — Ranked projects ordered by composite risk score.
- `GET /api/risk/:id` — 6-dimensional risk vector (`overall_score`, `financial_score`, `timeline_score`, `compliance_score`, `ia_score`, `geo_score`, `evidence_score`).
- `POST /api/risk/scores` (Protected: `ADMIN`, `AUDITOR`) — Persists ML risk score to PostgreSQL (`risk_scores` table).
- `POST /api/risk/flags` (Protected: `ADMIN`, `AUDITOR`) — Persists anomaly risk flag to PostgreSQL (`risk_flags` table).

### Duplicate Detection (Person 3 Integration)
- `GET /api/duplicates/:id` — Duplicate cluster findings with semantic similarity and PostGIS distance.
- `POST /api/duplicates/submit` (Protected: `ADMIN`, `AUDITOR`) — Persists duplicate cluster and candidate matches to PostgreSQL.

### Governance & Human Review
- `POST /api/review/action` (Protected: `ADMIN`, `AUDITOR`, `REVIEWER`) — Registers audit decision (`ACKNOWLEDGE`, `INVESTIGATE`, `ESCALATE`, `DISMISS`) and logs to immutable `audit_logs`.
- `GET /api/audit/:id` — Chronological audit trail for a project.
- `GET /api/evidence/:id` — Complete evidence dossier with CPWD benchmarks and GFR infractions.

---

## 4. RBAC Roles & Demo Credentials

| Username | Password | Role | Description |
| :--- | :--- | :--- | :--- |
| `admin` | `admin123` | **ADMIN** | Full administrative and pipeline privileges |
| `auditor` | `audit123` | **AUDITOR** | CAG auditor with review and scoring access |
| `reviewer` | `review123` | **REVIEWER** | Audit review officer |
| `viewer` | `view123` | **VIEWER** | Public transparency viewer (read-only) |

---

## 5. Automated Data Export

Running:
```bash
npm run export
```
Exports all 7 canonical master datasets into `data/processed/` in 3 formats:
1. `projects.json`, `projects.csv`, `projects.parquet` (10,000 records)
2. `payments.json`, `payments.csv`, `payments.parquet` (26,000+ records)
3. `implementing_agencies.json`, `implementing_agencies.csv`, `implementing_agencies.parquet` (252 records)
4. `mps.json`, `mps.csv`, `mps.parquet` (543 records)
5. `constituencies.json`, `constituencies.csv`, `constituencies.parquet` (543 records)
6. `districts.json`, `districts.csv`, `districts.parquet` (478 records)
7. `states.json`, `states.csv`, `states.parquet` (36 records)
8. `manifest.json` & `validation_report.json`

---

## 6. Testing Suite

```bash
# Run all tests (Unit + PostgreSQL Integration + E2E)
npm test

# Run PostgreSQL and API integration tests specifically
npm run test:integration

# Type check
npm run lint
```
