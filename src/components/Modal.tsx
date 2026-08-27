'use client';

import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactNode,
} from 'react';
import { createPortal } from 'react-dom';

import { CloseIcon } from '@/components/icons';
import { cn } from '@/lib/cn';

/**
 * The dialog primitive. Accessible by construction, because the alternative is a screen an
 * auditor cannot operate.
 *
 * Four obligations, all handled here so no caller has to remember them: focus moves into the
 * dialog on open and returns to the trigger on close, Tab cycles inside it, Escape and a
 * backdrop click both dismiss, and the surrounding page is inert to assistive technology via
 * `aria-modal`. Background scrolling is frozen, since a modal that scrolls the table behind it
 * loses the reviewer's place in a list of thousands.
 *
 * Rendered through a portal to `document.body`: the comparison dialog is opened from inside a
 * table cell, and a dialog nested in an overflow-scrolled container gets clipped by it.
 */

const FOCUSABLE_SELECTOR = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',');

export type ModalSize = 'md' | 'lg' | 'xl';

const SIZE_CLASS: Record<ModalSize, string> = {
  md: 'max-w-xl',
  lg: 'max-w-3xl',
  xl: 'max-w-[1120px]',
};

export interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  /** One line under the title: what this dialog is for, or what it is showing. */
  description?: ReactNode;
  /** Right-aligned actions. Verdict buttons, Close, Export. */
  footer?: ReactNode;
  children: ReactNode;
  size?: ModalSize;
  className?: string;
}

export function Modal({
  open,
  onClose,
  title,
  description,
  footer,
  children,
  size = 'lg',
  className,
}: ModalProps) {
  const titleId = useId();
  const descriptionId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  const restoreFocusRef = useRef<HTMLElement | null>(null);
  const [mounted, setMounted] = useState(false);

  // `document` does not exist during the server render, so the portal target is resolved
  // after hydration rather than at module scope.
  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open) return;

    restoreFocusRef.current =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    // Focus the panel itself rather than its first control: the reader should hear the
    // dialog's title before being dropped onto a button.
    panelRef.current?.focus();

    return () => {
      document.body.style.overflow = previousOverflow;
      restoreFocusRef.current?.focus();
    };
  }, [open]);

  const onKeyDown = useCallback(
    (event: ReactKeyboardEvent<HTMLDivElement>) => {
      if (event.key === 'Escape') {
        event.stopPropagation();
        onClose();
        return;
      }

      if (event.key !== 'Tab') return;

      const panel = panelRef.current;
      if (!panel) return;

      const focusable = Array.from(
        panel.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR),
      ).filter((element) => element.offsetParent !== null || element === panel);

      if (focusable.length === 0) {
        event.preventDefault();
        return;
      }

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const active = document.activeElement;

      if (!event.shiftKey && active === last) {
        event.preventDefault();
        first?.focus();
      } else if (event.shiftKey && (active === first || active === panel)) {
        event.preventDefault();
        last?.focus();
      }
    },
    [onClose],
  );

  if (!open || !mounted) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-900/70 backdrop-blur-sm px-6 py-10"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description === undefined ? undefined : descriptionId}
        tabIndex={-1}
        onKeyDown={onKeyDown}
        className={cn(
          'w-full rounded-2xl border border-slate-300 bg-white shadow-2xl outline-none overflow-hidden animate-fade-in',
          SIZE_CLASS[size],
          className,
        )}
      >
        <header className="flex items-start justify-between gap-4 border-b border-slate-200 bg-slate-50/80 px-6 py-4">
          <div>
            <h2 id={titleId} className="font-display text-xl font-bold text-slate-900">
              {title}
            </h2>
            {description === undefined ? null : (
              <p id={descriptionId} className="mt-1 text-xs text-slate-600 font-sans">
                {description}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="btn-ghost -mr-2 -mt-1 h-8 w-8 shrink-0 p-0 text-slate-500 hover:text-slate-900 hover:bg-slate-200/60 rounded-lg"
            aria-label="Close dialog"
          >
            <CloseIcon size={18} aria-hidden="true" />
          </button>
        </header>

        <div className="px-6 py-5 font-sans text-slate-800">{children}</div>

        {footer ? (
          <footer className="flex items-center justify-end gap-3 border-t border-slate-200 bg-slate-50 px-6 py-3.5 font-sans">
            {footer}
          </footer>
        ) : null}
      </div>
    </div>,
    document.body,
  );
}
