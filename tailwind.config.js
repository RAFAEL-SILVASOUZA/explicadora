/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        primary: '#7C5CFC',
        'primary-dark': '#5B3FD4',
        'primary-light': '#EDE8FE',
        secondary: '#FF8A3D',
        'secondary-light': '#FFF0E5',
        success: '#2EC4B6',
        'success-light': '#E0F7F4',
        danger: '#FF5D5D',
        'danger-light': '#FFE9E9',
        bg: '#FDF6EC',
        ink: '#2D2A3E',
      },
      fontFamily: {
        sans: ['var(--font-nunito)', 'system-ui', 'sans-serif'],
      },
      fontSize: {
        'enunciado': '1.5rem',
        'opcao': '1.25rem',
      },
      borderRadius: {
        'xl': '1rem',
        '2xl': '1.5rem',
        '3xl': '2rem',
      },
      boxShadow: {
        'card': '0 8px 24px -6px rgba(124, 92, 252, 0.18)',
        'card-hover': '0 14px 34px -8px rgba(124, 92, 252, 0.30)',
      },
      keyframes: {
        'pop-in': {
          '0%': { transform: 'scale(0.6)', opacity: '0' },
          '70%': { transform: 'scale(1.08)' },
          '100%': { transform: 'scale(1)', opacity: '1' },
        },
        'shake': {
          '0%, 100%': { transform: 'translateX(0)' },
          '20%': { transform: 'translateX(-8px)' },
          '40%': { transform: 'translateX(8px)' },
          '60%': { transform: 'translateX(-5px)' },
          '80%': { transform: 'translateX(5px)' },
        },
        'float': {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-10px)' },
        },
        'confetti-fall': {
          '0%': { transform: 'translateY(-10vh) rotate(0deg)', opacity: '1' },
          '100%': { transform: 'translateY(100vh) rotate(720deg)', opacity: '0' },
        },
        'wiggle': {
          '0%, 100%': { transform: 'rotate(-4deg)' },
          '50%': { transform: 'rotate(4deg)' },
        },
      },
      animation: {
        'pop-in': 'pop-in 0.45s cubic-bezier(0.34, 1.56, 0.64, 1) both',
        shake: 'shake 0.5s ease-in-out',
        float: 'float 3s ease-in-out infinite',
        'confetti-fall': 'confetti-fall 2.5s linear forwards',
        wiggle: 'wiggle 0.6s ease-in-out infinite',
      },
    },
  },
  plugins: [],
};
