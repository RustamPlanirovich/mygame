/** @type {import('tailwindcss').Config} */

/*
 * DESIGN SYSTEM
 * -------------
 * The codebase mixes two palettes: ~1500 uses of `cyber-*` tokens and ~2450 uses of
 * stock Tailwind families (730 gray, 346 slate, plus 14 more). Rather than rewrite
 * every component by hand, the stock families are retuned to one harmonised ramp so
 * existing markup lands inside the design system automatically.
 *
 * Rules:
 *  - `gray`/`slate`/`zinc`/`neutral`/`stone` all alias one blue-shifted neutral ramp (`ink`).
 *  - accent families keep their Tailwind names but are retuned to a consistent
 *    saturation/lightness curve so nothing clashes.
 *  - every `cyber-*` name that appears anywhere in src/ is defined here, including the
 *    four that were referenced but never defined (border/muted/accent/bg-dark).
 */

// Neutral ink ramp — cool, slightly blue, never pure black (pure black crushes detail
// and makes elevation impossible to read).
const ink = {
  50: '#eef1f7',
  100: '#d7dce7',
  200: '#b3bccd',
  300: '#8b96ac',
  400: '#66718a',
  500: '#4a5468',
  600: '#353d4e',
  700: '#272e3c',
  750: '#202632',
  800: '#1a1f29',
  850: '#141821',
  900: '#0f131b',
  925: '#0b0e15',
  950: '#070910',
};

// Mint-emerald primary. Toned down from the original acid #00ff9d, which reads as a
// 1999 terminal rather than a modern game UI.
const mint = {
  50: '#e6fff5',
  100: '#c2ffe8',
  200: '#8dfdd3',
  300: '#55f5bb',
  400: '#2ce8a5',
  500: '#12cf8c',
  600: '#06a771',
  700: '#07835b',
  800: '#0a6749',
  900: '#0a553d',
  950: '#01301f',
};

// Sky/azure secondary.
const azure = {
  50: '#ecf7ff',
  100: '#d3edff',
  200: '#b0e0ff',
  300: '#7bceff',
  400: '#3eb2ff',
  500: '#1691f5',
  600: '#0872d2',
  700: '#0a5aa9',
  800: '#0e4c8b',
  900: '#124073',
  950: '#0c2849',
};

// Rose danger (replaces the fully-saturated #ff0055).
const rose = {
  50: '#fff1f3',
  100: '#ffe0e5',
  200: '#ffc6cf',
  300: '#ff9dad',
  400: '#ff647f',
  500: '#f93b5c',
  600: '#e61a43',
  700: '#c11038',
  800: '#a11136',
  900: '#8a1134',
  950: '#4d0417',
};

const amber = {
  50: '#fffaeb',
  100: '#fff1c6',
  200: '#ffe088',
  300: '#ffc94a',
  400: '#ffb31f',
  500: '#f99207',
  600: '#dd6b02',
  700: '#b74b06',
  800: '#943a0c',
  900: '#7a300d',
  950: '#461702',
};

const violet = {
  50: '#f4f2ff',
  100: '#ebe7ff',
  200: '#d9d2ff',
  300: '#bdaeff',
  400: '#9d80ff',
  500: '#8250fc',
  600: '#742ef3',
  700: '#651cdf',
  800: '#5419bb',
  900: '#471899',
  950: '#2a0c68',
};

