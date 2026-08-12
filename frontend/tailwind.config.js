/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#1A1A1A",
        panel: "rgba(255,255,255,0.7)",
        line: "rgba(26,26,26,0.08)",
        mute: "#6B6B6B",
        soft: "#8A3FFC",
        brand: "#8A3FFC",
        brandHover: "#7A2FF0",
        coral: "#F3B5A5",
        coralHover: "#EEA493",
        mark: "#F5D76E",
        ok: "#16a34a",
        danger: "#DC2626",
        page: "#F7F6F3",
      },
      fontFamily: {
        sans: ['"Plus Jakarta Sans"', "ui-sans-serif", "system-ui", "sans-serif"],
      },
      borderRadius: {
        btn: "12px",
        panel: "18px",
      },
      boxShadow: {
        soft: "0 18px 50px rgba(23, 20, 31, 0.08)",
        glass: "0 8px 32px rgba(26, 26, 26, 0.06)",
      },
      backdropBlur: {
        glass: "18px",
      },
    },
  },
  plugins: [],
};
