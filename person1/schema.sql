-- =============================================================================
-- SIH26102 — MPLADS Audit Intelligence
-- PostgreSQL + PostGIS Database Schema (Phase 5)
-- Author: Person 1 (Data + Backend Lead)
-- =============================================================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS pg_trgm;   -- Trigram similarity for NLP duplicate detection

-- =============================================================================
-- 1. MASTER REFERENCE TABLES
-- =============================================================================

-- 1.1 States & Union Territories
CREATE TABLE IF NOT EXISTS states (
    state_id    VARCHAR(4)    PRIMARY KEY,
    name        VARCHAR(120)  NOT NULL,
    normalized_name VARCHAR(120) NOT NULL,
    state_type  VARCHAR(20)   NOT NULL CHECK (state_type IN ('STATE', 'UNION_TERRITORY')),
    total_mps   INTEGER       NOT NULL DEFAULT 0,
    total_allocated BIGINT    NOT NULL DEFAULT 0,
    geom        geometry(Point, 4326),
    created_at  TIMESTAMPTZ   DEFAULT NOW(),
    updated_at  TIMESTAMPTZ   DEFAULT NOW()
);

CREATE INDEX idx_states_geom ON states USING GIST (geom);
CREATE INDEX idx_states_type ON states (state_type);

-- 1.2 Districts
CREATE TABLE IF NOT EXISTS districts (
    district_id   VARCHAR(8)    PRIMARY KEY,
    state_id      VARCHAR(4)    NOT NULL REFERENCES states(state_id) ON DELETE CASCADE,
    name          VARCHAR(120)  NOT NULL,
    normalized_name VARCHAR(120) NOT NULL,
    created_at    TIMESTAMPTZ   DEFAULT NOW()
);

CREATE INDEX idx_districts_state ON districts (state_id);

-- 1.3 Constituencies
CREATE TABLE IF NOT EXISTS constituencies (
    constituency_id VARCHAR(8)  PRIMARY KEY,
    state_id        VARCHAR(4)  NOT NULL REFERENCES states(state_id) ON DELETE CASCADE,
    district_id     VARCHAR(8)  NOT NULL REFERENCES districts(district_id) ON DELETE CASCADE,
    name            VARCHAR(120) NOT NULL,
    normalized_name VARCHAR(120) NOT NULL,
    created_at      TIMESTAMPTZ  DEFAULT NOW()
);

CREATE INDEX idx_const_state ON constituencies (state_id);
CREATE INDEX idx_const_district ON constituencies (district_id);

-- 1.4 Members of Parliament
CREATE TABLE IF NOT EXISTS mps (
    mp_id                VARCHAR(8)   PRIMARY KEY,
    constituency_id      VARCHAR(8)   NOT NULL REFERENCES constituencies(constituency_id) ON DELETE CASCADE,
    state_id             VARCHAR(4)   NOT NULL REFERENCES states(state_id) ON DELETE CASCADE,
    name                 VARCHAR(200) NOT NULL,
    normalized_name      VARCHAR(200) NOT NULL,
    allocated_amount     BIGINT,
    allocation_quality_flag VARCHAR(30),
    source_row           INTEGER      NOT NULL,
    created_at           TIMESTAMPTZ  DEFAULT NOW()
);

CREATE INDEX idx_mps_state ON mps (state_id);
CREATE INDEX idx_mps_constituency ON mps (constituency_id);
CREATE INDEX idx_mps_quality_flag ON mps (allocation_quality_flag) WHERE allocation_quality_flag IS NOT NULL;

-- 1.5 Implementing Agencies
CREATE TABLE IF NOT EXISTS implementing_agencies (
    ia_id               VARCHAR(8)   PRIMARY KEY,
    name                VARCHAR(200) NOT NULL,
    normalized_name     VARCHAR(200) NOT NULL,
    agency_type         VARCHAR(20)  NOT NULL CHECK (agency_type IN (
        'PWD', 'DRDA', 'MUNICIPAL', 'PHED', 'ZILLA_PARISHAD', 'ELECTRICITY', 'IRRIGATION', 'OTHER'
    )),
    state_id            VARCHAR(4)   NOT NULL REFERENCES states(state_id) ON DELETE CASCADE,
    projects_count      INTEGER      NOT NULL DEFAULT 0,
    total_budget_handled BIGINT      NOT NULL DEFAULT 0,
    hhi_score           INTEGER,
    average_risk_score  DECIMAL(4,2),
    created_at          TIMESTAMPTZ  DEFAULT NOW(),
    updated_at          TIMESTAMPTZ  DEFAULT NOW()
);

