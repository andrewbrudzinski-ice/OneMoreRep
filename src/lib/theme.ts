import type { Theme } from '../types';

/**
 * Apply the chosen theme to the document root. The app is dark-first; this
 * toggles the Tailwind `dark` class and the CSS color-scheme so the setting
 * persists and native controls match.
 */
export function applyTheme(theme: Theme): void {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  const prefersDark =
    typeof window !== 'undefined' &&
    window.matchMedia?.('(prefers-color-scheme: dark)').matches !== false;
  const dark = theme === 'dark' || (theme === 'system' && prefersDark);
  root.classList.toggle('dark', dark);
  root.style.colorScheme = dark ? 'dark' : 'light';
}
