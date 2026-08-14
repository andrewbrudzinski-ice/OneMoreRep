/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // The slate scale is driven by CSS variables (see index.css) so the
        // whole UI flips between light and dark by inverting the scale — no
        // per-component color changes needed.
        slate: {
          50: 'rgb(var(--s-50) / <alpha-value>)',
          100: 'rgb(var(--s-100) / <alpha-value>)',
          200: 'rgb(var(--s-200) / <alpha-value>)',
          300: 'rgb(var(--s-300) / <alpha-value>)',
          400: 'rgb(var(--s-400) / <alpha-value>)',
          500: 'rgb(var(--s-500) / <alpha-value>)',
          600: 'rgb(var(--s-600) / <alpha-value>)',
          700: 'rgb(var(--s-700) / <alpha-value>)',
          800: 'rgb(var(--s-800) / <alpha-value>)',
          900: 'rgb(var(--s-900) / <alpha-value>)',
          950: 'rgb(var(--s-950) / <alpha-value>)',
        },
        // Semantic status colors for the "Beat Last Time" engine. `beat` /
        // `onaccent` follow the theme via CSS vars so the existing slate-based
        // screens recolor for free; the fixed tokens below are the redesign's
        // exact graphite/lime palette (dark-only), used by the rebuilt screens.
        beat: 'rgb(var(--accent) / <alpha-value>)', // accent — beat last time
        onaccent: 'rgb(var(--on-accent) / <alpha-value>)', // legible text on the accent
        matched: '#f59e0b', // amber — matched (fine on both themes)
        down: '#94a3b8', // neutral grey — down (never red)

        // --- Redesign palette (Modernist / "Chase Green") ---------------------
        ground: '#0D1014', // page ground
        surface: '#14181D', // raised surface (readiness, nutrition calories)
        surface2: '#1B2027', // progress-bar & chart tracks
        ink: '#F2F4F3', // primary text
        ink2: '#98A0A6', // secondary text
        ink3: '#626A71', // tertiary / micro-labels
        ink4: '#4E555C', // quaternary / demoted
        ink5: '#3D444B', // disabled / faintest
        accent: {
          DEFAULT: '#8FE81E', // electric lime
          hover: '#A5F13C',
          press: '#7ACC15',
          muted: '#5E7A2E', // in-progress macro bar fill
          muted2: '#4E6B26', // non-top muscle-volume bar fill
        },
        'on-accent': '#0D1014',
        moderate: '#F2B33D', // moderate readiness / matched
        fatigued: '#FB923C', // fatigued readiness / error
      },
      fontFamily: {
        sans: [
          'Archivo',
          'system-ui',
          '-apple-system',
          'Segoe UI',
          'Roboto',
          'Helvetica',
          'Arial',
          'sans-serif',
        ],
      },
    },
  },
  plugins: [],
};
