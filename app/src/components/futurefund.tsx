"use client";
import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { ActionError, Button, Card, ConfirmDialog, Empty, Field, FreshNote, Input, Pill, Progress } from "@/components/ui";
import { ChainFund, readFund } from "@/lib/chain";
import { big, byteLen, cap, dateText, dayString, endOfDay, fmt, parseAmount } from "@/lib/format";
import { useAct } from "@/lib/hooks";
import { explorerTx, relay } from "@/lib/relay";
import type { Bundle, FundEntryRow, FundRow, MissionRow } from "@/lib/private";
import type { Changed } from "@/components/missions";
import { useWallet } from "@/lib/wallet";

/** Said wherever FutureFund money appears, so nobody mistakes locked ledger money for an investment. */
export const CUSTODY =
  "Locked savings · No yield. Held in Fam-Fi until released to your teen. Test USDC has no real value.";

const Src = ({ tx }: { tx: string }) => {
  const l = explorerTx(tx);
  return l ? <a className="underline" href={l} target="_blank" rel="noreferrer">proof</a> : <span className="font-mono">{tx.slice(0, 10)}…</span>;
};

/** The contract's own number for a fund (the indexer is only used for history). */
function useChainFund(id: string) {
  const [f, setF] = useState<ChainFund | null>(null);
  const refresh = useCallback(async () => { try { setF(await readFund(id)); } catch { /* keep last */ } }, [id]);
  useEffect(() => { void refresh(); const t = setInterval(refresh, 4000); return () => clearInterval(t); }, [refresh]);
  return { f, refresh };
}

export function MoneyStory({ entries, status }: { entries: FundEntryRow[]; status: string }) {
  const rows = [...entries].sort((a, b) => a.blockNumber - b.blockNumber || (a.id < b.id ? -1 : 1));
  return (
    <div>
      <h4 className="mb-2 text-sm font-bold">Money story</h4>
      {rows.length === 0 ? <Empty>Nothing has happened here yet. When a contribution is confirmed, it shows up in this story.</Empty> : (
        <ol className="space-y-3">
          {rows.map((e) => (
            <li key={e.id} className="flex gap-3">
              <span className="mt-1.5 h-2.5 w-2.5 flex-none rounded-full bg-brand" />
              <div className="min-w-0">
                <p className="text-sm leading-snug">{e.text}.</p>
                <p className="mt-0.5 text-xs text-dim">{new Date(e.ts * 1000).toLocaleDateString()} · block {e.blockNumber} · <Src tx={e.txHash} /></p>
              </div>
            </li>
          ))}
        </ol>
      )}
      <p className="mt-3 rounded-xl bg-card2 px-3 py-2 text-sm text-muted">{status}</p>
    </div>
  );
}

const storyStatus = (f: ChainFund | null, row: FundRow) =>
  (f?.status ?? row.status) === "RELEASED"
    ? "This FutureFund has been paid out to the teen's spendable balance. Nothing is held in it any more."
    : "Your funds have not been invested. They are held in Fam-Fi and counted exactly: nothing is added to them and nothing can be lost to the market.";

// ───────────────────────── parent ─────────────────────────

