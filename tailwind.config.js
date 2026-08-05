/** @type {import('tailwindcss').Config} */

/*
 * DESIGN SYSTEM — Industry Idle dark
 * ----------------------------------
 * Modelled on https://play.industryidle.com (Dracula/Monokai themes): a soft
 * charcoal base rather than near-black, panels that sit *lighter* than the map,
 * hairline borders at ~10% of the foreground, 5px radii, and no glow anywhere.
 * Depth is read from the surface step alone — that is what keeps a dense idle-game
 * UI legible instead of noisy.
 *
 * The codebase mixes two palettes: ~1500 uses of `cyber-*` tokens and ~2450 uses of
 * stock Tailwind families (730 gray, 346 slate, plus 14 more). Rather than rewrite
 * every component by hand, the stock families are retuned to one harmonised ramp so
 * existing markup lands inside the design system automatically.
 *
 * Rules:
 *  - `gray`/`slate`/`zinc`/`neutral`/`stone` all alias one neutral ramp (`ink`).
 *  - accent families keep their Tailwind names but are retuned to Dracula hues plus
 *    the flat red/green/orange Industry Idle uses for its own states.
 *  - every `cyber-*` name that appears anywhere in src/ is defined here.
 */

// Neutral ink ramp. Built around Dracula's #282a36 background and #f8f8f2
// foreground — the palette Industry Idle's dark themes ship with. Never pure
// black: pure black crushes detail and makes elevation impossible to read.
const ink = {
  50: '#f8f8f2', // foreground
  100: '#e4e5ea',
  200: '#cbcdd8', // secondary text
  300: '#a6aabd', // muted text
  400: '#7f849f', // faint text
  500: '#6272a4', // Dracula "comment"
  600: '#4d5064', // strong edge
  700: '#3d3f4e', // edge / raised
  750: '#383a48', // surface 4 (hover)
  800: '#33353f', // surface 3 (card)
  850: '#2d2f3a', // surface 2 (panel)
  900: '#282a36', // Dracula background — the map surface
  925: '#242630', // surface 1
  950: '#1e1f28', // page backdrop
};

// Primary accent. Dracula green softened towards Industry Idle's own #2ecc71 so
// it holds up as a fill colour behind dark text.
const mint = {
  50: '#eafdf1',
  100: '#c9fadd',
  200: '#9bf4c0',
  300: '#6aeda1',
  400: '#3ee07f',
  500: '#2ecc71',
  600: '#22a75c',
  700: '#1c8449',
  800: '#19693c',
  900: '#165633',
  950: '#07301a',
};

// Informational cyan — Dracula #8be9fd, plus the #3dc5de the reference game uses
// for its own loading bar.
const azure = {
  50: '#effcff',
  100: '#d6f7ff',
  200: '#b3f0ff',
  300: '#8be9fd',
  400: '#5ed8f2',
  500: '#3dc5de',
  600: '#249fb9',
  700: '#1e7e93',
  800: '#1d6678',
  900: '#1c5563',
  950: '#0b3341',
};

// Danger — Dracula #ff5555 over Industry Idle's #e74c3c.
const rose = {
  50: '#fff1f0',
  100: '#ffdedb',
  200: '#ffc0bc',
  300: '#ff918c',
  400: '#ff5555',
  500: '#e74c3c',
  600: '#c93a2c',
  700: '#a53025',
  800: '#872a22',
  900: '#702622',
  950: '#3d100c',
};

// Warning — Dracula #ffb86c over Industry Idle's #f39c12.
const amber = {
  50: '#fff9ee',
  100: '#ffefd2',
  200: '#ffdda5',
  300: '#ffb86c',
  400: '#fca62f',
  500: '#f39c12',
  600: '#d17f0b',
  700: '#a8610c',
  800: '#894e11',
  900: '#714111',
  950: '#412106',
};

// Special / prestige — Dracula purple #bd93f9.
const violet = {
  50: '#f7f2ff',
  100: '#efe5ff',
  200: '#dfcdff',
  300: '#cdaefb',
  400: '#bd93f9',
  500: '#a370ef',
  600: '#8b4fe0',
  700: '#743cc4',
  800: '#6033a0',
  900: '#4f2d81',
  950: '#301656',
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
        // Industry Idle draws every divider as `rgba(foreground, 0.1)`; these are
        // the opaque equivalents over the panel surfaces plus the raw alpha form.
        edge: {
          subtle: 'rgb(248 248 242 / 0.07)',
          DEFAULT: ink[700],
          strong: ink[600],
          accent: 'rgb(62 224 127 / 0.35)',
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
          soft: 'rgb(62 224 127 / 0.12)',
        },
        info: { DEFAULT: azure[400], soft: 'rgb(94 216 242 / 0.12)' },
        success: { DEFAULT: mint[400], soft: 'rgb(62 224 127 / 0.12)' },
        warning: { DEFAULT: amber[300], soft: 'rgb(255 184 108 / 0.12)' },
        danger: { DEFAULT: rose[400], soft: 'rgb(255 85 85 / 0.12)' },
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

      // Industry Idle rounds boxes and buttons at 5px and dialogs at 10px. Small,
      // consistent radii are a large part of why its dense panels read as one sheet
      // rather than a pile of pills.
      borderRadius: {
        DEFAULT: '4px',
        md: '5px',
        lg: '5px',
        xl: '6px',
        '2xl': '10px',
      },

      boxShadow: {
        // The reference UI is flat: panels separate by surface step and hairline
        // border, not by shadow. Only things that genuinely float — the side panel,
        // dialogs, popovers — cast one, and it is a plain ambient drop with no
        // inner highlight.
        'elev-1': 'none',
        'elev-2': 'none',
        'elev-3': '0 0 10px rgb(0 0 0 / 0.5)',
        'elev-4': '0 0 24px rgb(0 0 0 / 0.6)',
        // Kept as names so old markup still compiles, but reduced to a flat ring.
        'glow-accent': '0 0 0 1px rgb(62 224 127 / 0.45)',
        'glow-info': '0 0 0 1px rgb(94 216 242 / 0.45)',
        'glow-danger': '0 0 0 1px rgb(255 85 85 / 0.45)',
        'inner-top': 'none',
      },

      backgroundImage: {
        'grid-fade': 'linear-gradient(to bottom, rgb(248 248 242 / 0.03), transparent 60%)',
        'accent-sheen': 'linear-gradient(180deg, rgb(62 224 127 / 0.14), rgb(62 224 127 / 0.06))',
        'danger-sheen': 'linear-gradient(180deg, rgb(255 85 85 / 0.14), rgb(255 85 85 / 0.06))',
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
          '0%, 100%': { boxShadow: '0 0 0 1px rgb(62 224 127 / 0.25)' },
          '50%': { boxShadow: '0 0 0 1px rgb(62 224 127 / 0.7)' },
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
