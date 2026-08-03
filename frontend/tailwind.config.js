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
          bg: '#FAF7F2',       // Warm Cream Background
          primary: '#0F6B4B',  // Deep Forest Emerald Green
          secondary: '#2BB673',// Vibrant Mint Emerald
          accent: '#A7F3D0',   // Luminous Mint Accent
          card: '#FFFFFF',     // Pure White Card
          ink: '#15342A',      // Deep Forest Ink Text
          muted: '#6B7280',    // Muted Slate Text
          border: '#E7E5E4',   // Warm Stone Border
        },
        sb: {
          50: '#F4FBF7',
          100: '#E6F7EF',
          200: '#C7EFE0',
          300: '#A7F3D0',
          400: '#6EE7B7',
          500: '#2BB673',
          600: '#0F6B4B',
          700: '#0B543A',
          800: '#08402C',
          900: '#15342A',
          950: '#091B15',
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
          50: '#F3F6F5',
          100: '#E2E8E5',
          500: '#6B7280',
          700: '#2C4940',
          800: '#1F4A3C',
          900: '#15342A',
          950: '#0D211A',
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
        'soft': '0 12px 32px -10px rgba(15, 107, 75, 0.08)',
        'soft-lg': '0 24px 48px -15px rgba(15, 107, 75, 0.12)',
        'floating': '0 24px 60px -12px rgba(21, 52, 42, 0.16)',
        'luxury': '0 16px 40px -12px rgba(15, 107, 75, 0.1)',
        'luxury-hover': '0 28px 56px -12px rgba(15, 107, 75, 0.18)',
      }
    },
  },
  plugins: [],
}
