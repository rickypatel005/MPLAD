'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

import { NAV_ICONS } from '@/components/icons';
import { cn } from '@/lib/cn';
import { NAV_ITEMS, isNavItemActive } from '@/lib/nav';

/**
 * Primary navigation — exactly the six top-level destinations.
 *
 * Project Investigation is intentionally not here: it is only ever reached by
 * drilling into a specific project (Design Doc §3). While on a project page the
 * Dashboard tab stays marked as the active section, so the presenter always sees
 * where in the product they are.
 *
 * Rendered as a tab list with `aria-current="page"` on the active item, so the
 * active state is announced rather than only shown.
 */
export function MainNav() {
  const pathname = usePathname();

  return (
    <nav aria-label="Primary" className="border-b border-slate-200 bg-white shadow-sm sticky top-0 z-30">
      <ul className="mx-auto flex max-w-shell items-stretch gap-1 px-6">
        {NAV_ITEMS.map((item) => {
          const active = isNavItemActive(item, pathname);
          const Icon = NAV_ICONS[item.icon];
          return (
            <li key={item.href} className="flex">
              <Link
                href={item.href}
                aria-current={active ? 'page' : undefined}
                title={item.description}
                className={cn(
                  'flex items-center gap-2 border-b-2 px-4 py-3 text-sm font-semibold font-sans transition-all duration-150',
                  active
                    ? 'border-amber-500 text-slate-900 bg-amber-500/10'
                    : 'border-transparent text-slate-600 hover:border-slate-300 hover:text-slate-900 hover:bg-slate-50',
                )}
              >
                <Icon size={16} className={active ? 'text-amber-600' : 'text-slate-400'} />
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
