'use client';

import {
  flexRender,
  getCoreRowModel,
  useReactTable,
  type ColumnDef,
} from '@tanstack/react-table';
import { useRouter } from 'next/navigation';
import { useMemo, type ReactNode } from 'react';

import type { PageMeta, SortOrder } from '@/types/api';
import { ArrowDownIcon, ArrowUpIcon } from '@/components/icons';
import { cn } from '@/lib/cn';
import { formatCount } from '@/lib/format';
import { PAGE_SIZE_OPTIONS } from '@/types/query';

/**
 * The dense table shell used by every list on every screen.
 *
 * Paging, sorting and filtering all happen on the server (TRD §9.3). The dataset is
 * 10,000–50,000 works and the brief is explicit that the browser must never hold all of
 * them, so this component is deliberately incapable of sorting or filtering: it renders the
 * page it was given and reports clicks upward, where they become URL parameters and then a
 * request. `manualSorting` and `manualPagination` say so to the table library as well, which
 * is what stops it from quietly re-sorting the 25 rows it can see and showing a different
 * order from the one the header claims.
 *
 * Columns are described with the local `Column<T>` shape rather than the library's accessor
 * definitions. Every cell here is a composed render — a risk badge beside a label, a truncated
 * description with a tooltip, a formatted currency figure — so there is nothing for an
 * accessor to earn, and display columns keep the whole surface free of `any`.
 */

export interface Column<T> {
  /** Stable id, also used as the React key. */
  id: string;
  header: string;
  /** Renders the cell. Compose freely; the table adds no formatting of its own. */
  cell: (row: T) => ReactNode;
  /**
   * URL sort field. Omitted for columns the API cannot sort by — a header that looks
   * sortable but silently does nothing is worse than one that does not invite the click.
   */
  sortField?: string;
  /** Right-aligns and tabular-aligns the column; numeric columns default to descending. */
  numeric?: boolean;
  /** Tailwind width class, e.g. "w-24". */
  width?: string;
  /** Shown as the header's tooltip, for columns whose meaning needs a sentence. */
  hint?: string;
}

export interface DataTableProps<T> {
  /** Memoise at the call site: a new array each render remounts the table model. */
  columns: readonly Column<T>[];
  data: readonly T[];
  /** Server-reported page metadata. */
  page: PageMeta;
  sortBy?: string;
  order?: SortOrder;
  onSort?: (field: string, order: SortOrder) => void;
  onPageChange: (page: number) => void;
  onPageSizeChange?: (pageSize: number) => void;
  /** Row identity. Falls back to the array index, which is stable within a page. */
  rowKey?: (row: T) => string;
  /** Primary drill-down for the row. Also rendered as a real link in the first cell. */
  rowHref?: (row: T) => string;
  /** Tints a row — used to make the demo's flagged works findable at a glance. */
  rowEmphasis?: (row: T) => boolean;
  /** Describes the table for screen readers. Required, not decorative. */
  caption: string;
  /** Noun for the pager, e.g. "works", "alerts", "candidate pairs". */
  unitLabel?: string;
  /** True during a background refetch: dims the body without collapsing the layout. */
  isFetching?: boolean;
  /** Caps the scroll area and pins the header to the top of it. */
  maxHeight?: number;
  /**
   * Shown in place of rows when the page is empty. A header with nothing beneath it reads as
   * a broken screen rather than as a filter that matched nothing, so this is never omitted —
   * the default says what happened and what to do about it.
   */
  emptyState?: ReactNode;
  /**
   * Hides the pager. For fixed-length panels — the dashboard's Top 10, a project's five
   * nearest comparables — where the list is the whole answer and a pager would imply
   * there is more to page through.
   */
  showPager?: boolean;
  className?: string;
}

