"use client";
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

type Theme = "light" | "dark" | "system";
const valid = (value: unknown): value is Theme => value === "light" || value === "dark" || value === "system";
const ThemeContext = createContext<{ theme: Theme; change: (theme: Theme) => void }>({ theme: "light", change: () => {} });

// Runs before the body paints. Storage is optional (private browsing may disable it).
export const themeInit = `(()=>{let t='light';try{const v=localStorage.getItem('famfi-theme');if(['light','dark','system'].includes(v))t=v}catch{}const d=t==='dark'||(t==='system'&&matchMedia('(prefers-color-scheme: dark)').matches);document.documentElement.dataset.theme=d?'dark':'light';document.documentElement.style.colorScheme=d?'dark':'light'})()`;

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<Theme>("light");
  const [ready, setReady] = useState(false);
  useEffect(() => {
    try { const saved = localStorage.getItem("famfi-theme"); if (valid(saved)) setTheme(saved); } catch {}
    setReady(true);
    const sync = (event: StorageEvent) => { if (event.key === "famfi-theme") setTheme(valid(event.newValue) ? event.newValue : "light"); };
    window.addEventListener("storage", sync);
    return () => window.removeEventListener("storage", sync);
  }, []);
  useEffect(() => {
    if (!ready) return;
    const media = matchMedia("(prefers-color-scheme: dark)");
    const apply = () => {
      const dark = theme === "dark" || (theme === "system" && media.matches);
      document.documentElement.dataset.theme = dark ? "dark" : "light";
      document.documentElement.style.colorScheme = dark ? "dark" : "light";
      document.querySelector('meta[name="theme-color"]')?.setAttribute("content", dark ? "#101113" : "#F2F2F2");
    };
    apply(); media.addEventListener("change", apply);
    return () => media.removeEventListener("change", apply);
  }, [theme, ready]);
  const change = (next: Theme) => { setTheme(next); try { localStorage.setItem("famfi-theme", next); } catch {} };
  return <ThemeContext.Provider value={{ theme, change }}>{children}</ThemeContext.Provider>;
}

export function ThemeToggle() {
  const { theme, change } = useContext(ThemeContext);
  return <label className="theme-control"><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.5 1.5m11 11L19 19M5 19l1.5-1.5m11-11L19 5"/></svg><span className="sr-only">Color theme</span><select aria-label="Color theme" value={theme} onChange={(e) => change(e.target.value as Theme)}><option value="light">Light</option><option value="dark">Dark</option><option value="system">System</option></select></label>;
}
