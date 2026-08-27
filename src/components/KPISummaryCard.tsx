import Link from 'next/link';
import type { ReactNode } from 'react';

import type { RiskLevel, RiskLevelCounts } from '@/types/api';
import { ArrowRightIcon, type IconComponent } from '@/components/icons';
import { RiskBadge, RiskGlyph } from '@/components/RiskBadge';
import { cn } from '@/lib/cn';
import { formatCount, formatPercent } from '@/lib/format';
import { RISK_LEVELS, riskMeta } from '@/lib/risk';

/**
 * A headline figure with the context that makes it mean something.
 *
 * `context` is a required prop, not an optional one. "1,847" is not information; "1,847 of
 * 12,000 works — 15% of the portfolio" is. The requirement that no number appears without
 * its denominator or comparison (PRD §6.1, brief §8) is enforced here by the type system
 * rather than by everyone remembering it.
 *
 * Values arrive pre-formatted. The card does no arithmetic and no rounding: formatting rules
 * for rupees, counts and scores live in `src/lib/format.ts`, and a tile that re-derived them
 * would be a second place for those rules to drift.
 */

export interface KPISummaryCardProps {
  label: string;
  /** Pre-formatted by the caller via `src/lib/format.ts`. */
  value: string;
  /** Follows the value in smaller type, e.g. "works", "of 1.00". */
  unit?: string;
  /** The denominator, comparison or period that makes the value interpretable. */
  context: string;
  /** Present when the figure is itself a risk level or score — adds label, shape, colour. */
  level?: RiskLevel;
  icon?: IconComponent;
  /** Turns the tile into a drill-down. The whole card becomes the target. */
  href?: string;
  /** Optional strip beneath the context line, e.g. a distribution bar. */
  footer?: ReactNode;
  className?: string;
}

export function KPISummaryCard({
  label,
  value,
  unit,
  context,
  level,
  icon: Icon,
  href,
  footer,
  className,
}: KPISummaryCardProps) {
  const body = (
    <>
      <div className="flex items-start justify-between gap-2">
        <span className="eyebrow">{label}</span>
        {Icon ? <Icon size={14} className="shrink-0 text-ink-faint" aria-hidden="true" /> : null}
      </div>

      <div className="mt-2 flex items-baseline gap-1.5">
        <span
          className={cn(
            'tabular text-stat font-semibold',
            level ? riskMeta(level).textClass : 'text-ink',
          )}
        >
          {value}
        </span>
        {unit ? <span className="text-body-sm text-ink-subtle">{unit}</span> : null}
        {level ? <RiskBadge level={level} size="sm" className="ml-1 translate-y-[-2px]" /> : null}
      </div>

      <p className="mt-1.5 text-caption leading-normal text-ink-muted">{context}</p>

      {footer ? <div className="mt-3">{footer}</div> : null}
    </>
  );

  if (href) {
    return (
      <Link
        href={href}
        className={cn(
          'panel group block px-4 py-3.5 transition-colors hover:border-gov-300 hover:bg-gov-50/40',
          className,
        )}
      >
        {body}
        <span className="mt-2 inline-flex items-center gap-1 text-caption font-medium text-gov-600 group-hover:underline">
          View detail
          <ArrowRightIcon size={12} aria-hidden="true" />
        </span>
      </Link>
    );
  }

  return <div className={cn('panel px-4 py-3.5', className)}>{body}</div>;
}

/** Equal-width row of tiles. Four across at the dashboard's target width. */
export function KPIRow({
  children,
  columns = 4,
  className,
}: {
  children: ReactNode;
  columns?: number;
  className?: string;
}) {
  return (
    <div
      className={cn('grid gap-3', className)}
      style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}
    >
      {children}
    </div>
  );
}

/**
 * The four-level distribution as a single stacked bar plus a legend.
 *
 * Each segment is labelled with its level name and count, so the bar is readable without
 * reference to colour — the segments differ in position and are restated in the legend
 * underneath. Segments below a couple of percent still get a visible sliver, because "four
 * Critical works out of twelve thousand" is precisely the finding a reviewer is looking for
 * and a mathematically proportional bar would render it invisible.
 */
export function RiskCountsBar({
  counts,
  className,
  showLegend = true,
}: {
  counts: RiskLevelCounts;
  className?: string;
  showLegend?: boolean;
}) {
  const total = RISK_LEVELS.reduce((sum, level) => sum + counts[level], 0);

  return (
    <div className={cn('w-full', className)}>
      <div
        className="flex h-2.5 w-full overflow-hidden rounded-control border border-line"
        role="img"
        aria-label={RISK_LEVELS.map(
          (level) => `${riskMeta(level).label}: ${formatCount(counts[level])}`,
        ).join('; ')}
      >
        {RISK_LEVELS.map((level) => {
          const count = counts[level];
          if (count === 0) return null;
          const share = total === 0 ? 0 : count / total;
          return (
            <div
              key={level}
              className={riskMeta(level).fillClass}
              style={{ width: `${Math.max(share * 100, 1.5)}%` }}
              title={`${riskMeta(level).label}: ${formatCount(count)} of ${formatCount(total)} (${formatPercent(share, 1)})`}
            />
          );
        })}
      </div>

      {showLegend ? (
        <ul className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1">
          {RISK_LEVELS.map((level) => (
            <li key={level} className="flex items-center gap-1.5">
              <RiskGlyph level={level} size={8} />
              <span className="text-caption text-ink-muted">{riskMeta(level).label}</span>
              <span className="tabular text-caption font-semibold text-ink">
                {formatCount(counts[level])}
              </span>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