export function DataTable<T>({
  columns,
  data,
  page,
  sortBy,
  order = 'desc',
  onSort,
  onPageChange,
  onPageSizeChange,
  rowKey,
  rowHref,
  rowEmphasis,
  caption,
  unitLabel = 'rows',
  isFetching = false,
  maxHeight,
  emptyState,
  showPager = true,
  className,
}: DataTableProps<T>) {
  const router = useRouter();

  const columnDefs = useMemo<ColumnDef<T>[]>(
    () =>
      columns.map((column) => ({
        id: column.id,
        header: column.header,
        cell: ({ row }) => column.cell(row.original),
      })),
    [columns],
  );

  const rows = useMemo(() => [...data], [data]);

  const table = useReactTable({
    data: rows,
    columns: columnDefs,
    getCoreRowModel: getCoreRowModel(),
    // The server owns both. Stated explicitly so the library never reorders or slices the
    // page it was handed.
    manualSorting: true,
    manualPagination: true,
    getRowId: rowKey ? (row) => rowKey(row) : undefined,
  });

  const byId = new Map(columns.map((column) => [column.id, column]));

  return (
    <div className={cn('flex flex-col', className)}>
      <div
        className={cn('relative overflow-auto', isFetching && 'opacity-60')}
        style={maxHeight === undefined ? undefined : { maxHeight }}
        aria-busy={isFetching}
      >
        <table className="data-table">
          <caption className="sr-only">{caption}</caption>
          <thead>
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id}>
                {headerGroup.headers.map((header) => {
                  const column = byId.get(header.column.id);
                  const sortField = column?.sortField;
                  const sortable = sortField !== undefined && onSort !== undefined;
                  const isActive = sortField !== undefined && sortField === sortBy;
                  const label = flexRender(header.column.columnDef.header, header.getContext());

                  return (
                    <th
                      key={header.id}
                      scope="col"
                      className={cn(
                        column?.width,
                        column?.numeric && 'text-right',
                        maxHeight !== undefined && 'sticky top-0 z-10 bg-surface-sunken',
                      )}
                      title={column?.hint}
                      aria-sort={
                        isActive
                          ? order === 'asc'
                            ? 'ascending'
                            : 'descending'
                          : sortable
                            ? 'none'
                            : undefined
                      }
                    >
                      {sortable ? (
                        <button
                          type="button"
                          onClick={() =>
                            onSort(sortField, nextOrder(isActive, order, column?.numeric ?? false))
                          }
                          className={cn(
                            'group inline-flex items-center gap-1 uppercase tracking-wider hover:text-gov-600',
                            column?.numeric && 'flex-row-reverse',
                            isActive && 'text-gov-700',
                          )}
                        >
                          {label}
                          <SortIndicator active={isActive} order={order} />
                        </button>
                      ) : (
                        label
                      )}
                    </th>
                  );
                })}
              </tr>
            ))}
          </thead>

          <tbody>
            {table.getRowModel().rows.map((row) => {
              const href = rowHref?.(row.original);
              const emphasised = rowEmphasis?.(row.original) ?? false;

              return (
                <tr
                  key={row.id}
                  className={cn(
                    emphasised && 'bg-gov-50/70',
                    href !== undefined && 'cursor-pointer',
                  )}
                  // Mouse convenience only. The row is not focusable and carries no link
                  // role: the first cell holds a real anchor, so keyboard and screen-reader
                  // users get one unambiguous target instead of a second, silent tab stop.
                  onClick={
                    href === undefined
                      ? undefined
                      : (event) => {
                          if (event.defaultPrevented) return;
                          const target = event.target;
                          // Let genuine controls inside the row handle their own clicks.
                          if (target instanceof HTMLElement && target.closest('a,button,input')) {
                            return;
                          }
                          // Client-side navigation: a full page load here would throw away
                          // the query cache and re-fetch the dashboard behind the drill-down.
                          router.push(href);
                        }
                  }
                >
                  {row.getVisibleCells().map((cell) => {
                    const column = byId.get(cell.column.id);
                    return (
                      <td
                        key={cell.id}
                        className={cn(column?.numeric && 'tabular text-right')}
                      >
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </td>
                    );
                  })}
                </tr>
              );
            })}

            {table.getRowModel().rows.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="px-3 py-10 text-center">
                  {emptyState ?? (
                    <span className="text-body-sm text-ink-muted">
                      No {unitLabel} match the current filters. Widen the date range or remove a
                      filter to see more.
                    </span>
                  )}
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      {showPager ? (
        <Pagination
          page={page}
          unitLabel={unitLabel}
          onPageChange={onPageChange}
          onPageSizeChange={onPageSizeChange}
        />
      ) : null}
    </div>
  );
}

