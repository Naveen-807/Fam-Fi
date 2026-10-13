"use client";
import { useEffect, useId, useRef, useState, type CSSProperties } from "react";

/** Decorative motion pauses offscreen and in background tabs. CSS handles reduced motion. */
export function useMotionVisibility() {
  const ref = useRef<HTMLDivElement>(null);
  const [running, setRunning] = useState(false);
  useEffect(() => {
    let visible = false;
    const update = () => setRunning(visible && !document.hidden);
    const observer = new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; update(); });
    if (ref.current) observer.observe(ref.current);
    document.addEventListener("visibilitychange", update);
    return () => { observer.disconnect(); document.removeEventListener("visibilitychange", update); };
  }, []);
  return { ref, running };
}

export function AnimatedOutline({ accent = "mint", radius = 20, duration = 6, delay = 0, animated = true }: { accent?: "coral" | "mint" | "blue"; radius?: number; duration?: number; delay?: number; animated?: boolean }) {
  const { ref, running } = useMotionVisibility();
  const [size, setSize] = useState({ width: 0, height: 0 });
  const filter = `outline-${useId().replace(/[^\w-]/g, "")}`;
  useEffect(() => {
    const observer = new ResizeObserver(([entry]) => setSize({ width: entry.contentRect.width, height: entry.contentRect.height }));
    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, [ref]);
  const style = { "--effect-accent": `var(--${accent})`, "--effect-duration": `${duration}s`, "--effect-delay": `${-delay}s`, animationPlayState: running ? "running" : "paused" } as CSSProperties;
  const rect = { x: 1, y: 1, width: Math.max(0, size.width - 2), height: Math.max(0, size.height - 2), rx: Math.min(radius, size.width / 2, size.height / 2), pathLength: 100 };
  return <div ref={ref} className={`animated-outline ${animated ? "outline-loop" : "outline-static"}`} style={style} aria-hidden="true" data-running={running}>
    {size.width > 0 && <svg width={size.width} height={size.height} fill="none"><defs><filter id={filter} x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="3"/></filter></defs><rect {...rect} className="outline-base"/><rect {...rect} className="outline-segment outline-glow" filter={`url(#${filter})`}/><rect {...rect} className="outline-segment outline-crisp"/></svg>}
  </div>;
}

export function FlowDiagram({ variant = "allowance", compact = false }: { variant?: "allowance" | "guidance" | "saving"; compact?: boolean }) {
  const { ref, running } = useMotionVisibility();
  const id = `flow-${useId().replace(/[^\w-]/g, "")}`;
  const accent = variant === "allowance" ? "coral" : variant === "guidance" ? "blue" : "mint";
  const labels = variant === "allowance" ? ["Parent", "Allowance", "Teen"] : variant === "guidance" ? ["Payment", "Family rules", "Review"] : ["Goal", "Teen saves", "Gift match"];
  return <div ref={ref} className={`flow-diagram ${compact ? "flow-compact" : ""}`} aria-label={`${labels.join(" to ")} illustration, not live transaction activity`} role="img" style={{ "--effect-accent": `var(--${accent})`, animationPlayState: running ? "running" : "paused" } as CSSProperties} data-running={running}>
    <svg viewBox="0 0 360 210" fill="none" aria-hidden="true"><defs><filter id={id} x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="3"/></filter></defs>
      <path d="M92 108C130 108 123 57 172 57M92 108C130 108 123 158 172 158" className="flow-path"/>
      <path d="M92 108C130 108 123 57 172 57" pathLength="100" className="flow-pulse"/>
      <path d="M92 108C130 108 123 158 172 158" pathLength="100" className="flow-pulse flow-pulse-second"/>
      <rect x="16" y="91" width="78" height="34" rx="10" className="flow-source"/><text x="55" y="112" textAnchor="middle" className="flow-source-label">{labels[0]}</text>
      <rect x="173" y="36" width="164" height="42" rx="12" className="flow-node"/><rect x="173" y="137" width="164" height="42" rx="12" className="flow-node"/>
      <rect x="173" y="36" width="164" height="42" rx="12" className="flow-node-glow" filter={`url(#${id})`}/>
      <text x="255" y="62" textAnchor="middle" className="flow-label">{labels[1]}</text><text x="255" y="163" textAnchor="middle" className="flow-label">{labels[2]}</text>
      <circle cx="156" cy="57" r="3" className="flow-dot"/><circle cx="156" cy="158" r="3" className="flow-dot"/>
    </svg>
    {!compact && <span className="diagram-caption">HOW IT CONNECTS · ILLUSTRATION</span>}
  </div>;
}
