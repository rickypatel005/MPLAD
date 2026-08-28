/**
 * SIH26102 — MPLADS Audit Intelligence
 * Authoritative Express + Vite Server Layer (Phases 6, 7, 8, 9)
 * With strict RBAC authorization, PostGIS spatial queries, PostgreSQL persistence, and OpenAPI Swagger documentation.
 */
import express from 'express';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
import dotenv from 'dotenv';
import { GoogleGenAI } from '@google/genai';
import { createServer as createViteServer } from 'vite';
import { checkDatabaseConnection, seedDatabase } from './src/db/postgres.ts';
import * as dbQueries from './src/db/queries.ts';
import {
  authenticateUser,
  optionalAuth,
  requireAuth,
  requireRole,
} from './src/middleware/auth.ts';
import frontendRoutes from './src/routes/frontendRoutes.ts';
import { FrontendDataStore } from './src/db/frontendData.ts';
import { AppDatabase } from './src/db/database.ts';

dotenv.config();

const app = express();
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

app.use(express.json());

// CORS middleware for cross-origin frontend dev mode
app.use((_req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PATCH, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  if (_req.method === 'OPTIONS') {
    return res.sendStatus(204);
  }
  next();
});

// Mount frontend-compatible routes BEFORE auth middleware so they take priority
app.use(frontendRoutes);

// Gemini API Lazy Client
let genAiClient: GoogleGenAI | null = null;
function getGeminiClient(): GoogleGenAI | null {
  if (!genAiClient && process.env.GEMINI_API_KEY) {
    try {
      genAiClient = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
    } catch (err) {
      console.warn('Failed to initialize Gemini AI Client:', err);
    }
  }
  return genAiClient;
}

// Apply optional auth to all requests (attaches user if Bearer token present)
app.use(optionalAuth);

// ----------------------------------------------------
// 0. Authentication Endpoints (Phase 9)
// ----------------------------------------------------
app.post('/api/auth/login', (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({
      error: {
        code: 'INVALID_REQUEST',
        message: 'username and password are required.',
      },
    });
  }

  const result = authenticateUser(username, password);
  if (!result) {
    return res.status(401).json({
      error: {
        code: 'INVALID_CREDENTIALS',
        message: 'Invalid username or password.',
      },
    });
  }

  res.json({
    token: result.token,
    user: result.user,
    expires_in: '24h',
  });
});

app.get('/api/auth/me', requireAuth, (req, res) => {
  res.json({
    user: req.user,
  });
});

// ----------------------------------------------------
// 1. Health & Pipeline Endpoints (Phase 5 PostgreSQL)
// ----------------------------------------------------
const healthHandler = async (_req: any, res: any) => {
  const dbHealth = await checkDatabaseConnection();
  const appDb = AppDatabase.getInstance();
  const feStore = FrontendDataStore.getInstance();

  if (!dbHealth.connected) {
    return res.status(200).json({
      status: 'healthy',
      version: '1.0.0',
      mode: 'in-memory',
      timestamp: new Date().toISOString(),
      service: 'SIH26102 MPLADS Audit Intelligence API',
      database: {
        in_memory: {
          connected: true,
          total_projects: appDb.projects.length,
          total_payments: appDb.payments.length,
          total_alerts: feStore.alerts.length,
          total_duplicates: feStore.duplicatePairs.length,
        },
        postgres: {
          connected: false,
          note: 'PostgreSQL container offline. Operating seamlessly with in-memory database.',
        },
      },
    });
  }

  try {
    const [stats, validation] = await Promise.all([
      dbQueries.getHealthDbStats(), dbQueries.getLatestPipelineValidation(),
    ]);
    const validationPassed = validation?.passed === true;
    res.status(validationPassed ? 200 : 503).json({
      status: validationPassed ? 'healthy' : 'degraded',
      version: '1.0.0',
      timestamp: new Date().toISOString(),
      service: 'SIH26102 MPLADS Audit Intelligence API',
      database: {
        connected: true,
        version: dbHealth.version?.split(' ')[0] || '15+',
      },
      total_projects: stats.total_projects,
      total_payments: stats.total_payments,
      total_mps: stats.total_mps,
      total_states: stats.total_states,
      validation: validation ? {
        status: validationPassed ? 'passed' : 'failed',
        checks_run: validation.checks_run,
        checks_passed: validation.checks_passed,
        completed_at: validation.completed_at,
      } : { status: 'missing' },
    });
  } catch (err: any) {
    res.status(500).json({ status: 'unhealthy', error: err.message });
  }
};

