/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/renderer/index.html', './src/renderer/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Cursor-style near-black, layered surfaces
        bg: {
          DEFAULT: '#1a1a1a', // editor surface
          alt: '#171717', // side + chat panels
          panel: '#1f1f1f', // cards, toolbar, inputs
          elevated: '#212121', // popovers / menus
          hover: '#262626'
        },
        border: {
          DEFAULT: '#2b2b2b',
          subtle: '#212121'
        },
        // Soft Cursor blue
        accent: {
          DEFAULT: '#4d7cfe',
          hover: '#5d8bff',
          subtle: '#4d7cfe26'
        },
        txt: {
          DEFAULT: '#d4d4d4',
          dim: '#8a8a8a',
          faint: '#6b6b6b'
        }
      },
      borderRadius: {
        lg: '10px',
        xl: '14px'
      },
      boxShadow: {
        panel: '0 1px 0 0 rgba(255,255,255,0.02) inset',
        pop: '0 8px 30px rgba(0,0,0,0.55), 0 0 0 1px rgba(255,255,255,0.04)'
      },
      fontFamily: {
        mono: ['"JetBrains Mono"', '"Fira Code"', 'Menlo', 'Consolas', 'monospace']
      }
    }
  },
  plugins: []
}
