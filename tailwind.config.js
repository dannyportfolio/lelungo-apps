/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: 'class',
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      colors: {
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        card: 'hsl(var(--card))',
        border: 'hsl(var(--border))',
        muted: 'hsl(var(--muted))',
        accent: {
          DEFAULT: 'hsl(var(--accent))',
          foreground: 'hsl(var(--accent-foreground))',
        },
        primary: {
          DEFAULT: 'hsl(var(--primary))',
          foreground: 'hsl(var(--primary-foreground))',
        },
      },
      fontFamily: {
        sans: ['ui-sans-serif', 'system-ui', '-apple-system', 'BlinkMacSystemFont', '"Segoe UI"', 'sans-serif'],
      },
      animation: {
        'pulse-slow': 'pulse-slow 5s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'marquee': 'marquee 40s linear infinite',
      },
      keyframes: {
        'pulse-slow': {
          '0%, 100%': { opacity: '1', transform: 'scale(1)' },
          '50%': { opacity: '.85', transform: 'scale(1.02)' },
        },
        'marquee': {
          '0%': { transform: 'translateX(0%)' },
          '100%': { transform: 'translateX(-50%)' }, // Translate 50% because we duplicate the content
        },
      },
      boxShadow: {
        'glow':        '0 0 40px hsl(var(--primary) / 0.15)',
        'glow-sm':     '0 0 20px hsl(var(--primary) / 0.1)',
        'glow-active': '0 0 30px hsl(var(--primary) / 0.3), inset 0 0 10px hsl(var(--primary) / 0.1)',
        'card':        '0 4px 24px rgba(0,0,0,0.06)',
        'card-hover':  '0 12px 32px rgba(0,0,0,0.1), 0 0 0 1px hsl(var(--border))',
        'glass':       'inset 0 1px 0 0 hsl(var(--foreground) / 0.05)',
      },
      backgroundImage: {
        'gradient-brand':  'linear-gradient(135deg, hsl(var(--gradient-start)) 0%, hsl(var(--gradient-end)) 100%)',
      },
    },
  },
  plugins: [],
};
