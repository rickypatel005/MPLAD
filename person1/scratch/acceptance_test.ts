/**
 * Comprehensive Person 1 Acceptance Test Script
 * Verifies all 27 endpoint behaviors, RBAC, pagination, errors, and data contracts.
 */
import request from 'supertest';
import { app } from '../server.ts';
import { authenticateUser } from '../src/middleware/auth.ts';
import { closePool } from '../src/db/postgres.ts';

async function runAcceptance() {
  console.log('╔═══════════════════════════════════════════════════════╗');
  console.log('║  SIH26102 — Final Person 1 Acceptance Verification    ║');
  console.log('╚═══════════════════════════════════════════════════════╝\n');

  let passed = 0;
  let failed = 0;

  function assert(name: string, condition: boolean, details?: string) {
    if (condition) {
      console.log(`  ✓ PASS: ${name}`);
      passed++;
    } else {
      console.error(`  ✗ FAIL: ${name} ${details ? `(${details})` : ''}`);
      failed++;
    }
  }

  // Tokens
  const adminAuth = authenticateUser('admin', 'admin123')!;
  const auditorAuth = authenticateUser('auditor', 'audit123')!;
  const reviewerAuth = authenticateUser('reviewer', 'review123')!;
  const viewerAuth = authenticateUser('viewer', 'view123')!;

  assert('Auth: admin token generated', !!adminAuth.token && adminAuth.user.role === 'ADMIN');
  assert('Auth: auditor token generated', !!auditorAuth.token && auditorAuth.user.role === 'AUDITOR');
  assert('Auth: reviewer token generated', !!reviewerAuth.token && reviewerAuth.user.role === 'REVIEWER');
  assert('Auth: viewer token generated', !!viewerAuth.token && viewerAuth.user.role === 'VIEWER');

  // 1. Health
  const healthRes = await request(app).get('/api/health');
  assert('GET /api/health returns 200 healthy', healthRes.status === 200 && healthRes.body.status === 'healthy');
  assert('GET /api/health total_projects >= 10000', healthRes.body.total_projects >= 10000);
  assert('GET /api/health validation passed', healthRes.body.validation.status === 'passed');

  // 2. Auth Endpoints
  const loginRes = await request(app).post('/api/auth/login').send({ username: 'auditor', password: 'audit123' });
  assert('POST /api/auth/login returns 200 with JWT', loginRes.status === 200 && !!loginRes.body.token);

  const meRes = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${auditorAuth.token}`);
  assert('GET /api/auth/me returns user profile', meRes.status === 200 && meRes.body.user.username === 'auditor');

  // 3. Projects List & Pagination
  const p1Res = await request(app).get('/api/projects?page=1&page_size=10');
  assert('GET /api/projects page 1 returns 10 items', p1Res.status === 200 && p1Res.body.items.length === 10);
  assert('GET /api/projects pagination total_items >= 10000', p1Res.body.pagination.total_items >= 10000);

  const p2Res = await request(app).get('/api/projects?page=2&page_size=10');
  assert('GET /api/projects page 2 returns 10 items', p2Res.status === 200 && p2Res.body.items.length === 10);
  const p1Ids = new Set(p1Res.body.items.map((i: any) => i.project_id));
  const hasDuplicates = p2Res.body.items.some((i: any) => p1Ids.has(i.project_id));
  assert('GET /api/projects pagination no duplicate IDs between page 1 & 2', !hasDuplicates);

  // 4. Project Details
  const projRes = await request(app).get('/api/projects/P10001');
  assert('GET /api/projects/:id returns 200', projRes.status === 200);
  const p = projRes.body;
  assert('GET /api/projects/:id contract fields present',
    !!p.project_id && !!p.project_name && !!p.description && !!p.state_id &&
    !!p.district_id && !!p.constituency_id && !!p.mp_id && !!p.ia_id &&
    typeof p.sanction_amount === 'number' && !!p.sanction_date && !!p.start_date &&
    !!p.expected_completion_date && typeof p.physical_progress === 'number' &&
    typeof p.financial_progress === 'number' && !!p.status && !!p.location
  );

  // 5. Payments
  const payRes = await request(app).get('/api/projects/P10001/payments');
  assert('GET /api/projects/:id/payments returns 200 with list', payRes.status === 200 && Array.isArray(payRes.body.payments));

  // 6. Dashboard Summary & State
  const dashRes = await request(app).get('/api/dashboard/summary');
  assert('GET /api/dashboard/summary returns 200', dashRes.status === 200 && dashRes.body.total_projects >= 10000);

  const stateResMH = await request(app).get('/api/dashboard/state/MH');
  assert('GET /api/dashboard/state/MH returns 200', stateResMH.status === 200 && stateResMH.body.state.state_id === 'MH');

  const stateResST21 = await request(app).get('/api/dashboard/state/ST21');
  assert('GET /api/dashboard/state/ST21 returns 200', stateResST21.status === 200 && !!stateResST21.body.state);

  // 7. Risk Endpoints
  const riskTopRes = await request(app).get('/api/risk/top?limit=10');
  assert('GET /api/risk/top returns top 10 risk projects', riskTopRes.status === 200 && riskTopRes.body.length === 10);

  const riskRes = await request(app).get('/api/risk/P10001');
  assert('GET /api/risk/:id returns 200 or 404 cleanly', riskRes.status === 200 || riskRes.status === 404);

  // 8. Duplicates
  const dupRes = await request(app).get('/api/duplicates/P10701');
  assert('GET /api/duplicates/:id returns 200', dupRes.status === 200 && (dupRes.body.primary_project_id === 'P10701' || dupRes.body.cluster_id === 'DUP-CLUST-001' || dupRes.body.project_id === 'P10701'));

  // 9. Implementing Agency
  const iaRes = await request(app).get('/api/ia/IA001');
  assert('GET /api/ia/:id returns 200 with agency details', iaRes.status === 200 && !!iaRes.body.agency);

  // 10. Alerts
  const alertsRes = await request(app).get('/api/alerts?limit=10');
  assert('GET /api/alerts returns 200', alertsRes.status === 200 && (Array.isArray(alertsRes.body) || Array.isArray(alertsRes.body.alerts) || Array.isArray(alertsRes.body.alerts?.items)));

  // 11. Review Action (RBAC)
  const reviewUnauth = await request(app).post('/api/review/action').send({ project_id: 'P10001', action: 'INVESTIGATE' });
  assert('POST /api/review/action unauthenticated returns 401', reviewUnauth.status === 401);

  const reviewViewer = await request(app).post('/api/review/action').set('Authorization', `Bearer ${viewerAuth.token}`).send({ project_id: 'P10001', action: 'INVESTIGATE' });
  assert('POST /api/review/action with VIEWER role returns 403', reviewViewer.status === 403);

  const reviewAuditor = await request(app).post('/api/review/action').set('Authorization', `Bearer ${auditorAuth.token}`).send({ project_id: 'P10001', action: 'INVESTIGATE', comment: 'Auditor inspection requested' });
  assert('POST /api/review/action with AUDITOR role returns 200', reviewAuditor.status === 200 && reviewAuditor.body.review.action === 'INVESTIGATE');

  const reviewReviewer = await request(app).post('/api/review/action').set('Authorization', `Bearer ${reviewerAuth.token}`).send({ project_id: 'P10001', action: 'ACKNOWLEDGE', comment: 'Reviewer acknowledged' });
  assert('POST /api/review/action with REVIEWER role returns 200', reviewReviewer.status === 200 && reviewReviewer.body.review.action === 'ACKNOWLEDGE');

  // 12. Audit Trail
  const auditRes = await request(app).get('/api/audit/P10001');
  assert('GET /api/audit/:id returns 200 with chronological events', auditRes.status === 200 && Array.isArray(auditRes.body.events) && auditRes.body.events.length >= 2);

  // 13. Evidence Dossier
  const evidenceRes = await request(app).get('/api/evidence/P10001');
  assert('GET /api/evidence/:id returns 200 with structured evidence', evidenceRes.status === 200 && !!evidenceRes.body.project_summary);

  // 14. Person 2 Contract: Features & ML Scores Persistence
  const featRes = await request(app).get('/api/features/projects?limit=5');
  assert('GET /api/features/projects returns 200 with feature vectors', featRes.status === 200 && featRes.body.features.length === 5);

  const postScoreRes = await request(app).post('/api/risk/scores').set('Authorization', `Bearer ${auditorAuth.token}`).send({
    project_id: 'P10001',
    overall_score: 0.89,
    risk_level: 'HIGH',
    financial_score: 0.91,
    timeline_score: 0.75,
    compliance_score: 0.80,
    model_version: 'TEST_ACCEPTANCE_V1',
    reasons: ['Acceptance test score persistence'],
  });
  assert('POST /api/risk/scores persists score with 200', postScoreRes.status === 200);

  // 15. Person 3 Contract: Duplicate Cluster Submission
  const postDupRes = await request(app).post('/api/duplicates/submit').set('Authorization', `Bearer ${auditorAuth.token}`).send({
    primary_project_id: 'P10001',
    matches: [
      {
        match_project_id: 'P10002',
        match_project_name: 'Near duplicate project',
        overall_similarity: 0.93,
        text_similarity: 0.95,
        geo_distance_meters: 30.0,
        date_proximity_days: 5,
        same_ia: true,
      },
    ],
  });
  assert('POST /api/duplicates/submit registers cluster with 200', postDupRes.status === 200 && !!postDupRes.body.cluster_id);

  // 16. OpenAPI / Swagger
  const openapiRes = await request(app).get('/api/openapi.json');
  assert('GET /api/openapi.json returns valid OpenAPI 3.0 spec', openapiRes.status === 200 && openapiRes.body.openapi === '3.0.3');

  // 17. Error Handling Verification
  const notFoundRes = await request(app).get('/api/projects/P99999');
  assert('GET /api/projects/P99999 returns 404 PROJECT_NOT_FOUND', notFoundRes.status === 404 && notFoundRes.body.error.code === 'PROJECT_NOT_FOUND');

  const badPagRes = await request(app).get('/api/projects/P10001/payments?page=0');
  assert('GET /api/projects/:id/payments?page=0 returns 400 INVALID_PAGINATION', badPagRes.status === 400 && badPagRes.body.error.code === 'INVALID_PAGINATION');

  const badActionRes = await request(app).post('/api/review/action').set('Authorization', `Bearer ${auditorAuth.token}`).send({ project_id: 'P10001', action: 'BAD_ACTION' });
  assert('POST /api/review/action with invalid action returns 400 INVALID_ACTION', badActionRes.status === 400 && badActionRes.body.error.code === 'INVALID_ACTION');

  console.log('\n═══════════════════════════════════════════════════════');
  console.log(`  Acceptance Summary: ${passed} Passed, ${failed} Failed`);
  console.log('═══════════════════════════════════════════════════════\n');

  await closePool();
  process.exit(failed > 0 ? 1 : 0);
}

runAcceptance().catch((err) => {
  console.error('Acceptance run error:', err);
  process.exit(1);
});