export function ParentFutureFund({
  teens, funds, entries, missions, balance, onChanged, fetchedAt, error,
}: {
  teens: { id: string; famId: string }[]; funds: FundRow[]; entries: FundEntryRow[]; missions: MissionRow[]; balance: bigint;
  onChanged: Changed; fetchedAt: number; error: string | null;
}) {
  const { signer } = useWallet();
  const { busy, run, error: actionError } = useAct();
  const [teen, setTeen] = useState("");
  const [name, setName] = useState("");
  const [purpose, setPurpose] = useState("");
  const fundingQuery = useSearchParams();
  const [target, setTarget] = useState(fundingQuery.get("allocate") === "future" ? fundingQuery.get("amount") ?? "" : "");
  const [date, setDate] = useState(dayString(365));
  const [confirm, setConfirm] = useState(false);
  const t = teens.find((x) => x.id === teen) ?? teens[0];
  const tgt = parseAmount(target);
  const horizon = endOfDay(date);
  const now = Math.floor(Date.now() / 1000);
  const problem = !t ? "Invite a teen first." : !name.trim() ? "Give the FutureFund a name." : byteLen(name) > 60 ? "The name is too long." : byteLen(purpose) > 200 ? "The purpose is too long (200 characters at most)." : tgt === null ? "Enter a target amount, e.g. 500." : horizon === null || horizon <= now ? "Pick a date in the future." : horizon > now + 40 * 365 * 86400 ? "Pick a date within 40 years." : null;

  return (
    <Card title="FutureFund" right={<Pill tone="slate">not invested</Pill>}>
      <ActionError error={actionError}/><p className="text-sm text-muted">A long-term pot for your teen&apos;s future. You decide the target and the date; your teen can see everything that happens to it.</p>
      <p className="mt-2 rounded-xl bg-card2 px-3 py-2 text-xs text-dim">{CUSTODY}</p>

      {teens.length > 0 && (
        <form className="mt-4 space-y-3" onSubmit={(e) => { e.preventDefault(); if (!problem) setConfirm(true); }}>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Teen">
              <select value={t?.id} onChange={(e) => setTeen(e.target.value)} className="w-full rounded-2xl border border-line bg-card2 px-4 py-3 text-sm">
                {teens.map((x) => <option key={x.id} value={x.id}>{cap(x.famId)}</option>)}
              </select>
            </Field>
            <Field label="Name"><Input maxLength={60} placeholder="College" value={name} onChange={(e) => setName(e.target.value)} /></Field>
          </div>
          <Field label="What it's for (optional)"><Input maxLength={200} value={purpose} onChange={(e) => setPurpose(e.target.value)} /></Field>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Target (USDC)"><Input inputMode="decimal" placeholder="500" value={target} onChange={(e) => setTarget(e.target.value)} /></Field>
            <Field label="Intended date" hint="Your teen can claim the money from this day. You can release it earlier."><Input type="date" min={dayString(1)} value={date} onChange={(e) => setDate(e.target.value)} /></Field>
          </div>
          {problem && (name || target) && <p className="text-sm text-warn">{problem}</p>}
          <Button type="submit" disabled={!!problem} busy={busy === "fcreate"}>Open FutureFund</Button>
        </form>
      )}
      <ConfirmDialog
        open={confirm} title="Open this FutureFund?" confirmLabel="Open it" busy={busy === "fcreate"}
        onCancel={() => setConfirm(false)}
        onConfirm={async () => {
          const ok = await run("fcreate", async () => {
            const tx = await relay(signer!, "createFutureFund", [t.id, tgt!, BigInt(horizon!), name.trim(), purpose.trim()]);
            const fundId = tx.events.find((e) => e.name === "FundCreated")?.args.fundId;
            await onChanged((b) => b.data.funds.some((f) => f.id === String(fundId)));
            return tx;
          }, "FutureFund opened. Add money whenever you like.");
          setConfirm(false);
          if (ok) { setName(""); setPurpose(""); setTarget(""); }
        }}
        lines={["Opening it moves no money.", `Target ${tgt ? fmt(tgt) : ""} for ${t ? cap(t.famId) : ""}, from ${horizon ? dateText(horizon) : ""}.`, "Money you add later is locked here, not invested, and ends up with your teen."]}
      />

      <div className="mt-5 space-y-4">
        {funds.length === 0 ? <Empty>No FutureFund yet.</Empty> : funds.map((f) => (
          <ParentFund key={f.id} row={f} entries={entries.filter((e) => e.fundId === f.id)} reserved={missions.filter((m) => m.teenFamId === f.teenFamId && ["ACTIVE", "SUBMITTED", "REJECTED"].includes(m.status)).reduce((a, m) => a + big(m.reward), 0n)} balance={balance} onChanged={onChanged} />
        ))}
      </div>
      {error && <p className="mt-3 text-xs text-bad" role="status">Future savings history is unavailable. Please retry family access.</p>}
    </Card>
  );
}

