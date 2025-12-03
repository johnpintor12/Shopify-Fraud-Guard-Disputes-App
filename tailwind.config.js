/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}", /* CHANGED: Added ./src to be specific */
  ],
  theme: {
    extend: {},
  },
  plugins: [],
}
