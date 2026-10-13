"use client";
import { useEffect, useState, type CSSProperties } from "react";
import { useMotionVisibility } from "./effects";
import Link from "next/link";
import type { Bundle, GoalRow } from "@/lib/private";
import { big, fmt } from "@/lib/format";

export function FamilyAvatar({ name, identity = name }: { name: string; identity?: string }) {
  const hue = [...identity.toLowerCase()].reduce((n, c) => (n * 31 + c.charCodeAt(0)) >>> 0, 0) % 3;
  return <span className={`family-avatar avatar-${hue}`} aria-hidden="true">{name.slice(0, 2).toUpperCase() || "?"}</span>;
}

export function FamilyConnections({ parent, teens, selected, onSelect }: { parent: string; teens: { id: string; famId: string; frozen?: boolean }[]; selected?: string; onSelect?: (id: string) => void }) {
  return <section className="family-connections" aria-label="Your connected family">
    <div className="family-person"><FamilyAvatar name={parent}/><strong>@{parent}</strong><small>Parent</small></div>
    <span className="family-connector" aria-hidden="true"/>
    <div className="family-members">
      {onSelect && teens.length > 0 && <button className={`family-person family-select ${!selected ? "selected" : ""}`} onClick={() => onSelect("")} aria-pressed={!selected}><span className="family-avatar">↔</span><strong>Everyone</strong><small>Family view</small></button>}
      {teens.map(t => <button key={t.id} className={`family-person family-select ${selected === t.id ? "selected" : ""}`} onClick={() => onSelect?.(t.id)} aria-pressed={selected === t.id} disabled={!onSelect}>
        <FamilyAvatar name={t.famId} identity={t.id}/><strong>@{t.famId}</strong><small>{t.frozen ? "Spending paused" : "Teen"}</small>
      </button>)}
      {!teens.length && <Link href="/parent?view=family" className="family-person"><span className="family-avatar">+</span><strong>Invite your teen</strong><small>Start together</small></Link>}
    </div>
  </section>;
}

export function Commitments({ bundle }: { bundle: Bundle | null }) {
  const c = bundle?.commitments;
  return <section className="commitments" aria-label="Committed for your family"><h2>Committed for your family</h2><div className="commitment-grid">
    {([['Allowance remaining', c?.allowance], ['Mission rewards', c?.missions], ['Held for the future', c?.futureFunds]] as const).map(([label, value]) => <div key={label}><span>{label}</span><strong className="num">{value == null ? "Not verified" : `$${fmt(big(value))}`}</strong></div>)}
  </div><p className="text-xs text-dim">Already reserved; separate from your available balance. {c?.coverage !== "complete" ? c?.reason ?? "Checking complete family coverage." : `Verified at block ${c.blockNumber}.`}</p></section>;
}

export function GoalIllustration({ title }: { title: string }) {
  const text = title.toLowerCase();
  const drawing = /bike|cycle/.test(text) ? <><circle cx="27" cy="70" r="17"/><circle cx="88" cy="70" r="17"/><path d="M27 70l19-33 20 33H27l29-22 32 22-13-43M70 27h16M41 37h14"/></> : /headphone|music|ear/.test(text) ? <><path d="M25 66V47a35 35 0 0 1 70 0v19"/><rect x="20" y="52" width="18" height="34" rx="8"/><rect x="82" y="52" width="18" height="34" rx="8"/></> : /book|college|school|study/.test(text) ? <><path d="M60 31c-14-11-30-10-43-5v56c15-5 28-4 43 6 15-10 28-11 43-6V26c-13-5-29-6-43 5v57"/><path d="M28 39l19 3M28 51l19 3M73 42l19-3M73 54l19-3"/></> : /travel|trip|holiday/.test(text) ? <><rect x="30" y="30" width="60" height="60" rx="10"/><path d="M47 30V19h26v11M44 42v34M76 42v34M39 90v7M81 90v7"/></> : <><circle cx="60" cy="57" r="35"/><circle cx="60" cy="57" r="22"/><circle cx="60" cy="57" r="8"/><path d="M60 57l36-36M85 21h11v11"/></>;
  return <svg viewBox="0 0 120 120" className="goal-illustration" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{drawing}</svg>;
}

export function GoalVisual({ goal }: { goal: { id: string; memo: string; target: unknown; saved: unknown; matched: unknown; status: string } }) {
  const {ref, running} = useMotionVisibility();
  const [pulse, setPulse] = useState(false);
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    const listener = (event: Event) => {
      if ((event as CustomEvent).detail?.goalId !== goal.id) return;
      setPulse(true); clearTimeout(timer); timer = setTimeout(() => setPulse(false), 1100);
    };
    window.addEventListener("famfi-contribution", listener);
    return () => { clearTimeout(timer); window.removeEventListener("famfi-contribution", listener); };
  }, [goal.id]);
  const target = big(goal.target);
  const percent = (value: bigint) => target > 0n ? Math.min(100, Number(value * 10000n / target) / 100) : 0;
  const own = percent(big(goal.saved)), match = Math.min(100 - own, percent(big(goal.matched)));
  return <div ref={ref} style={{"--scene-motion":running ? "running" : "paused"} as CSSProperties} className={`goal-scene ${pulse ? "contribution-confirmed" : ""} ${goal.status === "CLOSED" ? "goal-closed" : ""}`}>
    <svg className="goal-arcs" viewBox="0 0 160 160" aria-hidden="true"><circle cx="80" cy="80" r="71" pathLength="100" className="arc-track"/><circle cx="80" cy="80" r="71" pathLength="100" className="arc-own" strokeDasharray={`${own} ${100-own}`}/><circle cx="80" cy="80" r="71" pathLength="100" className="arc-match" strokeDasharray={`${match} ${100-match}`} strokeDashoffset={-own}/></svg>
    <GoalIllustration title={goal.memo}/><span className="contribution-light" aria-hidden="true"/>
  </div>;
}

export function FeaturedGoal({ goals }: { goals: GoalRow[] }) {
  const [selected, setSelected] = useState("");
  const active = goals.filter(g => g.status === "ACTIVE").sort((a,b) => a.deadline-b.deadline || a.id.localeCompare(b.id));
  const goal = active.find(g => g.id === selected) ?? active[0];
  if (!goal) return <section className="featured-goal"><GoalIllustration title=""/><div><p className="eyebrow">A GOAL TO SHARE</p><h2>What’s next for your family?</h2><Link className="text-link" href="?view=savings">Explore goals →</Link></div></section>;
  return <section className="featured-goal"><GoalVisual goal={goal}/><div><p className="eyebrow">YOUR NEXT GOAL</p><h2>{goal.memo || "Goal name syncing"}</h2><p><strong>${fmt(big(goal.saved)+big(goal.matched))}</strong> of ${fmt(big(goal.target))}</p><p className="text-sm text-muted">{fmt(big(goal.saved))} saved · {fmt(big(goal.matched))} family matching</p>{active.length > 1 && <label className="block mt-3 text-sm">Choose goal<select className="ml-2 bg-card2 rounded-lg p-2" value={goal.id} onChange={e=>setSelected(e.target.value)}>{active.map(g=><option key={g.id} value={g.id}>{g.memo}</option>)}</select></label>}<Link className="text-link" href="?view=savings">View goal →</Link></div></section>;
}
