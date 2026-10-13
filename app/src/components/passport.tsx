"use client";
import { Card, Empty } from "@/components/ui";
import { explorerTx } from "@/lib/relay";
import { fmt, big, dateTimeText } from "@/lib/format";
import type { Bundle } from "@/lib/private";

const MILESTONES = [
  ["MISSION_APPROVED", "First mission earned", "Your parent approved your work."],
  ["SAVED", "First step toward a goal", "You put money toward something that matters."],
  ["GOAL_COMPLETED", "First goal reached", "Your saving journey reached its target."],
  ["MATCHED", "Family help unlocked", "Your saving unlocked a matching contribution."],
] as const;

/** Milestones use complete backfilled first-event entities, never a recent-history guess. */
export function Passport({ bundle, fetchedAt, error }: { bundle: Bundle | null; fetchedAt: number; error: string | null }) {
  const achievements = bundle?.data.achievements ?? [];
  const missing = !bundle || !!error || !!bundle.indexerError || bundle.freshness?.lagBlocks == null || bundle.freshness.lagBlocks > 10;
  return <Card title="Progress Passport">
    <p className="text-sm text-muted mb-4">{bundle?.role === "PARENT" ? "Your family’s small steps, remembered. Review progress together before choosing more independence." : "Your small steps, remembered. You and your parent decide what comes next."}</p>
    <div className="passport-milestones">{MILESTONES.map(([kind, title, description]) => {
      const earned = achievements.filter(a=>a.kind===kind);
      return <section key={kind} className={earned.length ? "milestone earned" : "milestone"}>
        <span className="milestone-stamp" aria-hidden="true">{earned.length ? "✓" : "○"}</span>
        <h3>{title}</h3><p>{description}</p>
        {earned.length ? <details><summary>See achievement</summary>{earned.map(a=><p key={a.id} className="mt-2 text-xs">{bundle?.role === "PARENT" ? `@${bundle.data.teens?.find(t=>t.id===a.teen)?.famId ?? "teen"} · ` : ""}Confirmed {dateTimeText(a.ts)} · block {a.blockNumber} <a className="text-link" href={explorerTx(a.txHash)} target="_blank" rel="noreferrer">View proof ↗</a></p>)}</details> : <small>{missing ? "History updating" : "Your next milestone"}</small>}
      </section>;
    })}</div>
    <details className="mt-4"><summary>Lifetime progress details</summary>
      {!bundle ? <Empty>Loading your progress…</Empty> : bundle.data.progress.length === 0 ? <p className="mt-2 text-sm">{missing ? "Progress history is not yet complete." : "Your first confirmed achievement starts the story."}</p> : bundle.data.progress.map(p=><dl key={p.id} className="progress-totals">
        <dt>@{p.teenFamId}</dt><dd>{p.missionsCompleted} missions · {p.goalsCompleted} goals reached</dd>
        <dt>Rewards earned</dt><dd>{fmt(big(p.missionRewards))}</dd>
        <dt>Lifetime personal contributions</dt><dd>{fmt(big(p.savedTotal))}</dd>
        <dt>Family matching received</dt><dd>{fmt(big(p.matchedTotal))}</dd>
      </dl>)}
      <p className="text-xs text-muted mt-3">Historical contributions, not current balances. No score or automatic change to family rules. {fetchedAt ? "Last refreshed "+new Date(fetchedAt).toLocaleTimeString() : ""}</p>
    </details>
  </Card>;
}
