/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{vue,js,ts}'],
  theme: {
    extend: {
      colors: {
        dx: {
          primary: '#6a30b4',
          'primary-dark': '#5b2c91',
          'primary-light': '#f3e8ff',
          accent: '#00c2cb',
          'accent-dark': '#00a8b0',
          bg: '#f5f7fa',
          surface: '#ffffff',
          text: '#1f2937',
          muted: '#6b7280',
          border: '#e5e7eb',
        },
      },
      boxShadow: {
        hero: '0 12px 40px rgba(106, 48, 180, 0.28)',
        card: '0 4px 16px rgba(15, 23, 42, 0.06)',
      },
      backgroundImage: {
        'dx-hero':
          'linear-gradient(145deg, #6a30b4 0%, #2d70d6 42%, #00c2cb 100%)',
      },
    },
  },
  plugins: [],
};
