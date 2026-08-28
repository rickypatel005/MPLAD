# SIH26102 — Data Dictionary

## Entity Relationship Summary

```
states (1) ──→ (N) districts ──→ (N) constituencies ──→ (N) mps
                                                          │
states (1) ──→ (N) implementing_agencies                  │
                     │                                    │
                     └──────────→ projects ←──────────────┘
                                    │
                    ┌───────────────┼───────────────┐
                    │               │               │
              risk_scores     payments      risk_flags
                                    │
                    ┌───────────────┼───────────────┐
                    │               │               │
             review_actions    audit_logs    evidence_items
                                    │
                          duplicate_clusters
                                │
                          duplicate_matches
```

---

## 1. `states` — Indian States & Union Territories

| Field | Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `state_id` | VARCHAR(4) | **PK** | Stable ID (ST01–ST36) |
| `name` | VARCHAR(120) | NOT NULL | Raw uppercase name from CSV (e.g. `UTTAR PRADESH`) |
| `normalized_name` | VARCHAR(120) | NOT NULL | Display name (e.g. `Uttar Pradesh`) |
| `state_type` | ENUM | `STATE` \| `UNION_TERRITORY` | Constitutional classification |
| `total_mps` | INTEGER | >= 0 | Number of Lok Sabha constituencies |
| `total_allocated` | BIGINT | >= 0 | Total MPLADS allocation (INR) |
| `latitude` | FLOAT | — | Centroid latitude (WGS84) |
| `longitude` | FLOAT | — | Centroid longitude (WGS84) |

**Record Count:** 36

---

## 2. `districts` — Administrative Districts

| Field | Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `district_id` | VARCHAR(8) | **PK** | Auto-generated (D001+) |
| `state_id` | VARCHAR(4) | **FK → states** | Parent state |
| `name` | VARCHAR(120) | NOT NULL | Raw district name |
| `normalized_name` | VARCHAR(120) | NOT NULL | Title-cased display name |

**Record Count:** ~543 (approximated from constituency mapping)

---

## 3. `constituencies` — Lok Sabha Parliamentary Constituencies

| Field | Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `constituency_id` | VARCHAR(8) | **PK** | Auto-generated (C001+) |
| `state_id` | VARCHAR(4) | **FK → states** | Parent state |
| `district_id` | VARCHAR(8) | **FK → districts** | Parent district |
| `name` | VARCHAR(120) | NOT NULL | Raw constituency name from CSV |
| `normalized_name` | VARCHAR(120) | NOT NULL | Title-cased display name |

**Record Count:** 543

---

## 4. `mps` — Members of Parliament

| Field | Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `mp_id` | VARCHAR(8) | **PK** | Stable ID (MP001–MP543) |
| `constituency_id` | VARCHAR(8) | **FK → constituencies** | Associated constituency |
| `state_id` | VARCHAR(4) | **FK → states** | Associated state |
| `name` | VARCHAR(200) | NOT NULL | Raw name from CSV |
| `normalized_name` | VARCHAR(200) | NOT NULL | Title-cased display name |
| `allocated_amount` | BIGINT | NULLABLE | MPLADS allocation (INR). NULL = missing in source |
| `allocation_quality_flag` | VARCHAR(30) | NULLABLE | `MISSING_SOURCE_VALUE` if amount was absent/zero in CSV |
| `source_row` | INTEGER | NOT NULL | 1-indexed row number in source CSV |

**Record Count:** 543 (Row 343 has `allocated_amount = NULL`, `allocation_quality_flag = 'MISSING_SOURCE_VALUE'`)

---

## 5. `implementing_agencies` — Executive Divisions

| Field | Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `ia_id` | VARCHAR(8) | **PK** | Stable ID (IA001+) |
| `name` | VARCHAR(200) | NOT NULL | Full agency name |
| `normalized_name` | VARCHAR(200) | NOT NULL | Display name |
| `agency_type` | ENUM | `PWD` \| `DRDA` \| `MUNICIPAL` \| `PHED` \| `ZILLA_PARISHAD` \| `ELECTRICITY` \| `IRRIGATION` \| `OTHER` | Division type |
| `state_id` | VARCHAR(4) | **FK → states** | Jurisdiction state |
| `projects_count` | INTEGER | >= 0 | Number of projects handled |
| `total_budget_handled` | BIGINT | >= 0 | Total sanction amount managed (INR) |
| `hhi_score` | INTEGER | NULLABLE | Herfindahl-Hirschman Index for market concentration |
| `average_risk_score` | DECIMAL(4,2) | NULLABLE | Mean risk score across projects |

**Record Count:** 252 (7 agency types × 36 states)

