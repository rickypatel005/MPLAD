'use client';

import { useAnonymize } from '@/components/providers/AnonymizeProvider';
import { EyeIcon, EyeOffIcon } from '@/components/icons';
import { cn } from '@/lib/cn';

/**
 * Session-level toggle that masks MP identifiers across every screen.
 *
 * Rendered in the app header so its state is always visible — a presenter must
 * never have to wonder whether identities are currently exposed. Implemented as a
 * real `switch` role with `aria-checked` so it is keyboard-operable and announced
 * correctly.
 *
 * The "on" state is styled as the calm, expected state and "off" as the state that
 * draws attention, because exposing identities is the exceptional choice here.
 */
export function AnonymizeToggle({ className }: { className?: string }) {
  const { anonymized, toggle } = useAnonymize();

  return (
    <button
      type="button"
      role="switch"
      aria-checked={anonymized}
      onClick={toggle}
      title={
        anonymized
          ? 'MP identities are masked. Click to reveal.'
          : 'MP identities are visible. Click to mask.'
      }
      className={cn(
        'group inline-flex h-8 items-center gap-2 rounded-control border px-2.5 text-body-sm font-medium transition-colors',
        anonymized
          ? 'border-gov-700 bg-gov-800/60 text-gov-100 hover:bg-gov-800'
          : 'border-risk-high-border bg-risk-high-surface text-risk-high-text hover:bg-risk-high-surface/80',
        className,
      )}
    >
      {anonymized ? <EyeOffIcon size={15} /> : <EyeIcon size={15} />}
      <span className="whitespace-nowrap">
        MP identities: <span className="font-semibold">{anonymized ? 'masked' : 'visible'}</span>
      </span>
      <span
        aria-hidden="true"
        className={cn(
          'relative h-3.5 w-7 shrink-0 rounded-full transition-colors',
          anonymized ? 'bg-gov-400' : 'bg-risk-high',
        )}
      >
        <span
          className={cn(
            'absolute top-0.5 h-2.5 w-2.5 rounded-full bg-white transition-all',
            anonymized ? 'left-[0.875rem]' : 'left-0.5',
          )}
        />
      </span>
    </button>
  );
}
