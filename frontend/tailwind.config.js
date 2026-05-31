/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: ['class'],
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    container: {
      center: true,
      padding: '2rem',
      screens: { '2xl': '1400px' },
    },
    extend: {
      fontFamily: {
        sans: ['Cairo', 'Tajawal', 'system-ui', 'sans-serif'],
        display: ['Cairo', 'sans-serif'],
      },
      colors: {
        border: 'hsl(45 50% 25% / 0.3)',
        input: 'hsl(45 30% 15%)',
        ring: 'hsl(45 95% 55%)',
        background: 'hsl(230 25% 5%)',
        foreground: 'hsl(45 30% 95%)',
        primary: {
          DEFAULT: 'hsl(45 95% 55%)',
          foreground: 'hsl(230 25% 5%)',
        },
        secondary: {
          DEFAULT: 'hsl(195 100% 50%)',
          foreground: 'hsl(230 25% 5%)',
        },
        destructive: {
          DEFAULT: 'hsl(0 84% 60%)',
          foreground: 'hsl(0 0% 100%)',
        },
        muted: {
          DEFAULT: 'hsl(230 20% 12%)',
          foreground: 'hsl(45 15% 65%)',
        },
        accent: {
          DEFAULT: 'hsl(195 100% 50%)',
          foreground: 'hsl(230 25% 5%)',
        },
        popover: {
          DEFAULT: 'hsl(230 25% 8%)',
          foreground: 'hsl(45 30% 95%)',
        },
        card: {
          DEFAULT: 'hsl(230 25% 8%)',
          foreground: 'hsl(45 30% 95%)',
        },
        gold: {
          50: '#FFFBEB',
          100: '#FEF3C7',
          200: '#FDE68A',
          300: '#FCD34D',
          400: '#FBBF24',
          500: '#F59E0B',
          600: '#D97706',
          700: '#B45309',
          DEFAULT: '#FFD700',
        },
        neon: {
          blue: '#00D4FF',
          cyan: '#00FFFF',
          purple: '#B061FF',
          green: '#39FF14',
          pink: '#FF10F0',
        },
        chart: {
          1: 'hsl(45 95% 55%)',
          2: 'hsl(195 100% 50%)',
          3: 'hsl(280 80% 60%)',
          4: 'hsl(140 70% 50%)',
          5: 'hsl(0 80% 60%)',
        },
      },
      borderRadius: {
        lg: '0.75rem',
        md: '0.5rem',
        sm: '0.25rem',
      },
      backgroundImage: {
        'gold-gradient': 'linear-gradient(135deg, #FFD700 0%, #B8860B 100%)',
        'neon-gradient': 'linear-gradient(135deg, #00D4FF 0%, #B061FF 100%)',
        'dark-glass': 'linear-gradient(135deg, rgba(255,215,0,0.05) 0%, rgba(0,212,255,0.05) 100%)',
      },
      boxShadow: {
        'gold-glow': '0 0 20px rgba(255, 215, 0, 0.4), 0 0 40px rgba(255, 215, 0, 0.2)',
        'neon-glow': '0 0 20px rgba(0, 212, 255, 0.4), 0 0 40px rgba(0, 212, 255, 0.2)',
        'glass': '0 8px 32px 0 rgba(0, 0, 0, 0.4)',
      },
      keyframes: {
        'accordion-down': { from: { height: 0 }, to: { height: 'var(--radix-accordion-content-height)' } },
        'accordion-up': { from: { height: 'var(--radix-accordion-content-height)' }, to: { height: 0 } },
        'pulse-glow': {
          '0%, 100%': { boxShadow: '0 0 20px rgba(255, 215, 0, 0.4)' },
          '50%': { boxShadow: '0 0 40px rgba(255, 215, 0, 0.8)' },
        },
        'shimmer': {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
        'float': {
          '0%, 100%': { transform: 'translateY(0px)' },
          '50%': { transform: 'translateY(-10px)' },
        },
      },
      animation: {
        'accordion-down': 'accordion-down 0.2s ease-out',
        'accordion-up': 'accordion-up 0.2s ease-out',
        'pulse-glow': 'pulse-glow 2s ease-in-out infinite',
        'shimmer': 'shimmer 3s linear infinite',
        'float': 'float 3s ease-in-out infinite',
      },
    },
  },
  plugins: [require('tailwindcss-animate')],
};