---

## 6. `projects` — MPLADS Civic Infrastructure Projects

| Field | Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `project_id` | VARCHAR(10) | **PK** | Stable ID (P10001+) |
| `project_name` | VARCHAR(300) | NOT NULL | Descriptive name (e.g. `Road & Transport - Rampur Ward 7`) |
| `description` | TEXT | NOT NULL | Full NLP-ready project description |
| `category` | VARCHAR(80) | NOT NULL | One of 11 civic categories |
| `state_id` | VARCHAR(4) | **FK → states** | Project state |
| `state_name` | VARCHAR(120) | NOT NULL | Denormalized state name |
| `district_id` | VARCHAR(8) | **FK → districts** | Project district |
| `district_name` | VARCHAR(120) | NOT NULL | Denormalized district name |
| `constituency_id` | VARCHAR(8) | **FK → constituencies** | Project constituency |
| `constituency_name` | VARCHAR(120) | NOT NULL | Denormalized constituency name |
| `mp_id` | VARCHAR(8) | **FK → mps** | Sponsoring MP |
| `mp_name` | VARCHAR(200) | NOT NULL | Denormalized MP name |
| `ia_id` | VARCHAR(8) | **FK → implementing_agencies** | Executing agency |
| `ia_name` | VARCHAR(200) | NOT NULL | Denormalized IA name |
| `sanction_amount` | BIGINT | > 0 | Sanctioned cost in INR |
| `sanction_date` | DATE | NOT NULL | Date of financial sanction |
| `start_date` | DATE | NOT NULL | Project commencement date |
| `expected_completion_date` | DATE | NOT NULL | Planned completion deadline |
| `actual_completion_date` | DATE | NULLABLE | NULL if incomplete |
| `physical_progress` | SMALLINT | 0–100 | Ground execution percentage |
| `financial_progress` | SMALLINT | 0–100 | Financial disbursement percentage |
| `status` | ENUM | `NOT_STARTED` \| `IN_PROGRESS` \| `COMPLETED` \| `STALLED` | Current lifecycle state |
| `location.latitude` | FLOAT | — | WGS84 latitude |
| `location.longitude` | FLOAT | — | WGS84 longitude |
| `location.address` | VARCHAR(300) | — | Human-readable address |
| `location.gps_accuracy_meters` | SMALLINT | — | GPS fix accuracy |
| `record_source` | ENUM | `SOURCE` \| `SYNTHETIC` | Data provenance |
| `synthetic_scenario` | ENUM | See below | Injected anomaly ground truth |
| `detector_flagged` | BOOLEAN | NULLABLE | True if Person 2 ML or Person 3 NLP detected an anomaly |
| `detector_model_version` | VARCHAR(60) | NULLABLE | Scoring ML model identifier (e.g. `ISOFOREST_V2.1`) |
| `detector_score` | DECIMAL(4,2) | 0.00–1.00 | Model confidence/risk output score |
| `source_file` | VARCHAR(200) | NOT NULL | Origin CSV filename |
| `source_row` | INTEGER | NOT NULL | Row number from source MP |
| `synthetic_seed` | INTEGER | NOT NULL | PRNG seed used (26102) |
| `review_status` | ENUM | `UNREVIEWED` \| `ACKNOWLEDGE` \| `INVESTIGATE` \| `ESCALATE` \| `DISMISS` | Latest review decision |
| `review_count` | INTEGER | >= 0 | Total review actions recorded |

**Record Count:** 10,000+

### Anomaly Scenarios (`synthetic_scenario`)

| Scenario | Description | Demo Project IDs |
| :--- | :--- | :--- |
| `NORMAL_BENCHMARK` | Standard project within all MoSPI benchmarks | ~95% of dataset |
| `HIGH_COST_ANOMALY` | 3x–5x above CPWD/PWD schedule of rates | P10101, P10245 |
| `PAYMENT_PROGRESS_MISMATCH` | High financial (85%+) vs low physical (15–28%) | P10342 |
| `TIMELINE_DELAY_ANOMALY` | Stalled past expected completion date | P10450, P10612 |
| `IA_CONCENTRATION_ANOMALY` | Single IA with excessive budget share | P10580 |
| `DUPLICATE_PROJECT_PAIR` | Two near-identical works within 50m | P10701, P10702 |
| `COMPLIANCE_ANOMALY` | Missing mandatory statutory clearances | P10880 |

---

## 7. `risk_scores` — Multi-Dimensional Risk Vectors

