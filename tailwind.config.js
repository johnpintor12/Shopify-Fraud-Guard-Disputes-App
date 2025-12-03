/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}", /* Standard Vite structure */
    "./*.{js,ts,jsx,tsx}",        /* ALSO scan root files just in case */
  ],
  theme: {
    extend: {},
  },
  plugins: [],
}
