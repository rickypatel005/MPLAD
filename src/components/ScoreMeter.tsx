import type { RiskLevel } from '@/types/api';
import { RiskGlyph } from '@/components/RiskBadge';
import { cn } from '@/lib/cn';
import { formatPercent, formatScore } from '@/lib/format';
import { RISK_LEVEL_BANDS, riskLevelFromScore, riskMeta } from '@/lib/risk';

/**
 * A score shown against the scale it belongs to.
 *
 * The product forbids a bare risk score anywhere in the UI (brief §8, PRD §8): a reader
 * given "0.85" has no way to know whether that is bad, and no basis for acting on it. This
 * component is the sanctioned way to render one — the number always arrives with its band,
 * its level name, and its position on the fixed four-level scale.
 *
 * Three simultaneous encodings, none of them sufficient alone: the needle's position, the
 * level name in text, and the level's shape glyph. Colour is a fourth, never the first — the
 * meter is still readable printed in greyscale, which is how an audit note tends to travel.
 */

function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(1, Math.max(0, value));
}

export interface ScoreMeterProps {
  /** 0–1. */
  score: number;
  /** From the API where available; derived from the score only as a fallback. */
  level?: RiskLevel;
  /** Field name shown above the meter, e.g. "Overall risk". */
  label?: string;
  /** Weight of this dimension in the composite, printed so the total can be checked. */
  weight?: number;
  /** Prints the four band boundaries beneath the bar. */
  showBands?: boolean;
  className?: string;
}

export function ScoreMeter({
  score,
  level,
  label,
  weight,
  showBands = false,
  className,
}: ScoreMeterProps) {
  const resolved = level ?? riskLevelFromScore(score);
  const meta = riskMeta(resolved);
  const position = clamp01(score) * 100;

  return (
    <div className={cn('w-full', className)}>
      <div className="flex items-baseline justify-between gap-3">
        {label ? <span className="eyebrow">{label}</span> : null}
        <span className="flex items-baseline gap-1.5">
          <RiskGlyph level={resolved} size={9} className="translate-y-px" />
          <span className={cn('text-caption font-semibold uppercase tracking-wide', meta.textClass)}>
            {meta.label}
          </span>
          <span className="tabular text-caption text-ink-muted">
            {formatScore(score)} of 1.00
          </span>
          {weight === undefined ? null : (
            <span className="tabular text-meta text-ink-faint">
              weight {formatPercent(weight)}
            </span>
          )}
        </span>
      </div>

      <div
        className="relative mt-1.5 h-2.5 w-full overflow-hidden rounded-control border border-line"
        role="img"
        aria-label={`${label ? `${label}: ` : ''}${meta.label} risk, ${formatScore(score)} of 1.00, in the ${meta.range} band`}
        title={`${meta.label} — ${meta.range}. ${meta.meaning}`}
      >
        <div className="flex h-full w-full">
          {RISK_LEVEL_BANDS.map((band) => (
            <div
              key={band.level}
              className={riskMeta(band.level).surfaceClass}
              style={{ width: `${(band.max - band.min) * 100}%` }}
            />
          ))}
        </div>

        {/* The needle. Dark rather than tinted, so it stays visible over any band. */}
        <span
          aria-hidden="true"
          className="absolute top-0 h-full w-0.5 -translate-x-1/2 bg-ink"
          style={{ left: `${position}%` }}
        />
      </div>

      {showBands ? (
        <div className="mt-1 flex w-full">
          {RISK_LEVEL_BANDS.map((band) => (
            <span
              key={band.level}
              className="tabular text-meta text-ink-faint"
              style={{ width: `${(band.max - band.min) * 100}%` }}
            >
              {band.min.toFixed(2)}
            </span>
          ))}
          <span className="tabular text-meta text-ink-faint">1.00</span>
        </div>
      ) : null}
    </div>
  );
}

/**
 * One dimension's contribution to the composite score.
 *
 * Two bars in one: the pale track is the most this dimension could contribute at its
 * weight, and the filled portion is what it actually contributed. Read down a column of
 * six, it shows at a glance which findings drove the overall figure — a 1.00 on Financial
 * at weight 0.25 outweighs a 1.00 on Evidence at 0.05, and the geometry says so without
 * the reader doing arithmetic.
 */
export function ContributionBar({
  score,
  level,
  weight,
  maxWeight = 0.25,
  className,
}: {
  score: number;
  level: RiskLevel;
  weight: number;
  /** Weight of the heaviest dimension, so the six bars share one scale. */
  maxWeight?: number;
  className?: string;
}) {
  const meta = riskMeta(level);
  const trackWidth = (weight / maxWeight) * 100;
  const filled = clamp01(score) * 100;
  const contribution = clamp01(score) * weight;

  return (
    <div
      className={cn('flex items-center gap-2', className)}
      title={`Contributes ${contribution.toFixed(3)} of the ${weight.toFixed(2)} available at this weight`}
    >
      <span className="relative block h-2 flex-1 rounded-control bg-line-subtle">
        <span
          className="absolute left-0 top-0 h-full rounded-control bg-surface-sunken ring-1 ring-inset ring-line"
          style={{ width: `${trackWidth}%` }}
        />
        <span
          className={cn('absolute left-0 top-0 h-full rounded-control', meta.fillClass)}
          style={{ width: `${(trackWidth * filled) / 100}%` }}
        />
      </span>
      <span className="tabular w-14 shrink-0 text-right text-meta text-ink-muted">
        +{contribution.toFixed(3)}
      </span>
    </div>
  );
}
