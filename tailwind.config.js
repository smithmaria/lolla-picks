/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        display: ['Anton', 'sans-serif'],
        body: ['Golos Text', 'sans-serif'],
      },
      colors: {
        black: '#17120f',
        grayDark: '#222222',
        grayCustom: '#2e2e2e',
        white: '#fffeff',
        pink: '#ecade6',
        teal: '#32c2e2',
        tealDark: '#359bac',
        green: '#ccdf00',
        tealgreen: '#05ad99',
        blue: '#34c3e3',
        blue2: '#1dbaca',
        blue3: '#01b2b2',
        red: '#fc4338',
        yellow: '#cfdf05',
      },
    },
  },
  plugins: [],
}
