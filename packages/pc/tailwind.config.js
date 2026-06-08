/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{vue,js,ts}'],
  theme: {
    extend: {
      colors: {
        dx: {
          primary: '#1677ff',
          'primary-dark': '#0958d9',
          'primary-light': '#e8f3ff',
          accent: '#13c2c2',
          'accent-dark': '#08979c',
          bg: '#f5f7fa',
          surface: '#ffffff',
          text: '#1f2937',
          muted: '#6b7280',
          border: '#e5e7eb',
        },
      },
      boxShadow: {
        hero: '0 12px 40px rgba(9, 88, 217, 0.28)',
        card: '0 4px 16px rgba(15, 23, 42, 0.06)',
      },
      backgroundImage: {
        'dx-hero':
          'linear-gradient(145deg, #0958d9 0%, #1677ff 42%, #13c2c2 100%)',
      },
    },
  },
  plugins: [],
};
