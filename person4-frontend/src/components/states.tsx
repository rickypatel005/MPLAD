'use client';

import type { ReactNode } from 'react';

import { AlertTriangleIcon, FilterIcon, RefreshIcon, SpinnerIcon } from '@/components/icons';
import { cn } from '@/lib/cn';
import { STATE_COPY } from '@/lib/copy';

/**
 * Loading, empty and error states.
 *
 * Every data-fetching component must implement all three (Design Doc §6). The demo
 * is driven by live clicks in front of judges, so a blank panel or an unlabelled
 * spinner is a failure mode, not a cosmetic issue:
 *
 * - Loading uses **skeletons shaped like the content**, so the layout does not jump
 *   when data lands and the screen never looks broken mid-fetch.
 * - Empty states say which filter caused the emptiness and offer a way out.
 * - Errors always expose an explicit retry — never a silent failure — and state
 *   that filters were preserved, so the presenter can recover in one click.
 */

// ---------------------------------------------------------------------------
// Loading
// ---------------------------------------------------------------------------

/** Skeleton shaped like a dense table: header row plus `rows` body rows. */
export function TableSkeleton({
  rows = 8,
  columns = 6,
  className,
}: {
  rows?: number;
  columns?: number;
  className?: string;
}) {
  return (
    <div className={cn('w-full', className)} role="status" aria-label={STATE_COPY.loading.title}>
      <div className="flex gap-3 border-b border-line-strong bg-surface-sunken px-3 py-2">
        {Array.from({ length: columns }).map((_, i) => (
          <div key={i} className="skeleton h-3 flex-1" />
        ))}
      </div>
      {Array.from({ length: rows }).map((_, r) => (
        <div key={r} className="flex gap-3 border-b border-line-subtle px-3 py-2.5">
          {Array.from({ length: columns }).map((_, c) => (
            <div
              key={c}
              className="skeleton h-3.5 flex-1"
              style={{ opacity: 1 - r * (0.5 / Math.max(rows, 1)) }}
            />
          ))}
        </div>
      ))}
      <span className="sr-only">{STATE_COPY.loading.body}</span>
    </div>
  );
}

/** Skeleton shaped like a chart or map panel. */
export function BlockSkeleton({
  height = 280,
  label = STATE_COPY.loading.title,
  className,
}: {
  height?: number;
  label?: string;
  className?: string;
}) {
  return (
    <div
      role="status"
      aria-label={label}
      className={cn('skeleton w-full', className)}
      style={{ height }}
    >
      <span className="sr-only">{STATE_COPY.loading.body}</span>
    </div>
  );
}

/** Skeleton shaped like a row of KPI cards. */
export function CardsSkeleton({ count = 4, className }: { count?: number; className?: string }) {
  return (
    <div
      role="status"
      aria-label={STATE_COPY.loading.title}
      className={cn('grid gap-3', className)}
      style={{ gridTemplateColumns: `repeat(${count}, minmax(0, 1fr))` }}
    >
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="panel p-4">
          <div className="skeleton h-2.5 w-24" />
          <div className="skeleton mt-3 h-7 w-20" />
          <div className="skeleton mt-3 h-2.5 w-full" />
        </div>
      ))}
      <span className="sr-only">{STATE_COPY.loading.body}</span>
    </div>
  );
}

/** Inline spinner with a label, for in-place refreshes where a skeleton would flash. */
export function InlineLoading({ label = 'Loading', className }: { label?: string; className?: string }) {
  return (
    <span
      role="status"
      className={cn('inline-flex items-center gap-2 text-caption text-ink-subtle', className)}
    >
      <SpinnerIcon size={13} />
      {label}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Empty
// ---------------------------------------------------------------------------

export function EmptyState({
  title = STATE_COPY.empty.title,
  body = STATE_COPY.empty.body,
  actionLabel,
  onAction,
  icon,
  className,
}: {
  title?: string;
  body?: string;
  actionLabel?: string;
  onAction?: () => void;
  icon?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center gap-2 px-6 py-12 text-center',
        className,
      )}
    >
      <span className="text-ink-faint">{icon ?? <FilterIcon size={22} />}</span>
      <p className="text-card-title font-semibold text-ink">{title}</p>
      <p className="max-w-md text-body-sm leading-relaxed text-ink-muted">{body}</p>
      {actionLabel && onAction ? (
        <button type="button" onClick={onAction} className="btn-secondary mt-2">
          {actionLabel}
        </button>
      ) : null}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Error
// ---------------------------------------------------------------------------

export function ErrorState({
  title = STATE_COPY.error.title,
  body = STATE_COPY.error.body,
  detail,
  onRetry,
  className,
}: {
  title?: string;
  body?: string;
  /** Technical detail, e.g. the status code. Shown small — useful when debugging live. */
  detail?: string;
  onRetry?: () => void;
  className?: string;
}) {
  return (
    <div
      role="alert"
      className={cn(
        'flex flex-col items-center justify-center gap-2 px-6 py-12 text-center',
        className,
      )}
    >
      <AlertTriangleIcon size={22} className="text-risk-high" />
      <p className="text-card-title font-semibold text-ink">{title}</p>
      <p className="max-w-md text-body-sm leading-relaxed text-ink-muted">{body}</p>
      {detail ? (
        <p className="max-w-md break-words font-mono text-meta text-ink-faint">{detail}</p>
      ) : null}
      {onRetry ? (
        <button type="button" onClick={onRetry} className="btn-secondary mt-2">
          <RefreshIcon size={14} />
          {STATE_COPY.error.action}
        </button>
      ) : null}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Composition helper
// ---------------------------------------------------------------------------

export interface AsyncBoundaryProps {
  isLoading: boolean;
  isError: boolean;
  error?: unknown;
  isEmpty?: boolean;
  onRetry?: () => void;
  /** Rendered while loading — pass a skeleton shaped like the real content. */
  loadingFallback: ReactNode;
  emptyTitle?: string;
  emptyBody?: string;
  onClearFilters?: () => void;
  children: ReactNode;
}

/**
 * Renders exactly one of loading / error / empty / content.
 *
 * Using this at every fetch site is what makes "no blank screens" enforceable
 * rather than a thing each page remembers to do.
 */
export function AsyncBoundary({
  isLoading,
  isError,
  error,
  isEmpty = false,
  onRetry,
  loadingFallback,
  emptyTitle,
  emptyBody,
  onClearFilters,
  children,
}: AsyncBoundaryProps) {
  if (isLoading) return <>{loadingFallback}</>;

  if (isError) {
    return (
      <ErrorState
        detail={error instanceof Error ? error.message : undefined}
        onRetry={onRetry}
      />
    );
  }

  if (isEmpty) {
    return (
      <EmptyState
        title={emptyTitle}
        body={emptyBody}
        actionLabel={onClearFilters ? STATE_COPY.empty.action : undefined}
        onAction={onClearFilters}
      />
    );
  }

  return <>{children}</>;
}
