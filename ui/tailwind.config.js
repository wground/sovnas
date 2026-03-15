/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        urbit: {
          purple: '#8b5cf6',
          'purple-dark': '#6d28d9',
        },
      },
    },
  },
  plugins: [],
};
