import type { Config } from "tailwindcss";

export default {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#0f1b2d",
        mint: { 50: "#ecfdf5", 100: "#d1fae5", 500: "#10b981", 600: "#059669", 700: "#047857" },
        sun: { 100: "#fef3c7", 500: "#f59e0b", 700: "#b45309" },
        rose: { 100: "#ffe4e6", 600: "#e11d48" },
      },
      boxShadow: { card: "0 1px 2px rgba(15,27,45,.06), 0 8px 24px rgba(15,27,45,.06)" },
    },
  },
  plugins: [],
} satisfies Config;
