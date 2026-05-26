/** @type {import('tailwindcss').Config} */

export default {
  darkMode: "class",
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    container: {
      center: true,
    },
    extend: {
      colors: {
        navy: {
          50: '#E8EBF0',
          100: '#C5CCD9',
          200: '#8B99B3',
          300: '#51668D',
          400: '#2D4470',
          500: '#1B2A4A',
          600: '#162240',
          700: '#111A33',
          800: '#0C1226',
          900: '#070919',
        },
        cyan: {
          DEFAULT: '#00E5C7',
          50: '#E6FFF9',
          100: '#B3FFE9',
          200: '#80FFD9',
          300: '#4DFFC9',
          400: '#1AFFB9',
          500: '#00E5C7',
          600: '#00B89E',
          700: '#008B76',
          800: '#005D4F',
          900: '#002F28',
        },
        ivory: '#FFFEF9',
        warmgray: '#F5F3EF',
      },
      fontFamily: {
        serif: ['"Noto Serif SC"', 'Georgia', 'serif'],
        sans: ['"Noto Sans SC"', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'monospace'],
      },
      animation: {
        'pulse-glow': 'pulse-glow 2s ease-in-out infinite',
        'flow-line': 'flow-line 2s linear infinite',
        'fade-in-up': 'fade-in-up 0.5s ease-out',
        'fade-in': 'fade-in 0.3s ease-out',
        'slide-in-right': 'slide-in-right 0.3s ease-out',
      },
      keyframes: {
        'pulse-glow': {
          '0%, 100%': { boxShadow: '0 0 5px rgba(0, 229, 199, 0.3)' },
          '50%': { boxShadow: '0 0 20px rgba(0, 229, 199, 0.6)' },
        },
        'flow-line': {
          '0%': { backgroundPosition: '200% 0' },
          '100%': { backgroundPosition: '-200% 0' },
        },
        'fade-in-up': {
          '0%': { opacity: '0', transform: 'translateY(20px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'fade-in': {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        'slide-in-right': {
          '0%': { opacity: '0', transform: 'translateX(20px)' },
          '100%': { opacity: '1', transform: 'translateX(0)' },
        },
      },
    },
  },
  plugins: [],
};