app.get('/api/health', healthHandler);
app.get('/health', healthHandler);

app.get('/api/pipeline/status', async (_req, res) => {
  const stats = await dbQueries.getHealthDbStats();
  res.json({
    database_connected: true,
    total_projects: stats.total_projects,
    total_payments: stats.total_payments,
    total_mps: stats.total_mps,
    total_states: stats.total_states,
    pipeline_engine: 'PostgreSQL 15 + PostGIS 3.3',
  });
});

// Protected: Only ADMIN can re-run and re-seed the pipeline
app.post('/api/pipeline/run', requireAuth, requireRole('ADMIN'), async (req, res) => {
  try {
    const { project_count, seed } = req.body;
    const targetCount = project_count ? parseInt(project_count, 10) : 10000;
    const randomSeed = seed ? parseInt(seed, 10) : 26102;
    if (!Number.isInteger(targetCount) || targetCount < 1 || targetCount > 100000 || !Number.isInteger(randomSeed)) {
      return res.status(400).json({ error: { code: 'INVALID_PIPELINE_OPTIONS', message: 'project_count must be an integer between 1 and 100000 and seed must be an integer.' } });
    }

    const seedResult = await seedDatabase({
      reset: true,
      projectCount: targetCount,
      seed: randomSeed,
    });

    res.json({
      message: 'Pipeline executed and PostgreSQL database re-seeded successfully.',
      details: seedResult,
    });
  } catch (err: any) {
    res.status(500).json({
      error: {
        code: 'PIPELINE_RUN_FAILED',
        message: err.message,
      },
    });
  }
});

// ----------------------------------------------------
// 2. Projects Endpoints (Phases 7.1, Gap 4 & Gap 8)
// ----------------------------------------------------
app.get('/api/projects', async (req, res) => {
  try {
    const page = parseInt(req.query.page as string, 10) || 1;
    const page_size = parseInt(req.query.page_size as string, 10) || 50;
    const state_id = req.query.state_id as string;
    const district_id = req.query.district_id as string;
    const agency = req.query.agency as string;
    const status = req.query.status as string;
    const risk_level = req.query.risk_level as string;
    const scenario = req.query.scenario as string;
    const search = req.query.search as string;
    const date_from = req.query.date_from as string;
    const date_to = req.query.date_to as string;
    const sort_by = req.query.sort_by as any;
    const sort_order = req.query.sort_order as any;

    if (!Number.isInteger(page) || page < 1 || !Number.isInteger(page_size) || page_size < 1 || page_size > 100) {
      return res.status(400).json({ error: { code: 'INVALID_PAGINATION', message: 'page must be >= 1 and page_size must be between 1 and 100.' } });
    }

    const result = await dbQueries.getProjects({
      page,
      page_size,
      state_id,
      district_id,
      agency,
      status,
      risk_level,
      scenario,
      search,
      date_from,
      date_to,
      sort_by,
      sort_order,
    });

    res.json(result);
  } catch (err: any) {
    res.status(500).json({
      error: {
        code: 'QUERY_ERROR',
        message: err.message,
      },
    });
  }
});