/**
 * Which direction a fresh click should sort.
 *
 * Clicking the active column flips it. Clicking a new one starts descending for numbers —
 * on this product every numeric column is a severity, a cost or a score, and the interesting
 * end is the top — and ascending for text, where alphabetical is what a reader expects.
 */
function nextOrder(isActive: boolean, current: SortOrder, numeric: boolean): SortOrder {
  if (isActive) return current === 'asc' ? 'desc' : 'asc';
  return numeric ? 'desc' : 'asc';
}

function SortIndicator({ active, order }: { active: boolean; order: SortOrder }) {
  if (!active) {
    return (
      <span aria-hidden="true" className="text-ink-faint opacity-0 transition-opacity group-hover:opacity-100">
        <ArrowDownIcon size={11} />
      </span>
    );
  }
  return (
    <span aria-hidden="true" className="text-gov-600">
      {order === 'asc' ? <ArrowUpIcon size={11} /> : <ArrowDownIcon size={11} />}
    </span>
  );
}

/**
 * Server-side pager.
 *
 * Always states the range against the total — "26–50 of 1,847 works" — because a page number
 * on its own tells a reviewer nothing about how much they have not looked at. The total is
 * the count *after* filtering, which is the number they actually need.
 */
export function Pagination({
  page,
  unitLabel = 'rows',
  onPageChange,
  onPageSizeChange,
  className,
}: {
  page: PageMeta;
  unitLabel?: string;
  onPageChange: (page: number) => void;
  onPageSizeChange?: (pageSize: number) => void;
  className?: string;
}) {
  const first = page.total_items === 0 ? 0 : (page.page - 1) * page.page_size + 1;
  const last = Math.min(page.page * page.page_size, page.total_items);
  const canPrevious = page.page > 1;
  const canNext = page.page < page.total_pages;

  return (
    <nav
      className={cn(
        'flex items-center justify-between gap-4 border-t border-line px-3 py-2',
        className,
      )}
      aria-label="Pagination"
    >
      <p className="tabular text-caption text-ink-muted" aria-live="polite">
        {page.total_items === 0 ? (
          `No ${unitLabel} match the current filters`
        ) : (
          <>
            Showing {formatCount(first)}–{formatCount(last)} of {formatCount(page.total_items)}{' '}
            {unitLabel}
          </>
        )}
      </p>

      <div className="flex items-center gap-3">
        {onPageSizeChange ? (
          <label className="flex items-center gap-1.5 text-caption text-ink-muted">
            Rows
            <select
              className="control h-7 py-0 pr-6 text-caption"
              value={page.page_size}
              onChange={(event) => onPageSizeChange(Number(event.target.value))}
            >
              {PAGE_SIZE_OPTIONS.map((size) => (
                <option key={size} value={size}>
                  {size}
                </option>
              ))}
            </select>
          </label>
        ) : null}

        <div className="flex items-center gap-1">
          <button
            type="button"
            className="btn-secondary h-7 px-2 text-caption"
            onClick={() => onPageChange(1)}
            disabled={!canPrevious}
          >
            First
          </button>
          <button
            type="button"
            className="btn-secondary h-7 px-2 text-caption"
            onClick={() => onPageChange(page.page - 1)}
            disabled={!canPrevious}
          >
            Previous
          </button>
          <span className="tabular px-2 text-caption text-ink-muted">
            Page {formatCount(page.page)} of {formatCount(page.total_pages)}
          </span>
          <button
            type="button"
            className="btn-secondary h-7 px-2 text-caption"
            onClick={() => onPageChange(page.page + 1)}
            disabled={!canNext}
          >
            Next
          </button>
          <button
            type="button"
            className="btn-secondary h-7 px-2 text-caption"
            onClick={() => onPageChange(page.total_pages)}
            disabled={!canNext}
          >
            Last
          </button>
        </div>
      </div>
    </nav>
  );
}
