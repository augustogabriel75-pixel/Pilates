import type { Config } from 'tailwindcss';

// Paleta derivada da identidade visual: cinza suave, marrom/cobre e bege/dourado.
const config: Config = {
  darkMode: 'class',
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        copper: {
          50: '#faf5f1', 100: '#f2e6dc', 200: '#e4cbb7', 300: '#d3a98b', 400: '#c08462',
          500: '#a86b45', 600: '#8f5838', 700: '#74462f', 800: '#5e3a29', 900: '#4c3023',
        },
        sand: {
          50: '#fbf8f3', 100: '#f5eee3', 200: '#ebdcc6', 300: '#dcc4a0', 400: '#c9a97a',
          500: '#b8915d', 600: '#9f784a', 700: '#7f5f3d', 800: '#684e35', 900: '#56412e',
        },
        mist: {
          50: '#f7f6f5', 100: '#eeecea', 200: '#dcd9d5', 300: '#c2bdb8', 400: '#a19b95',
          500: '#8a847e', 600: '#716b66', 700: '#5a5551', 800: '#3a3633', 850: '#2c2927', 900: '#211f1d', 950: '#171514',
        },
      },
      fontFamily: {
        serif: ['var(--font-serif)', 'Georgia', 'serif'],
        sans: ['var(--font-sans)', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        soft: '0 1px 2px rgba(60, 40, 30, .04), 0 4px 16px rgba(60, 40, 30, .06)',
      },
    },
  },
  plugins: [],
};
export default config;
