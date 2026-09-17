/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // Near-black, green-tinted dark surfaces used by the technician
        // portal (activated via the `dark` class — see DashboardLayout).
        // Kept separate from `brand` so the light admin UI is untouched.
        surface: {
          950: '#040705',
          900: '#0a120d',
          850: '#0e1812',
          800: '#111d16',
          700: '#1a2b21',
          600: '#28402f',
          500: '#3a5a43',
        },
        // Green ramp (matches the `emerald` dark:-variant accents used
        // throughout the app), used for the sidebar background and primary
        // buttons/links across the whole black-and-green theme.
        brand: {
          50: '#ecfdf5',
          100: '#d1fae5',
          200: '#a7f3d0',
          300: '#6ee7b7',
          400: '#34d399',
          500: '#10b981',
          600: '#059669',
          700: '#047857',
          800: '#065f46',
          900: '#064e3b',
        },
        // Status accents for stat tiles (info/warning/critical). "good" reuses
        // brand dark-blue above so it stays consistent with the rest of the UI.
        info: {
          50: '#eaf3fd',
          100: '#cde2fb',
          500: '#2a78d6',
          600: '#256abf',
          700: '#184f95',
        },
        warning: {
          50: '#fdf3e0',
          100: '#fbe6c2',
          500: '#eda100',
          600: '#c98500',
          700: '#9a6700',
        },
        critical: {
          50: '#fbe9e9',
          100: '#f6cfcf',
          500: '#d03b3b',
          600: '#b52f2f',
          700: '#8f2424',
        },
      },
    },
  },
  plugins: [],
};
