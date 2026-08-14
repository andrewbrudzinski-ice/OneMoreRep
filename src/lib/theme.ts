/**
 * The app ships dark-only. This pins the document to the dark palette and the
 * matching chrome color regardless of any stored preference. Kept as a function
 * (and the `theme` setting is kept in the data model) so a future light ramp
 * can reintroduce a real choice without a migration.
 */
export function applyTheme(): void {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  root.classList.add('dark');
  root.style.colorScheme = 'dark';

  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', '#0D1014');
}
