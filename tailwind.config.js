/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/renderer/index.html', './src/renderer/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        bg: {
          DEFAULT: '#1e1e1e',
          alt: '#252526',
          panel: '#1b1b1b',
          hover: '#2a2d2e'
        },
        border: { DEFAULT: '#333333' },
        accent: { DEFAULT: '#0e639c', hover: '#1177bb' }
      },
      fontFamily: {
        mono: ['"JetBrains Mono"', '"Fira Code"', 'Menlo', 'Consolas', 'monospace']
      }
    }
  },
  plugins: []
}
