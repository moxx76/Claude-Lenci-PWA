/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        // Palette ESATTA dal DESIGN.md Lenci Athletic
        primary: '#005f98',
        'primary-container': '#0078bf',
        'primary-fixed': '#cfe5ff',
        'primary-fixed-dim': '#99cbff',
        'primary-fixed-dark': '#004a78',
        secondary: '#006e25',
        'secondary-container': '#80f98b',
        'secondary-fixed': '#83fc8e',
        tertiary: '#b3005c',
        error: '#ba1a1a',
        'error-container': '#ffdad6',
        // Neutrals editorial
        ink: {
          900: '#181c20', // on-surface (main text)
          700: '#404751', // on-surface-variant (body)
          500: '#707882', // outline (muted)
          300: '#c0c7d2', // outline-variant (border)
          200: '#e0e2e9', // surface-variant / border
          150: '#e6e8ee', // container-high
          100: '#ebeef4', // container
          50: '#f1f3fa',  // container-low
          25: '#f7f9ff',  // surface
        },
        surface: '#f7f9ff',
      },
      fontFamily: {
        display: ['Anybody', 'system-ui', 'sans-serif'],
        body: ['Lexend', 'system-ui', 'sans-serif'],
        sans: ['Lexend', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        raised: '0 10px 24px rgba(0,120,191,0.06)',
        'raised-strong': '0 12px 26px rgba(0,95,152,0.28)',
        'raised-light': '0 6px 16px rgba(0,120,191,0.05)',
        cta: '0 8px 20px rgba(0,95,152,0.25)',
        modal: '0 20px 40px rgba(0,0,0,0.2)',
        nav: '0 -4px 14px rgba(0,0,0,0.05)',
      },
    },
  },
  plugins: [],
}
