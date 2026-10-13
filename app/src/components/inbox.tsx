"use client";
import { useState } from "react";
import { ActionError, Button, Card, ConfirmDialog, Empty, Input, Pill } from "@/components/ui";
import { fam, readMission } from "@/lib/chain";
import { big, byteLen, cap, dateText, fmt } from "@/lib/format";
import { useAct, useNow } from "@/lib/hooks";
import { explorerTx, relay } from "@/lib/relay";
import type { Bundle, GoalRow, HoldRow, MissionRow, RequestRow } from "@/lib/private";
import type { Changed } from "@/components/missions";
import { useWallet } from "@/lib/wallet";
import { useCapabilities } from "./flow-status";
import { MissionReview } from "./mission-review";

const Src = ({ tx }: { tx?: string }) => {
  if (!tx) return null;
  const l = explorerTx(tx);
  return l ? <a className="underline" href={l} target="_blank" rel="noreferrer">proof</a> : <span className="font-mono">{tx.slice(0, 10)}…</span>;
};

/** One review experience for everything that needs a parent: submitted missions, held payments, proposed goals, money requests. */
export function ApprovalInbox({ bundle, onChanged, error }: { bundle: Bundle | null; onChanged: Changed; error?: string | null }) {
  const missions = (bundle?.data.missions ?? []).filter((m) => m.status === "SUBMITTED");
  const holds = (bundle?.data.holds ?? []).filter((h) => h.status === "OPEN");
  const goals = (bundle?.data.goals ?? []).filter((g) => g.status === "PROPOSED");
  const requests = bundle?.data.requests ?? [];
  const total = missions.length + holds.length + goals.length + requests.length;

  return (
    <Card title="Needs your attention" right={!bundle ? undefined : total > 0 ? <Pill tone="sun">{total} waiting</Pill> : <Pill tone="slate">No items loaded</Pill>}>
      {(bundle?.liveGoals === "unavailable" || bundle?.liveApprovals === "unavailable") && <p className="mb-3 text-sm text-muted" role="status">Current approvals could not all be checked. This inbox may be incomplete; try refreshing.</p>}
      {!bundle ? <Empty>{error ? "Your inbox will appear when the family summaries reconnect." : "Checking for things that need your attention…"}</Empty> : total === 0 ? (
        <Empty>No approvals in the loaded data. New goals are checked against the network; other requests appear as the family history catches up.</Empty>
      ) : (
        <div className="space-y-3">
          {missions.map((m) => <MissionItem key={"m" + m.id} m={m} onChanged={onChanged} />)}
          {holds.map((h) => <HoldItem key={"h" + h.id} h={h} onChanged={onChanged} />)}
          {goals.map((g) => <GoalItem key={"g" + g.id} g={g} onChanged={onChanged} />)}
          {requests.map((r) => <RequestItem key={"r" + r.id} r={r} onChanged={onChanged} />)}
        </div>
      )}
    </Card>
  );
}

function Item({ tone, label, title, what, why, status, actions, children }: {
  tone: "sun" | "slate"; label: string; title: string; what: string; why: string; status: string; actions: string; children: React.ReactNode;
}) {
  return (
    <div className={`rounded-xl border p-4 ${tone === "sun" ? "border-warn/30 bg-warn/10" : "border-line bg-card2/60"}`}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="font-semibold">{title}</p>
        <Pill tone={tone}>{label}</Pill>
      </div>
      <p className="mt-2 text-sm text-muted">{what}</p>
      <p className="mt-1 text-xs text-muted">{status} · {actions}</p>
      <details className="mt-2 text-sm"><summary>Details</summary><dl className="mt-2 space-y-1 text-sm">
        <div><dt className="inline font-semibold text-fg">What happened: </dt><dd className="inline text-muted">{what}</dd></div>
        <div><dt className="inline font-semibold text-fg">Why you&apos;re asked: </dt><dd className="inline text-muted">{why}</dd></div>
        <div><dt className="inline font-semibold text-fg">Status: </dt><dd className="inline text-muted">{status}</dd></div>
        <div><dt className="inline font-semibold text-fg">Who can act: </dt><dd className="inline text-muted">only you, the parent. {actions}</dd></div>
      </dl></details>
      <div className="mt-3 flex flex-wrap gap-2">{children}</div>
    </div>
  );
}

