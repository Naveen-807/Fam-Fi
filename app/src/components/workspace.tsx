"use client";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import type { ReactNode } from "react";

export type WorkspaceSection = { id: string; label: string; note: string; icon: string };
export const parentSections: WorkspaceSection[] = [
  { id: "overview", label: "Home", note: "Your family's money, in view.", icon: "overview" },
  { id: "family", label: "Family", note: "More independence. The right amount of guidance.", icon: "family" },
  { id: "missions", label: "Missions", note: "Small achievements, with something real behind them.", icon: "missions" },
  { id: "savings", label: "Goals & future", note: "Make room for the things that matter.", icon: "savings" },
  { id: "activity", label: "Activity", note: "The story behind every confirmed action.", icon: "activity" },
];
export const teenSections: WorkspaceSection[] = [
  { id: "overview", label: "Home", note: "A little independence, every day.", icon: "overview" },
  { id: "payments", label: "Pay & ask", note: "Send by name. Split with friends. Keep it simple.", icon: "payments" },
  { id: "missions", label: "Missions", note: "Your next achievement starts here.", icon: "missions" },
  { id: "savings", label: "Goals & future", note: "Big plans begin with small steps.", icon: "savings" },
  { id: "activity", label: "My progress", note: "See how far you've come.", icon: "activity" },
];
export function useWorkspaceView(sections: WorkspaceSection[]) {
  const q = useSearchParams();
  return sections.find((s) => s.id === q.get("view"))?.id ?? (q.has("pay") && sections.some((s) => s.id === "payments") ? "payments" : "overview");
}
export function NavIcon({ name }: { name: string }) {
  const paths: Record<string, ReactNode> = {
    overview: <><rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" /></>,
    family: <><circle cx="9" cy="8" r="3" /><path d="M3 21v-3a6 6 0 0 1 12 0v3M16 5a3 3 0 0 1 0 6M18 15a5 5 0 0 1 3 5" /></>,
    missions: <><rect x="5" y="4" width="14" height="17" rx="2" /><path d="M9 3h6v4H9zM9 13l2 2 4-4" /></>,
    savings: <><path d="M12 21V9M12 14C4 14 3 9 3 4c7 0 9 3 9 8M12 17c7 0 9-4 9-9-6 0-9 3-9 7" /></>,
    activity: <><path d="M4 7h16M4 12h12M4 17h16" /><circle cx="20" cy="12" r="1" /></>,
    payments: <><rect x="3" y="5" width="18" height="15" rx="2" /><path d="M3 9h18M15 15h3" /></>,
  };
  return <svg viewBox="0 0 24 24" width="19" height="19" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name] ?? paths.overview}</svg>;
}
export function Workspace({ sections, view, famId, role, children }: { sections: WorkspaceSection[]; view: string; famId: string; role: string; children: ReactNode }) {
  const path = usePathname();
  const query = useSearchParams();
  const current = sections.find((s) => s.id === view)!;
  const href = (id: string) => { const q = new URLSearchParams(query.toString()); q.set("view", id); return `${path}?${q}`; };
  return <div className="workspace">
    <aside className="workspace-sidebar">
      <div className="workspace-profile"><span className="profile-initial">{famId.slice(0, 1).toUpperCase()}</span><div><strong>@{famId}</strong><span>{role === "parent" ? "Family account" : "Teen account"}</span></div></div>
      <p className="nav-caption">YOUR SPACE</p>
      <nav aria-label={`${role} navigation`} className="workspace-nav">{sections.map((s) => <Link key={s.id} href={href(s.id)} aria-current={view === s.id ? "page" : undefined}><NavIcon name={s.icon} /><span>{s.label}</span>{view === s.id && <span className="nav-current-dot" />}</Link>)}</nav>
      <div className="sidebar-note"><span className="orbit-mark" aria-hidden="true"><i/><i/><i/></span><strong>Room to grow.</strong><p>Real habits. Small steps.<br />A future of their own.</p></div>
      <p className="sidebar-test">Monad testnet <span>·</span> Test USDC<br /><span>Test dollars have no real value.</span></p>
    </aside>
    <main className="workspace-main" id="main-content">
      <header className="workspace-heading"><div><p className="eyebrow">{role === "parent" ? "FAMILY FINANCE" : "MY MONEY"} <span>/</span> {current.label}</p><h1>{view === "overview" ? `Hello, ${famId.charAt(0).toUpperCase() + famId.slice(1)}.` : current.label}</h1><p>{current.note}</p></div><div className="heading-mark" aria-hidden="true"><NavIcon name={current.icon} /></div></header>
      <div className="workspace-content" key={view}>{children}</div>
    </main>
  </div>;
}