| Field | Type | Range | Description |
| :--- | :--- | :--- | :--- |
| `project_id` | VARCHAR(10) | **FK → projects** | Scored project |
| `overall_score` | DECIMAL(4,2) | 0.00–1.00 | Weighted composite risk |
| `risk_level` | ENUM | `LOW` \| `MEDIUM` \| `HIGH` \| `CRITICAL` | Classification bucket |
| `financial_score` | DECIMAL(4,2) | 0.00–1.00 | Financial anomaly signal (weight: 35%) |
| `timeline_score` | DECIMAL(4,2) | 0.00–1.00 | Timeline breach signal (weight: 20%) |
| `compliance_score` | DECIMAL(4,2) | 0.00–1.00 | Regulatory compliance signal (weight: 15%) |
| `ia_score` | DECIMAL(4,2) | 0.00–1.00 | Agency concentration signal (weight: 15%) |
| `geo_score` | DECIMAL(4,2) | 0.00–1.00 | Geospatial anomaly signal (weight: 10%) |
| `evidence_score` | DECIMAL(4,2) | 0.00–1.00 | Evidence strength signal (weight: 5%) |
| `model_version` | VARCHAR(60) | — | Scoring engine version |
| `reasons` | TEXT[] | — | Human-readable explanation strings |

### Risk Level Thresholds

| Level | Score Range |
| :--- | :--- |
| LOW | 0.00 – 0.29 |
| MEDIUM | 0.30 – 0.49 |
| HIGH | 0.50 – 0.69 |
| CRITICAL | 0.70 – 1.00 |

---

## 8. `payments` — Financial Transaction Ledger

| Field | Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `payment_id` | VARCHAR(12) | **PK** | PAY000001+ |
| `project_id` | VARCHAR(10) | **FK → projects** | Parent project |
| `payment_date` | DATE | NOT NULL | Disbursement date |
| `payment_amount` | BIGINT | >= 0 | Tranche amount (INR) |
| `cumulative_payment` | BIGINT | NOT NULL | Running total paid |
| `payment_status` | ENUM | `PROCESSED` \| `PENDING_AUDIT` \| `FLAGGED` | Transaction state |
| `milestone_description` | VARCHAR(200) | NOT NULL | Inspection phase label |
| `voucher_no` | VARCHAR(40) | NOT NULL | PFMS voucher reference |

**Record Count:** 20,000+

---

## 9. `review_actions` — Human-in-the-Loop Decisions

| Field | Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `review_id` | VARCHAR(40) | **PK** | Auto-generated |
| `project_id` | VARCHAR(10) | **FK → projects** | Reviewed project |
| `reviewer_id` | VARCHAR(20) | NOT NULL | User performing review |
| `reviewer_name` | VARCHAR(120) | NOT NULL | Display name |
| `reviewer_role` | ENUM | `ADMIN` \| `AUDITOR` \| `REVIEWER` \| `VIEWER` | Role at time of decision |
| `action` | ENUM | `ACKNOWLEDGE` \| `INVESTIGATE` \| `ESCALATE` \| `DISMISS` | Decision type |
| `comment` | TEXT | — | Auditor's notes |

---

## 10. `audit_logs` — Immutable Event Chronicle

| Field | Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `audit_id` | VARCHAR(40) | **PK** | Auto-generated |
| `project_id` | VARCHAR(10) | **FK → projects** | Related project |
| `actor_id` | VARCHAR(40) | NOT NULL | System or user performing action |
| `actor_name` | VARCHAR(120) | NOT NULL | Display name |
| `action` | VARCHAR(60) | NOT NULL | Event type (e.g. `PROJECT_INGESTED`, `RISK_FLAGS_RAISED`, `REVIEW_DECISION_INVESTIGATE`) |
| `payload_json` | JSONB | NOT NULL | Event-specific structured data |

---

## 11. `users` — Authentication & Authorization

| Field | Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `user_id` | VARCHAR(20) | **PK** | USR-001+ |
| `username` | VARCHAR(60) | UNIQUE | Login username |
| `password_hash` | VARCHAR(256) | NOT NULL | bcrypt hash (production) |
| `display_name` | VARCHAR(120) | NOT NULL | Full name |
| `role` | ENUM | `ADMIN` \| `AUDITOR` \| `REVIEWER` \| `VIEWER` | Access control role |
| `is_active` | BOOLEAN | DEFAULT TRUE | Account active flag |

### Project Categories (11)

1. Road & Transport
2. Bridge & Culvert
3. Drinking Water Supply
4. Drainage & Sewerage
5. Community Hall & Social Asset
6. School & Educational Infra
7. Primary Health Centre & Hospital
8. Public Solar & Street Lighting
9. Sanitation Complex
10. Irrigation & Check Dam
11. Sports & Youth Facility
