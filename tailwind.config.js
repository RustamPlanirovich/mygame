/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        'cyber-black': '#0a0a12',
        'cyber-dark': '#1a1a24',
        'cyber-darker': '#14141e',
        'cyber-gray': '#404055',
        'cyber-gray-light': '#6b6b80',
        'cyber-green': '#00ff9d',
        'cyber-blue': '#00b8ff',
        'cyber-red': '#ff0055',
        'cyber-yellow': '#ffd700',
        'cyber-text': '#e8e8f0',
        'cyber-text-dim': '#b0b0c0',
      },
      fontFamily: {
        mono: ['"Courier New"', 'Courier', 'monospace'],
      },
    },
  },
  plugins: [],
}
