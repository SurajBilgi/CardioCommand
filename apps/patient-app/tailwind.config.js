/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        bg: {
          base: '#FAF7F2',
          surface: '#FFFFFF',
          elevated: '#F5F0E8',
          border: '#E8E0D4',
        },
        accent: {
          primary: '#E8715A',
          calm: '#5A9E6F',
          warm: '#F0A050',
          urgent: '#D94040',
        },
        txt: {
          primary: '#2C2420',
          secondary: '#7A6E68',
          muted: '#B0A89F',
        },
      },
      fontFamily: {
        display: ['Playfair Display', 'serif'],
        body: ['Lora', 'serif'],
        ui: ['DM Sans', 'sans-serif'],
      },
      maxWidth: {
        mobile: '480px',
      },
      screens: {
        xs: '375px',
      },
    },
  },
  plugins: [],
}
