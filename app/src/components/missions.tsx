"use client";
import { useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { MissionReview } from "./mission-review";
import { ActionError, Button, Card, ConfirmDialog, Empty, Field, Input, Pill } from "@/components/ui";
import { readMission } from "@/lib/chain";
import { byteLen, big, cap, dateText, dateTimeText, dayString, endOfDay, fmt, parseAmount } from "@/lib/format";
import { useAct } from "@/lib/hooks";
import { explorerTx, relay } from "@/lib/relay";
import type { Bundle, GoalRow, MissionRow } from "@/lib/private";

export type Changed = (until?: (b: Bundle) => boolean) => Promise<void> | void;
import { useWallet } from "@/lib/wallet";

const TONE: Record<MissionRow["status"], "mint" | "sun" | "rose" | "slate"> = {
  ACTIVE: "mint", SUBMITTED: "sun", REJECTED: "rose", APPROVED: "mint", CANCELLED: "slate", EXPIRED: "slate",
};
const LABEL: Record<MissionRow["status"], string> = {
  ACTIVE: "to do", SUBMITTED: "waiting for review", REJECTED: "sent back", APPROVED: "approved and paid", CANCELLED: "cancelled", EXPIRED: "expired",
};

/** Plain-language meaning of a mission's state, for the person looking at it. */
export function explain(m: MissionRow, who: "teen" | "parent", nowSec = Math.floor(Date.now() / 1000)): string {
  const r = fmt(big(m.reward));
  const late = nowSec > m.deadline;
  switch (m.status) {
    case "ACTIVE":
      return who === "teen"
        ? late ? `The deadline has passed. ${r} will go back to ${cap(m.parentFamId)}.` : `Finish this by ${dateText(m.deadline)} to earn ${r}. The money is already set aside for you.`
        : late ? `Nothing was submitted by the deadline. You can take the ${r} back.` : `${r} is set aside. ${cap(m.teenFamId)} hasn't marked it done yet.`;
    case "SUBMITTED":
      return who === "teen" ? `You marked it done. ${cap(m.parentFamId)} still has to check it. Nothing is paid until they approve.` : `${cap(m.teenFamId)} says it's done. Approve to pay ${r}, or send it back with a note.`;
    case "REJECTED":
      return who === "teen"
        ? `${cap(m.parentFamId)} sent it back${m.feedback ? `: "${m.feedback}"` : ""}. ${late ? "The deadline has passed." : `You can fix it and submit again until ${dateText(m.deadline)}.`}`
        : `You sent it back${m.feedback ? ` ("${m.feedback}")` : ""}. The ${r} stays set aside until ${dateText(m.deadline)}.`;
    case "APPROVED":
      return who === "teen" ? `You earned ${r}${m.savedToGoal ? " and it went straight into your savings goal" : ""}.` : `You paid ${r}${m.savedToGoal ? " (saved into their goal)" : ""}.`;
    case "CANCELLED":
      return who === "teen" ? `${cap(m.parentFamId)} cancelled it. Nothing was paid.` : `Cancelled. The ${r} went back to your balance.`;
    case "EXPIRED":
      return who === "teen" ? "The deadline passed without an approved submission. Nothing was paid." : `Expired. The ${r} went back to your balance.`;
  }
}

function SourceLink({ tx }: { tx: string }) {
  const link = explorerTx(tx);
  return link ? <a className="underline" href={link} target="_blank" rel="noreferrer">proof</a> : <span className="font-mono">{tx.slice(0, 10)}…</span>;
}

// ───────────────────────── parent ─────────────────────────

export function ParentMissions({
  teens, missions, goals, balance, onChanged,
}: {
  teens: { id: string; famId: string; frozen?: boolean }[];
  missions: MissionRow[];
  goals: GoalRow[];
  balance: bigint;
  onChanged: Changed;
}) {
  const { signer } = useWallet();
  const { busy, run, error: actionError } = useAct();
  const [teen, setTeen] = useState("");
  const [title, setTitle] = useState("");
  const [desc, setDesc] = useState("");
  const fundingQuery = useSearchParams();
  const [reward, setReward] = useState(fundingQuery.get("allocate") === "mission" ? fundingQuery.get("amount") ?? "" : "");
  const [date, setDate] = useState(dayString(7));
  const [goalId, setGoalId] = useState("0");
  const [confirm, setConfirm] = useState(false);

  const teenRow = teens.find((t) => t.id === teen) ?? teens[0];
  const teenGoals = goals.filter((g) => teenRow && g.teenFamId === teenRow.famId && g.status === "ACTIVE");
  const r = parseAmount(reward);
  const deadline = endOfDay(date);
  const now = Math.floor(Date.now() / 1000);
  const problem = useMemo(() => {
    if (!teenRow) return "Invite a teen first.";
    if (teenRow.frozen) return `${cap(teenRow.famId)}'s spending is frozen. Unfreeze first.`;
    if (!title.trim()) return "Give the mission a short title.";
    if (byteLen(title) > 80) return "The title is too long (80 characters at most).";
    if (byteLen(desc) > 280) return "The description is too long (280 characters at most).";
    if (r === null) return "Enter the reward, e.g. 5 or 2.50.";
    if (r > balance) return "That's more than your balance. Add test USDC first.";
    if (deadline === null || deadline <= now) return "Pick a deadline after today.";
    if (deadline > now + 365 * 86400) return "The deadline can be at most a year away.";
    return null;
  }, [teenRow, title, desc, r, balance, deadline, now]);

  const open = missions.filter((m) => ["ACTIVE", "SUBMITTED", "REJECTED"].includes(m.status)).length;
  const reserved = missions.filter((m) => ["ACTIVE", "SUBMITTED", "REJECTED"].includes(m.status)).reduce((a, m) => a + big(m.reward), 0n);

  const create = async () => {
    const ok = await run(
      "mcreate",
      async () => {
        const tx = await relay(signer!, "createMission", [teenRow.id, r!, BigInt(deadline!), BigInt(goalId), title.trim(), desc.trim()]);
        await onChanged((b) => b.data.missions.some((x) => x.txHash.toLowerCase() === tx.hash.toLowerCase()));
        return tx;
      },
      `Mission created. ${fmt(r!)} is now set aside.`,
    );
    setConfirm(false);
    if (ok) { setTitle(""); setDesc(""); setReward(""); setGoalId("0"); }
  };

  return (
    <Card title="Money missions" right={open > 0 ? <Pill tone="sun">{open} open · {fmt(reserved)} set aside</Pill> : undefined}>
      <ActionError error={actionError}/><p className="mb-3 text-sm text-muted">Commit a reward before the task starts. The money is set aside for your teen the moment you create the mission, so they know it&apos;s real.</p>
      {teens.length === 0 ? (
        <Empty>Once a teen has joined your family you can set them a mission here.</Empty>
      ) : (
        <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); if (!problem) setConfirm(true); }}>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Teen">
              <select value={teenRow?.id} onChange={(e) => { setTeen(e.target.value); setGoalId("0"); }} className="w-full rounded-2xl border border-line bg-card2 px-4 py-3 text-sm">
                {teens.map((t) => <option key={t.id} value={t.id}>{cap(t.famId)}</option>)}
              </select>
            </Field>
            <Field label="Reward (USDC)" hint={`Your balance: ${fmt(balance)}`}>
              <Input inputMode="decimal" placeholder="5.00" value={reward} onChange={(e) => setReward(e.target.value)} />
            </Field>
          </div>
          <Field label="Title" hint="Short and clear, e.g. “Wash the car”">
            <Input maxLength={80} value={title} onChange={(e) => setTitle(e.target.value)} />
          </Field>
          <Field label="Details (optional)">
            <Input maxLength={280} value={desc} onChange={(e) => setDesc(e.target.value)} />
          </Field>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Deadline">
              <Input type="date" min={dayString(1)} max={dayString(365)} value={date} onChange={(e) => setDate(e.target.value)} />
            </Field>
            <Field label="Save the reward into a goal (optional)" hint="If the goal is still open when you approve, it goes straight in.">
              <select value={goalId} onChange={(e) => setGoalId(e.target.value)} className="w-full rounded-2xl border border-line bg-card2 px-4 py-3 text-sm">
                <option value="0">No, pay to their balance</option>
                {teenGoals.map((g) => <option key={g.id} value={g.id}>{g.memo || `Goal ${g.id}`}</option>)}
              </select>
            </Field>
          </div>
          <p className="text-xs text-dim">Titles and notes are stored publicly on the test network. Don&apos;t put private details in them, and don&apos;t add photos.</p>
          {problem && (title || reward) && <p className="text-sm text-warn" role="status">{problem}</p>}
          <Button type="submit" disabled={!!problem} busy={busy === "mcreate"}>Review and set aside {r ? fmt(r) : ""}</Button>
        </form>
      )}

      <ConfirmDialog
        open={confirm}
        title="Set aside this reward?"
        confirmLabel={`Set aside ${r ? fmt(r) : ""}`}
        busy={busy === "mcreate"}
        onCancel={() => setConfirm(false)}
        onConfirm={create}
        lines={r && deadline ? [
          <>{fmt(r)} leaves your spendable balance now: {fmt(balance)} → <b>{fmt(balance - r)}</b>.</>,
          <>It can&apos;t be spent elsewhere. It only goes to {cap(teenRow.famId)} when you approve, or back to you if you cancel or the deadline ({dateText(deadline)}) passes without a submission.</>,
          <>It&apos;s a test-network transaction. These dollars have no real value.</>,
        ] : []}
      />

      <h3 className="mb-2 mt-6 text-sm font-bold">All missions</h3>
      {missions.length === 0 ? <Empty>No missions yet.</Empty> : (
        <div className="space-y-3">{missions.map((m) => <ParentMissionRow key={m.id} m={m} onChanged={onChanged} />)}</div>
      )}
    </Card>
  );
}