function ParentFund({ row, entries, reserved, balance, onChanged }: { row: FundRow; entries: FundEntryRow[]; reserved: bigint; balance: bigint; onChanged: Changed }) {
  const { signer } = useWallet();
  const { busy, run, error: actionError } = useAct();
  const { f, refresh } = useChainFund(row.id);
  const fundingQuery = useSearchParams();
  const [amount, setAmount] = useState(fundingQuery.get("allocate") === "future" ? fundingQuery.get("amount") ?? "" : "");
  const [ask, setAsk] = useState<null | "add" | "release">(null);
  const funded = f?.funded ?? big(row.funded);
  const target = f?.target ?? big(row.target);
  const open = (f?.status ?? row.status) === "OPEN";
  const amt = parseAmount(amount);
  const bad = amt === null ? "Enter an amount." : amt > balance ? "That's more than your balance." : null;

  return (
    <div className="rounded-2xl border border-line bg-card2/60 p-4"><ActionError error={actionError}/>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="font-semibold">{row.name} <span className="text-sm font-normal text-dim">for {cap(row.teenFamId)}</span></p>
          {row.purpose && <p className="text-sm text-muted">{row.purpose}</p>}
        </div>
        <Pill tone={open ? "mint" : "slate"}>{open ? "open" : "paid out"}</Pill>
      </div>
      <div className="mt-3"><Progress value={funded} max={target} /></div>
      <dl className="num mt-2 grid grid-cols-3 gap-2 text-xs">
        <div><dt className="text-dim">Contributed (locked)</dt><dd className="text-sm font-semibold">{fmt(funded)}</dd></div>
        <div><dt className="text-dim">Family target</dt><dd className="text-sm font-semibold">{fmt(target)}</dd></div>
        <div><dt className="text-dim">Set aside for missions</dt><dd className="text-sm font-semibold">{fmt(reserved)}</dd></div>
      </dl>
      <p className="mt-1 text-xs text-dim">Intended date {dateText(row.horizon)}. Mission money is a separate pot; it never counts here.</p>
      {open && (
        <div className="mt-3 flex flex-wrap items-end gap-2">
          <div className="w-32"><Input aria-label="Amount to add" inputMode="decimal" placeholder="10" value={amount} onChange={(e) => setAmount(e.target.value)} /></div>
          <Button disabled={!!bad} onClick={() => setAsk("add")}>Add</Button>
          <Button variant="ghost" disabled={funded === 0n} onClick={() => setAsk("release")}>Release to {cap(row.teenFamId)} now</Button>
        </div>
      )}
      <details className="mt-4"><summary>Details & money story</summary><MoneyStory entries={entries} status={storyStatus(f, row)} /></details>

      <ConfirmDialog
        open={ask === "add"} title="Add to this FutureFund?" confirmLabel={`Add ${amt ? fmt(amt) : ""}`} busy={busy === "fadd" + row.id}
        onCancel={() => setAsk(null)}
        onConfirm={async () => {
          await run("fadd" + row.id, async () => {
            if ((await readFund(row.id)).status !== "OPEN") throw new Error("That FutureFund has already been paid out.");
            const tx = await relay(signer!, "contributeFutureFund", [BigInt(row.id), amt!]);
            await refresh();
            await onChanged((b) => b.data.fundEntries.some((e) => e.txHash.toLowerCase() === tx.hash.toLowerCase()));
            return tx;
          }, "Contribution confirmed. It's held in Fam-Fi, not invested.");
          setAsk(null); setAmount("");
        }}
        lines={amt ? [<>{fmt(amt)} leaves your spendable balance: {fmt(balance)} → <b>{fmt(balance - amt)}</b>.</>, "It's locked in this FutureFund. It isn't invested and earns nothing.", "It goes to your teen, on the intended date or when you release it. You can't take it back."] : []}
      />
      <ConfirmDialog
        open={ask === "release"} danger title="Release the whole FutureFund now?" confirmLabel={`Release ${fmt(funded)}`} busy={busy === "frel" + row.id}
        onCancel={() => setAsk(null)}
        onConfirm={async () => {
          await run("frel" + row.id, async () => {
            if ((await readFund(row.id)).status !== "OPEN") throw new Error("That FutureFund has already been paid out.");
            const tx = await relay(signer!, "releaseFutureFund", [BigInt(row.id)]);
            await refresh();
            await onChanged((b) => b.data.funds.some((x) => x.id === row.id && x.status === "RELEASED"));
            return tx;
          }, `${fmt(funded)} is now ${cap(row.teenFamId)}'s to spend`);
          setAsk(null);
        }}
        lines={[`${fmt(funded)} goes to ${cap(row.teenFamId)}'s spendable balance right away.`, "The FutureFund closes. This can't be undone."]}
      />
    </div>
  );
}

