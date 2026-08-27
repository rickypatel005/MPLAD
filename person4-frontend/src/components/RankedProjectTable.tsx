'use client';

import Link from 'next/link';
import { useMemo, type ReactNode } from 'react';

import type { PageMeta, RankedProject, SortOrder } from '@/types/api';
import { DataTable, type Column } from '@/components/DataTable';
import { ChevronRightIcon, DIMENSION_ICONS } from '@/components/icons';
import { useAnonymize } from '@/components/providers/AnonymizeProvider';
import { RiskBadge } from '@/components/RiskBadge';
import { cn } from '@/lib/cn';
import { formatLakhs } from '@/lib/format';
import { riskMeta } from '@/lib/risk';

/**
 * The ranked list of flagged works — the dashboard's Top 10 and its full sortable table.
 *
 * Every row answers "why is this here?" in the row itself. The reason column carries the
 * dominant dimension's own sentence from the API, never a category name: "flagged for review"
 * with no figure beside it tells a reviewer nothing they can act on, and the whole product
 * rests on the drill-down being motivated before it is clicked (PRD §6.1).
 *
 * The score never appears on its own. It is rendered inside the risk badge, which carries
 * the band name and the level's shape as well as its colour, so the ranking survives both
 * greyscale printing and colour-blind readers (Design Doc §4.1).
 */

export interface RankedProjectTableProps {
  projects: readonly RankedProject[];
  page: PageMeta;
  sortBy?: string;
  order?: SortOrder;
  onSort?: (field: string, order: SortOrder) => void;
  onPageChange: (page: number) => void;
  onPageSizeChange?: (pageSize: number) => void;
  isFetching?: boolean;
  /**
   * `compact` drops the columns a glance does not need — type, agency, MP — for the
   * dashboard panel that has to fit ten rows above the fold.
   */
  variant?: 'full' | 'compact';
  maxHeight?: number;
  emptyState?: ReactNode;
  showPager?: boolean;
  className?: string;
}

export function RankedProjectTable({
  projects,
  page,
  sortBy,
  order = 'desc',
  onSort,
  onPageChange,
  onPageSizeChange,
  isFetching = false,
  variant = 'full',
  maxHeight,
  emptyState,
  showPager = true,
  className,
}: RankedProjectTableProps) {
  const { mpLabel } = useAnonymize();

  // Rank is the row's position in the whole filtered result set, not within the page, so
  // page 3 of a risk-sorted table starts at 51 rather than restarting at 1.
  const rankOf = useMemo(() => {
    const offset = (page.page - 1) * page.page_size;
    return new Map(projects.map((project, index) => [project.project_id, offset + index + 1]));
  }, [page.page, page.page_size, projects]);

  const columns = useMemo<Column<RankedProject>[]>(() => {
    const rank: Column<RankedProject> = {
      id: 'rank',
      header: '#',
      width: 'w-10',
      numeric: true,
      hint: 'Position in the current ranking',
      cell: (row) => (
        <span className="tabular text-caption text-ink-subtle">{rankOf.get(row.project_id)}</span>
      ),
    };

    const work: Column<RankedProject> = {
      id: 'work',
      header: 'Work',
      sortField: 'project_id',
      width: variant === 'compact' ? 'w-[26rem]' : 'w-[24rem]',
      cell: (row) => (
        <span className="block">
          <Link
            href={`/project/${row.project_id}`}
            className="block max-w-[24rem] truncate text-body-sm font-medium text-gov-700 hover:underline"
            title={row.work_description}
          >
            {row.work_description}
          </Link>
          <span className="tabular text-meta text-ink-faint">{row.project_id}</span>
        </span>
      ),
    };

    const type: Column<RankedProject> = {
      id: 'work_type',
      header: 'Type',
      sortField: 'work_type',
      width: 'w-36',
      cell: (row) => <span className="text-body-sm text-ink-muted">{row.work_type}</span>,
    };

    const place: Column<RankedProject> = {
      id: 'district',
      header: 'District',
      sortField: 'district_name',
      width: 'w-40',
      cell: (row) => (
        <span className="block">
          <span className="block text-body-sm text-ink">{row.district_name}</span>
          <span className="block text-meta text-ink-faint">{row.state_name}</span>
        </span>
      ),
    };

    const mp: Column<RankedProject> = {
      id: 'mp',
      header: 'MP',
      width: 'w-24',
      hint: 'Masked while anonymised review is on',
      cell: (row) => (
        <span className="tabular text-body-sm text-ink-muted">{mpLabel({ mp_id: row.mp_id })}</span>
      ),
    };

    const agency: Column<RankedProject> = {
      id: 'ia',
      header: 'Implementing agency',
      width: 'w-44',
      cell: (row) => (
        <span className="block max-w-[11rem] truncate text-body-sm text-ink-muted" title={row.ia_name}>
          {row.ia_name}
        </span>
      ),
    };

    const cost: Column<RankedProject> = {
      id: 'cost',
      header: 'Sanctioned',
      sortField: 'estimated_cost_lakhs',
      numeric: true,
      width: 'w-24',
      hint: 'Estimated cost of the work',
      cell: (row) => (
        <span className="text-body-sm text-ink">{formatLakhs(row.estimated_cost_lakhs)}</span>
      ),
    };

    const risk: Column<RankedProject> = {
      id: 'risk',
      header: 'Risk',
      sortField: 'overall_risk',
      width: 'w-32',
      hint: 'Composite of six weighted dimensions, 0.00–1.00',
      cell: (row) => <RiskBadge level={row.risk_level} score={row.overall_risk} size="sm" />,
    };

    const reason: Column<RankedProject> = {
      id: 'reason',
      header: 'Why it is flagged',
      cell: (row) => {
        const Icon = DIMENSION_ICONS[row.top_reason_dimension];
        return (
          <span className="flex items-start gap-1.5">
            <Icon
              size={13}
              className={cn('mt-px shrink-0', riskMeta(row.risk_level).textClass)}
              aria-hidden="true"
            />
            <span className="text-body-sm leading-snug text-ink-muted">{row.top_reason}</span>
          </span>
        );
      },
    };

    const open: Column<RankedProject> = {
      id: 'open',
      header: '',
      width: 'w-24',
      cell: (row) => (
        <Link
          href={`/project/${row.project_id}`}
          className="inline-flex items-center gap-0.5 whitespace-nowrap text-caption font-medium text-gov-600 hover:underline"
        >
          Investigate
          <ChevronRightIcon size={12} aria-hidden="true" />
        </Link>
      ),
    };

    return variant === 'compact'
      ? [rank, work, place, risk, reason]
      : [rank, work, type, place, mp, agency, cost, risk, reason, open];
  }, [mpLabel, rankOf, variant]);

  return (
    <DataTable
      columns={columns}
      data={projects}
      page={page}
      sortBy={sortBy}
      order={order}
      onSort={onSort}
      onPageChange={onPageChange}
      onPageSizeChange={onPageSizeChange}
      rowKey={(row) => row.project_id}
      rowHref={(row) => `/project/${row.project_id}`}
      rowEmphasis={(row) => row.risk_level === 'CRITICAL'}
      caption="Works ranked by composite risk score, highest first. Each row states the dimension that contributed most."
      unitLabel="works"
      isFetching={isFetching}
      maxHeight={maxHeight}
      emptyState={emptyState}
      showPager={showPager}
      className={className}
    />
  );
}
