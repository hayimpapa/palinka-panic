/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        folkred: '#8B0000',
        folkgreen: '#2e7d32',
        folkcream: '#fff6e3',
        folknavy: '#1e2a52',
      },
      fontFamily: {
        folk: ['Georgia', 'Cambria', '"Times New Roman"', 'serif'],
      },
    },
  },
  plugins: [],
}
