"use client";
import { useMemo, useState } from "react";
import { Button, Card, Empty, FreshNote, Pill } from "@/components/ui";
import { explorerTx } from "@/lib/relay";
import { big, cap, dateText, fmt } from "@/lib/format";
import type { Bundle, WeekRow } from "@/lib/private";

const DAY = 86400;
/** Local-week index (Monday start) for a UTC time in the family's time zone; identical to the indexer's `weekOf`. */
export const weekOf = (tsSec: number, tz: number) => Math.floor((Math.floor((tsSec + tz) / DAY) + 3) / 7);
const weekStartTs = (week: number, tz: number) => (week * 7 - 3) * DAY - tz;

function Tile({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-2xl bg-card2 p-3">
      <p className="num text-xl font-extrabold">{value}</p>
      <p className="text-xs font-semibold text-muted">{label}</p>
      {sub && <p className="mt-0.5 text-[11px] text-dim">{sub}</p>}
    </div>
  );
}

const sum = (rows: WeekRow[], f: (r: WeekRow) => bigint) => rows.reduce((a, r) => a + f(r), 0n);
const isum = (rows: WeekRow[], f: (r: WeekRow) => number) => rows.reduce((a, r) => a + f(r), 0);

/** Parent's Weekly Brief: one local Monday-to-Sunday week from indexed events, with every number traceable to its source. */
export function WeeklyBrief({ bundle, fetchedAt, error }: { bundle: Bundle | null; fetchedAt: number; error: string | null }) {
  const tz = bundle?.data.family[0]?.tzOffset ?? 0;
  const current = weekOf(Math.floor(Date.now() / 1000), tz);
  const [back, setBack] = useState(0);
  const week = current - back;

  const rows = useMemo(() => (bundle?.data.weeks ?? []).filter((w) => w.week === week), [bundle, week]);
  const start = weekStartTs(week, tz);
  const end = start + 7 * DAY;
  const holds = (bundle?.data.holds ?? []).filter((h) => h.createdAt >= start && h.createdAt < end);
  const sources = (bundle?.data.history ?? []).filter((h) => h.ts >= start && h.ts < end);
  const waiting = {
    missions: (bundle?.data.missions ?? []).filter((m) => m.status === "SUBMITTED"),
    requests: bundle?.data.requests ?? [],
    holds: (bundle?.data.holds ?? []).filter((h) => h.status === "OPEN"),
  };
  const lastBlock = Math.max(0, ...(bundle?.data.progress ?? []).map((p) => p.lastEventBlock));

  return (
    <Card
      title="Weekly brief"
      right={
        <div className="flex items-center gap-1">
          <Button variant="ghost" className="!px-3 !py-1.5" disabled={back >= 7} onClick={() => setBack(back + 1)}>← Earlier</Button>
          <Button variant="ghost" className="!px-3 !py-1.5" disabled={back === 0} onClick={() => setBack(back - 1)}>Later →</Button>
        </div>
      }
    >
      {!bundle ? <Empty>Loading…</Empty> : (
        <>
          <p className="text-sm font-semibold">
            {dateText(start)} to {dateText(end - 1)} {back === 0 && <Pill tone="mint">this week</Pill>}
          </p>
          <p className="text-xs text-dim">Weeks run Monday to Sunday in your family&apos;s time zone.</p>

          <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
            <Tile label="Missions completed" value={String(isum(rows, (r) => r.missionsCompleted))} />
            <Tile label="Mission rewards paid" value={`$${fmt(sum(rows, (r) => big(r.missionRewards)))}`} />
            <Tile label="Saved toward goals" value={`$${fmt(sum(rows, (r) => big(r.savedTotal)))}`} />
            <Tile label="Goals reached" value={String(isum(rows, (r) => r.goalsCompleted))} />
            <Tile label="Payments completed" value={String(isum(rows, (r) => r.paymentsCompleted))} />
            <Tile label="Allowance funded" value={`$${fmt(sum(rows, (r) => big(r.allowanceFunded)))}`} />
          </div>
          {rows.length === 0 && <p className="mt-2 text-sm text-muted">Nothing counted this week yet.</p>}
          {rows.length > 1 && (
            <ul className="mt-3 space-y-1 text-sm text-muted">
              {rows.map((r) => (
                <li key={r.id}>{cap(r.teenFamId)}: {r.missionsCompleted} missions, ${fmt(big(r.savedTotal))} saved, {r.paymentsCompleted} payments</li>
              ))}
            </ul>
          )}

          <h3 className="mb-2 mt-5 text-sm font-bold">Waiting on you now</h3>
          <div className="flex flex-wrap gap-2">
            <Pill tone={waiting.missions.length ? "sun" : "slate"}>{waiting.missions.length} mission{waiting.missions.length === 1 ? "" : "s"} to review</Pill>
            <Pill tone={waiting.holds.length ? "sun" : "slate"}>{waiting.holds.length} held payment{waiting.holds.length === 1 ? "" : "s"}</Pill>
            <Pill tone={waiting.requests.length ? "sun" : "slate"}>{waiting.requests.length} money request{waiting.requests.length === 1 ? "" : "s"}</Pill>
          </div>
          <p className="mt-1 text-xs text-dim">These are open right now (pending), not part of the confirmed totals above.</p>

          <h3 className="mb-2 mt-5 text-sm font-bold">Held payments this week</h3>
          {holds.length === 0 ? <p className="text-sm text-muted">None.</p> : (
            <ul className="space-y-1 text-sm">
              {holds.map((h) => (
                <li key={h.id} className="flex flex-wrap items-center justify-between gap-2">
                  <span>{cap(h.fromFamId)} → {cap(h.toFamId)} · <span className="num">{fmt(big(h.amount))}</span></span>
                  <Pill tone={h.status === "OPEN" ? "sun" : h.status === "EXECUTED" ? "mint" : "slate"}>
                    {h.status === "OPEN" ? "still held" : h.status === "EXECUTED" ? "went through" : h.status === "REJECTED" ? "rejected" : "cancelled"}
                  </Pill>
                </li>
              ))}
            </ul>
          )}

          <h3 className="mb-2 mt-5 text-sm font-bold">Where these numbers come from</h3>
          {sources.length === 0 ? <p className="text-sm text-muted">No counted events this week.</p> : (
            <ul className="space-y-1.5 text-sm">
              {sources.slice(0, 15).map((h) => {
                const link = explorerTx(h.txHash);
                return (
                  <li key={h.id} className="flex flex-wrap items-baseline justify-between gap-2">
                    <span className="min-w-0">{cap(rows.find((r) => r.teen === h.teen)?.teenFamId ?? "")} · {h.text}</span>
                    <span className="text-xs text-dim">{link ? <a className="underline" href={link} target="_blank" rel="noreferrer">proof</a> : <span className="font-mono">{h.txHash.slice(0, 10)}…</span>}</span>
                  </li>
                );
              })}
            </ul>
          )}
          <div className="mt-4"><FreshNote fetchedAt={fetchedAt} error={error} blockNumber={lastBlock || undefined} /></div>
          <p className="mt-1 text-xs text-dim">Totals are confirmed on-chain events only. There are no estimates or forecasts.</p>
        </>
      )}
    </Card>
  );
}
