/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#0F0F0F",
        panel: "#14111F",
        line: "#2A2540",
        mute: "#9794a8",
        soft: "#b391f5",
        brand: "#8A3FFC",
        brandHover: "#7A2FF0",
        ok: "#16a34a",
        danger: "#F00",
      },
      fontFamily: {
        sans: ["Poppins", "ui-sans-serif", "system-ui", "sans-serif"],
      },
      borderRadius: {
        btn: "10px",
        panel: "16px",
      },
      boxShadow: {
        soft: "0 20px 50px rgba(0,0,0,0.35)",
      },
    },
  },
  plugins: [],
};
