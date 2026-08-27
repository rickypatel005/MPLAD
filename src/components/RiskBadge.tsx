import type { RiskLevel } from '@/types/api';
import { SEVERITY_GLYPHS } from '@/components/icons';
import { cn } from '@/lib/cn';
import { formatScore } from '@/lib/format';
import { riskMeta } from '@/lib/risk';

/**
 * The canonical way a risk level appears anywhere in the UI.
 *
 * Three simultaneous encodings, all mandatory (PRD §8, Design Doc §2.1, §7):
 * colour, a distinct shape per level, and the text label. Colour is never the sole
 * indicator, so the badge still reads in greyscale and for colour-vision-deficient
 * viewers.
 *
 * `score` is optional and, when present, is shown *after* the label — never on its
 * own. A bare score with no level and no reason is exactly what the product
 * forbids; the surrounding view is still responsible for showing the evidence text.
 */

export type RiskBadgeSize = 'sm' | 'md' | 'lg';

export interface RiskBadgeProps {
  level: RiskLevel;
  /** 0–1 overall or dimension score. Rendered next to the label when provided. */
  score?: number | null;
  size?: RiskBadgeSize;
  className?: string;
}

const SIZE_CLASSES: Record<RiskBadgeSize, { wrapper: string; glyph: number }> = {
  sm: { wrapper: 'h-5 gap-1 px-1.5 text-meta', glyph: 8 },
  md: { wrapper: 'h-6 gap-1.5 px-2 text-caption', glyph: 10 },
  lg: { wrapper: 'h-8 gap-2 px-2.5 text-body', glyph: 12 },
};

export function RiskBadge({ level, score, size = 'md', className }: RiskBadgeProps) {
  const meta = riskMeta(level);
  const Glyph = SEVERITY_GLYPHS[level];
  const sizing = SIZE_CLASSES[size];

  return (
    <span
      className={cn(
        'inline-flex items-center whitespace-nowrap rounded-control border font-semibold uppercase tracking-wide',
        meta.badgeClass,
        sizing.wrapper,
        className,
      )}
      title={`${meta.label} risk (${meta.range}) — ${meta.meaning}`}
    >
      <Glyph size={sizing.glyph} />
      {meta.label}
      {score !== null && score !== undefined ? (
        <span className="tabular font-normal normal-case opacity-80">{formatScore(score)}</span>
      ) : null}
    </span>
  );
}

/**
 * Colour + shape only, for the tightest contexts — map markers, graph legends, the
 * leading cell of a dense table row. Always accompanied by a text label elsewhere
 * in the same row or panel, plus an accessible name of its own.
 */
export function RiskGlyph({
  level,
  size = 10,
  className,
}: {
  level: RiskLevel;
  size?: number;
  className?: string;
}) {
  const meta = riskMeta(level);
  const Glyph = SEVERITY_GLYPHS[level];
  return (
    <span
      className={cn('inline-flex items-center', className)}
      style={{ color: meta.hex }}
      role="img"
      aria-label={`${meta.label} risk`}
      title={`${meta.label} risk (${meta.range})`}
    >
      <Glyph size={size} aria-hidden="true" />
    </span>
  );
}

/** Horizontal legend for the fixed four-level scale. */
export function RiskScaleLegend({
  className,
  showRanges = true,
}: {
  className?: string;
  showRanges?: boolean;
}) {
  return (
    <ul className={cn('flex flex-wrap items-center gap-x-4 gap-y-1.5', className)}>
      {(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'] as RiskLevel[]).map((level) => {
        const meta = riskMeta(level);
        return (
          <li key={level} className="flex items-center gap-1.5">
            <RiskGlyph level={level} size={9} />
            <span className="text-caption font-medium text-ink">{meta.label}</span>
            {showRanges ? (
              <span className="tabular text-meta text-ink-faint">{meta.range}</span>
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}
