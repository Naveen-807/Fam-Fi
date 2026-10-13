"use client";
import { Button, Card, Empty, FreshNote, Pill } from "./ui";
import { big, cap, fmt, timeAgo } from "@/lib/format";
import { explorerTx } from "@/lib/relay";
import type { Bundle } from "@/lib/private";
import { FamilyAvatar } from "./family-visuals";

/** A single confirmed money action, reconstructed from several contract events by Envio. */
export function SavingStory({ bundle, fetchedAt, error, onRetry }: { bundle: Bundle | null; fetchedAt: number; error: string | null; onRetry?: () => unknown }) {
  const receipts = bundle?.data.savingReceipts ?? [];
  const releases = bundle?.data.matchReleases ?? [];
  return (
    <Card title="Saved together" right={<Pill tone="mint">Confirmed contributions</Pill>}>
      {!bundle ? <Empty>{error || "Loading your savings story…"}</Empty> : !receipts.length ? (
        <Empty>Save toward a goal and see your contribution and family matching together here.</Empty>
      ) : (
        <ol className="space-y-4">
          {receipts.slice(0, 8).map((r) => {
            const own = big(r.ownAmount), matched = big(r.matchedAmount);
            const matches = releases.filter((m) => m.receiptId === r.id);
            const shownMatches = matches.reduce((sum, m) => sum + big(m.amount), 0n);
            const proof = explorerTx(r.txHash);
            return (
              <li key={r.id} className="rounded-2xl border border-line bg-card2 p-4">
                <p className="text-sm font-bold">{r.goalName}</p>
                {bundle.role === "PARENT" && <p className="text-xs text-dim">{cap(r.teenFamId)}&apos;s goal</p>}
                <div className="mt-3 flex flex-wrap items-baseline gap-2 text-sm">
                  <span><b className="num">{fmt(own)}</b> saved</span><span aria-hidden="true">+</span>
                  <span><b className="num text-brand">{fmt(matched)}</b> matched</span><span aria-hidden="true">=</span>
                  <span><b className="num">{fmt(own + matched)}</b> added</span>
                </div>
                <details className="mt-3"><summary>Details & receipt</summary>
                <p className="mt-2 text-xs text-muted">
                  {r.source === "MISSION" ? `Earned from “${r.missionTitle}”, approved by the parent and saved in the same transaction.` : "A confirmed contribution from the teen's balance."}
                </p>
                {matches.length > 0 && <ul className="mt-2 space-y-1 text-xs text-muted">{matches.map((m) => (
                  <li key={m.id} className="contributor-row"><FamilyAvatar name={m.sponsorFamId || "Family"}/>{m.sponsorFamId ? `@${m.sponsorFamId}` : "Family contributor"} matched <span className="num">{fmt(big(m.amount))}</span></li>
                ))}</ul>}
                {shownMatches !== matched && <p className="mt-1 text-xs text-dim">Some contributor details are not in this recent-history window. The matching total comes from the confirmed goal event.</p>}
                <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-dim">
                  <span>{fmt(big(r.totalAfter))} of {fmt(big(r.target))} after this action · {timeAgo(r.ts)}</span>
                  {proof && <a className="text-brand underline" href={proof} target="_blank" rel="noreferrer">View receipt</a>}
                </div>
                </details>
              </li>
            );
          })}
        </ol>
      )}
      {!!bundle?.data.gifts?.length && <details className="mt-4"><summary>Family support: reserved and released</summary><ul className="mt-3 space-y-2">{bundle.data.gifts.map(g=><li key={g.id} className="contributor-row text-sm"><FamilyAvatar name={g.sponsorFamId || "Family"}/><span>@{g.sponsorFamId || "contributor"} · {fmt(big(g.released))} released · {fmt(big(g.escrow))} reserved{g.deadline < Date.now()/1000 ? " (expired; reclaimable)" : ""}</span></li>)}</ul><p className="text-xs text-muted mt-2">Reserved gifts remain the contributor’s commitment. They are not funded goal progress. These amounts are indexed history and may lag the chain.</p></details>}
      <details className="mt-3 text-xs text-dim"><summary>About these contributions</summary><p>Family matching is gift money. Receipt totals describe each confirmed action, not the current goal balance.</p></details>
      {error && onRetry && <Button variant="ghost" onClick={() => void onRetry()}>Retry family summaries</Button>}
    </Card>
  );
}
