import { DISCLAIMER_TEXT } from '@/lib/copy';
import { AlertTriangleIcon } from '@/components/icons';
import { cn } from '@/lib/cn';

/**
 * The mandated disclaimer (Design Doc §4.2).
 *
 * Fixed copy, always visible, never a tooltip. Required on every project-level and
 * alert-level view; the root layout renders the `bar` variant app-wide so it can
 * never be missing from a screen the judges happen to land on.
 *
 * This is the one place the word in the disclaimer legitimately appears — it exists
 * to *negate* a determination, which is the opposite of the accusatory language
 * banned everywhere else (Design Doc §9).
 */
export function DisclaimerFooter({
  variant = 'bar',
  className,
}: {
  variant?: 'bar' | 'panel';
  className?: string;
}) {
  if (variant === 'panel') {
    return (
      <div
        className={cn(
          'flex items-start gap-2.5 rounded-card border border-risk-high-border bg-risk-high-surface px-3.5 py-3',
          className,
        )}
      >
        <AlertTriangleIcon size={16} className="mt-0.5 shrink-0 text-risk-high" />
        <p className="text-caption font-medium leading-relaxed text-risk-high-text">
          {DISCLAIMER_TEXT}
        </p>
      </div>
    );
  }

  return (
    <div
      className={cn(
        'flex items-center justify-center gap-2 border-t border-line bg-surface px-6 py-2.5',
        className,
      )}
    >
      <AlertTriangleIcon size={13} className="shrink-0 text-ink-faint" />
      <p className="text-meta font-medium uppercase tracking-wider text-ink-subtle">
        {DISCLAIMER_TEXT}
      </p>
    </div>
  );
}