// PostGIS Spatial Query Endpoint (Gap 4)
app.get('/api/projects/spatial', async (req, res) => {
  try {
    const lat = parseFloat(req.query.lat as string);
    const lng = parseFloat(req.query.lng as string);
    const radius_km = req.query.radius_km ? parseFloat(req.query.radius_km as string) : undefined;
    const radius_meters = req.query.radius_meters ? parseFloat(req.query.radius_meters as string) : undefined;
    const bbox = req.query.bbox as string;
    const category = req.query.category as string;
    const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 50;

    if (isNaN(lat) || isNaN(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
      return res.status(400).json({
        error: {
          code: 'INVALID_COORDINATES',
          message: 'lat and lng query parameters are required and must be valid numeric coordinates.',
        },
      });
    }

    const result = await dbQueries.getProjectsSpatial({
      lat,
      lng,
      radius_km,
      radius_meters,
      bbox,
      category,
      limit,
    });

    res.json(result);
  } catch (err: any) {
    res.status(500).json({
      error: {
        code: 'SPATIAL_QUERY_ERROR',
        message: err.message,
      },
    });
  }
});

app.get('/api/projects/:id', async (req, res) => {
  try {
    const project = await dbQueries.getProjectById(req.params.id);
    if (!project) {
      return res.status(404).json({
        error: {
          code: 'PROJECT_NOT_FOUND',
          message: `Project with ID ${req.params.id} was not found in the database.`,
        },
      });
    }
    res.json(project);
  } catch (err: any) {
    res.status(500).json({
      error: {
        code: 'QUERY_ERROR',
        message: err.message,
      },
    });
  }
});

app.get('/api/projects/:id/payments', async (req, res) => {
  const page = Number(req.query.page ?? 1);
  const pageSize = Number(req.query.page_size ?? 50);
  if (!Number.isInteger(page) || page < 1 || !Number.isInteger(pageSize) || pageSize < 1 || pageSize > 100) {
    return res.status(400).json({ error: { code: 'INVALID_PAGINATION', message: 'page must be >= 1 and page_size must be between 1 and 100.' } });
  }
  try {
    const result = await dbQueries.getPaymentsForProject(req.params.id, page, pageSize);
    if (!result) {
      return res.status(404).json({ error: { code: 'PROJECT_NOT_FOUND', message: `Project with ID ${req.params.id} was not found in the database.` } });
    }
    res.json({ project_id: req.params.id, payments: result.items, pagination: result.pagination });
  } catch (err: any) {
    res.status(500).json({ error: { code: 'QUERY_ERROR', message: err.message } });
  }
});

// ----------------------------------------------------
// 3. Dashboard Endpoints (Phase 7.2)
// ----------------------------------------------------
app.get('/api/dashboard/summary', async (_req, res) => {
  try {
    const summary = await dbQueries.getDashboardSummary();
    res.json(summary);
  } catch (err: any) {
    res.status(500).json({
      error: {
        code: 'SUMMARY_QUERY_ERROR',
        message: err.message,
      },
    });
  }
});

app.get('/api/dashboard/state/:id', async (req, res) => {
  try {
    const stateData = await dbQueries.getStateDashboard(req.params.id);
    if (!stateData) {
      return res.status(404).json({
        error: {
          code: 'STATE_NOT_FOUND',
          message: `State with ID ${req.params.id} not found.`,
        },
      });
    }
    res.json(stateData);
  } catch (err: any) {
    res.status(500).json({
      error: {
        code: 'QUERY_ERROR',
        message: err.message,
      },
    });
  }
});

// ----------------------------------------------------
// 4. Risk Endpoints (Phase 7.3 & Phase 8 Person 2 Integration)
// ----------------------------------------------------
app.get('/api/risk/top', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit as string, 10) || 25;
    const top = await dbQueries.getTopRiskProjects(limit);
    res.json(top);
  } catch (err: any) {
    res.status(500).json({
      error: {
        code: 'QUERY_ERROR',
        message: err.message,
      },
    });
  }
});

app.get('/api/alerts', async (req, res) => {
  const limit = Number(req.query.limit ?? 25);
  if (!Number.isInteger(limit) || limit < 1 || limit > 100) {
    return res.status(400).json({ error: { code: 'INVALID_LIMIT', message: 'limit must be an integer between 1 and 100.' } });
  }
  try {
    const alerts = await dbQueries.getTopRiskProjects(limit);
    res.json({ alerts, count: alerts.length });
  } catch (err: any) {
    res.status(500).json({ error: { code: 'QUERY_ERROR', message: err.message } });
  }
});

