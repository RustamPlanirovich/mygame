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
        'cyber-dark': '#11111a',
        'cyber-gray': '#333344',
        'cyber-green': '#00ff9d',
        'cyber-blue': '#00b8ff',
        'cyber-red': '#ff0055',
        'cyber-text': '#e0e0e0',
      },
      fontFamily: {
        mono: ['"Courier New"', 'Courier', 'monospace'],
      },
    },
  },
  plugins: [],
}
