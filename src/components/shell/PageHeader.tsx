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
    <div className={cn('border-b border-line bg-surface', className)}>
      <div className="mx-auto max-w-shell px-6 py-4">
        {breadcrumbs && breadcrumbs.length > 0 ? (
          <nav aria-label="Breadcrumb" className="mb-1.5">
            <ol className="flex flex-wrap items-center gap-1 text-caption text-ink-subtle">
              {breadcrumbs.map((crumb, index) => (
                <li key={`${crumb.label}-${index}`} className="flex items-center gap-1">
                  {index > 0 ? (
                    <ChevronRightIcon size={12} className="text-ink-faint" aria-hidden="true" />
                  ) : null}
                  {crumb.href ? (
                    <Link href={crumb.href} className="rounded hover:text-gov-600 hover:underline">
                      {crumb.label}
                    </Link>
                  ) : (
                    <span className="text-ink-muted">{crumb.label}</span>
                  )}
                </li>
              ))}
            </ol>
          </nav>
        ) : null}

        <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-3">
          <div className="min-w-0">
            <h1 className="text-page font-semibold text-ink">{title}</h1>
            {description ? (
              <p className="mt-1 max-w-4xl text-body-sm leading-relaxed text-ink-muted">
                {description}
              </p>
            ) : null}
          </div>
          {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
        </div>

        {children ? <div className="mt-4">{children}</div> : null}
      </div>
    </div>
  );
}
