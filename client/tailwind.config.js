/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          50: "#eef6ff",
          100: "#d9ebff",
          200: "#bcdcff",
          300: "#8ec5ff",
          400: "#58a4ff",
          500: "#3380ff",
          600: "#1c5ff5",
          700: "#1648e1",
          800: "#1a3bb6",
          900: "#1b388f",
          950: "#152259",
        },
      },
    },
  },
  plugins: [],
};
