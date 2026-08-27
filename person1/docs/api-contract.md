# SIH26102 — REST API Contract

## Base URL
```
http://localhost:3000/api
```

## Authentication
All protected endpoints require a `Bearer` token in the `Authorization` header:
```
Authorization: Bearer <jwt_token>
```

Obtain a token via `POST /api/auth/login`.

---

## Endpoints

### 1. Authentication

#### `POST /api/auth/login`
Authenticate a user and receive a JWT token.

**Request Body:**
```json
{
  "username": "auditor",
  "password": "audit123"
}
```

**Response (200):**
```json
{
  "token": "eyJhbGciOiJIUzI1NiIs...",
  "user": {
    "user_id": "USR-002",
    "username": "auditor",
    "display_name": "Shri R. Sharma (CAG)",
    "role": "AUDITOR"
  },
  "expires_in": "24h"
}
```

**Demo Credentials:**

| Username | Password | Role |
| :--- | :--- | :--- |
| `admin` | `admin123` | ADMIN |
| `auditor` | `audit123` | AUDITOR |
| `viewer` | `view123` | VIEWER |

---

### 2. Health & Pipeline

#### `GET /api/health`
Returns service health and database status.

**Response:**
```json
{
  "status": "healthy",
  "timestamp": "2026-08-27T06:00:00.000Z",
  "service": "SIH26102 MPLADS Audit Intelligence API",
  "total_projects": 10000,
  "validation": {
    "status": "passed",
    "checks_run": 12,
    "checks_passed": 12
  }
}
```

Returns HTTP 503 with `status: "degraded"` when the database is unreachable,
no validated pipeline run exists, or the latest validation run failed.

#### `GET /api/projects/{id}/payments`
Returns the project's payment ledger. `page` defaults to 1 and `page_size` to
50 (maximum 100). A missing project returns `404 PROJECT_NOT_FOUND`.

```json
{ "project_id": "P10342", "payments": [], "pagination": { "page": 1 } }
```

#### `GET /api/alerts`
Returns high-risk projects ordered by overall risk score. `limit` defaults to
25 and is bounded to 1–100.

#### `GET /api/pipeline/status`
Returns the full pipeline profiling report including ingestion metrics, synthetic generation stats, and validation results.

#### `POST /api/pipeline/run`
Re-executes the full data pipeline with optional parameters.

**Request Body:**
```json
{
  "project_count": 10000,
  "seed": 26102
}
```

---

### 3. Projects (Phase 7.1)

#### `GET /api/projects`
Paginated, filterable, and sortable list of all projects.

**Query Parameters:**

| Param | Type | Default | Description |
| :--- | :--- | :--- | :--- |
| `page` | int | 1 | Page number |
| `page_size` | int | 50 | Items per page (max 100) |
| `state_id` | string | — | Filter by state (e.g. `ST34`) |
| `status` | string | — | Filter by status (`NOT_STARTED`, `IN_PROGRESS`, `COMPLETED`, `STALLED`) |
| `risk_level` | string | — | Filter by risk (`LOW`, `MEDIUM`, `HIGH`, `CRITICAL`) |
| `scenario` | string | — | Filter by anomaly scenario |
| `search` | string | — | Full-text search across ID, name, MP, state, category, IA |
| `sort_by` | string | `risk` | Sort field (`risk`, `amount`, `date`, `progress`) |
| `sort_order` | string | `desc` | Sort direction (`asc`, `desc`) |

**Response:**
```json
{
  "items": [ /* ProjectEntity[] */ ],
  "pagination": {
    "page": 1,
    "page_size": 50,
    "total_items": 10000,
    "total_pages": 200,
    "has_next": true,
    "has_prev": false
  }
}
```

#### `GET /api/projects/:id`
Returns a single project with embedded payments, flags, and review status.

---

### 4. Dashboard (Phase 7.2)

#### `GET /api/dashboard/summary`
Returns national-level aggregated statistics.