app.get('/api/risk/:id', async (req, res) => {
  try {
    const score = await dbQueries.getRiskScoreByProjectId(req.params.id);
    if (!score) {
      return res.status(404).json({
        error: {
          code: 'RISK_SCORE_NOT_FOUND',
          message: `Risk score for project ${req.params.id} was not found.`,
        },
      });
    }
    res.json(score);
  } catch (err: any) {
    res.status(500).json({
      error: {
        code: 'QUERY_ERROR',
        message: err.message,
      },
    });
  }
});

// Person 2 ML Model Output Submission Endpoint (Gap 7: PostgreSQL Persistence)
app.post('/api/risk/scores', requireAuth, requireRole('ADMIN', 'AUDITOR'), async (req, res) => {
  const {
    project_id,
    overall_score,
    risk_level,
    financial_score,
    timeline_score,
    compliance_score,
    ia_score,
    geo_score,
    evidence_score,
    model_version,
    reasons,
    feature_contributions,
  } = req.body;

  if (!project_id || overall_score === undefined || !risk_level) {
    return res.status(400).json({
      error: {
        code: 'INVALID_REQUEST',
        message: 'project_id, overall_score (0.00-1.00), and risk_level (LOW|MEDIUM|HIGH|CRITICAL) are required.',
      },
    });
  }
  const scoreValues = [overall_score, financial_score, timeline_score, compliance_score, ia_score, geo_score, evidence_score]
    .filter((value) => value !== undefined)
    .map((value) => Number(value));
  if (!scoreValues.every((value) => Number.isFinite(value) && value >= 0 && value <= 1) || !['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'].includes(risk_level)) {
    return res.status(422).json({ error: { code: 'INVALID_RISK_SCORE', message: 'Risk scores must be numbers from 0 to 1 and risk_level must be LOW, MEDIUM, HIGH, or CRITICAL.' } });
  }

  try {
    const success = await dbQueries.saveRiskScore({
      project_id,
      overall_score: parseFloat(overall_score),
      risk_level,
      financial_score: parseFloat(financial_score || 0),
      timeline_score: parseFloat(timeline_score || 0),
      compliance_score: parseFloat(compliance_score || 0),
      ia_score: parseFloat(ia_score || 0),
      geo_score: parseFloat(geo_score || 0),
      evidence_score: parseFloat(evidence_score || 0),
      model_version: model_version || 'PERSON2_ML_V2.0',
      scored_at: new Date().toISOString(),
      reasons: reasons || [],
      feature_contributions: feature_contributions || [],
    });

    if (!success) {
      return res.status(404).json({
        error: {
          code: 'PROJECT_NOT_FOUND',
          message: `Project ${project_id} not found.`,
        },
      });
    }

    res.json({
      message: `Risk score for project ${project_id} persisted successfully.`,
      model_version: model_version || 'PERSON2_ML_V2.0',
    });
  } catch (err: any) {
    res.status(500).json({
      error: {
        code: 'PERSISTENCE_ERROR',
        message: err.message,
      },
    });
  }
});