CREATE INDEX idx_ia_state ON implementing_agencies (state_id);
CREATE INDEX idx_ia_type ON implementing_agencies (agency_type);
CREATE INDEX idx_ia_hhi ON implementing_agencies (hhi_score DESC);

-- =============================================================================
-- 2. CORE PROJECT TABLE (with PostGIS geometry)
-- =============================================================================

CREATE TABLE IF NOT EXISTS projects (
    project_id              VARCHAR(10)  PRIMARY KEY,
    project_name            VARCHAR(300) NOT NULL,
    description             TEXT         NOT NULL,
    category                VARCHAR(80)  NOT NULL,
    state_id                VARCHAR(4)   NOT NULL REFERENCES states(state_id),
    state_name              VARCHAR(120) NOT NULL,
    district_id             VARCHAR(8)   NOT NULL REFERENCES districts(district_id),
    district_name           VARCHAR(120) NOT NULL,
    constituency_id         VARCHAR(8)   NOT NULL REFERENCES constituencies(constituency_id),
    constituency_name       VARCHAR(120) NOT NULL,
    mp_id                   VARCHAR(8)   NOT NULL REFERENCES mps(mp_id),
    mp_name                 VARCHAR(200) NOT NULL,
    ia_id                   VARCHAR(8)   NOT NULL REFERENCES implementing_agencies(ia_id),
    ia_name                 VARCHAR(200) NOT NULL,
    sanction_amount         BIGINT       NOT NULL CHECK (sanction_amount > 0),
    sanction_date           DATE         NOT NULL,
    start_date              DATE         NOT NULL,
    expected_completion_date DATE        NOT NULL,
    actual_completion_date  DATE,
    physical_progress       SMALLINT     NOT NULL CHECK (physical_progress BETWEEN 0 AND 100),
    financial_progress      SMALLINT     NOT NULL CHECK (financial_progress BETWEEN 0 AND 100),
    status                  VARCHAR(20)  NOT NULL CHECK (status IN ('NOT_STARTED', 'IN_PROGRESS', 'COMPLETED', 'STALLED')),
    -- PostGIS spatial column
    geom                    geometry(Point, 4326),
    gps_accuracy_meters     SMALLINT,
    address                 VARCHAR(300),
    -- Provenance & lineage
    record_source           VARCHAR(12)  NOT NULL CHECK (record_source IN ('SOURCE', 'SYNTHETIC')),
    synthetic_scenario      VARCHAR(40)  NOT NULL DEFAULT 'NORMAL_BENCHMARK',
    source_file             VARCHAR(200) NOT NULL,
    source_row              INTEGER      NOT NULL,
    synthetic_seed          INTEGER      NOT NULL,
    -- Review state
    review_status           VARCHAR(20)  DEFAULT 'UNREVIEWED',
    review_count            INTEGER      DEFAULT 0,
    -- Timestamps
    created_at              TIMESTAMPTZ  DEFAULT NOW(),
    updated_at              TIMESTAMPTZ  DEFAULT NOW()
);

-- Spatial index for geo queries (nearest-neighbor, bounding box)
CREATE INDEX idx_projects_geom ON projects USING GIST (geom);
-- B-tree indexes for common query patterns
CREATE INDEX idx_projects_state ON projects (state_id);
CREATE INDEX idx_projects_mp ON projects (mp_id);
CREATE INDEX idx_projects_ia ON projects (ia_id);
CREATE INDEX idx_projects_status ON projects (status);
CREATE INDEX idx_projects_category ON projects (category);
CREATE INDEX idx_projects_scenario ON projects (synthetic_scenario);
CREATE INDEX idx_projects_sanction_date ON projects (sanction_date);
-- Trigram index for full-text search on project_name
CREATE INDEX idx_projects_name_trgm ON projects USING GIN (project_name gin_trgm_ops);

-- =============================================================================
-- 3. RISK SCORING TABLE
-- =============================================================================