export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        // ---- unified neutral ramp: gray and slate are the same thing now ----
        ink,
        gray: ink,
        slate: ink,
        zinc: ink,
        neutral: ink,
        stone: ink,

        // ---- accent families, retuned but keeping their Tailwind names ----
        green: mint,
        emerald: mint,
        lime: mint,
        teal: mint,
        cyan: azure,
        blue: azure,
        sky: azure,
        indigo: violet,
        purple: violet,
        violet,
        fuchsia: violet,
        red: rose,
        rose,
        pink: rose,
        yellow: amber,
        amber,
        orange: amber,

        // ---- legacy cyber-* tokens (kept so ~1500 existing usages still work) ----
        'cyber-black': ink[950],
        'cyber-darker': ink[925],
        'cyber-dark': ink[850],
        /*
         * cyber-gray and cyber-green are used BOTH flat (`bg-cyber-gray`) and with numeric
         * shades (`bg-cyber-gray-800`, `text-cyber-green-400`). Only the flat form was defined,
         * so 228 numbered usages across src/ resolved to nothing — the entire Аналитика panel
         * rendered with no background and no text colour at all. `DEFAULT` keeps the flat form
         * working while adding the scale.
         *
         * The scale is INVERTED relative to `ink` on purpose: this codebase writes
         * `bg-cyber-gray-900` for the darkest surface and `text-cyber-gray-100` for the
         * brightest text, i.e. Tailwind's dark-theme convention, whereas `ink` is ordered
         * light-to-dark like a normal Tailwind ramp.
         */
        'cyber-gray': {
          DEFAULT: ink[700],
          100: ink[100],
          200: ink[200],
          300: ink[300],
          400: ink[400],
          500: ink[500],
          600: ink[600],
          700: ink[700],
          800: ink[800],
          900: ink[900],
        },
        'cyber-gray-light': ink[400],
        'cyber-green': {
          DEFAULT: mint[400],
          400: mint[400],
          600: mint[600],
        },
        'cyber-blue': azure[400],
        'cyber-red': rose[400],
        'cyber-yellow': amber[300],
        // Used by CurrencyPanel and SettingsPanel but never defined before, so those
        // elements silently rendered with no colour.
        'cyber-purple': violet[400],
        'cyber-text': ink[50],
        'cyber-text-dim': ink[300],

        // ---- tokens referenced in src/ but never defined before (67 dead usages) ----
        'cyber-border': ink[700],
        'cyber-muted': ink[400],
        'cyber-accent': mint[400],
        'cyber-bg-dark': ink[900],

        // ---- semantic tokens for new code ----
        surface: {
          base: ink[950],
          1: ink[925],
          2: ink[850],
          3: ink[800],
          4: ink[750],
          raised: ink[700],
        },
        edge: {
          subtle: 'rgb(255 255 255 / 0.06)',
          DEFAULT: ink[700],
          strong: ink[600],
          accent: 'rgb(44 232 165 / 0.35)',
        },
        content: {
          primary: ink[50],
          secondary: ink[200],
          muted: ink[300],
          faint: ink[400],
          inverse: ink[950],
        },
        accent: {
          DEFAULT: mint[400],
          hover: mint[300],
          press: mint[500],
          soft: 'rgb(44 232 165 / 0.12)',
        },
        info: { DEFAULT: azure[400], soft: 'rgb(62 178 255 / 0.12)' },
        success: { DEFAULT: mint[400], soft: 'rgb(44 232 165 / 0.12)' },
        warning: { DEFAULT: amber[300], soft: 'rgb(255 201 74 / 0.12)' },
        danger: { DEFAULT: rose[400], soft: 'rgb(255 100 127 / 0.12)' },
      },

      fontFamily: {
        // Body text is UI sans now. Monospace body text was the single biggest thing
        // making the game read as dated; mono is reserved for numbers and data.
        sans: [
          'Inter var',
          'Inter',
          '-apple-system',
          'BlinkMacSystemFont',
          '"Segoe UI"',
          'Roboto',
          '"Helvetica Neue"',
          'Arial',
          '"Noto Sans"',
          'sans-serif',
          '"Apple Color Emoji"',
          '"Segoe UI Emoji"',
        ],
        mono: [
          'ui-monospace',
          'SFMono-Regular',
          '"SF Mono"',
          'Menlo',
          'Consolas',
          '"Liberation Mono"',
          '"Roboto Mono"',
          'monospace',
        ],
        display: [
          'Inter var',
          'Inter',
          '-apple-system',
          'BlinkMacSystemFont',
          '"Segoe UI"',
          'sans-serif',
        ],
      },

      fontSize: {
        // 227 uses of text-[10px] and 40 of text-[9px] exist; these give them names and
        // a readable line-height instead of inheriting a cramped one.
        '3xs': ['0.5625rem', { lineHeight: '0.875rem', letterSpacing: '0.01em' }], // 9px
        '2xs': ['0.625rem', { lineHeight: '0.9375rem', letterSpacing: '0.01em' }], // 10px
        xs: ['0.6875rem', { lineHeight: '1rem' }], // 11px
        sm: ['0.8125rem', { lineHeight: '1.25rem' }], // 13px
        base: ['0.9375rem', { lineHeight: '1.5rem' }], // 15px
      },

      borderRadius: {
        DEFAULT: '0.375rem',
        md: '0.5rem',
        lg: '0.625rem',
        xl: '0.875rem',
        '2xl': '1.125rem',
      },

      boxShadow: {
        // Depth comes from a layered ambient shadow plus a 1px inner top highlight,
        // which is what makes a dark UI feel physical rather than flat.
        'elev-1': '0 1px 2px rgb(0 0 0 / 0.35), inset 0 1px 0 rgb(255 255 255 / 0.04)',
        'elev-2':
          '0 2px 6px rgb(0 0 0 / 0.4), 0 1px 2px rgb(0 0 0 / 0.3), inset 0 1px 0 rgb(255 255 255 / 0.05)',
        'elev-3':
          '0 8px 24px -6px rgb(0 0 0 / 0.55), 0 2px 6px rgb(0 0 0 / 0.35), inset 0 1px 0 rgb(255 255 255 / 0.06)',
        'elev-4':
          '0 20px 48px -12px rgb(0 0 0 / 0.7), 0 4px 12px rgb(0 0 0 / 0.4), inset 0 1px 0 rgb(255 255 255 / 0.07)',
        'glow-accent': '0 0 0 1px rgb(44 232 165 / 0.35), 0 0 18px -2px rgb(44 232 165 / 0.35)',
        'glow-info': '0 0 0 1px rgb(62 178 255 / 0.35), 0 0 18px -2px rgb(62 178 255 / 0.35)',
        'glow-danger': '0 0 0 1px rgb(255 100 127 / 0.35), 0 0 18px -2px rgb(255 100 127 / 0.35)',
        'inner-top': 'inset 0 1px 0 rgb(255 255 255 / 0.06)',
      },

      backgroundImage: {
        'grid-fade': 'linear-gradient(to bottom, rgb(255 255 255 / 0.03), transparent 60%)',
        'accent-sheen':
          'linear-gradient(135deg, rgb(44 232 165 / 0.16), rgb(62 178 255 / 0.08) 55%, transparent)',
        'danger-sheen': 'linear-gradient(135deg, rgb(255 100 127 / 0.16), transparent)',
      },

      transitionTimingFunction: {
        // Ease-out with no overshoot: responsive without being bouncy.
        snap: 'cubic-bezier(0.2, 0.8, 0.2, 1)',
      },

      keyframes: {
        'fade-in': { from: { opacity: '0' }, to: { opacity: '1' } },
        'slide-up': {
          from: { opacity: '0', transform: 'translateY(8px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        'slide-in-right': {
          from: { opacity: '0', transform: 'translateX(24px)' },
          to: { opacity: '1', transform: 'translateX(0)' },
        },
        'scale-in': {
          from: { opacity: '0', transform: 'scale(0.96)' },
          to: { opacity: '1', transform: 'scale(1)' },
        },
        'pulse-glow': {
          '0%, 100%': { boxShadow: '0 0 0 1px rgb(44 232 165 / 0.25)' },
          '50%': {
            boxShadow: '0 0 0 1px rgb(44 232 165 / 0.5), 0 0 20px -2px rgb(44 232 165 / 0.45)',
          },
        },
        shimmer: { '100%': { transform: 'translateX(100%)' } },
        countdown: { from: { width: '100%' }, to: { width: '0%' } },
      },

      animation: {
        'fade-in': 'fade-in 0.2s ease-out both',
        'slide-up': 'slide-up 0.24s cubic-bezier(0.2,0.8,0.2,1) both',
        'slide-in-right': 'slide-in-right 0.26s cubic-bezier(0.2,0.8,0.2,1) both',
        'scale-in': 'scale-in 0.18s cubic-bezier(0.2,0.8,0.2,1) both',
        'pulse-glow': 'pulse-glow 2.4s ease-in-out infinite',
        shimmer: 'shimmer 1.4s infinite',
        countdown: 'countdown 10s linear forwards',
      },
    },
  },
  plugins: [],
};
