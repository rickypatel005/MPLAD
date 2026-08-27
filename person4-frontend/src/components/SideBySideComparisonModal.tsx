'use client';

import Link from 'next/link';
import dynamic from 'next/dynamic';
import type { ReactNode } from 'react';

import type { DuplicatePairRow, DuplicateSideProject } from '@/types/api';
import { ExternalLinkIcon } from '@/components/icons';
import { Modal } from '@/components/Modal';
import { useAnonymize } from '@/components/providers/AnonymizeProvider';
import { RiskBadge } from '@/components/RiskBadge';
import { useReviewDuplicatePair } from '@/lib/api';

const PairDistanceMiniMap = dynamic(
  () => import('@/components/map/PairDistanceMiniMap').then((m) => m.PairDistanceMiniMap),
  { ssr: false }
);
import { cn } from '@/lib/cn';
import { DISCLAIMER_SHORT } from '@/lib/copy';
import {
  formatDate,
  formatDistanceKm,
  formatLakhs,
  formatSimilarity,
  humanizeEnum,
  orDash,
} from '@/lib/format';

/**
 * Two candidate-duplicate works, attribute by attribute, with the reviewer's verdict.
 *
 * A similarity score on its own is not reviewable — 91% is a claim, and the officer's job is
 * to check it. So the dialog puts the two records side by side and marks every attribute as
 * matching or differing, letting the reader reach their own conclusion about whether one work
 * was recommended twice or two genuinely similar works happen to sit near each other.
 *
 * "Differs" is as important as "same" here: two road works in one district with the same
 * agency and near-identical descriptions but different MPs and dates are exactly the pattern
 * worth escalating, and hiding the differences would hide the finding.
 *
 * The verdict is recorded as a human determination. The model proposes the pair; nothing in
 * this dialog resolves it (Design Doc §4.2).
 */

const ROW_LABEL_CLASS = 'whitespace-nowrap text-caption font-medium text-ink-muted';

type MatchState = 'same' | 'differs' | 'similar';

interface ComparisonRow {
  label: string;
  a: ReactNode;
  b: ReactNode;
  match: MatchState;
  /** Overrides the match chip's text, e.g. the similarity figure on the description row. */
  matchLabel?: string;
}

function matchOf(a: string | number | null, b: string | number | null): MatchState {
  if (a === null || b === null) return 'differs';
  return a === b ? 'same' : 'differs';
}

function MatchChip({ match, label }: { match: MatchState; label?: string }) {
  const text = label ?? (match === 'same' ? 'Same' : match === 'similar' ? 'Similar' : 'Differs');
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-control border px-1.5 py-0.5 text-meta font-semibold uppercase tracking-wide',
        match === 'same' && 'border-risk-high-border bg-risk-high-surface text-risk-high-text',
        match === 'similar' &&
          'border-risk-medium-border bg-risk-medium-surface text-risk-medium-text',
        match === 'differs' && 'border-line bg-surface-sunken text-ink-subtle',
      )}
    >
      {text}
    </span>
  );
}

/**
 * A matching attribute is the finding, not the reassurance — which is why "Same" carries the
 * warm tint and "Differs" is neutral. Two works sharing an agency, a district and a
 * description is what raises the pair; the chip's wording says which is which regardless of
 * how the tint reads.
 */
function StatBlock({
  label,
  value,
  context,
}: {
  label: string;
  value: string;
  context: string;
}) {
  return (
    <div className="rounded-card border border-line bg-surface-sunken px-3 py-2">
      <p className="eyebrow">{label}</p>
      <p className="tabular mt-0.5 text-section font-semibold text-ink">{value}</p>
      <p className="mt-0.5 text-meta leading-snug text-ink-muted">{context}</p>
    </div>
  );
}

function SideHeading({ side, project }: { side: 'A' | 'B'; project: DuplicateSideProject }) {
  return (
    <span className="block">
      <span className="eyebrow">Work {side}</span>
      <Link
        href={`/project/${project.project_id}`}
        className="tabular mt-0.5 flex items-center gap-1 text-body-sm font-semibold text-gov-700 hover:underline"
      >
        {project.project_id}
        <ExternalLinkIcon size={11} aria-hidden="true" />
      </Link>
    </span>
  );
}

export interface SideBySideComparisonModalProps {
  /** `null` renders nothing — the caller can pass a pair still being fetched. */
  pair: DuplicatePairRow | null;
  open: boolean;
  onClose: () => void;
  /**
   * The two-point map. Injected rather than imported so Leaflet stays in the one route that
   * needs it instead of loading with every screen that can open this dialog.
   */
  miniMap?: ReactNode;
  /** Replaced by the authenticated officer's identity once sign-in exists. */
  reviewedBy?: string;
}