function MissionItem({ m, onChanged }: { m: MissionRow; onChanged: Changed }) {
  const capabilities = useCapabilities();
  const reviewEnded = capabilities.missionReviewTimeout === true && Date.now()/1000 >= Math.max(m.submittedAt,m.deadline)+7*86400;
  const { signer } = useWallet();
  const { busy, run, error: actionError } = useAct();
  const [ask, setAsk] = useState<null | "approve" | "reject">(null);
  const [note, setNote] = useState("");
  const reward = fmt(big(m.reward));
  const stillSubmitted = async () => {
    if ((await readMission(m.id)).status !== "SUBMITTED") throw new Error("That mission isn't waiting for review any more. Refreshing.");
  };
  const done = (until: (b: Bundle) => boolean) => onChanged(until);
  return (
    <Item
      tone="sun" label="mission to review" title={`${cap(m.teenFamId)}: ${m.title}`}
      what={`${cap(m.teenFamId)} marked it done${m.submittedAt ? ` on ${dateText(m.submittedAt)}` : ""}. Due ${dateText(m.deadline)}.`}
      why={`${reward} is already set aside. It's only paid when you approve.`}
      status="waiting for review"
      actions={`Approve pays ${reward} once. Send back keeps it set aside so ${cap(m.teenFamId)} can try again before the deadline.`}
    >
      <ActionError error={actionError}/><Button disabled={reviewEnded} onClick={() => setAsk("approve")}>Approve and pay {reward}</Button>
      <ActionError error={actionError}/><Button disabled={reviewEnded} variant="ghost" onClick={() => setAsk("reject")}>Send back…</Button>
      <span className="self-center text-xs text-dim"><Src tx={m.lastTxHash} /></span>
      <MissionReview id={m.id} onChanged={onChanged}/>

      <ConfirmDialog
        open={ask === "approve"} title="Pay this reward?" confirmLabel={`Pay ${reward}`} busy={busy === "ma" + m.id}
        onCancel={() => setAsk(null)}
        onConfirm={async () => {
          await run("ma" + m.id, async () => {
            await stillSubmitted();
            const tx = await relay(signer!, "approveMission", [BigInt(m.id)]);
            await done((b) => b.data.missions.some((x) => x.id === m.id && x.status === "APPROVED"));
            return tx;
          }, `${cap(m.teenFamId)} earned ${reward}`);
          setAsk(null);
        }}
        lines={[`${reward} moves from the amount set aside to ${cap(m.teenFamId)}${m.goalId !== "0" ? " (into their savings goal if it's still open)" : ""}.`, "It can't be undone, and it's paid only once.", "Test-network dollars: no real value."]}
      />

      <ConfirmDialog
        open={ask === "reject"} title="Send this back?" confirmLabel="Send back" danger busy={busy === "mr" + m.id}
        onCancel={() => setAsk(null)}
        onConfirm={async () => {
          if (byteLen(note) > 140) return;
          await run("mr" + m.id, async () => {
            await stillSubmitted();
            const tx = await relay(signer!, "rejectMission", [BigInt(m.id), note.trim()]);
            await done((b) => b.data.missions.some((x) => x.id === m.id && x.status === "REJECTED"));
            return tx;
          }, "Sent back with your note. The reward stays set aside.");
          setAsk(null); setNote("");
        }}
        lines={[
          "Nothing is paid. The reward stays set aside until the deadline.",
          <span key="n" className="block">
            <span className="mb-1 block text-xs">A short note for {cap(m.teenFamId)} (optional, public on the test network)</span>
            <Input maxLength={140} value={note} onChange={(e) => setNote(e.target.value)} aria-label="Feedback for your teen" />
            {byteLen(note) > 140 && <span className="text-xs text-bad">Too long.</span>}
          </span>,
        ]}
      />
    </Item>
  );
}

function HoldItem({ h, onChanged }: { h: HoldRow; onChanged: Changed }) {
  const { signer } = useWallet();
  const { busy, run, error: actionError } = useAct();
  const now = useNow(1000) / 1000;
  const over = h.kind === "OVER_LIMIT";
  const left = Math.max(0, Number(h.releaseAt) - now);
  const amt = fmt(big(h.amount));
  const open = async () => {
    if (Number((await fam.pendings(BigInt(h.id))).status) !== 1) throw new Error("That payment was already decided. Refreshing.");
  };
  const decide = (kind: "a" | "r") =>
    run(kind + h.id, async () => {
      await open();
      const tx = await relay(signer!, kind === "a" ? "approvePending" : "rejectPending", [BigInt(h.id)]);
      await onChanged((b) => !(b.data.holds ?? []).some((x) => x.id === h.id && x.status === "OPEN"));
      return tx;
    }, kind === "a" ? "Approved. The payment went through." : "Rejected. The money went back.");
  return (
    <Item
      tone="sun" label={over ? "over today's limit" : "looks unusual"} title={`${cap(h.fromFamId)} → ${cap(h.toFamId)} · ${amt}`}
      what={`${cap(h.fromFamId)} tried to pay ${cap(h.toFamId)} ${amt}${h.memo ? ` (“${h.memo}”)` : ""}. The money is held, not spent.`}
      why={over ? "It's more than the daily limit you set, so it waits for you." : "A large first payment to someone new, or an early large payment, is held briefly so you can look."}
      status={over ? "waiting for you" : left > 0 ? `short hold, ${Math.ceil(left)}s left` : "hold is over; you can still reject it unless your teen has released it"}
      actions="Approve sends the money. Reject returns it to your teen."
    >
      <ActionError error={actionError}/><Button busy={busy === "a" + h.id} onClick={() => decide("a")}>Approve {amt}</Button>
      <ActionError error={actionError}/><Button variant="danger" busy={busy === "r" + h.id} onClick={() => decide("r")}>Reject</Button>
      <span className="self-center text-xs text-dim"><Src tx={h.txHash} /></span>
    </Item>
  );
}

