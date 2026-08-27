import type { ReactElement, SVGProps } from 'react';

import type { RiskDimensionKey, RiskLevel } from '@/types/api';
import type { NavIconKey } from '@/lib/nav';

/**
 * Icon set for MPLADS-AUDIT-AI.
 *
 * Two families:
 *
 * - **Outline icons** (nav, dimensions, controls) — stroked, 24×24, currentColor.
 * - **Severity glyphs** — solid shapes, one distinct shape per risk level. The
 *   shape is a second, non-colour encoding of severity, so the scale still reads
 *   in greyscale and for colour-vision-deficient viewers (Design Doc §7). One
 *   consistent icon per dimension, reused everywhere that dimension appears
 *   (Design Doc §2.4).
 *
 * All icons are `aria-hidden` by default: they accompany a text label rather than
 * replacing one. Pass `aria-hidden={false}` plus a `title` only when an icon is
 * genuinely standalone.
 */

export interface IconProps extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  size?: number;
}

/** Every icon shares this signature, so maps of icons stay assignable. */
export type IconComponent = (props: IconProps) => ReactElement;

function Outline({ size = 16, children, ...rest }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      {...rest}
    >
      {children}
    </svg>
  );
}

function Solid({ size = 12, children, ...rest }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
      focusable="false"
      {...rest}
    >
      {children}
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Severity glyphs — shape encodes level
// ---------------------------------------------------------------------------

/** LOW — circle. */
export const CircleGlyph = (props: IconProps) => (
  <Solid {...props}>
    <circle cx="12" cy="12" r="8" />
  </Solid>
);

/** MEDIUM — diamond. */
export const DiamondGlyph = (props: IconProps) => (
  <Solid {...props}>
    <path d="M12 3 21 12 12 21 3 12Z" />
  </Solid>
);

/** HIGH — triangle. */
export const TriangleGlyph = (props: IconProps) => (
  <Solid {...props}>
    <path d="M12 3.5 22 20.5H2Z" />
  </Solid>
);

/** CRITICAL — octagon, borrowing the visual grammar of a stop sign. */
export const OctagonGlyph = (props: IconProps) => (
  <Solid {...props}>
    <path d="M8.4 2.5h7.2L21.5 8.4v7.2L15.6 21.5H8.4L2.5 15.6V8.4Z" />
  </Solid>
);

export const SEVERITY_GLYPHS: Record<RiskLevel, IconComponent> = {
  LOW: CircleGlyph,
  MEDIUM: DiamondGlyph,
  HIGH: TriangleGlyph,
  CRITICAL: OctagonGlyph,
};

// ---------------------------------------------------------------------------
// Navigation icons
// ---------------------------------------------------------------------------

export const DashboardIcon = (props: IconProps) => (
  <Outline {...props}>
    <path d="M3 20h18" />
    <path d="M6 20V11" />
    <path d="M11 20V5" />
    <path d="M16 20v-6" />
    <path d="M21 20v-9" />
  </Outline>
);

export const NetworkIcon = (props: IconProps) => (
  <Outline {...props}>
    <circle cx="12" cy="5" r="2.4" />
    <circle cx="5" cy="17" r="2.4" />
    <circle cx="19" cy="17" r="2.4" />
    <path d="M10.6 7 6.4 14.9" />
    <path d="M13.4 7l4.2 7.9" />
    <path d="M7.4 17h9.2" />
  </Outline>
);

export const MapIcon = (props: IconProps) => (
  <Outline {...props}>
    <path d="M9 4 3 6v14l6-2 6 2 6-2V4l-6 2-6-2Z" />
    <path d="M9 4v14" />
    <path d="M15 6v14" />
  </Outline>
);

export const ComplianceIcon = (props: IconProps) => (
  <Outline {...props}>
    <path d="M9 3h6v3H9Z" />
    <path d="M15 4.5h2.5A1.5 1.5 0 0 1 19 6v13.5A1.5 1.5 0 0 1 17.5 21h-11A1.5 1.5 0 0 1 5 19.5V6a1.5 1.5 0 0 1 1.5-1.5H9" />
    <path d="m8.5 13.5 2.2 2.2 4.8-4.8" />
  </Outline>
);

export const AlertsIcon = (props: IconProps) => (
  <Outline {...props}>
    <path d="M18 9a6 6 0 1 0-12 0c0 5-2 6.5-2 6.5h16S18 14 18 9Z" />
    <path d="M10.3 19a2 2 0 0 0 3.4 0" />
  </Outline>
);

export const DuplicatesIcon = (props: IconProps) => (
  <Outline {...props}>
    <rect x="3" y="3" width="12" height="12" rx="1.5" />
    <path d="M9 20.5h9a2.5 2.5 0 0 0 2.5-2.5V9" />
  </Outline>
);

export const NAV_ICONS: Record<NavIconKey, IconComponent> = {
  dashboard: DashboardIcon,
  network: NetworkIcon,
  map: MapIcon,
  compliance: ComplianceIcon,
  alerts: AlertsIcon,
  duplicates: DuplicatesIcon,
};

// ---------------------------------------------------------------------------
// Risk dimension icons — one per dimension, reused everywhere
// ---------------------------------------------------------------------------

/** FINANCIAL — rupee sign. */
export const RupeeIcon = (props: IconProps) => (
  <Outline {...props}>
    <path d="M7 4h10" />
    <path d="M7 8.5h10" />
    <path d="M7 13h4.5a4.5 4.5 0 0 0 0-9" />
    <path d="M7 13h2l7 7" />
  </Outline>
);

/** TIMELINE — clock. */
export const ClockIcon = (props: IconProps) => (
  <Outline {...props}>
    <circle cx="12" cy="12" r="8.5" />
    <path d="M12 7.5V12l3.2 2" />
  </Outline>
);

/** IA / CONTRACTOR — institutional building. */
export const BuildingIcon = (props: IconProps) => (
  <Outline {...props}>
    <path d="M4 21h16" />
    <path d="M6 21V8l6-4 6 4v13" />
    <path d="M10 21v-5h4v5" />
    <path d="M9.5 11h1.5" />
    <path d="M13 11h1.5" />
  </Outline>
);

/** GEO — map pin. */
export const PinIcon = (props: IconProps) => (
  <Outline {...props}>
    <path d="M12 21s6.5-6 6.5-11a6.5 6.5 0 1 0-13 0C5.5 15 12 21 12 21Z" />
    <circle cx="12" cy="10" r="2.4" />
  </Outline>
);

/** EVIDENCE — camera, since stage photographs are the primary evidence artefact. */
export const CameraIcon = (props: IconProps) => (
  <Outline {...props}>
    <path d="M4 8.5h3l1.6-2.5h6.8L17 8.5h3a1 1 0 0 1 1 1v8a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1v-8a1 1 0 0 1 1-1Z" />
    <circle cx="12" cy="13.5" r="3.2" />
  </Outline>
);

export const DIMENSION_ICONS: Record<RiskDimensionKey, IconComponent> = {
  FINANCIAL: RupeeIcon,
  TIMELINE: ClockIcon,
  COMPLIANCE: ComplianceIcon,
  IA: BuildingIcon,
  GEO: PinIcon,
  EVIDENCE: CameraIcon,
};

// ---------------------------------------------------------------------------
// Interface / control icons
// ---------------------------------------------------------------------------

export const ChevronRightIcon = (props: IconProps) => (
  <Outline {...props}>
    <path d="m9.5 5.5 7 6.5-7 6.5" />
  </Outline>
);

export const ChevronDownIcon = (props: IconProps) => (
  <Outline {...props}>
    <path d="m5.5 9.5 6.5 7 6.5-7" />
  </Outline>
);

export const ArrowUpIcon = (props: IconProps) => (
  <Outline {...props}>
    <path d="M12 19V5" />
    <path d="m6 11 6-6 6 6" />
  </Outline>
);

export const ArrowDownIcon = (props: IconProps) => (
  <Outline {...props}>
    <path d="M12 5v14" />
    <path d="m6 13 6 6 6-6" />
  </Outline>
);

export const ArrowRightIcon = (props: IconProps) => (
  <Outline {...props}>
    <path d="M5 12h14" />
    <path d="m13 6 6 6-6 6" />
  </Outline>
);

export const ExternalLinkIcon = (props: IconProps) => (
  <Outline {...props}>
    <path d="M14 4h6v6" />
    <path d="M20 4 11 13" />
    <path d="M18 14.5V19a1.5 1.5 0 0 1-1.5 1.5H5A1.5 1.5 0 0 1 3.5 19V7.5A1.5 1.5 0 0 1 5 6h4.5" />
  </Outline>
);

export const SearchIcon = (props: IconProps) => (
  <Outline {...props}>
    <circle cx="11" cy="11" r="6.5" />
    <path d="m16 16 4.5 4.5" />
  </Outline>
);

export const FilterIcon = (props: IconProps) => (
  <Outline {...props}>
    <path d="M4 6h16" />
    <path d="M7 12h10" />
    <path d="M10 18h4" />
  </Outline>
);

export const CloseIcon = (props: IconProps) => (
  <Outline {...props}>
    <path d="M6 6l12 12" />
    <path d="M18 6 6 18" />
  </Outline>
);

export const DownloadIcon = (props: IconProps) => (
  <Outline {...props}>
    <path d="M12 4v11" />
    <path d="m7.5 10.5 4.5 4.5 4.5-4.5" />
    <path d="M4.5 19.5h15" />
  </Outline>
);

export const RefreshIcon = (props: IconProps) => (
  <Outline {...props}>
    <path d="M20 6.5v5h-5" />
    <path d="M19.3 11.5A7.5 7.5 0 1 0 12 19.5a7.5 7.5 0 0 0 6.8-4.3" />
  </Outline>
);

export const EyeIcon = (props: IconProps) => (
  <Outline {...props}>
    <path d="M2.5 12S6 6 12 6s9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6Z" />
    <circle cx="12" cy="12" r="2.8" />
  </Outline>
);

export const EyeOffIcon = (props: IconProps) => (
  <Outline {...props}>
    <path d="M4 4l16 16" />
    <path d="M9.6 5.2A8.6 8.6 0 0 1 12 5c6 0 9.5 6 9.5 6a17 17 0 0 1-2.6 3.3" />
    <path d="M6.4 7.2A16.6 16.6 0 0 0 2.5 11s3.5 6 9.5 6a8.7 8.7 0 0 0 3.4-.66" />
    <path d="M10.2 10.3a2.8 2.8 0 0 0 3.6 3.9" />
  </Outline>
);

export const CheckIcon = (props: IconProps) => (
  <Outline {...props}>
    <path d="m5 12.5 4.5 4.5L19 7.5" />
  </Outline>
);

export const AlertTriangleIcon = (props: IconProps) => (
  <Outline {...props}>
    <path d="M12 4.5 21 19.5H3Z" />
    <path d="M12 10v4" />
    <path d="M12 17h.01" />
  </Outline>
);

export const InfoIcon = (props: IconProps) => (
  <Outline {...props}>
    <circle cx="12" cy="12" r="8.5" />
    <path d="M12 11v5.5" />
    <path d="M12 8h.01" />
  </Outline>
);

export const ScaleIcon = (props: IconProps) => (
  <Outline {...props}>
    <path d="M12 4v16" />
    <path d="M7 20h10" />
    <path d="M5 8h14" />
    <path d="M5 8 2.5 14h5Z" />
    <path d="M19 8l-2.5 6h5Z" />
  </Outline>
);

export const LayersIcon = (props: IconProps) => (
  <Outline {...props}>
    <path d="m12 3 9 4.5-9 4.5L3 7.5Z" />
    <path d="m3 12.5 9 4.5 9-4.5" />
  </Outline>
);

export const GridIcon = (props: IconProps) => (
  <Outline {...props}>
    <rect x="3.5" y="3.5" width="7" height="7" rx="1" />
    <rect x="13.5" y="3.5" width="7" height="7" rx="1" />
    <rect x="3.5" y="13.5" width="7" height="7" rx="1" />
    <rect x="13.5" y="13.5" width="7" height="7" rx="1" />
  </Outline>
);

export const SpinnerIcon = ({ size = 16, className, ...rest }: IconProps) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={2.25}
    strokeLinecap="round"
    aria-hidden="true"
    focusable="false"
    className={['animate-spin', className].filter(Boolean).join(' ')}
    {...rest}
  >
    <path d="M12 3.5a8.5 8.5 0 1 0 8.5 8.5" />
  </svg>
);
