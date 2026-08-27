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
      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-card bg-gov-500/90 ring-1 ring-inset ring-white/20"
    >
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        {/* Bars under a magnifier: analysis over a record. */}
        <path d="M4 20h16" stroke="white" strokeWidth="1.75" strokeLinecap="round" />
        <path d="M6.5 20v-4.5" stroke="white" strokeWidth="1.75" strokeLinecap="round" />
        <path d="M10 20v-7.5" stroke="white" strokeWidth="1.75" strokeLinecap="round" />
        <circle cx="15" cy="9" r="4.4" stroke="white" strokeWidth="1.75" />
        <path d="m18.3 12.3 2.4 2.4" stroke="white" strokeWidth="1.75" strokeLinecap="round" />
      </svg>
    </span>
  );
}

export function AppHeader() {
  return (
    <header className="bg-surface-header text-white">
      <div className="mx-auto flex max-w-shell items-center gap-4 px-6 py-3">
        <Link href="/" className="flex items-center gap-3 rounded-control" title={PRODUCT_TAGLINE}>
          <BrandMark />
          <span className="flex flex-col leading-tight">
            <span className="text-section font-semibold tracking-tight text-white">
              {PRODUCT_NAME}
            </span>
            <span className="text-meta uppercase tracking-wider text-gov-200">
              {PRODUCT_OWNER}
            </span>
          </span>
        </Link>

        <p className="ml-2 hidden max-w-sm border-l border-white/15 pl-4 text-caption leading-snug text-gov-100 xl:block">
          {PRODUCT_TAGLINE}
        </p>

        <div className="ml-auto flex items-center gap-2.5">
          <DataProvenanceBadge />
          <AnonymizeToggle />
        </div>
      </div>
    </header>
  );
}

/**
 * Standing statement of what the numbers on screen are.
 *
 * Present because the demo runs on a synthetic dataset calibrated to published
 * MPLADS patterns. Saying so plainly and permanently is both honest and, for a
 * government audience, a credibility gain rather than a weakness.
 */
function DataProvenanceBadge() {
  return (
    <span
      className="hidden items-center gap-1.5 rounded-control border border-white/15 bg-white/5 px-2.5 py-1.5 text-meta uppercase tracking-wider text-gov-100 lg:inline-flex"
      title="Risk scores are computed by the analysis engine over a synthetic dataset calibrated to published MPLADS patterns. No live government records are used."
    >
      <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-gov-300" />
      Synthetic demonstration data
    </span>
  );
}
