/**
 * Minimal class-name joiner.
 *
 * Deliberately hand-written rather than pulling in clsx/classnames: the whole
 * behaviour we need is "drop falsy values and join with a space", and every
 * avoided dependency is one fewer thing that can fail to resolve at install time.
 */
export type ClassValue = string | number | false | null | undefined;

export function cn(...values: ClassValue[]): string {
  let out = '';
  for (const value of values) {
    if (!value && value !== 0) continue;
    out = out ? `${out} ${value}` : String(value);
  }
  return out;
}