// Person 2 ML Anomaly Flag Submission Endpoint (Gap 7: PostgreSQL Persistence)
app.post('/api/risk/flags', requireAuth, requireRole('ADMIN', 'AUDITOR'), async (req, res) => {
  const { project_id, flag_type, severity, rule_code, message, evidence_json } = req.body;

  if (!project_id || !flag_type || !severity || !message) {
    return res.status(400).json({
      error: {
        code: 'INVALID_REQUEST',
        message: 'project_id, flag_type, severity, and message are required.',
      },
    });
  }

  const flagId = `FLAG-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

  try {
    const success = await dbQueries.saveRiskFlag({
      flag_id: flagId,
      project_id,
      flag_type,
      severity,
      rule_code: rule_code || 'RULE_ML_01',
      message,
      evidence_json: evidence_json || {},
      created_at: new Date().toISOString(),
    });

    if (!success) {
      return res.status(404).json({
        error: {
          code: 'PROJECT_NOT_FOUND',
          message: `Project ${project_id} not found.`,
        },
      });
    }

    res.json({
      message: `Risk flag ${flagId} recorded for project ${project_id}.`,
      flag_id: flagId,
    });
  } catch (err: any) {
    res.status(500).json({
      error: {
        code: 'PERSISTENCE_ERROR',
        message: err.message,
      },
    });
  }
});

// ----------------------------------------------------
// 5. Duplicates Endpoints (Phase 7.4 & Phase 8 Person 3 Integration)
// ----------------------------------------------------
app.get('/api/duplicates/:id', async (req, res) => {
  try {
    const duplicates = await dbQueries.getDuplicatesForProject(req.params.id);
    if (!duplicates) {
      return res.json({
        project_id: req.params.id,
        suspected_count: 0,
        matches: [],
        message: 'No duplicate civic works identified for this project.',
      });
    }
    res.json(duplicates);
  } catch (err: any) {
    res.status(500).json({
      error: {
        code: 'QUERY_ERROR',
        message: err.message,
      },
    });
  }
});

// Person 3 NLP/Geo Duplicate Cluster Submission Endpoint (Gap 7: PostgreSQL Persistence)
app.post('/api/duplicates/submit', requireAuth, requireRole('ADMIN', 'AUDITOR'), async (req, res) => {
  const { cluster_id, primary_project_id, suspected_count, max_similarity, total_suspect_amount, matches } = req.body;

  if (!primary_project_id || !matches || !Array.isArray(matches)) {
    return res.status(400).json({
      error: {
        code: 'INVALID_REQUEST',
        message: 'primary_project_id and matches array are required.',
      },
    });
  }

  const clusterId = cluster_id || `CLUST-${primary_project_id}-${Date.now()}`;

  try {
    await dbQueries.saveDuplicateCluster({
      cluster_id: clusterId,
      primary_project_id,
      suspected_count: suspected_count || matches.length + 1,
      max_similarity: max_similarity || (matches[0]?.overall_similarity || 0.85),
      total_suspect_amount: total_suspect_amount || 0,
      matches,
    });

    res.json({
      message: `Duplicate cluster ${clusterId} registered successfully.`,
      cluster_id: clusterId,
    });
  } catch (err: any) {
    res.status(500).json({
      error: {
        code: 'PERSISTENCE_ERROR',
        message: err.message,
      },
    });
  }
});

// ----------------------------------------------------
// 6. Implementing Agency Endpoint (Phase 7.5)
// ----------------------------------------------------
app.get('/api/ia/:id', async (req, res) => {
  try {
    const agencyData = await dbQueries.getAgencyById(req.params.id);
    if (!agencyData) {
      return res.status(404).json({
        error: {
          code: 'AGENCY_NOT_FOUND',
          message: `Implementing Agency ${req.params.id} not found.`,
        },
      });
    }
    res.json(agencyData);
  } catch (err: any) {
    res.status(500).json({
      error: {
        code: 'QUERY_ERROR',
        message: err.message,
      },
    });
  }
});

// ----------------------------------------------------
// 7. Feature Extraction Endpoint for Person 2 & 3 ML/NLP
// ----------------------------------------------------
app.get('/api/features/projects', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit as string, 10) || 1000;
    const features = await dbQueries.getFeatureDataset(limit);
    res.json({
      count: features.length,
      features: features,
    });
  } catch (err: any) {
    res.status(500).json({
      error: {
        code: 'QUERY_ERROR',
        message: err.message,
      },
    });
  }
});

// ----------------------------------------------------
// 8. Human Review Action Endpoint (Phase 7.6)
// Protected: Requires ADMIN, AUDITOR, or REVIEWER.
// ----------------------------------------------------
app.post(
  '/api/review/action',
  requireAuth,
  requireRole('ADMIN', 'AUDITOR', 'REVIEWER'),
  async (req, res) => {
    const { project_id, action, comment } = req.body;

    if (!project_id || !action) {
      return res.status(400).json({
        error: {
          code: 'INVALID_REQUEST',
          message: 'project_id and action (ACKNOWLEDGE | INVESTIGATE | ESCALATE | DISMISS) are required.',
        },
      });
    }

    const validActions = ['ACKNOWLEDGE', 'INVESTIGATE', 'ESCALATE', 'DISMISS'];
    if (!validActions.includes(action)) {
      return res.status(400).json({
        error: {
          code: 'INVALID_ACTION',
          message: `Action must be one of: ${validActions.join(', ')}`,
        },
      });
    }

    // Authenticated user performing the review
    const reviewerId = req.user?.user_id || 'USR-002';
    const reviewerName = req.user?.display_name || 'Shri R. Sharma';
    const reviewerRole = req.user?.role || 'AUDITOR';

    try {
      const reviewRecord = await dbQueries.addReviewAction(
        project_id,
        action,
        reviewerId,
        reviewerName,
        reviewerRole,
        comment || `Review decision recorded: ${action}`
      );

      if (!reviewRecord) {
        return res.status(404).json({
          error: {
            code: 'PROJECT_NOT_FOUND',
            message: `Project ${project_id} not found.`,
          },
        });
      }

      res.json({
        message: `Review action '${action}' registered successfully.`,
        review: reviewRecord,
      });
    } catch (err: any) {
      res.status(500).json({
        error: {
          code: 'PERSISTENCE_ERROR',
          message: err.message,
        },
      });
    }
  }
);

// ----------------------------------------------------
// 9. Audit Trail Endpoint (Phase 7.7)
// ----------------------------------------------------
app.get('/api/audit/:id', async (req, res) => {
  try {
    const auditLogs = await dbQueries.getAuditTrailForProject(req.params.id);
    res.json({
      project_id: req.params.id,
      total_events: auditLogs.length,
      events: auditLogs,
    });
  } catch (err: any) {
    res.status(500).json({
      error: {
        code: 'QUERY_ERROR',
        message: err.message,
      },
    });
  }
});

// ----------------------------------------------------
// 10. Evidence Dossier Endpoint (Phase 7.8)
// ----------------------------------------------------
app.get('/api/evidence/:id', async (req, res) => {
  try {
    const dossier = await dbQueries.getEvidenceDossier(req.params.id);
    if (!dossier) {
      return res.status(404).json({
        error: {
          code: 'DOSSIER_NOT_FOUND',
          message: `Evidence dossier for project ${req.params.id} could not be generated.`,
        },
      });
    }
    res.json(dossier);
  } catch (err: any) {
    res.status(500).json({
      error: {
        code: 'QUERY_ERROR',
        message: err.message,
      },
    });
  }
});

// ----------------------------------------------------
// 11. AI Auditor Analysis (Gemini Integration)
// ----------------------------------------------------
app.post('/api/ai/analyze', async (req, res) => {
  const { project_id } = req.body;
  if (!project_id) {
    return res.status(400).json({ error: { message: 'project_id is required' } });
  }

  const project = await dbQueries.getProjectById(project_id);
  if (!project) {
    return res.status(404).json({ error: { message: 'Project not found' } });
  }

  const client = getGeminiClient();
  if (!client) {
    return res.json({
      ai_available: false,
      summary: `Automated Heuristic Audit Summary: Project ${project.project_id} (${project.project_name}) in ${project.constituency_name}, ${project.state_name} has a risk score of ${project.risk_score?.overall_score || 0.20} (${project.risk_score?.risk_level || 'LOW'}). Primary flagged factors include ${(project.risk_score?.reasons || []).join(', ')}. Recommend physical verification of measurement book before authorizing remaining ₹${((project.sanction_amount * (100 - project.financial_progress)) / 10000000).toFixed(2)} Cr disbursement.`,
      actionable_recommendations: [
        'Depute District Vigilance Officer for on-site physical Geo-tagged photo audit.',
        'Obtain certified measurement book entries from Executive Engineer.',
        'Cross-verify vendor invoice vouchers against PFMS payment gateway logs.',
      ],
    });
  }

  try {
    const prompt = `You are a Senior Vigilance and Audit Officer reviewing an Indian MPLADS (Member of Parliament Local Area Development Scheme) civic project.
Analyze the following project dossier and provide:
1. A concise 3-sentence forensic audit executive summary.
2. 3 specific actionable investigation steps for the District Collector.
3. Key regulatory clauses under MoSPI/GFR guidelines that are potentially violated.

Project Details:
- ID: ${project.project_id}
- Name: ${project.project_name}
- Category: ${project.category}
- MP: ${project.mp_name} (${project.constituency_name}, ${project.state_name})
- Implementing Agency: ${project.ia_name}
- Sanction Amount: ₹${project.sanction_amount.toLocaleString('en-IN')}
- Financial Progress: ${project.financial_progress}%
- Physical Progress: ${project.physical_progress}%
- Status: ${project.status}
- Injected Anomaly: ${project.synthetic_scenario}
- Risk Level: ${project.risk_score?.risk_level} (Score: ${project.risk_score?.overall_score})
- Flags: ${project.flags?.map((f) => f.message).join(' | ') || 'None'}
`;

    const response = await client.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
    });

    res.json({
      ai_available: true,
      model: 'gemini-2.5-flash',
      analysis_text: response.text,
    });
  } catch (err: any) {
    console.error('Gemini audit analysis error:', err);
    res.json({
      ai_available: false,
      error: err.message,
      summary: `Audit Heuristics: Project ${project.project_id} exhibits ${project.risk_score?.risk_level || 'LOW'} risk. ${project.risk_score?.reasons?.[0] || 'Standard monitoring recommended.'}`,
    });
  }
});

// ----------------------------------------------------
// 12. OpenAPI / Swagger Documentation Endpoints (Phase 6/7)
// ----------------------------------------------------
app.get('/api/openapi.json', (_req, res) => {
  const candidatePaths = [
    path.join(process.cwd(), 'docs', 'openapi.json'),
    path.join(process.cwd(), 'person1', 'docs', 'openapi.json'),
    path.join(__dirname, 'docs', 'openapi.json'),
  ];
  for (const openApiPath of candidatePaths) {
    if (fs.existsSync(openApiPath)) {
      const spec = JSON.parse(fs.readFileSync(openApiPath, 'utf-8'));
      return res.json(spec);
    }
  }
  res.json({
    openapi: '3.0.3',
    info: {
      title: 'SIH26102 MPLADS Audit Intelligence API',
      version: '2.6.0',
      description: 'REST API for MPLADS forensic audit intelligence, risk scoring, duplicate detection, and governance.',
    },
  });
});

app.get('/api/docs', (_req, res) => {
  res.setHeader('Content-Type', 'text/html');
  res.send(`<!DOCTYPE html>
<html>
<head>
  <title>SIH26102 MPLADS API Documentation</title>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <link rel="stylesheet" href="https://unpkg.com/swagger-ui-dist@5/swagger-ui.css" />
  <style>body { margin: 0; padding: 0; background: #0f172a; } .swagger-ui { filter: invert(88%) hue-rotate(180deg); }</style>
</head>
<body>
  <div id="swagger-ui"></div>
  <script src="https://unpkg.com/swagger-ui-dist@5/swagger-ui-bundle.js"></script>
  <script>
    SwaggerUIBundle({
      url: '/api/openapi.json',
      dom_id: '#swagger-ui',
      presets: [SwaggerUIBundle.presets.apis],
      layout: 'BaseLayout'
    });
  </script>
</body>
</html>`);
});

// ----------------------------------------------------
// 13. Data Export Endpoints (Phase 4 & Phase 5)
// ----------------------------------------------------
app.get('/api/export/projects', async (_req, res) => {
  try {
    const result = await dbQueries.getProjects({ page: 1, page_size: 10000 });
    const data = {
      _metadata: {
        exported_at: new Date().toISOString(),
        source: 'SIH26102 MPLADS Audit Intelligence Pipeline (PostgreSQL)',
        total_records: result.pagination.total_items,
        schema_version: 'v2.6',
      },
      records: result.items.map((p) => ({
        project_id: p.project_id,
        project_name: p.project_name,
        category: p.category,
        state_id: p.state_id,
        state_name: p.state_name,
        district_id: p.district_id,
        district_name: p.district_name,
        constituency_id: p.constituency_id,
        mp_id: p.mp_id,
        mp_name: p.mp_name,
        ia_id: p.ia_id,
        ia_name: p.ia_name,
        sanction_amount: p.sanction_amount,
        sanction_date: p.sanction_date,
        physical_progress: p.physical_progress,
        financial_progress: p.financial_progress,
        status: p.status,
        latitude: p.location.latitude,
        longitude: p.location.longitude,
        synthetic_scenario: p.synthetic_scenario,
        risk_level: p.risk_score?.risk_level,
        risk_overall: p.risk_score?.overall_score,
      })),
    };

    res.setHeader('Content-Disposition', 'attachment; filename="projects.json"');
    res.setHeader('Content-Type', 'application/json');
    res.json(data);
  } catch (err: any) {
    res.status(500).json({ error: { message: err.message } });
  }
});

// ----------------------------------------------------
// 14. Vite Middleware / Production Static Serve
// ----------------------------------------------------
async function startServer() {
  // Initialize the in-memory data engine (no PostgreSQL required)
  console.log('[SIH26102 Backend] Initializing in-memory AppDatabase...');
  try {
    const db = AppDatabase.getInstance();
    console.log(`[SIH26102 Backend] AppDatabase ready: ${db.projects.length} projects, ${db.payments.length} payments`);
  } catch (err: any) {
    console.error(`[SIH26102 Backend] AppDatabase initialization failed: ${err.message}`);
  }

  // Build all frontend-compatible derived views
  console.log('[SIH26102 Backend] Building FrontendDataStore derived views...');
  try {
    const feStore = FrontendDataStore.getInstance();
    feStore.initialize();
    console.log(`[SIH26102 Backend] FrontendDataStore ready:`);
    console.log(`  → ${feStore.records.length} project records`);
    console.log(`  → ${feStore.alerts.length} alerts`);
    console.log(`  → ${feStore.duplicatePairs.length} duplicate pairs`);
    console.log(`  → ${feStore.network.nodes.length} network nodes, ${feStore.network.edges.length} edges`);
    console.log(`  → ${feStore.compliance.states.length} state compliance summaries`);
  } catch (err: any) {
    console.error(`[SIH26102 Backend] FrontendDataStore initialization failed: ${err.message}`);
  }

  // Check PostgreSQL connectivity (optional — server starts regardless)
  console.log('[SIH26102 Backend] Checking PostgreSQL connectivity...');
  const conn = await checkDatabaseConnection();
  if (!conn.connected) {
    console.warn(`\x1b[33m[SIH26102 Warning] PostgreSQL connection failed: ${conn.error}\x1b[0m`);
    console.warn('[SIH26102 Warning] Server will continue with in-memory database only.');
    console.warn('[SIH26102 Warning] PostgreSQL-dependent endpoints may return 503. Frontend-compatible endpoints work normally.');
  } else {
    console.log(`[SIH26102 Backend] Connected to PostgreSQL (${conn.version?.split(' ')[0] || '15+'})`);
  }

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`\n[SIH26102 Backend] ✅ Server running on http://0.0.0.0:${PORT}`);
    console.log(`[SIH26102 Backend] Frontend-compatible API: http://0.0.0.0:${PORT}/api/dashboard`);
    console.log(`[SIH26102 Backend] Swagger UI available at http://0.0.0.0:${PORT}/api/docs`);
  });
}

// Only auto-start when executed directly (not when imported in tests)
if (process.env.NODE_ENV !== 'test') {
  startServer();
}

export { app };
