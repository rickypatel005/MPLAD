import type { RiskDimensionKey, RiskLevel } from '@/types/api';

/**
 * Route definitions for MPLADS-AUDIT-AI.
 *
 * Top-level nav shows exactly six items. `/project/[id]` is deliberately absent —
 * Project Investigation is always reached by drilling into a specific project, never
 * from the nav (Design Doc §3).
 */

export type NavIconKey = 'dashboard' | 'network' | 'map' | 'compliance' | 'alerts' | 'duplicates';

export interface NavItem {
  href: string;
  /** Nav label. */
  label: string;
  /** Full page title used in the page header and document title. */
  title: string;
  /** One-line purpose, shown under the page title. */
  description: string;
  icon: NavIconKey;
  /** Nav highlights for these path prefixes too. */
  matchPrefixes?: string[];
}

export const NAV_ITEMS: readonly NavItem[] = [
  {
    href: '/',
    label: 'Dashboard',
    title: 'Risk Dashboard',
    description:
      'National, state and district overview of analysed MPLADS works, ranked by risk.',
    icon: 'dashboard',
    matchPrefixes: ['/project'],
  },
  {
    href: '/network',
    label: 'Network',
    title: 'IA Network Graph',
    description:
      'Relationships between implementing agencies, MPs and districts, sized by project count and coloured by concentration.',
    icon: 'network',
  },
  {
    href: '/map',
    label: 'Map',
    title: 'Map View',
    description:
      'Geographic distribution of works with district risk heat and duplicate-pair proximity.',
    icon: 'map',
  },
  {
    href: '/compliance',
    label: 'Compliance',
    title: 'Compliance Monitor',
    description:
      'Rule-by-rule guideline adherence by state, including the SC and ST area spend mandate.',
    icon: 'compliance',
  },
  {
    href: '/alerts',
    label: 'Alerts',
    title: 'Alert Feed',
    description: 'High and critical flags in chronological order, with acknowledgement tracking.',
    icon: 'alerts',
  },
  {
    href: '/duplicates',
    label: 'Duplicates',
    title: 'Duplicate Detection',
    description:
      'Candidate duplicate works ranked by description similarity and geographic proximity.',
    icon: 'duplicates',
  },
] as const;

/** Page metadata for the drill-down route, which has no nav entry. */
export const PROJECT_ROUTE = {
  title: 'Project Investigation',
  description: 'Full evidence pack for a single work, across all six risk dimensions.',
  href: (projectId: string) => `/project/${encodeURIComponent(projectId)}`,
} as const;

/** True when `pathname` should highlight `item` in the nav. */
export function isNavItemActive(item: NavItem, pathname: string): boolean {
  if (item.href === '/') {
    return pathname === '/' || (item.matchPrefixes ?? []).some((p) => pathname.startsWith(p));
  }
  return pathname === item.href || pathname.startsWith(`${item.href}/`);
}

export function navItemFor(pathname: string): NavItem | undefined {
  return NAV_ITEMS.find((item) => isNavItemActive(item, pathname));
}

// ---------------------------------------------------------------------------
// Cross-page deep links
// ---------------------------------------------------------------------------

/**
 * The demo depends on jumping straight to a specific node, pair or state rather
 * than searching manually (Design Doc §8). These builders keep every cross-link in
 * one place so the golden path cannot break.
 */
export const DEEP_LINKS = {
  /** Dashboard filtered to one state. */
  dashboardForState: (stateId: string) => `/?state=${encodeURIComponent(stateId)}`,
  /** Dashboard filtered to the projects of one implementing agency. */
  dashboardForIA: (iaId: string) => `/?ia=${encodeURIComponent(iaId)}`,
  /** Network graph focused on a specific IA node, panel already open. */
  networkForIA: (iaId: string) => `/network?focus=${encodeURIComponent(iaId)}`,
  /** Duplicate Detection with one pair pre-selected and its comparison open. */
  duplicatePair: (pairId: number) => `/duplicates?pair=${pairId}`,
  /** Map centred on a duplicate pair, showing both points and the distance between them. */
  mapForDuplicatePair: (pairId: number) => `/map?pair=${pairId}`,
  /** Map centred on a single work. */
  mapForProject: (projectId: string) => `/map?project=${encodeURIComponent(projectId)}`,
  /** Compliance Monitor scrolled to the SC/ST mandate tracker. */
  complianceSCST: () => '/compliance?view=scst',
  /** Alert feed filtered to one project. */
  alertsForProject: (projectId: string) => `/alerts?project=${encodeURIComponent(projectId)}`,
  /** Project investigation page. */
  project: (projectId: string) => PROJECT_ROUTE.href(projectId),
} as const;

// ---------------------------------------------------------------------------
// Icon key maps
// ---------------------------------------------------------------------------

export const DIMENSION_ICON_KEYS: Record<RiskDimensionKey, string> = {
  FINANCIAL: 'rupee',
  TIMELINE: 'clock',
  COMPLIANCE: 'compliance',
  IA: 'building',
  GEO: 'pin',
  EVIDENCE: 'camera',
};

export const SEVERITY_SHAPE_KEYS: Record<RiskLevel, string> = {
  LOW: 'circle',
  MEDIUM: 'diamond',
  HIGH: 'triangle',
  CRITICAL: 'octagon',
};
