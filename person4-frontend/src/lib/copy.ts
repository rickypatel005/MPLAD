/**
 * Fixed product copy and vocabulary rules for MPLADS-AUDIT-AI.
 *
 * Centralised for two reasons:
 *
 * 1. The disclaimer is a product requirement, not boilerplate (Design Doc §4.2,
 *    §9). Keeping one constant means it cannot drift or be dropped.
 * 2. The banned-vocabulary rule (PRD §8, Design Doc §9) is only meaningful if it
 *    is checkable. `findBannedTerms` powers the pre-demo audit script, and the
 *    fixture generator runs its evidence strings through it.
 *
 * The system flags for human review. It never accuses. All copy here reads as an
 * auditor's working note.
 */

// ---------------------------------------------------------------------------
// Mandated copy
// ---------------------------------------------------------------------------

/**
 * Persistent disclaimer, verbatim from Design Doc §4.2. Must be visible on every
 * project-level and alert-level view — never hidden behind a tooltip.
 */
export const DISCLAIMER_TEXT =
  'NOT A DETERMINATION OF FRAUD. AI-generated risk flag for human review.';

/** Shorter form for dense contexts such as PDF footers and modal headers. */
export const DISCLAIMER_SHORT = 'AI-generated risk flag for human review.';

/** Standing call to action. Every flag pairs with a human action, never a verdict. */
export const REVIEW_CTA = 'Flagged for officer review';

/** Explains what the product is, in one line — used in the header and the report. */
export const PRODUCT_NAME = 'MPLADS-AUDIT-AI';
export const PRODUCT_TAGLINE = 'Risk analytics and anomaly review for MPLADS works';
export const PRODUCT_OWNER = 'Ministry of Statistics & Programme Implementation';

/** Anonymisation notice shown while the toggle is on. */
export const ANONYMIZED_NOTICE =
  'MP identities are masked. Risk findings relate to works and implementing agencies, not individuals.';

/** Rendered wherever a score appears without room for full evidence. */
export const SCORE_CONTEXT_HINT = 'Every score is accompanied by the evidence behind it.';

// ---------------------------------------------------------------------------
// Vocabulary rules (PRD §8, Design Doc §9)
// ---------------------------------------------------------------------------

/** Approved framing. Use these words in any new copy. */
export const APPROVED_VOCABULARY: readonly string[] = [
  'anomaly',
  'risk',
  'flagged for review',
  'requires verification',
  'requires field verification',
  'deviation',
  'unverified',
] as const;

/**
 * Banned in any system-generated text. These imply a determination rather than a
 * flag, which is precisely what the product must not do.
 */
export const BANNED_VOCABULARY: readonly string[] = [
  'fraud',
  'fraudulent',
  'guilty',
  'corrupt',
  'corruption',
  'embezzle',
  'embezzlement',
  'criminal',
  'scam',
  'bribe',
  'bribery',
  'culprit',
  'proven',
] as const;

/**
 * The single sanctioned appearance of the word "fraud": the disclaimer, which
 * exists to *negate* a determination. `findBannedTerms` ignores this exact phrase.
 */
export const BANNED_TERM_EXEMPTIONS: readonly string[] = [
  'NOT A DETERMINATION OF FRAUD',
] as const;

export interface BannedTermHit {
  term: string;
  index: number;
  excerpt: string;
}

/**
 * Returns every banned term in `text`, ignoring the sanctioned disclaimer phrase.
 * Matches whole words only, so "incorruptible" or "reproven" do not false-positive.
 */
export function findBannedTerms(text: string): BannedTermHit[] {
  let haystack = text;
  for (const exemption of BANNED_TERM_EXEMPTIONS) {
    haystack = haystack.replaceAll(exemption, ' '.repeat(exemption.length));
    haystack = haystack.replaceAll(exemption.toLowerCase(), ' '.repeat(exemption.length));
  }

  const hits: BannedTermHit[] = [];
  for (const term of BANNED_VOCABULARY) {
    const pattern = new RegExp(`\\b${term}\\b`, 'gi');
    for (const match of haystack.matchAll(pattern)) {
      const index = match.index ?? 0;
      hits.push({
        term,
        index,
        excerpt: text.slice(Math.max(0, index - 40), index + term.length + 40).trim(),
      });
    }
  }
  return hits.sort((a, b) => a.index - b.index);
}

/** Convenience predicate for assertions in the fixture generator. */
export function isCopyCompliant(text: string): boolean {
  return findBannedTerms(text).length === 0;
}

// ---------------------------------------------------------------------------
// Empty / error / loading copy
// ---------------------------------------------------------------------------

/**
 * Every data-fetching view implements all three states (Design Doc §6). Copy lives
 * here so no screen ships with a blank panel or a bare "Error" during the demo.
 */
export const STATE_COPY = {
  loading: {
    title: 'Loading',
    body: 'Retrieving analysis results from the risk engine.',
  },
  empty: {
    title: 'No projects match these filters',
    body: 'Widen the date range, clear a filter, or select a different state.',
    action: 'Clear all filters',
  },
  error: {
    title: 'Could not load this view',
    body: 'The risk engine did not respond. Your filters have been preserved.',
    action: 'Retry',
  },
  noAlerts: {
    title: 'No open alerts',
    body: 'Every high and critical flag in this range has been acknowledged.',
  },
  noDuplicates: {
    title: 'No duplicate candidates in range',
    body: 'Lower the similarity threshold or widen the distance radius to see weaker matches.',
  },
  noLocation: {
    title: 'Location not recorded',
    body: 'This work has no GPS coordinates. The district centroid is shown instead.',
  },
  noPhotos: {
    title: 'No photographs on record',
    body: 'Stage photographs are required evidence. Their absence is itself a finding.',
  },
} as const;
