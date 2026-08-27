/**
 * Public surface of the API layer.
 *
 * Components import from `@/lib/api` only. `client.ts` is not re-exported wholesale
 * on purpose — `apiGet`/`apiPost` are internal plumbing, and exposing them would
 * invite ad-hoc calls that bypass the typed endpoint functions.
 */

export { ApiError, API_BASE_URL, IS_MOCK_MODE, buildQueryString } from '@/lib/api/client';

export {
  acknowledgeAlert,
  getAlerts,
  getComplianceSummary,
  getDashboard,
  getDuplicates,
  getMapData,
  getNetwork,
  getProject,
  getReport,
  postAnalyze,
  reviewDuplicatePair,
} from '@/lib/api/endpoints';

export {
  queryKeys,
  useAcknowledgeAlert,
  useAlerts,
  useAnalyze,
  useComplianceSummary,
  useDashboard,
  useDuplicates,
  useMapData,
  useNetwork,
  useProject,
  useReport,
  useReviewDuplicatePair,
} from '@/lib/api/hooks';
