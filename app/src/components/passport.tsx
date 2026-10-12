"use client";
import { Card, Empty, FreshNote, GoalCard, Pill } from "@/components/ui";
import { explorerTx } from "@/lib/relay";
import { big, dateTimeText, fmt, timeAgo } from "@/lib/format";
import type { Bundle } from "@/lib/private";

const KIND: Record<string, string> = { MISSION_APPROVED: "mission", SAVED: "saving", GOAL_COMPLETED: "goal reached", PAYMENT: "payment" };

function Stat({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <div className="rounded-2xl bg-card2 p-3" title={hint}>
      <p className="num text-2xl font-extrabold">{value}</p>
      <p className="text-xs font-semibold text-muted">{label}</p>
    </div>
  );
}

/** The teen's Progress Passport: counts of confirmed, responsible actions, straight from the indexed chain events. There is no score. */
export function Passport({ bundle, fetchedAt, error }: { bundle: Bundle | null; fetchedAt: number; error: string | null }) {
  const p = bundle?.data.progress[0];
  const goals = (bundle?.data.goals ?? []).filter((g) => g.status === "ACTIVE" || g.status === "COMPLETE");
  const history = bundle?.data.history ?? [];
  return (
    <Card title="Progress Passport" right={p ? <Pill tone="mint">{p.missionsCompleted + p.goalsCompleted} wins</Pill> : undefined}>
      {!bundle ? <Empty>Loading…</Empty> : (
        <>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <Stat label="Missions completed" value={String(p?.missionsCompleted ?? 0)} hint="Missions your parent approved" />
            <Stat label="Mission rewards earned" value={`$${fmt(big(p?.missionRewards))}`} hint="Paid when a parent approved" />
            <Stat label="Saved toward goals" value={`$${fmt(big(p?.savedTotal))}`} hint="Your own contributions to goals, including mission rewards you saved" />
            <Stat label="Goals reached" value={String(p?.goalsCompleted ?? 0)} hint="Goals that hit their target" />
            <Stat label="Payments completed" value={String(p?.paymentsCompleted ?? 0)} hint="Payments that went through inside your family's rules" />
          </div>
          <p className="mt-3 text-xs text-dim">
            Only things that really happened count: an approved mission, money you saved, a goal you reached, a payment that went through inside your family&apos;s rules.
            Sent-back missions, held payments and repeats don&apos;t. How much you spend never counts.
          </p>

          {goals.length > 0 && (
            <div className="mt-5">
              <h3 className="mb-2 text-sm font-bold">Your goals</h3>
              <div className="space-y-3">{goals.map((g) => <GoalCard key={g.id} g={g} />)}</div>
            </div>
          )}

          <h3 className="mb-2 mt-5 text-sm font-bold">Recent progress</h3>
          {history.length === 0 ? <Empty>Nothing counted yet. Finish a mission or save toward a goal and it shows up here.</Empty> : (
            <ol className="space-y-3">
              {history.slice(0, 12).map((h) => {
                const link = explorerTx(h.txHash);
                return (
                  <li key={h.id} className="flex gap-3">
                    <span className="mt-1.5 h-2.5 w-2.5 flex-none rounded-full bg-brand" />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm leading-snug">{h.text}</p>
                      <p className="mt-0.5 text-xs text-dim">
                        {KIND[h.kind] ?? h.kind} · {timeAgo(h.ts)} · block {h.blockNumber} ·{" "}
                        {link ? <a className="underline" href={link} target="_blank" rel="noreferrer">proof</a> : <span className="font-mono">{h.txHash.slice(0, 10)}…</span>}
                      </p>
                    </div>
                    {big(h.amount) > 0n && h.kind !== "PAYMENT" && <span className="num flex-none text-sm font-semibold text-dim">{fmt(big(h.amount))}</span>}
                  </li>
                );
              })}
            </ol>
          )}
          <div className="mt-4 space-y-1">
            <p className="text-xs text-dim">
              {p ? `Last counted action: ${dateTimeText(p.lastEventTs)} (block ${p.lastEventBlock}).` : "No counted actions yet."}
            </p>
            <FreshNote fetchedAt={fetchedAt} error={error} blockNumber={p?.lastEventBlock} />
          </div>
        </>
      )}
    </Card>
  );
}
