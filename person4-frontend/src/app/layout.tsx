import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';

import { Inter, Source_Serif_4, JetBrains_Mono } from 'next/font/google';

import '@/app/globals.css';

import { DisclaimerFooter } from '@/components/DisclaimerFooter';
import { AnonymizeProvider } from '@/components/providers/AnonymizeProvider';
import { QueryProvider } from '@/components/providers/QueryProvider';
import { AppHeader } from '@/components/shell/AppHeader';
import { MainNav } from '@/components/shell/MainNav';
import { PRODUCT_NAME, PRODUCT_TAGLINE } from '@/lib/copy';

const inter = Inter({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-inter',
  display: 'swap',
});

const sourceSerif = Source_Serif_4({
  subsets: ['latin'],
  weight: ['400', '600', '700'],
  style: ['normal', 'italic'],
  variable: '--font-source-serif',
  display: 'swap',
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  weight: ['400', '500', '600'],
  variable: '--font-jetbrains',
  display: 'swap',
});

export const metadata: Metadata = {
  title: {
    default: `${PRODUCT_NAME} — Risk Dashboard`,
    template: `%s — ${PRODUCT_NAME}`,
  },
  description: PRODUCT_TAGLINE,
  robots: { index: false, follow: false },
};

/**
 * Desktop-first, per Design Doc §2.5: the primary target is 1280–1920px and the
 * minimum supported width is ~1024px. `initialScale` is fixed rather than
 * responsive because a government review tool used on a laptop or projector should
 * not reflow into a phone layout for this scope.
 */
export const viewport: Viewport = {
  width: 1024,
  initialScale: 1,
};

/**
 * Root layout.
 *
 * Provider order matters: `QueryProvider` wraps `AnonymizeProvider` so that a
 * change to the anonymisation toggle re-renders labels without touching the query
 * cache — masking is presentation-only and must never trigger a refetch during the
 * demo.
 *
 * The disclaimer bar is mounted here rather than per-page. It is required on every
 * project-level and alert-level view (Design Doc §4.2); rendering it app-wide means
 * it cannot go missing from whichever screen a judge happens to land on.
 */
export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html
      lang="en-IN"
      className={`${inter.variable} ${sourceSerif.variable} ${jetbrainsMono.variable}`}
    >
      <body className="flex min-h-screen flex-col font-sans bg-surface-page text-ink antialiased">
        <QueryProvider>
          <AnonymizeProvider>
            <a
              href="#main-content"
              className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-2 focus:z-50 focus:rounded-control focus:bg-white focus:px-3 focus:py-2 focus:text-body-sm focus:font-medium focus:text-gov-700 focus:shadow-raised"
            >
              Skip to main content
            </a>

            <AppHeader />
            <MainNav />

            <main id="main-content" className="flex-1">
              {children}
            </main>

            <DisclaimerFooter variant="bar" className="mt-auto" />
          </AnonymizeProvider>
        </QueryProvider>
      </body>
    </html>
  );
}