// ───────────────────────── teen ─────────────────────────

export function TeenFutureFund({ bundle, onChanged, fetchedAt, error }: { bundle: Bundle | null; onChanged: Changed; fetchedAt: number; error: string | null }) {
  const funds = bundle?.data.funds ?? [];
  return (
    <Card title="FutureFund" right={<Pill tone="slate">not invested</Pill>}>
      {!bundle ? <Empty>Loading…</Empty> : funds.length === 0 ? (
        <Empty>No FutureFund yet. If your parent opens one for you, you&apos;ll see exactly what&apos;s in it and what happened, right here.</Empty>
      ) : (
        <div className="space-y-5">
          {funds.map((f) => <TeenFund key={f.id} row={f} entries={bundle.data.fundEntries.filter((e) => e.fundId === f.id)} onChanged={onChanged} />)}
        </div>
      )}
      <p className="mt-4 text-xs text-muted">{CUSTODY}</p>
    </Card>
  );
}

function TeenFund({ row, entries, onChanged }: { row: FundRow; entries: FundEntryRow[]; onChanged: Changed }) {
  const { signer } = useWallet();
  const { busy, run, error: actionError } = useAct();
  const { f, refresh } = useChainFund(row.id);
  const [ask, setAsk] = useState(false);
  const funded = f?.funded ?? big(row.funded);
  const target = f?.target ?? big(row.target);
  const open = (f?.status ?? row.status) === "OPEN";
  const reached = Math.floor(Date.now() / 1000) >= row.horizon;
  return (
    <div className="rounded-2xl border border-line bg-card2/60 p-4"><ActionError error={actionError}/>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="font-semibold">{row.name}</p>
          {row.purpose && <p className="text-sm text-muted">{row.purpose}</p>}
        </div>
        <Pill tone={open ? "mint" : "slate"}>{open ? "locked" : "paid out"}</Pill>
      </div>
      <div className="mt-3"><Progress value={funded} max={target} /></div>
      <p className="num mt-1.5 text-xs text-dim">{fmt(funded)} confirmed of your family&apos;s {fmt(target)} target · date {dateText(row.horizon)}</p>
      <p className="mt-2 text-sm text-muted">
        {open
          ? funded === 0n ? "Nothing has been added yet."
            : reached ? `You can claim ${fmt(funded)} now. It moves to your spendable balance.` : `${fmt(funded)} is locked for you until ${dateText(row.horizon)}, unless your parent releases it sooner.`
          : "This FutureFund has been paid out to your balance."}
      </p>
      {open && reached && funded > 0n && <div className="mt-3"><Button onClick={() => setAsk(true)}>Claim {fmt(funded)}</Button></div>}
      <details className="mt-4"><summary>Details & money story</summary><MoneyStory entries={entries} status={storyStatus(f, row)} /></details>
      <ConfirmDialog
        open={ask} title="Claim your FutureFund?" confirmLabel={`Claim ${fmt(funded)}`} busy={busy === "fclaim" + row.id}
        onCancel={() => setAsk(false)}
        onConfirm={async () => {
          await run("fclaim" + row.id, async () => {
            if ((await readFund(row.id)).status !== "OPEN") throw new Error("That FutureFund has already been paid out.");
            const tx = await relay(signer!, "claimFutureFund", [BigInt(row.id)]);
            await refresh();
            await onChanged((b) => b.data.funds.some((x) => x.id === row.id && x.status === "RELEASED"));
            return tx;
          }, `${fmt(funded)} is now in your balance`);
          setAsk(false);
        }}
        lines={[`${fmt(funded)} moves to your spendable balance.`, "Your family's rules (like daily limits and freezes) apply when you spend it.", "The FutureFund closes."]}
      />
    </div>
  );
}
