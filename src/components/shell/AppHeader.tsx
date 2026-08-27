import Link from 'next/link';

import { AnonymizeToggle } from '@/components/AnonymizeToggle';
import { PRODUCT_NAME, PRODUCT_OWNER, PRODUCT_TAGLINE } from '@/lib/copy';

/**
 * Institutional application header.
 *
 * Reads as a government system of record rather than a consumer product: dark
 * navy band, restrained mark, the owning ministry named alongside the product, and
 * no gradients or hero treatment. The audience is MoSPI officers and judges
 * assessing "government readiness" (Design Doc §1).
 *
 * The right-hand cluster carries the two pieces of standing context a viewer needs
 * at all times: that the data on screen is synthetic, and whether MP identities are
 * currently masked.
 */

function BrandMark() {
  return (
    <span
      aria-hidden="true"
      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-800 ring-1 ring-inset ring-amber-500/40 shadow-sm"
    >
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="M4 20h16" stroke="#F59E0B" strokeWidth="2" strokeLinecap="round" />
        <path d="M6.5 20v-4.5" stroke="white" strokeWidth="1.75" strokeLinecap="round" />
        <path d="M10 20v-7.5" stroke="white" strokeWidth="1.75" strokeLinecap="round" />
        <circle cx="15" cy="9" r="4.4" stroke="#F59E0B" strokeWidth="2" />
        <path d="m18.3 12.3 2.4 2.4" stroke="white" strokeWidth="1.75" strokeLinecap="round" />
      </svg>
    </span>
  );
}

export function AppHeader() {
  return (
    <header className="bg-slate-900 text-white shadow-md">
      <div className="tricolor-stripe" />
      <div className="mx-auto flex max-w-shell items-center gap-4 px-6 py-3.5">
        <Link href="/" className="flex items-center gap-3 rounded-lg group" title={PRODUCT_TAGLINE}>
          <BrandMark />
          <span className="flex flex-col leading-tight">
            <span className="font-display text-xl font-bold tracking-wide text-white group-hover:text-amber-400 transition-colors">
              {PRODUCT_NAME}
            </span>
            <span className="text-[0.65rem] font-bold uppercase tracking-widest text-amber-500 font-sans">
              EMPOWERED INDIAN &bull; {PRODUCT_OWNER}
            </span>
          </span>
        </Link>

        <p className="ml-3 hidden max-w-md border-l border-slate-800 pl-4 text-xs leading-relaxed text-slate-300 xl:block font-sans">
          {PRODUCT_TAGLINE}
        </p>

        <div className="ml-auto flex items-center gap-3">
          <DataProvenanceBadge />
          <AnonymizeToggle />
        </div>
      </div>
    </header>
  );
}

/**
 * Standing statement of what the numbers on screen are.
 */
function DataProvenanceBadge() {
  return (
    <span
      className="hidden items-center gap-2 rounded-lg border border-slate-700/80 bg-slate-800/90 px-3 py-1.5 text-[0.7rem] font-semibold uppercase tracking-wider text-slate-300 shadow-inner lg:inline-flex"
      title="Risk scores are computed by the analysis engine over a synthetic dataset calibrated to published MPLADS patterns. No live government records are used."
    >
      <span aria-hidden="true" className="h-2 w-2 rounded-full bg-amber-500 animate-pulse" />
      Synthetic demonstration data
    </span>
  );
}
