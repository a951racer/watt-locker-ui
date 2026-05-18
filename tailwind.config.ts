import type { Config } from 'tailwindcss'

export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        deepNavy: '#061B38',
        midnightBlue: '#0D2A4F',
        steelBlue: '#2E4767',
        electricBlue: '#1E7EF2',
        brightCyan: '#3FA9FF',
        softFog: '#7E93AD',
        lightSilver: '#D9E1EA',
        pureWhite: '#FFFFFF',
      },
    },
  },
  plugins: [],
} satisfies Config