function ParentMissionRow({ m, onChanged }: { m: MissionRow; onChanged: Changed }) {
  const { signer } = useWallet();
  const { busy, run, error: actionError } = useAct();
  const [ask, setAsk] = useState(false);
  const late = Math.floor(Date.now() / 1000) > m.deadline;
  const canCancel = (m.status === "ACTIVE" || m.status === "REJECTED") && !late;
  const canExpire = (m.status === "ACTIVE" || m.status === "REJECTED") && late;

  const act = (label: string, fn: string, okMsg: string) =>
    run(label, async () => {
      const chain = await readMission(m.id); // the contract decides; never act on a stale screen
      if (!["ACTIVE", "REJECTED"].includes(chain.status)) throw new Error(`That mission is already ${chain.status.toLowerCase()}.`);
      const tx = await relay(signer!, fn, [BigInt(m.id)]);
      await onChanged((b) => b.data.missions.some((x) => x.id === m.id && x.status !== m.status));
      return tx;
    }, okMsg);

  return (
    <div className="rounded-2xl border border-line bg-card2/60 p-4"><ActionError error={actionError}/>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-semibold">{m.title}</p>
          <p className="text-xs text-dim">for {cap(m.teenFamId)} · <span className="num">{fmt(big(m.reward))}</span> · due {dateText(m.deadline)}</p>
        </div>
        <Pill tone={TONE[m.status]}>{LABEL[m.status]}</Pill>
      </div>
      {m.description && <p className="mt-2 text-sm text-muted">{m.description}</p>}
      <p className="mt-2 text-sm text-muted">{explain(m, "parent")}</p>
      {m.status === "SUBMITTED" && <MissionReview id={m.id} onChanged={onChanged}/>}
      <p className="mt-1 text-xs text-dim">Created {dateTimeText(m.createdAt)} · <SourceLink tx={m.txHash} />{m.lastTxHash !== m.txHash && <> · latest change <SourceLink tx={m.lastTxHash} /></>}</p>
      {(canCancel || canExpire) && (
        <div className="mt-3">
          <Button variant="ghost" busy={busy === "mc" + m.id} onClick={() => setAsk(true)}>{canExpire ? "Close and take the money back" : "Cancel and take the money back"}</Button>
        </div>
      )}
      <ConfirmDialog
        open={ask}
        danger
        title={canExpire ? "Close this mission?" : "Cancel this mission?"}
        confirmLabel="Take it back"
        busy={busy === "mc" + m.id}
        onCancel={() => setAsk(false)}
        onConfirm={async () => { await act("mc" + m.id, canExpire ? "expireMission" : "cancelMission", `${fmt(big(m.reward))} is back in your balance`); setAsk(false); }}
        lines={[`${fmt(big(m.reward))} returns to your spendable balance.`, `${cap(m.teenFamId)} won't be paid for “${m.title}”.`]}
      />
    </div>
  );
}

