import type { ReactNode } from 'react';

import type { RiskDimensionDetail, RiskDimensionKey } from '@/types/api';
import { DIMENSION_ICONS } from '@/components/icons';
import { RiskBadge } from '@/components/RiskBadge';
import { ContributionBar, ScoreMeter } from '@/components/ScoreMeter';
import { cn } from '@/lib/cn';
import { formatDistanceKm, formatPercent, formatScore, formatZScore } from '@/lib/format';
import { RISK_DIMENSION_ORDER, dimensionMeta, riskMeta } from '@/lib/risk';

/**
 * One of the six risk dimensions, as evidence rather than as a score.
 *
 * This is the component the whole product is judged on. The brief's central requirement is
 * that a reviewer can see *why* something was flagged (brief §2, PRD §6.2), so the card is
 * built around the concrete figure and the sentence explaining it. The score is present, but
 * it is never the headline and never appears without its band.
 *
 * Reading order is deliberate: what was measured, what it was measured against, how far off
 * it is, and only then how much that moved the composite. An officer should be able to stop
 * reading after the second line and still know whether to open the file.
 *
 * `metric_label` is optional in the payload — a dimension can be elevated for reasons that
 * do not reduce to one number, such as several guideline breaches at once. When it is
 * absent the evidence sentence takes the headline position, so the card never degrades into
 * a label with a number beside it.
 */

/**
 * The secondary statistic, formatted for what it actually is.
 *
 * `metric_value` carries a different kind of number per dimension — a Z-score, an HHI index,
 * a probability, a distance, a count of breached rules. Rendering all of them to two decimal
 * places would print "Rules breached 4.00" and "Predicted delay probability 0.96", both of
 * which read as machine output rather than a finding. The name the backend supplies is
 * enough to choose the right presentation.
 */
function statValue(name: string, value: number): string {
  if (/z-?score/i.test(name)) return formatZScore(value);
  if (/distance/i.test(name)) return formatDistanceKm(value);
  if (/probability|share|similarity|rate|present|%/i.test(name)) return formatPercent(value);
  return Number.isInteger(value) ? String(value) : formatScore(value);
}

export interface EvidenceCardProps {
  detail: RiskDimensionDetail;
  /**
   * Marks the dimension that contributed most to the composite. Exactly one card per
   * project should carry it, and the caller decides which — the API's ordering is
   * canonical, not severity-ranked.
   */
  isTopContributor?: boolean;
  /** Dimension-specific detail: the comparables table, the photo strip, the rule list. */
  children?: ReactNode;
  /** Cross-link out of the card, e.g. "View this agency in the network graph". */
  action?: ReactNode;
  className?: string;
}

export function EvidenceCard({
  detail,
  isTopContributor = false,
  children,
  action,
  className,
}: EvidenceCardProps) {
  const meta = dimensionMeta(detail.dimension);
  const level = riskMeta(detail.severity);
  const Icon = DIMENSION_ICONS[detail.dimension];

  return (
    <article
      className={cn(
        'panel flex flex-col',
        // The tint is an accent on the header strip only. Tinting the whole card would put
        // four saturated blocks on one screen and make the page feel alarmist rather than
        // analytical.
        isTopContributor && 'ring-1 ring-gov-200',
        className,
      )}
      aria-labelledby={`dimension-${detail.dimension}`}
    >
      <header
        className={cn(
          'flex items-center justify-between gap-3 rounded-t-card border-b px-4 py-2.5',
          level.surfaceClass,
          level.borderClass,
        )}
      >
        <h3
          id={`dimension-${detail.dimension}`}
          className="flex items-center gap-2 text-card-title font-semibold text-ink"
        >
          <Icon size={15} className={level.textClass} aria-hidden="true" />
          {meta.label}
        </h3>
        <div className="flex items-center gap-2">
          {isTopContributor ? (
            <span className="eyebrow whitespace-nowrap text-gov-700">Largest contributor</span>
          ) : null}
          <RiskBadge level={detail.severity} score={detail.score} size="sm" />
        </div>
      </header>

      <div className="flex flex-1 flex-col gap-3 px-4 py-3.5">
        {/* The finding, in the largest type on the card. */}
        {detail.metric_label === null ? (
          <p className="text-body font-medium leading-relaxed text-ink">{detail.evidence}</p>
        ) : (
          <div>
            <p className="tabular text-section font-semibold text-ink">{detail.metric_label}</p>
            <p className="mt-1 text-body leading-relaxed text-ink">{detail.evidence}</p>
          </div>
        )}

        {/* The named statistic, so the figure above is checkable rather than asserted. */}
        {detail.metric_name !== null && detail.metric_value !== null ? (
          <dl className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
            <dt className="eyebrow">{detail.metric_name}</dt>
            <dd className="tabular text-body-sm font-semibold text-ink">
              {statValue(detail.metric_name, detail.metric_value)}
            </dd>
            {detail.reference === null ? null : (
              <>
                <dt className="eyebrow ml-2">Measured against</dt>
                <dd className="text-body-sm text-ink-muted">{detail.reference}</dd>
              </>
            )}
          </dl>
        ) : detail.reference === null ? null : (
          <p className="text-caption text-ink-subtle">
            <span className="eyebrow mr-1.5">Measured against</span>
            {detail.reference}
          </p>
        )}

        <ScoreMeter
          score={detail.score}
          level={detail.severity}
          label={`${meta.shortLabel} score`}
          weight={meta.weight}
        />

        <p className="text-body-sm leading-relaxed text-ink-muted">{detail.explanation}</p>

        {children}

        {action ? <div className="mt-auto pt-1">{action}</div> : null}
      </div>
    </article>
  );
}

