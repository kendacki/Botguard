/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#17141F",
        panel: "rgba(255,255,255,0.55)",
        line: "rgba(138,63,252,0.18)",
        mute: "#6B6680",
        soft: "#8A3FFC",
        brand: "#8A3FFC",
        brandHover: "#7A2FF0",
        ok: "#16a34a",
        danger: "#DC2626",
        page: "#FFFFFF",
      },
      fontFamily: {
        sans: ["Poppins", "ui-sans-serif", "system-ui", "sans-serif"],
      },
      borderRadius: {
        btn: "10px",
        panel: "18px",
      },
      boxShadow: {
        soft: "0 18px 50px rgba(23, 20, 31, 0.08)",
        glass: "0 8px 32px rgba(138, 63, 252, 0.08)",
      },
      backdropBlur: {
        glass: "18px",
      },
    },
  },
  plugins: [],
};
