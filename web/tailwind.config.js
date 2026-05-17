/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: 'class',
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        accent: {
          DEFAULT: '#f97316',
          hover: '#ea6c0a',
        },
      },
      fontFamily: {
        sans: [
          '-apple-system',
          'BlinkMacSystemFont',
          '"Segoe UI"',
          'Roboto',
          'Helvetica',
          'Arial',
          'sans-serif',
        ],
      },
      aspectRatio: {
        card: '63 / 88',
      },
      animation: {
        shimmer:       'shimmer 1.6s linear infinite',
        'bounce-heart':'bounceHeart 0.45s cubic-bezier(0.36,0.07,0.19,0.97) forwards',
        'float-heart': 'floatHeart 0.7s ease-out forwards',
        'flash':       'flash 0.35s ease-out forwards',
        'slide-up':    'slideUp 0.32s cubic-bezier(0.32,0.72,0,1) forwards',
        'fade-in':     'fadeIn 0.2s ease-out forwards',
        'scale-in':    'scaleIn 0.22s cubic-bezier(0.34,1.56,0.64,1) forwards',
        'holo':        'holo 4s ease infinite',
        'pulse-ring':  'pulseRing 1s ease-out infinite',
      },
      keyframes: {
        shimmer: {
          '0%':   { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition:  '200% 0' },
        },
        bounceHeart: {
          '0%':   { transform: 'scale(1)' },
          '25%':  { transform: 'scale(1.4)' },
          '55%':  { transform: 'scale(0.88)' },
          '75%':  { transform: 'scale(1.15)' },
          '100%': { transform: 'scale(1)' },
        },
        floatHeart: {
          '0%':   { opacity: '1',  transform: 'translateY(0)   scale(1)' },
          '100%': { opacity: '0',  transform: 'translateY(-56px) scale(1.6)' },
        },
        flash: {
          '0%':   { opacity: '0.85' },
          '100%': { opacity: '0' },
        },
        slideUp: {
          '0%':   { transform: 'translateY(100%)', opacity: '0' },
          '100%': { transform: 'translateY(0)',    opacity: '1' },
        },
        fadeIn: {
          '0%':   { opacity: '0' },
          '100%': { opacity: '1' },
        },
        scaleIn: {
          '0%':   { transform: 'scale(0.88)', opacity: '0' },
          '100%': { transform: 'scale(1)',    opacity: '1' },
        },
        holo: {
          '0%,100%': { backgroundPosition: '0% 50%',   filter: 'hue-rotate(0deg)' },
          '50%':     { backgroundPosition: '100% 50%',  filter: 'hue-rotate(30deg)' },
        },
        pulseRing: {
          '0%':   { transform: 'scale(1)',    opacity: '0.6' },
          '100%': { transform: 'scale(1.5)',  opacity: '0' },
        },
      },
    },
  },
  plugins: [],
};
