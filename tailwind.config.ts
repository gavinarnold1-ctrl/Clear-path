import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        // Oversikt brand palette
        fjord: '#1B3A4B',
        pine: '#2D5F3E',
        midnight: '#0F1F28',
        snow: '#F7F9F8',
        frost: '#E8F0ED',
        mist: '#C8D5CE',
        stone: '#8B9A8E',
        lichen: '#A3B8A0',
        birch: '#D4C5A9',
        ember: '#C4704B',
        // Semantic aliases
        income: '#2D5F3E',
        expense: '#C4704B',
        transfer: '#D4C5A9',
      },
      fontFamily: {
        display: ['var(--font-fraunces)', 'serif'],
        body: ['var(--font-dm-sans)', 'sans-serif'],
        mono: ['var(--font-jetbrains)', 'monospace'],
        sans: ['var(--font-dm-sans)', 'sans-serif'],
      },
      borderRadius: {
        card: '12px',
        button: '8px',
        badge: '5px',
        bar: '3px',
      },
    },
  },
  plugins: [],
}

export default config
