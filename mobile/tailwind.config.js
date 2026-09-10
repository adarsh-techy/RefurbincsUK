/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./App.js', './src/**/*.{js,jsx}'],
  presets: [require('nativewind/preset')],
  // 'class' (rather than the default 'media') lets the app set the scheme
  // itself via nativewind's setColorScheme — see src/context/ThemeContext.js
  // — instead of only following the OS setting.
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // Matches the web technician portal's black-and-blue theme.
        surface: {
          950: '#040509',
          900: '#0a0d16',
          800: '#111726',
          700: '#1a2436',
          600: '#28364d',
        },
        brand: {
          50: '#eff6ff',
          100: '#dbeafe',
          400: '#60a5fa',
          500: '#3b82f6',
          600: '#2563eb',
          700: '#1d4ed8',
        },
      },
    },
  },
  plugins: [],
};
