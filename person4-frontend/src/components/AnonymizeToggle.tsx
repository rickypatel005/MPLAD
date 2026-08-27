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
        'group inline-flex h-8 items-center gap-2 rounded-lg border px-3 text-xs font-semibold font-sans transition-all duration-150 shadow-sm',
        anonymized
          ? 'border-slate-700 bg-slate-800 text-slate-200 hover:bg-slate-750'
          : 'border-amber-400 bg-amber-500/20 text-amber-300 hover:bg-amber-500/30',
        className,
      )}
    >
      {anonymized ? <EyeOffIcon size={14} className="text-amber-400" /> : <EyeIcon size={14} className="text-amber-300" />}
      <span className="whitespace-nowrap">
        MP identities: <span className="font-bold text-amber-400">{anonymized ? 'masked' : 'visible'}</span>
      </span>
      <span
        aria-hidden="true"
        className={cn(
          'relative h-4 w-8 shrink-0 rounded-full transition-colors',
          anonymized ? 'bg-amber-500' : 'bg-amber-600/50',
        )}
      >
        <span
          className={cn(
            'absolute top-0.5 h-3 w-3 rounded-full bg-slate-900 shadow transition-all',
            anonymized ? 'left-[1.125rem]' : 'left-0.5',
          )}
        />
      </span>
    </button>
  );
}
