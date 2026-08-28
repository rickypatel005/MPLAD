import type { Config } from 'tailwindcss';

/**
 * MPLADS-AUDIT-AI design tokens.
 *
 * The risk scale is FIXED by the PRD (§7) and Design Document (§2.1) and must not
 * be changed. Colour is never the sole encoding of risk anywhere in the UI — every
 * risk indicator pairs colour with a text label and an icon.
 */
const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // ---- Fixed risk scale (PRD §7) ----
        // Each level exposes DEFAULT (the fixed hue) plus a tinted surface,
        // border and readable text colour, e.g. bg-risk-high-surface,
        // border-risk-high-border, text-risk-high-text, bg-risk-high.
        // Kept as explicit tokens so risk styling is never improvised at the
        // call site — see RISK_LEVEL_META in src/lib/risk.ts.
        'risk-low': {
          surface: '#F0FDF4',
          border: '#BBF7D0',
          text: '#14532D',
          DEFAULT: '#16A34A',
        },
        'risk-medium': {
          surface: '#FEFCE8',
          border: '#FEF08A',
          text: '#713F12',
          DEFAULT: '#EAB308',
        },
        'risk-high': {
          surface: '#FFF7ED',
          border: '#FED7AA',
          text: '#7C2D12',
          DEFAULT: '#F97316',
        },
        'risk-critical': {
          surface: '#FEF2F2',
          border: '#FECACA',
          text: '#7F1D1D',
          DEFAULT: '#DC2626',
        },

        // ---- Stitch Material/Institutional tokens ----
        'primary-container': '#131b2e',
        'on-primary': '#ffffff',
        'on-primary-container': '#7c839b',
        'secondary-container': '#316bf3',
        'on-secondary-container': '#fefcff',
        'surface-dim': '#d8dadc',
        'surface-bright': '#f7f9fb',
        'surface-container-lowest': '#ffffff',
        'surface-container-low': '#f2f4f6',
        'surface-container': '#eceef0',
        'surface-container-high': '#e6e8ea',
        'surface-container-highest': '#e0e3e5',
        'on-surface': '#191c1e',
        'on-surface-variant': '#45464d',
        'border-subtle': '#E2E8F0',

        // ---- Institutional neutrals (document-like, official feel) ----
        ink: {
          DEFAULT: '#1B2430',
          muted: '#4A5568',
          subtle: '#6B7280',
          faint: '#9AA3AF',
        },
        surface: {
          DEFAULT: '#FFFFFF',
          sunken: '#F7F8FA',
          raised: '#FFFFFF',
          page: '#F4F5F7',
          header: '#0F1B2D',
        },
        line: {
          DEFAULT: '#E2E5EA',
          strong: '#CBD1D9',
          subtle: '#EDEFF2',
        },

        // ---- Single restrained institutional accent (never competes with risk) ----
        gov: {
          50: '#EEF3FA',
          100: '#D8E3F3',
          200: '#B3C8E6',
          300: '#7FA3D3',
          400: '#4F7CB8',
          500: '#2C5A96',
          600: '#1F4578',
          700: '#193760',
          800: '#152C4C',
          900: '#0F1B2D',
        },
        // ---- Civic Gold / Saffron (Empowered Indian official accents) ----
        'civic-gold': {
          50: '#FFFBEB',
          100: '#FEF3C7',
          200: '#FDE68A',
          300: '#FCD34D',
          400: '#FBBF24',
          500: '#F59E0B',
          600: '#D97706',
          700: '#B45309',
          800: '#92400E',
          900: '#78350F',
        },
      },
      fontFamily: {
        sans: [
          'var(--font-inter)',
          'var(--font-outfit)',
          'Inter',
          'Outfit',
          'ui-sans-serif',
          'system-ui',
          '-apple-system',
          'BlinkMacSystemFont',
          'Segoe UI',
          'Roboto',
          'sans-serif',
        ],
        serif: [
          'var(--font-source-serif)',
          'var(--font-cormorant)',
          'Source Serif 4',
          'Cormorant Garamond',
          'Georgia',
          'Times New Roman',
          'serif',
        ],
        display: [
          'var(--font-source-serif)',
          'var(--font-cormorant)',
          'Source Serif 4',
          'Cormorant Garamond',
          'Georgia',
          'serif',
        ],
        headline: [
          'var(--font-source-serif)',
          'Source Serif 4',
          'Georgia',
          'serif',
        ],
        body: [
          'var(--font-inter)',
          'Inter',
          'ui-sans-serif',
          'sans-serif',
        ],
        mono: [
          'var(--font-jetbrains)',
          'JetBrains Mono',
          'ui-monospace',
          'SFMono-Regular',
          'SF Mono',
          'Menlo',
          'Consolas',
          'monospace',
        ],
      },
      fontSize: {
        // Deliberate, compact type scale for data-dense audit screens.
        'meta': ['0.6875rem', { lineHeight: '1rem', letterSpacing: '0.04em' }],
        'caption': ['0.75rem', { lineHeight: '1.125rem' }],
        'body-sm': ['0.8125rem', { lineHeight: '1.25rem' }],
        'body': ['0.875rem', { lineHeight: '1.375rem' }],
        'card-title': ['0.9375rem', { lineHeight: '1.375rem', letterSpacing: '-0.005em' }],
        'section': ['1.0625rem', { lineHeight: '1.5rem', letterSpacing: '-0.01em' }],
        'page': ['1.375rem', { lineHeight: '1.75rem', letterSpacing: '-0.015em' }],
        'stat': ['1.75rem', { lineHeight: '2rem', letterSpacing: '-0.02em' }],
        'stat-lg': ['2.25rem', { lineHeight: '2.5rem', letterSpacing: '-0.025em' }],
      },
      boxShadow: {
        card: '0 1px 2px 0 rgb(16 24 40 / 0.04), 0 1px 3px 0 rgb(16 24 40 / 0.06)',
        raised: '0 2px 4px -1px rgb(16 24 40 / 0.06), 0 4px 12px -2px rgb(16 24 40 / 0.08)',
        overlay: '0 8px 32px -4px rgb(16 24 40 / 0.18)',
      },
      borderRadius: {
        // Restrained radii — institutional, not consumer-app pill shapes.
        card: '4px',
        control: '3px',
      },
      spacing: {
        '4.5': '1.125rem',
        '13': '3.25rem',
        '18': '4.5rem',
      },
      maxWidth: {
        shell: '1800px',
      },
      transitionDuration: {
        DEFAULT: '120ms',
      },
    },
  },
  plugins: [],
};

export default config;
