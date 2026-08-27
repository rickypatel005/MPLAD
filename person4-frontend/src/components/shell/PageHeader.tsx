import Link from 'next/link';
import type { ReactNode } from 'react';

import { ChevronRightIcon } from '@/components/icons';
import { cn } from '@/lib/cn';

/**
 * Consistent page heading block: breadcrumb, title, one-line purpose, and a slot
 * for page-level actions.
 *
 * Every route uses this so the shell reads as one coherent system, and so the
 * purpose of each screen is stated on the screen itself — useful when a judge
 * arrives mid-demo without the narration.
 */

export interface Breadcrumb {
  label: string;
  href?: string;
}

export interface PageHeaderProps {
  title: string;
  description?: string;
  breadcrumbs?: Breadcrumb[];
  /** Buttons, toggles, filters summary — right-aligned, vertically centred. */
  actions?: ReactNode;
  /** Extra content below the title block, e.g. a risk banner on a project page. */
  children?: ReactNode;
  className?: string;
}

export function PageHeader({
  title,
  description,
  breadcrumbs,
  actions,
  children,
  className,
}: PageHeaderProps) {
  return (
    <div className={cn('border-b border-slate-200 bg-white/80 backdrop-blur-sm', className)}>
      <div className="mx-auto max-w-shell px-6 py-5">
        {breadcrumbs && breadcrumbs.length > 0 ? (
          <nav aria-label="Breadcrumb" className="mb-2">
            <ol className="flex flex-wrap items-center gap-1.5 text-xs text-slate-500 font-sans">
              {breadcrumbs.map((crumb, index) => (
                <li key={`${crumb.label}-${index}`} className="flex items-center gap-1.5">
                  {index > 0 ? (
                    <ChevronRightIcon size={12} className="text-slate-400" aria-hidden="true" />
                  ) : null}
                  {crumb.href ? (
                    <Link href={crumb.href} className="rounded hover:text-amber-700 hover:underline transition-colors font-medium">
                      {crumb.label}
                    </Link>
                  ) : (
                    <span className="text-slate-800 font-semibold">{crumb.label}</span>
                  )}
                </li>
              ))}
            </ol>
          </nav>
        ) : null}

        <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-3">
          <div className="min-w-0">
            <h1 className="font-display text-2xl md:text-3xl font-bold tracking-tight text-slate-900">{title}</h1>
            {description ? (
              <p className="mt-1.5 max-w-4xl text-sm leading-relaxed text-slate-600 font-sans">
                {description}
              </p>
            ) : null}
          </div>
          {actions ? <div className="flex shrink-0 items-center gap-2.5">{actions}</div> : null}
        </div>

        {children ? <div className="mt-4">{children}</div> : null}
      </div>
    </div>
  );
}