export function SideBySideComparisonModal({
  pair,
  open,
  onClose,
  miniMap,
  reviewedBy = 'MoSPI reviewer (demo session)',
}: SideBySideComparisonModalProps) {
  const { mpLabel } = useAnonymize();
  const review = useReviewDuplicatePair();

  if (pair === null) return null;

  const { project_a: a, project_b: b } = pair;

  const rows: ComparisonRow[] = [
    {
      label: 'Work description',
      a: <span className="text-body-sm leading-snug text-ink">{a.work_description}</span>,
      b: <span className="text-body-sm leading-snug text-ink">{b.work_description}</span>,
      match: a.work_description === b.work_description ? 'same' : 'similar',
      matchLabel:
        a.work_description === b.work_description
          ? 'Identical'
          : `${formatSimilarity(pair.similarity_score)} similar`,
    },
    {
      label: 'Work type',
      a: a.work_type,
      b: b.work_type,
      match: matchOf(a.work_type, b.work_type),
    },
    {
      label: 'District',
      a: `${a.district_name}, ${a.state_name}`,
      b: `${b.district_name}, ${b.state_name}`,
      match: matchOf(a.district_id, b.district_id),
    },
    {
      label: 'Implementing agency',
      a: a.ia_name,
      b: b.ia_name,
      match: matchOf(a.ia_id, b.ia_id),
    },
    {
      label: 'Recommending MP',
      a: mpLabel({ mp_id: a.mp_id }),
      b: mpLabel({ mp_id: b.mp_id }),
      match: matchOf(a.mp_id, b.mp_id),
    },
    {
      label: 'Sanctioned cost',
      a: formatLakhs(a.estimated_cost_lakhs),
      b: formatLakhs(b.estimated_cost_lakhs),
      match: matchOf(a.estimated_cost_lakhs, b.estimated_cost_lakhs),
    },
    {
      label: 'Recommended',
      a: formatDate(a.recommended_date),
      b: formatDate(b.recommended_date),
      match: matchOf(a.recommended_date, b.recommended_date),
    },
    {
      label: 'Sanctioned',
      a: orDash(formatDate(a.sanction_date)),
      b: orDash(formatDate(b.sanction_date)),
      match: matchOf(a.sanction_date, b.sanction_date),
    },
    {
      label: 'Completed',
      a: orDash(formatDate(a.completion_date)),
      b: orDash(formatDate(b.completion_date)),
      match: matchOf(a.completion_date, b.completion_date),
    },
    {
      label: 'Risk assessment',
      a: <RiskBadge level={a.risk_level} score={a.overall_risk} size="sm" />,
      b: <RiskBadge level={b.risk_level} score={b.overall_risk} size="sm" />,
      match: matchOf(a.risk_level, b.risk_level),
    },
  ];

  const verdict = pair.review_status;
  const busy = review.isPending;

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="xl"
      title={`Candidate duplicate pair #${pair.pair_id}`}
      description={`${formatSimilarity(pair.similarity_score)} textual similarity, ${formatDistanceKm(
        pair.geo_distance_km,
      )} apart. ${DISCLAIMER_SHORT}`}
      footer={
        <>
          <span className="mr-auto flex items-center gap-2 text-caption text-ink-muted">
            <span className="eyebrow">Review status</span>
            <span className="font-semibold text-ink">{humanizeEnum(verdict)}</span>
            {review.isError ? (
              <span className="text-risk-critical-text">Could not save — try again.</span>
            ) : null}
          </span>
          <button
            type="button"
            className="btn-secondary"
            disabled={busy}
            onClick={() =>
              review.mutate({
                pairId: pair.pair_id,
                review_status: 'NOT_A_DUPLICATE',
                reviewed_by: reviewedBy,
              })
            }
          >
            Not a duplicate
          </button>
          <button
            type="button"
            className="btn-primary"
            disabled={busy}
            onClick={() =>
              review.mutate({
                pairId: pair.pair_id,
                review_status: 'CONFIRMED_DUPLICATE',
                reviewed_by: reviewedBy,
              })
            }
          >
            Confirm duplicate
          </button>
        </>
      }
    >
      <div className="grid grid-cols-3 gap-2">
        <StatBlock
          label="Textual similarity"
          value={formatSimilarity(pair.similarity_score)}
          context="Sentence-embedding cosine similarity; pairs are surfaced from 85% upward"
        />
        <StatBlock
          label="Distance apart"
          value={formatDistanceKm(pair.geo_distance_km)}
          context={
            a.location_source === 'GPS' && b.location_source === 'GPS'
              ? 'Between recorded GPS coordinates'
              : 'One or both locations fall back to the district centroid'
          }
        />
        <StatBlock
          label="Detected by"
          value={humanizeEnum(pair.detection_method)}
          context={
            pair.shared_attributes.length === 0
              ? 'No shared attributes recorded'
              : `Shared: ${pair.shared_attributes.join(', ')}`
          }
        />
      </div>

      {miniMap ? (
        <div className="mt-3">{miniMap}</div>
      ) : (
        <div className="mt-3">
          <PairDistanceMiniMap projectA={a} projectB={b} geoDistanceKm={pair.geo_distance_km} />
        </div>
      )}

      <table className="data-table mt-3">
        <caption className="sr-only">
          Attribute-by-attribute comparison of the two works in this candidate pair.
        </caption>
        <thead>
          <tr>
            <th scope="col" className="w-40">
              Attribute
            </th>
            <th scope="col">
              <SideHeading side="A" project={a} />
            </th>
            <th scope="col">
              <SideHeading side="B" project={b} />
            </th>
            <th scope="col" className="w-28">
              Comparison
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.label} className={row.match === 'differs' ? undefined : 'bg-gov-50/50'}>
              <th scope="row" className={cn(ROW_LABEL_CLASS, 'px-3 py-2 text-left align-top')}>
                {row.label}
              </th>
              <td className="align-top text-body-sm text-ink">{row.a}</td>
              <td className="align-top text-body-sm text-ink">{row.b}</td>
              <td className="align-top">
                <MatchChip match={row.match} label={row.matchLabel} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </Modal>
  );
}
