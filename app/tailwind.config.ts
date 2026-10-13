import type { Config } from "tailwindcss";

export default {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        bg: "rgb(var(--bg-rgb) / <alpha-value>)",
        card: "rgb(var(--card-rgb) / <alpha-value>)",
        card2: "rgb(var(--card2-rgb) / <alpha-value>)",
        line: "rgb(var(--line-rgb) / <alpha-value>)",
        fg: "rgb(var(--fg-rgb) / <alpha-value>)",
        muted: "rgb(var(--muted-rgb) / <alpha-value>)",
        dim: "rgb(var(--muted-rgb) / <alpha-value>)",
        brand: { DEFAULT: "rgb(var(--brand-rgb) / <alpha-value>)", soft: "rgb(var(--card2-rgb) / <alpha-value>)", deep: "rgb(var(--brand-hover-rgb) / <alpha-value>)" },
        onbrand: "rgb(var(--onbrand-rgb) / <alpha-value>)",
        ok: "rgb(var(--ok-rgb) / <alpha-value>)",
        warn: "rgb(var(--warn-rgb) / <alpha-value>)",
        bad: "rgb(var(--bad-rgb) / <alpha-value>)",
        onbad: "rgb(var(--onbad-rgb) / <alpha-value>)",
      },
      fontFamily: {
        display: ['"Manrope"', "sans-serif"],
        sans: ['"Manrope"', "ui-sans-serif", "system-ui", "-apple-system", "Segoe UI", "sans-serif"],
      },
      boxShadow: {
        glow: "none",
        card: "none",
      },
      keyframes: {
        fadeUp: { from: { opacity: "0", transform: "translateY(10px)" }, to: { opacity: "1", transform: "none" } },
        float: { "0%,100%": { transform: "translateY(0) rotate(-3deg)" }, "50%": { transform: "translateY(-10px) rotate(-1deg)" } },
        shimmer: { from: { backgroundPosition: "-200% 0" }, to: { backgroundPosition: "200% 0" } },
        pulseRing: { "0%": { boxShadow: "0 0 0 0 rgba(255,214,10,.5)" }, "100%": { boxShadow: "0 0 0 14px rgba(255,214,10,0)" } },
      },
      animation: {
        fadeUp: "fadeUp .45s cubic-bezier(.2,.8,.2,1) both",
        float: "float 6s ease-in-out infinite",
        shimmer: "shimmer 3s linear infinite",
        pulseRing: "pulseRing 1.8s ease-out infinite",
      },
    },
  },
  plugins: [],
} satisfies Config;
