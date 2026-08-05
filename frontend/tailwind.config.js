/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        brand: {
          bg: '#F8FAFC',       // Slate 50 (Cool Background)
          primary: '#0B0F1B',  // Dark Navy/Slate (Sidebar color)
          secondary: '#4F46E5',// Indigo 600
          accent: '#818CF8',   // Indigo 400
          card: '#FFFFFF',     // Pure White Card
          ink: '#0F172A',      // Slate 900 Text
          muted: '#64748B',    // Slate 500 Text
          border: '#E2E8F0',   // Slate 200 Border
        },
        sb: {
          50: '#EEF2FF',
          100: '#E0E7FF',
          200: '#C7D2FE',
          300: '#A5B4FC',
          400: '#818CF8',
          500: '#6366F1',
          600: '#4F46E5',
          700: '#4338CA',
          800: '#3730A3',
          900: '#312E81',
          950: '#1E1B4B',
        },
        cream: {
          50: '#FFFFFF',
          100: '#FCFAF7',
          200: '#FAF7F2',
          300: '#F4EFE6',
          400: '#EBE3D5',
          500: '#DFCDB7',
        },
        ink: {
          50: '#F8FAFC',
          100: '#F1F5F9',
          500: '#64748B',
          700: '#334155',
          800: '#1E293B',
          900: '#0F172A',
          950: '#020617',
        },
        stoneBorder: '#E7E5E4'
      },
      fontFamily: {
        sans: ['Plus Jakarta Sans', 'Inter', '-apple-system', 'sans-serif'],
        display: ['Space Grotesk', 'Plus Jakarta Sans', 'sans-serif'],
      },
      borderRadius: {
        '2xl': '1rem',      // 16px
        '3xl': '1.25rem',   // 20px
        '4xl': '1.5rem',    // 24px (Starbucks Card Spec)
        '5xl': '2rem',      // 32px
        '6xl': '2.5rem',    // 40px
      },
      boxShadow: {
        'soft': '0 12px 32px -10px rgba(79, 70, 229, 0.08)',
        'soft-lg': '0 24px 48px -15px rgba(79, 70, 229, 0.12)',
        'floating': '0 24px 60px -12px rgba(15, 23, 42, 0.16)',
        'luxury': '0 16px 40px -12px rgba(79, 70, 229, 0.1)',
        'luxury-hover': '0 28px 56px -12px rgba(79, 70, 229, 0.18)',
      }
    },
  },
  plugins: [],
}
