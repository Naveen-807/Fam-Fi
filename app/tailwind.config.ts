import type { Config } from "tailwindcss";

export default {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        bg: "#0A0A0B",
        card: "#141416",
        card2: "#1C1C1F",
        line: "#2A2A2E",
        fg: "#F7F7F5",
        muted: "#B6B6BD",
        dim: "#86868F",
        brand: { DEFAULT: "#FFD60A", soft: "#FFE55C", deep: "#E6B800" },
        onbrand: "#0A0A0B",
        ok: "#3DDC97",
        warn: "#FFB020",
        bad: "#FF5C6C",
      },
      fontFamily: {
        display: ['"Plus Jakarta Sans"', "ui-rounded", "system-ui", "sans-serif"],
        sans: ['"Plus Jakarta Sans"', "ui-sans-serif", "system-ui", "-apple-system", "Segoe UI", "sans-serif"],
      },
      boxShadow: {
        glow: "0 0 0 1px rgba(255,214,10,.35), 0 10px 40px -8px rgba(255,214,10,.35)",
        card: "0 1px 0 rgba(255,255,255,.04) inset, 0 12px 32px -12px rgba(0,0,0,.7)",
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