**Response Schema: `DashboardSummary`**
- `total_projects`, `total_allocated_budget`, `total_utilized_budget`
- `overall_physical_avg`, `overall_financial_avg`
- `high_risk_count`, `critical_risk_count`
- `reviewed_count`, `pending_investigation_count`
- `status_breakdown`: `{ NOT_STARTED, IN_PROGRESS, COMPLETED, STALLED }`
- `risk_level_breakdown`: `{ LOW, MEDIUM, HIGH, CRITICAL }`
- `category_breakdown`: `[{ category, count, total_amount, avg_risk }]`
- `state_aggregates`: `[{ state_id, state_name, project_count, ... }]`
- `recent_alerts`: `[{ project_id, risk_level, overall_score, message }]`

#### `GET /api/dashboard/state/:id`
Returns state-level breakdown with MPs, agencies, and flagged projects.

---

### 5. Risk (Phase 7.3)

#### `GET /api/risk/top`
Returns top risk-scored projects.

| Param | Type | Default |
| :--- | :--- | :--- |
| `limit` | int | 25 |

#### `GET /api/risk/:id`
Returns the 6-dimension risk vector for a project.

**Response Schema: `RiskScore`**
- `overall_score` (0.00–1.00), `risk_level`
- `financial_score`, `timeline_score`, `compliance_score`
- `ia_score`, `geo_score`, `evidence_score`
- `reasons[]`, `feature_contributions[]`

---

### 6. Duplicates (Phase 7.4)

#### `GET /api/duplicates/:id`
Returns suspected duplicate civic works for a project.

**Response Schema: `DuplicateCluster`**
- `cluster_id`, `primary_project_id`, `suspected_count`, `max_similarity`
- `matches[]`: `{ match_project_id, overall_similarity, text_similarity, geo_distance_meters, date_proximity_days, same_ia, match_reasons[] }`

---

### 7. Implementing Agency (Phase 7.5)

#### `GET /api/ia/:id`
Returns agency details and workload metrics.

**Response:**
```json
{
  "agency": { /* ImplementingAgencyEntity */ },
  "total_projects": 142,
  "total_budget": 640000000,
  "high_risk_projects": 8,
  "hhi_index": 3890,
  "projects": [ /* top 20 projects */ ]
}
```

---

### 8. Human Review (Phase 7.6)

#### `POST /api/review/action`
Submit a human review decision on a project.

**Request Body:**
```json
{
  "project_id": "P10342",
  "action": "INVESTIGATE",
  "reviewer_id": "USR-002",
  "reviewer_name": "Shri R. Sharma",
  "reviewer_role": "AUDITOR",
  "comment": "Dispatching DVO for physical audit."
}
```

**Valid Actions:** `ACKNOWLEDGE`, `INVESTIGATE`, `ESCALATE`, `DISMISS`

---

### 9. Audit Trail (Phase 7.7)

#### `GET /api/audit/:id`
Returns the full chronological audit trail for a project.

---

### 10. Evidence Dossier (Phase 7.8)

#### `GET /api/evidence/:id`
Returns a comprehensive forensic evidence dossier.

**Response Schema: `EvidenceDossier`**
- `project_summary`, `risk_vector`, `evidence_items[]`
- `anomaly_narrative`, `regulatory_infractions[]`
- `duplicate_findings`, `agency_concentration_summary`
- `audit_chronology[]`, `review_decisions[]`

---

### 11. AI Forensic Analysis

#### `POST /api/ai/analyze`
Triggers Gemini 2.5 Flash forensic analysis or returns rule-based heuristics.

**Request Body:**
```json
{ "project_id": "P10342" }
```

---

### 12. Data Export

#### `GET /api/export/projects`
Downloads all projects as a JSON file.

#### `GET /api/export/payments`
Downloads all payments as a JSON file.

---

## Error Response Format

All errors follow a consistent structure:
```json
{
  "error": {
    "code": "PROJECT_NOT_FOUND",
    "message": "Project with ID P99999 was not found in the database."
  }
}
```

| HTTP Status | Error Code | Description |
| :---: | :--- | :--- |
| 400 | `INVALID_REQUEST` | Missing required parameters |
| 400 | `INVALID_ACTION` | Invalid review action type |
| 401 | `UNAUTHORIZED` | Missing or invalid JWT token |
| 403 | `FORBIDDEN` | Insufficient role permissions |
| 404 | `PROJECT_NOT_FOUND` | Project ID does not exist |
| 404 | `STATE_NOT_FOUND` | State ID does not exist |
| 404 | `AGENCY_NOT_FOUND` | Agency ID does not exist |
