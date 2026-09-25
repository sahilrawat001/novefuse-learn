/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['"Plus Jakarta Sans"', 'Inter', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'monospace'],
      },
      animation: {
        'soundwave-1': 'soundwave 1.1s ease-in-out infinite alternate',
        'soundwave-2': 'soundwave 1.4s ease-in-out infinite alternate 0.15s',
        'soundwave-3': 'soundwave 0.8s ease-in-out infinite alternate 0.3s',
        'soundwave-4': 'soundwave 1.2s ease-in-out infinite alternate 0.1s',
        'soundwave-5': 'soundwave 1.5s ease-in-out infinite alternate 0.25s',
        'pulse-glow': 'pulseGlow 2.5s ease-in-out infinite',
        'orb-rotate': 'orbRotate 20s linear infinite',
      },
      keyframes: {
        soundwave: {
          '0%': { height: '6px' },
          '100%': { height: '32px' },
        },
        pulseGlow: {
          '0%, 100%': { opacity: '0.35', transform: 'scale(0.98)' },
          '50%': { opacity: '0.75', transform: 'scale(1.05)' },
        },
        orbRotate: {
          '0%': { transform: 'rotate(0deg)' },
          '100%': { transform: 'rotate(360deg)' },
        }
      }
    },
  },
  plugins: [],
}