/**
 * The six cards, in canonical order, with the arithmetic of the composite underneath.
 *
 * Order is fixed by weight (Financial first, Evidence last) rather than by severity. A
 * layout that reshuffles between projects makes two files impossible to compare, and the
 * demo depends on the presenter knowing where each card will be before the page loads.
 */
export function EvidenceCardGrid({
  details,
  extras,
  actions,
  topContributor,
  className,
}: {
  details: readonly RiskDimensionDetail[];
  extras?: Partial<Record<RiskDimensionKey, ReactNode>>;
  actions?: Partial<Record<RiskDimensionKey, ReactNode>>;
  /** Dimension to mark as the largest contributor; computed by the caller. */
  topContributor?: RiskDimensionKey;
  className?: string;
}) {
  const byDimension = new Map(details.map((detail) => [detail.dimension, detail]));
  const ordered = RISK_DIMENSION_ORDER.map((key) => byDimension.get(key)).filter(
    (detail): detail is RiskDimensionDetail => detail !== undefined,
  );

  return (
    <div className={cn('grid grid-cols-1 gap-3 xl:grid-cols-2 2xl:grid-cols-3', className)}>
      {ordered.map((detail) => (
        <EvidenceCard
          key={detail.dimension}
          detail={detail}
          isTopContributor={topContributor === detail.dimension}
          action={actions?.[detail.dimension]}
        >
          {extras?.[detail.dimension]}
        </EvidenceCard>
      ))}
    </div>
  );
}

/**
 * How the six dimensions add up, as a table.
 *
 * Present because a composite that cannot be taken apart is not explainable, and an
 * unexplainable flag is one nobody can defend acting on. The rows sum to the overall score
 * shown at the top of the page; if they ever did not, this table is where it would show.
 */
export function CompositionBreakdown({
  details,
  overallRisk,
  className,
}: {
  details: readonly RiskDimensionDetail[];
  overallRisk: number;
  className?: string;
}) {
  const byDimension = new Map(details.map((detail) => [detail.dimension, detail]));
  const rows = RISK_DIMENSION_ORDER.map((key) => byDimension.get(key)).filter(
    (detail): detail is RiskDimensionDetail => detail !== undefined,
  );
  const maxWeight = Math.max(...rows.map((row) => dimensionMeta(row.dimension).weight), 0.25);

  return (
    <section className={cn('panel', className)} aria-label="How the overall score is composed">
      <div className="panel-header">
        <h3 className="panel-title">How the overall score is composed</h3>
        <span className="panel-hint">score × weight, summed across six dimensions</span>
      </div>
      <table className="data-table">
        <thead>
          <tr>
            <th scope="col">Dimension</th>
            <th scope="col" className="w-20 text-right">
              Score
            </th>
            <th scope="col" className="w-20 text-right">
              Weight
            </th>
            <th scope="col">Contribution</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const meta = dimensionMeta(row.dimension);
            return (
              <tr key={row.dimension}>
                <td>
                  <span className="flex items-center gap-2">
                    <RiskBadge level={row.severity} size="sm" />
                    <span className="text-body-sm text-ink">{meta.shortLabel}</span>
                  </span>
                </td>
                <td className="tabular text-right">{formatScore(row.score)}</td>
                <td className="tabular text-right text-ink-muted">{meta.weight.toFixed(2)}</td>
                <td>
                  <ContributionBar
                    score={row.score}
                    level={row.severity}
                    weight={meta.weight}
                    maxWeight={maxWeight}
                  />
                </td>
              </tr>
            );
          })}
        </tbody>
        <tfoot>
          {/* Padding is explicit: `.data-table` only styles `tbody td`, and the total row
              must line up with the columns above it. */}
          <tr className="border-t-2 border-line-strong">
            <td className="px-3 py-2 text-body-sm font-semibold text-ink" colSpan={3}>
              Overall risk
            </td>
            <td className="tabular px-3 py-2 text-body-sm font-semibold text-ink">
              {formatScore(overallRisk)} of 1.00
            </td>
          </tr>
        </tfoot>
      </table>
    </section>
  );
}
