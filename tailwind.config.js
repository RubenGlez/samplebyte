/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      backgroundImage: {
        main: "url('../public/1.avif')",
      },
    },
  },
  corePlugins: {
    preflight: false,
  },
  plugins: [],
};