// ───────────────────────── teen ─────────────────────────

export function TeenMissions({ missions, frozen, onChanged }: { missions: MissionRow[]; frozen: boolean; onChanged: Changed }) {
  const { signer } = useWallet();
  const { busy, run, error: actionError } = useAct();
  const live = missions.filter((m) => ["ACTIVE", "SUBMITTED", "REJECTED"].includes(m.status));
  const done = missions.filter((m) => !["ACTIVE", "SUBMITTED", "REJECTED"].includes(m.status));
  const now = Math.floor(Date.now() / 1000);

  const submit = (m: MissionRow) =>
    run("ms" + m.id, async () => {
      const chain = await readMission(m.id);
      if (!["ACTIVE", "REJECTED"].includes(chain.status)) throw new Error("That mission can't be submitted any more. Refreshing.");
      const tx = await relay(signer!, "submitMission", [BigInt(m.id)]);
      await onChanged((b) => b.data.missions.some((x) => x.id === m.id && x.status === "SUBMITTED"));
      return tx;
    }, "Sent to your parent for review. Nothing is paid until they approve.");

  return (
    <Card title="Missions" right={live.length > 0 ? <Pill tone="mint">{live.length} open</Pill> : undefined}><ActionError error={actionError}/>
      {missions.length === 0 ? (
        <Empty>No missions yet. When your parent sets you one, the reward is already set aside and you&apos;ll see it here.</Empty>
      ) : (
        <div className="space-y-3">
          {[...live, ...done].map((m) => {
            const late = now > m.deadline;
            const canSubmit = (m.status === "ACTIVE" || m.status === "REJECTED") && !late && !frozen;
            return (
              <div key={m.id} className="rounded-2xl border border-line bg-card2/60 p-4">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-semibold">{m.title}</p>
                    <p className="text-xs text-dim">Reward <span className="num">{fmt(big(m.reward))}</span> · due {dateText(m.deadline)}</p>
                  </div>
                  <Pill tone={TONE[m.status]}>{LABEL[m.status]}</Pill>
                </div>
                {m.description && <p className="mt-2 text-sm text-muted">{m.description}</p>}
                <p className="mt-2 text-sm text-muted">{explain(m, "teen")}</p>
                {m.status === "SUBMITTED" && <MissionReview id={m.id} onChanged={onChanged}/>}
                {m.status === "REJECTED" && m.feedback && <p className="mt-2 rounded-xl bg-bad/10 px-3 py-2 text-sm text-bad">Feedback: {m.feedback}</p>}
                {canSubmit && (
                  <div className="mt-3">
                    <Button busy={busy === "ms" + m.id} onClick={() => submit(m)}>{m.status === "REJECTED" ? "Submit again" : "I did it"}</Button>
                  </div>
                )}
                {(m.status === "ACTIVE" || m.status === "REJECTED") && frozen && <p className="mt-2 text-xs text-dim">Your parent has paused your account, so you can&apos;t submit right now.</p>}
                <p className="mt-2 text-xs text-dim"><SourceLink tx={m.lastTxHash} /></p>
              </div>
            );
          })}
        </div>
      )}
    </Card>
  );
}