CREATE TABLE IF NOT EXISTS risk_scores (
    project_id        VARCHAR(10) PRIMARY KEY REFERENCES projects(project_id) ON DELETE CASCADE,
    overall_score     DECIMAL(4,2) NOT NULL CHECK (overall_score BETWEEN 0.00 AND 1.00),
    risk_level        VARCHAR(10)  NOT NULL CHECK (risk_level IN ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL')),
    financial_score   DECIMAL(4,2) NOT NULL,
    timeline_score    DECIMAL(4,2) NOT NULL,
    compliance_score  DECIMAL(4,2) NOT NULL,
    ia_score          DECIMAL(4,2) NOT NULL,
    geo_score         DECIMAL(4,2) NOT NULL,
    evidence_score    DECIMAL(4,2) NOT NULL,
    model_version     VARCHAR(60)  NOT NULL,
    scored_at         TIMESTAMPTZ  NOT NULL,
    reasons           TEXT[]       NOT NULL DEFAULT '{}',
    feature_contributions JSONB,
    created_at        TIMESTAMPTZ  DEFAULT NOW()
);

CREATE INDEX idx_risk_overall ON risk_scores (overall_score DESC);
CREATE INDEX idx_risk_level ON risk_scores (risk_level);

-- Authoritative record of each seed/validation run.  The health endpoint reads
-- this instead of reporting a hard-coded validation result.
CREATE TABLE IF NOT EXISTS pipeline_runs (
    run_id              BIGSERIAL PRIMARY KEY,
    completed_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    project_count       INTEGER NOT NULL,
    payment_count       INTEGER NOT NULL,
    checks_run          INTEGER NOT NULL,
    checks_passed       INTEGER NOT NULL,
    validation_passed   BOOLEAN NOT NULL,
    failure_summary     JSONB NOT NULL DEFAULT '[]'::jsonb
);

CREATE INDEX idx_pipeline_runs_completed_at ON pipeline_runs (completed_at DESC);

-- =============================================================================
-- 4. RISK FLAGS & RULES CONFIGURATION TABLES
-- =============================================================================

CREATE TABLE IF NOT EXISTS rules (
    rule_code       VARCHAR(20)  PRIMARY KEY,
    rule_name       VARCHAR(150) NOT NULL,
    description     TEXT         NOT NULL,
    severity        VARCHAR(10)  NOT NULL CHECK (severity IN ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL')),
    category        VARCHAR(30)  NOT NULL,
    threshold_config JSONB       NOT NULL DEFAULT '{}',
    active          BOOLEAN      NOT NULL DEFAULT TRUE,
    created_at      TIMESTAMPTZ  DEFAULT NOW(),
    updated_at      TIMESTAMPTZ  DEFAULT NOW()
);

CREATE INDEX idx_rules_active ON rules (active);
CREATE INDEX idx_rules_severity ON rules (severity);
CREATE INDEX idx_rules_category ON rules (category);

INSERT INTO rules (rule_code, rule_name, description, severity, category, threshold_config, active) VALUES
    ('RULE_FIN_01',  'Payment vs Progress Divergence', 'Financial utilization exceeds physical execution by more than allowable threshold', 'CRITICAL', 'FINANCIAL', '{"divergence_threshold_pct": 25, "advance_limit_pct": 40}', true),
    ('RULE_TIME_01', 'Milestone Delay / Project Stall', 'Work remains incomplete or stalled past scheduled statutory completion milestone', 'HIGH', 'TIMELINE', '{"stall_threshold_days": 180, "max_milestone_variance": 0.3}', true),
    ('RULE_COST_01', 'Schedule of Rates (SOR) Exceedance', 'Sanctioned unit cost significantly exceeds CPWD/State PWD Schedule of Rates', 'HIGH', 'COST', '{"max_sor_multiplier": 2.5}', true),
    ('RULE_IA_01',   'Implementing Agency Concentration', 'Implementing Agency controls disproportionate market share in constituency (HHI)', 'HIGH', 'AGENCY', '{"hhi_threshold": 2500, "market_share_limit_pct": 50}', true),
    ('RULE_SCST_01', 'SC/ST Statutory Allocation Mandate', 'Mandatory 15% SC and 7.5% ST target developmental allocation compliance', 'MEDIUM', 'COMPLIANCE', '{"sc_target_pct": 15.0, "st_target_pct": 7.5}', true),
    ('RULE_DOCS_01', 'Statutory Clearance & Approvals', 'Mandatory District Collectorate sanction, structural stability, and audit sign-offs', 'HIGH', 'COMPLIANCE', '{"required_documents": ["ADMIN_SANCTION", "STRUCTURAL_CERT"]}', true)
ON CONFLICT (rule_code) DO NOTHING;

CREATE TABLE IF NOT EXISTS risk_flags (
    flag_id       VARCHAR(40)  PRIMARY KEY,
    project_id    VARCHAR(10)  NOT NULL REFERENCES projects(project_id) ON DELETE CASCADE,
    flag_type     VARCHAR(20)  NOT NULL CHECK (flag_type IN (
        'FINANCIAL', 'TIMELINE', 'COMPLIANCE', 'IA_CONCENTRATION', 'DUPLICATE', 'GEO_SPATIAL'
    )),
    severity      VARCHAR(10)  NOT NULL CHECK (severity IN ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL')),
    rule_code     VARCHAR(20)  NOT NULL,
    message       TEXT         NOT NULL,
    evidence_json JSONB        NOT NULL DEFAULT '{}',
    created_at    TIMESTAMPTZ  DEFAULT NOW()
);

CREATE INDEX idx_flags_project ON risk_flags (project_id);
CREATE INDEX idx_flags_type ON risk_flags (flag_type);
CREATE INDEX idx_flags_severity ON risk_flags (severity);

-- =============================================================================
-- 5. PAYMENT TRANSACTIONS LEDGER
-- =============================================================================

CREATE TABLE IF NOT EXISTS payments (
    payment_id          VARCHAR(12) PRIMARY KEY,
    project_id          VARCHAR(10) NOT NULL REFERENCES projects(project_id) ON DELETE CASCADE,
    payment_date        DATE        NOT NULL,
    payment_amount      BIGINT      NOT NULL CHECK (payment_amount >= 0),
    cumulative_payment  BIGINT      NOT NULL,
    payment_status      VARCHAR(16) NOT NULL CHECK (payment_status IN ('PROCESSED', 'PENDING_AUDIT', 'FLAGGED')),
    milestone_description VARCHAR(200) NOT NULL,
    voucher_no          VARCHAR(40) NOT NULL,
    created_at          TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_payments_project ON payments (project_id);
CREATE INDEX idx_payments_date ON payments (payment_date);
CREATE INDEX idx_payments_status ON payments (payment_status);

-- =============================================================================
-- 6. DUPLICATE CLUSTERS & MATCHES
-- =============================================================================

CREATE TABLE IF NOT EXISTS duplicate_clusters (
    cluster_id           VARCHAR(30) PRIMARY KEY,
    primary_project_id   VARCHAR(10) NOT NULL REFERENCES projects(project_id),
    suspected_count      INTEGER     NOT NULL,
    max_similarity       DECIMAL(4,2) NOT NULL,
    total_suspect_amount BIGINT      NOT NULL,
    created_at           TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS duplicate_matches (
    id                  SERIAL PRIMARY KEY,
    cluster_id          VARCHAR(30) NOT NULL REFERENCES duplicate_clusters(cluster_id) ON DELETE CASCADE,
    match_project_id    VARCHAR(10) NOT NULL REFERENCES projects(project_id),
    match_project_name  VARCHAR(300) NOT NULL,
    match_description   TEXT,
    overall_similarity  DECIMAL(4,2) NOT NULL,
    text_similarity     DECIMAL(4,2) NOT NULL,
    geo_distance_meters DECIMAL(10,1) NOT NULL,
    date_proximity_days INTEGER NOT NULL,
    same_ia             BOOLEAN NOT NULL DEFAULT FALSE,
    match_reasons       TEXT[] NOT NULL DEFAULT '{}',
    created_at          TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_dup_matches_cluster ON duplicate_matches (cluster_id);

-- =============================================================================
-- 7. USER MANAGEMENT & AUTHENTICATION (Phase 9)
-- =============================================================================

CREATE TABLE IF NOT EXISTS users (
    user_id       VARCHAR(20)   PRIMARY KEY,
    username      VARCHAR(60)   NOT NULL UNIQUE,
    password_hash VARCHAR(256)  NOT NULL,
    display_name  VARCHAR(120)  NOT NULL,
    role          VARCHAR(16)   NOT NULL CHECK (role IN ('ADMIN', 'AUDITOR', 'REVIEWER', 'VIEWER')),
    is_active     BOOLEAN       NOT NULL DEFAULT TRUE,
    last_login    TIMESTAMPTZ,
    created_at    TIMESTAMPTZ   DEFAULT NOW(),
    updated_at    TIMESTAMPTZ   DEFAULT NOW()
);

CREATE UNIQUE INDEX idx_users_username ON users (username);

-- Seed demo users (passwords are bcrypt hashes of the demo passwords)
-- In production, use proper bcrypt hashing. These are plaintext markers for demo.
INSERT INTO users (user_id, username, password_hash, display_name, role) VALUES
    ('USR-001', 'admin',        '$DEMO_HASH_admin123',    'System Administrator',      'ADMIN'),
    ('USR-002', 'auditor',      '$DEMO_HASH_audit123',    'Shri R. Sharma (CAG)',      'AUDITOR'),
    ('USR-003', 'reviewer',     '$DEMO_HASH_review123',   'Audit Review Officer',       'REVIEWER'),
    ('USR-004', 'viewer',       '$DEMO_HASH_view123',     'Public Transparency Viewer', 'VIEWER')
ON CONFLICT (user_id) DO NOTHING;

-- =============================================================================
-- 8. REVIEW ACTIONS TABLE (Phase 9)
-- =============================================================================

CREATE TABLE IF NOT EXISTS review_actions (
    review_id     VARCHAR(40)  PRIMARY KEY,
    project_id    VARCHAR(10)  NOT NULL REFERENCES projects(project_id) ON DELETE CASCADE,
    reviewer_id   VARCHAR(20)  NOT NULL REFERENCES users(user_id),
    reviewer_name VARCHAR(120) NOT NULL,
    reviewer_role VARCHAR(16)  NOT NULL,
    action        VARCHAR(16)  NOT NULL CHECK (action IN ('ACKNOWLEDGE', 'INVESTIGATE', 'ESCALATE', 'DISMISS')),
    comment       TEXT,
    created_at    TIMESTAMPTZ  DEFAULT NOW()
);

CREATE INDEX idx_reviews_project ON review_actions (project_id);
CREATE INDEX idx_reviews_action ON review_actions (action);
CREATE INDEX idx_reviews_reviewer ON review_actions (reviewer_id);

-- =============================================================================
-- 9. AUDIT LOG TABLE (Phase 9)
-- =============================================================================

CREATE TABLE IF NOT EXISTS audit_logs (
    audit_id     VARCHAR(40)  PRIMARY KEY,
    project_id   VARCHAR(10)  NOT NULL REFERENCES projects(project_id) ON DELETE CASCADE,
    actor_id     VARCHAR(40)  NOT NULL,
    actor_name   VARCHAR(120) NOT NULL,
    action       VARCHAR(60)  NOT NULL,
    payload_json JSONB        NOT NULL DEFAULT '{}',
    created_at   TIMESTAMPTZ  DEFAULT NOW()
);

CREATE INDEX idx_audit_project ON audit_logs (project_id);
CREATE INDEX idx_audit_action ON audit_logs (action);
CREATE INDEX idx_audit_created ON audit_logs (created_at DESC);

-- =============================================================================
-- 10. EVIDENCE ITEMS TABLE (Phase 7.8)
-- =============================================================================

CREATE TABLE IF NOT EXISTS evidence_items (
    id              VARCHAR(20)  PRIMARY KEY,
    project_id      VARCHAR(10)  NOT NULL REFERENCES projects(project_id) ON DELETE CASCADE,
    title           VARCHAR(200) NOT NULL,
    category        VARCHAR(20)  NOT NULL CHECK (category IN (
        'FINANCIAL', 'PHYSICAL_AUDIT', 'GEO_COORDINATES', 'TIMELINE', 'CONTRACTOR_IA', 'DUPLICATE'
    )),
    severity        VARCHAR(10)  NOT NULL CHECK (severity IN ('INFO', 'WARNING', 'ALERT', 'CRITICAL')),
    metric_label    VARCHAR(100) NOT NULL,
    observed_value  TEXT         NOT NULL,
    benchmark_value TEXT         NOT NULL,
    delta_description TEXT       NOT NULL,
    timestamp       TIMESTAMPTZ  NOT NULL,
    created_at      TIMESTAMPTZ  DEFAULT NOW()
);

CREATE INDEX idx_evidence_project ON evidence_items (project_id);
CREATE INDEX idx_evidence_severity ON evidence_items (severity);

-- =============================================================================
-- 11. HELPER VIEWS
-- =============================================================================

-- Dashboard summary view (pre-aggregated for fast queries)
CREATE OR REPLACE VIEW v_dashboard_summary AS
SELECT
    COUNT(*)                                    AS total_projects,
    SUM(p.sanction_amount)                      AS total_allocated_budget,
    SUM(ROUND(p.sanction_amount * p.financial_progress / 100.0)) AS total_utilized_budget,
    ROUND(AVG(p.physical_progress), 1)          AS overall_physical_avg,
    ROUND(AVG(p.financial_progress), 1)         AS overall_financial_avg,
    COUNT(*) FILTER (WHERE rs.risk_level = 'HIGH')     AS high_risk_count,
    COUNT(*) FILTER (WHERE rs.risk_level = 'CRITICAL') AS critical_risk_count,
    COUNT(*) FILTER (WHERE p.review_status != 'UNREVIEWED') AS reviewed_count,
    COUNT(*) FILTER (WHERE p.review_status = 'UNREVIEWED'
                       AND rs.risk_level IN ('HIGH', 'CRITICAL')) AS pending_investigation_count
FROM projects p
LEFT JOIN risk_scores rs ON p.project_id = rs.project_id;

-- State-level aggregate view
CREATE OR REPLACE VIEW v_state_aggregates AS
SELECT
    s.state_id,
    s.normalized_name                           AS state_name,
    COUNT(p.project_id)                         AS project_count,
    COALESCE(SUM(p.sanction_amount), 0)         AS allocated_sum,
    COUNT(*) FILTER (WHERE rs.risk_level = 'HIGH')     AS risk_count,
    COUNT(*) FILTER (WHERE rs.risk_level = 'CRITICAL') AS critical_count,
    ROUND(COALESCE(AVG(p.physical_progress), 0), 1)    AS avg_physical_progress,
    ROUND(COALESCE(AVG(p.financial_progress), 0), 1)   AS avg_financial_progress
FROM states s
LEFT JOIN projects p ON s.state_id = p.state_id
LEFT JOIN risk_scores rs ON p.project_id = rs.project_id
GROUP BY s.state_id, s.normalized_name;

-- Nearby duplicate candidates using PostGIS (within 500m, same category)
CREATE OR REPLACE VIEW v_duplicate_candidates AS
SELECT
    a.project_id    AS project_a,
    b.project_id    AS project_b,
    a.category,
    ST_Distance(a.geom::geography, b.geom::geography) AS distance_meters,
    similarity(a.project_name, b.project_name)         AS name_similarity
FROM projects a
JOIN projects b ON a.project_id < b.project_id
    AND a.state_id = b.state_id
    AND a.category = b.category
    AND ST_DWithin(a.geom::geography, b.geom::geography, 500)
WHERE similarity(a.project_name, b.project_name) > 0.4;

-- =============================================================================
-- 12. TRIGGER FUNCTIONS
-- =============================================================================

-- Auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION trigger_set_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_timestamp_projects
    BEFORE UPDATE ON projects
    FOR EACH ROW
    EXECUTE FUNCTION trigger_set_timestamp();

CREATE TRIGGER set_timestamp_states
    BEFORE UPDATE ON states
    FOR EACH ROW
    EXECUTE FUNCTION trigger_set_timestamp();

CREATE TRIGGER set_timestamp_ia
    BEFORE UPDATE ON implementing_agencies
    FOR EACH ROW
    EXECUTE FUNCTION trigger_set_timestamp();

CREATE TRIGGER set_timestamp_users
    BEFORE UPDATE ON users
    FOR EACH ROW
    EXECUTE FUNCTION trigger_set_timestamp();

-- =============================================================================
-- END OF SCHEMA
-- =============================================================================