function GoalItem({ g, onChanged }: { g: GoalRow; onChanged: Changed }) {
  const capabilities = useCapabilities();
  const { signer } = useWallet();
  const { busy, run, error: actionError } = useAct();
  const decide = (open: boolean) =>
    run("g" + open + g.id, async () => {
      if (Number((await fam.goals(BigInt(g.id))).status) !== 1) throw new Error("That goal was already decided. Refreshing.");
      const tx = await relay(signer!, "approveGoal", [BigInt(g.id), open]);
      await onChanged((b) => b.data.goals.some((x) => x.id === g.id && x.status !== "PROPOSED"));
      return tx;
    }, open ? "Goal approved and open for gifts" : "Goal approved");
  return (
    <Item
      tone="slate" label="new goal" title={`${cap(g.teenFamId)}: ${g.memo}`}
      what={`${cap(g.teenFamId)} wants to save ${fmt(big(g.target))} by ${dateText(g.deadline)}.`}
      why="Saving only starts once you approve the goal."
      status="waiting for your OK"
      actions="Approving moves no money. Opening it for gifts lets relatives match what your teen saves. There's no decline button, so a goal you don't want simply stays unapproved."
    >
      <ActionError error={actionError}/><Button busy={busy === "gtrue" + g.id} onClick={() => decide(true)}>Approve and open for gifts</Button>
      <ActionError error={actionError}/><Button variant="ghost" busy={busy === "gfalse" + g.id} onClick={() => decide(false)}>Approve (no gifts)</Button>
      {capabilities.goalDecline === true ? <Button variant="ghost" busy={busy === "decline"} onClick={() => run("decline", async () => {
        if (Number((await fam.goals(BigInt(g.id))).status) !== 1) throw new Error("That proposal was already decided.");
        const tx = await relay(signer!, "declineGoal", [BigInt(g.id)]);
        await onChanged(); return tx;
      }, "Goal declined. No money moved.")}>Decline goal</Button> : <span className="text-xs text-muted">This deployment has no decline action; unapproved goals stay pending.</span>}
      {g.namePending && <span className="self-center text-xs text-dim">Confirmed on the network. The goal name is still syncing.</span>}
    </Item>
  );
}

function RequestItem({ r, onChanged }: { r: RequestRow; onChanged: Changed }) {
  const { signer } = useWallet();
  const { busy, run, error: actionError } = useAct();
  const [ask, setAsk] = useState(false);
  const amt = fmt(big(r.amount));
  return (
    <Item
      tone="slate" label="money request" title={`${cap(r.fromFamId)} asks for ${amt}`}
      what={`${cap(r.fromFamId)} asked you for ${amt}${r.memo ? ` (“${r.memo}”)` : ""}.`}
      why="Only you can pay a request made to you."
      status="open"
      actions={`Pay sends ${amt} from your balance. To say no, just don't pay.`}
    >
      <ActionError error={actionError}/><Button onClick={() => setAsk(true)}>Pay {amt}</Button>
      <ConfirmDialog
        open={ask} title="Pay this request?" confirmLabel={`Pay ${amt}`} busy={busy === "pr" + r.id}
        onCancel={() => setAsk(false)}
        onConfirm={async () => {
          await run("pr" + r.id, async () => {
            if (Number((await fam.requests(BigInt(r.id))).status) !== 1) throw new Error("That request was already paid. Refreshing.");
            const tx = await relay(signer!, "payRequest", [BigInt(r.id)]);
            await onChanged((b) => !(b.data.requests ?? []).some((x) => x.id === r.id));
            return tx;
          }, `Paid ${cap(r.fromFamId)}`);
          setAsk(false);
        }}
        lines={[`${amt} leaves your balance and goes to ${cap(r.fromFamId)}.`, "Test-network dollars: no real value."]}
      />
    </Item>
  );
}
