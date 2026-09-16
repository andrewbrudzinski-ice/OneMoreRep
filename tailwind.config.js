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

        // --- Performance-dashboard palette (navy-black + lime) ---------------
        ground: '#0A0D12', // page ground (deep navy-black)
        surface: '#12161D', // panel surface (raised one step off ground)
        feature: '#161B22', // feature/hero panel (a step brighter than surface)
        surface2: '#1A1F27', // inset tracks / nested wells / chart tracks
        surface3: '#232A33', // hover / active tile / raised control
        tickoff: '#2B333D', // unfilled gauge ticks / faint scale marks
        ink: '#F0F3F7', // primary text
        ink2: '#9BA5B0', // secondary text
        ink3: '#6C7681', // tertiary / micro-labels
        ink4: '#525A63', // quaternary / demoted
        ink5: '#3C434C', // disabled / faintest
        // Border weights (over the dark ground) — used as border-hairline etc.
        hairline: 'rgba(255,255,255,0.06)', // faint internal dividers
        line: 'rgba(255,255,255,0.10)', // default panel border
        'line-strong': 'rgba(255,255,255,0.17)', // emphasis / hover border
        accent: {
          DEFAULT: '#8FE81E', // electric lime
          hover: '#A5F13C',
          press: '#7ACC15',
          soft: 'rgba(143,232,30,0.12)', // tinted accent wash
          muted: '#5E7A2E', // in-progress macro bar fill
          muted2: '#41562A', // non-top muscle-volume bar fill
        },
        'on-accent': '#0B0E13',
        moderate: '#F2B33D', // moderate readiness / matched
        fatigued: '#FB923C', // fatigued readiness / error
      },
      borderRadius: {
        panel: '14px', // top-level bordered panels
        tile: '10px', // nested metric tiles / wells
        control: '8px', // buttons, inputs, chips
      },
      boxShadow: {
        // Restrained elevation: a soft drop + a 1px inset top highlight so
        // panels read as lifted off the ground without gradients or glow.
        panel: '0 1px 2px 0 rgba(0,0,0,0.45), inset 0 1px 0 0 rgba(255,255,255,0.035)',
        raised: '0 4px 14px -4px rgba(0,0,0,0.55), inset 0 1px 0 0 rgba(255,255,255,0.05)',
        well: 'inset 0 1px 2px 0 rgba(0,0,0,0.4)',
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
