"use client";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { Button, Card, Empty, Field, GoalCard, Input, Money, Pill, Proof, Shell, SignIn, Timeline, useToast } from "@/components/ui";
import { Onboard } from "@/components/onboard";
import { Account, ROLE, readBalance, TeenView } from "@/lib/chain";
import { faucet, relay, signInvite, TxResult } from "@/lib/relay";
import { Q, useGql } from "@/lib/gql";
import { useAct, useMe, useNow, useTeenView } from "@/lib/hooks";
import { useWallet } from "@/lib/wallet";
import { big, cap, fmt, parseAmount } from "@/lib/format";
import { cfg } from "@/lib/config";
import { QR } from "@/components/qr";
import { encodeTerms, Terms } from "@/lib/terms";

export default function ParentPage() {
  const { signer } = useWallet();
  const { acct, loaded, refresh } = useMe();

  if (!signer)
    return (
      <Shell>
        <SignIn
          title="Parent sign in"
          blurb="Set up your family in under a minute. You decide the limits; your teen gets room to grow."
        />
      </Shell>
    );
  if (!loaded) return <Shell><Empty>Loading…</Empty></Shell>;
  if (!acct || acct.role === ROLE.NONE) return <Shell><Onboard kind="parent" onDone={refresh} /></Shell>;
  if (acct.role !== ROLE.PARENT)
    return (
      <Shell famId={acct.famId}>
        <Card className="mx-auto mt-6 max-w-md text-center">
          <h1 className="text-xl font-bold">This account isn&apos;t a parent</h1>
          <p className="mt-2 text-sm text-muted">Signed in as @{acct.famId}. Try the teen or gift view instead.</p>
          <div className="mt-4 flex justify-center gap-2">
            <Link href="/teen"><Button variant="ghost">Teen view</Button></Link>
            <Link href="/gift"><Button variant="ghost">Gift view</Button></Link>
          </div>
        </Card>
      </Shell>
    );
  if (acct.familyId === 0) return <Shell famId={acct.famId}><FamilyStep onDone={refresh} /></Shell>;
  return <Shell famId={acct.famId} role="parent"><Dashboard acct={acct} /></Shell>;
}

function FamilyStep({ onDone }: { onDone: () => void }) {
  const { signer } = useWallet();
  const { busy, run } = useAct();
  return (
    <Card className="mx-auto mt-6 max-w-md text-center">
      <h1 className="text-xl font-bold">One more step</h1>
      <p className="mt-2 text-sm text-muted">Create your family so you can invite your teen.</p>
      <Button
        className="mt-4"
        busy={busy === "fam"}
        onClick={async () => {
          const tz = -new Date().getTimezoneOffset() * 60;
          if (await run("fam", () => relay(signer!, "createFamily", [tz]), "Family created")) onDone();
        }}
      >
        Create family
      </Button>
    </Card>
  );
}

// ───────────────────────── money requests ─────────────────────────

/** Requests your teens (or anyone) sent you. Paying one moves the money from your balance to theirs. */
function MoneyRequests({ me, onPaid }: { me: string; onPaid: () => void }) {
  const { signer } = useWallet();
  const { busy, run } = useAct();
  const incoming = useGql<{ Request: any[] }>(Q.requestsTo, { a: me }, `r${me}`);
  const rows = incoming.data?.Request ?? [];
  return (
    <Card title="Money requests" right={rows.length > 0 ? <Pill tone="sun">{rows.length} asking</Pill> : undefined}>
      {rows.length === 0 ? (
        <Empty>When your teen asks you for money, it shows up here and you pay with one tap.</Empty>
      ) : (
        <div className="space-y-2">
          {rows.map((r) => (
            <div key={r.id} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-card2 p-3">
              <p className="text-sm">
                <span className="font-bold">{cap(r.fromFamId)}</span> asks for <span className="num font-bold text-brand">{fmt(big(r.amount))}</span>
                {r.memo ? <span className="text-muted"> · {r.memo}</span> : null}
              </p>
              <Button busy={busy === "pr" + r.id} onClick={async () => { if (await run("pr" + r.id, () => relay(signer!, "payRequest", [BigInt(r.id)]), `Paid ${cap(r.fromFamId)}`)) onPaid(); }}>
                Pay
              </Button>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}

// ───────────────────────── dashboard ─────────────────────────

function Dashboard({ acct }: { acct: Account }) {
  const { signer } = useWallet();
  const f = acct.familyId;
  const [balance, setBalance] = useState<bigint | null>(null);
  const { busy, run } = useAct();

  const refreshBalance = useCallback(async () => {
    if (signer) setBalance(await readBalance(signer.address));
  }, [signer]);
  useEffect(() => {
    void refreshBalance();
    const t = setInterval(refreshBalance, 2500);
    return () => clearInterval(t);
  }, [refreshBalance]);

  const teens = useGql<{ User: { id: string; famId: string; level: number; frozen: boolean }[] }>(Q.teens, { f }, `t${f}`);
  const pending = useGql<{ Pending: any[] }>(Q.pendingFamily, { f }, `p${f}`);
  const goals = useGql<{ Goal: any[] }>(Q.goalsFamily, { f }, `g${f}`);
  const timeline = useGql<{ TimelineEntry: any[] }>(Q.timelineFamily, { f }, `tl${f}`);

  const waiting = (pending.data?.Pending ?? []).length + (goals.data?.Goal ?? []).filter((g) => g.status === "PROPOSED").length;

  return (
    <div className="grid items-start gap-5 lg:grid-cols-[1.15fr_1fr]">
    <div className="space-y-5">
      <Card>
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-sm text-dim">Your balance</p>
            <Money value={balance ?? 0n} size="xl" />
          </div>
          <Button
            variant="soft"
            busy={busy === "add"}
            onClick={() =>
              run("add", async () => { const r = await faucet(acct.famId); await refreshBalance(); return r; }, (r) => `Added ${r.amount} test dollars`)
            }
          >
            + Add test USDC
          </Button>
        </div>
        <p className="mt-3 text-xs text-dim">Test dollars have no real value. This is a prototype on a test network.</p>
      </Card>

      <MoneyRequests me={signer!.address.toLowerCase()} onPaid={refreshBalance} />

      <Approvals pending={pending.data?.Pending} goals={goals.data?.Goal} waiting={waiting} />

      <div className="space-y-4">
        <h2 className="text-lg font-bold">Your teens</h2>
        {teens.data && teens.data.User.length === 0 && <Empty>No teen yet. Create an invite below and send it to them.</Empty>}
        {teens.data?.User.map((t) => <TeenPanel key={t.id} teen={t} parentBalance={balance ?? 0n} onChange={refreshBalance} />)}
      </div>

    </div>

    <div className="space-y-5">
      <InviteCard familyId={f} />

      <Card title="Goals and gifts">
        {goals.data?.Goal.length ? (
          <div className="space-y-3">
            {goals.data.Goal.map((g) => (
              <GoalCard key={g.id} g={g}>
                {g.status === "ACTIVE" && <GiftLink goalId={g.id} />}
              </GoalCard>
            ))}
          </div>
        ) : (
          <Empty>When your teen proposes a goal, it shows up here for your OK.</Empty>
        )}
      </Card>

      <Card title="Family timeline">
        <Timeline rows={timeline.data?.TimelineEntry} />
      </Card>
    </div>
    </div>
  );
}

// ───────────────────────── approvals ─────────────────────────

function Approvals({ pending, goals, waiting }: { pending?: any[]; goals?: any[]; waiting: number }) {
  const { signer } = useWallet();
  const { busy, run } = useAct();
  const now = useNow(1000) / 1000;
  const proposed = (goals ?? []).filter((g) => g.status === "PROPOSED");

  return (
    <Card
      title="Needs your OK"
      right={waiting > 0 ? <Pill tone="sun">{waiting} waiting</Pill> : <Pill tone="mint">all clear</Pill>}
    >
      {waiting === 0 && <Empty>Nothing is waiting. You&apos;ll only hear from us when something unusual happens.</Empty>}
      <div className="space-y-3">
        {(pending ?? []).map((p) => {
          const over = p.kind === "OVER_LIMIT";
          const left = Math.max(0, Number(p.releaseAt) - now);
          return (
            <div key={p.id} className="rounded-xl border border-warn/30 bg-warn/10 p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="font-semibold">
                  {cap(p.fromFamId)} wants to pay {cap(p.toFamId)} <span className="num">{fmt(big(p.amount))}</span>
                </p>
                <Pill tone="sun">{over ? "over today's limit" : "looks unusual"}</Pill>
              </div>
              <p className="mt-1 text-sm text-muted">
                {over
                  ? "This is more than the daily limit, so it waits for you."
                  : left > 0
                    ? `On a short hold (${Math.ceil(left)}s left). If you do nothing, ${cap(p.fromFamId)} can release it afterwards.`
                    : "The hold is over. You can still reject it before it's released."}
              </p>
              <div className="mt-3 flex gap-2">
                <Button busy={busy === "a" + p.id} onClick={() => run("a" + p.id, () => relay(signer!, "approvePending", [BigInt(p.id)]), "Approved")}>Approve</Button>
                <Button variant="danger" busy={busy === "r" + p.id} onClick={() => run("r" + p.id, () => relay(signer!, "rejectPending", [BigInt(p.id)]), "Rejected. The money went back.")}>
                  Reject
                </Button>
              </div>
            </div>
          );
        })}
        {proposed.map((g) => (
          <div key={g.id} className="rounded-xl border border-line p-4">
            <p className="font-semibold">
              {cap(g.teenFamId)} wants to save <span className="num">{fmt(big(g.target))}</span> for &ldquo;{g.memo}&rdquo;
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Button busy={busy === "g" + g.id} onClick={() => run("g" + g.id, () => relay(signer!, "approveGoal", [BigInt(g.id), true]), "Goal approved and open for gifts")}>
                Approve and open for gifts
              </Button>
              <Button variant="ghost" busy={busy === "gp" + g.id} onClick={() => run("gp" + g.id, () => relay(signer!, "approveGoal", [BigInt(g.id), false]), "Goal approved")}>
                Approve (no gifts)
              </Button>
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}

// ───────────────────────── a teen's controls ─────────────────────────

function TeenPanel({ teen, parentBalance, onChange }: { teen: { id: string; famId: string; level: number; frozen: boolean }; parentBalance: bigint; onChange: () => void }) {
  const { signer } = useWallet();
  const { view, refresh } = useTeenView(teen.id);
  const { busy, run } = useAct();
  const toast = useToast();
  const [budget, setBudget] = useState("");
  const [perHour, setPerHour] = useState("");
  const [tx, setTx] = useState<TxResult | null>(null);
  const [limits, setLimits] = useState<string[] | null>(null);
  const now = useNow(1000);

  if (!view) return <Card><Empty>Loading {teen.famId}…</Empty></Card>;
  const spendable = view.balance + view.accrued + (() => {
    const elapsed = BigInt(Math.max(0, Math.floor((now - view.fetchedAt) / 1000)));
    const cap2 = view.streamRemaining - view.accrued;
    const x = view.rate * elapsed;
    return x > cap2 ? (cap2 < 0n ? 0n : cap2) : x;
  })();
  const L = limits ?? view.limits.map((x) => fmt(x));

  async function fund() {
    const b = parseAmount(budget);
    const h = parseAmount(perHour);
    if (!b || !h) return toast.err("Choose how much to set aside and how much flows each hour.");
    if (b > parentBalance) return toast.err("You don't have that much. Add test USDC first.");
    const rate = h / 3600n || 1n;
    const r = await run("fund", () => relay(signer!, "fundStream", [teen.id, b, rate]), `${cap(teen.famId)}'s allowance is flowing`);
    if (r) { setTx(r); onChange(); void refresh(); }
  }

  async function saveLimits() {
    const parsed = L.map((x) => parseAmount(x));
    if (parsed.some((x) => !x)) return toast.err("Each daily limit needs an amount.");
    const lim = parsed as bigint[];
    for (let i = 1; i < 4; i++) if (lim[i] < lim[i - 1]) return toast.err("Limits should go up with each level.");
    const r = await run(
      "lim",
      () => relay(signer!, "setLimits", [teen.id, lim, view!.threshold, view!.firstDayCap, view!.holdSeconds, view!.strictHolds]),
      "Limits updated",
    );
    if (r) { setLimits(null); void refresh(); }
  }

  return (
    <Card hero>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-lg font-bold">{cap(teen.famId)}</p>
          <div className="mt-1 flex gap-2">
            <Pill tone="mint">Level {view.level + 1}</Pill>
            {view.frozen && <Pill tone="rose">frozen</Pill>}
          </div>
        </div>
        <Button
          variant={view.frozen ? "ghost" : "danger"}
          busy={busy === "frz"}
          onClick={async () => { if (await run("frz", () => relay(signer!, view.frozen ? "unfreeze" : "freeze", [teen.id]), view.frozen ? "Spending is back on" : "Spending frozen")) void refresh(); }}
        >
          {view.frozen ? "Unfreeze" : "Freeze spending"}
        </Button>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3">
        <div className="rounded-xl bg-card2 p-3">
          <p className="text-xs text-dim">Can spend now</p>
          <Money value={spendable} />
        </div>
        <div className="rounded-xl bg-card2 p-3">
          <p className="text-xs text-dim">Left today</p>
          <Money value={view.remainingToday} />
        </div>
      </div>

      <details className="mt-4 rounded-xl border border-line p-3" open={view.streamRemaining === 0n}>
        <summary className="cursor-pointer text-sm font-semibold">Allowance {view.streamRemaining > 0n && <span className="num font-normal text-dim">· {fmt(view.streamRemaining)} still to flow</span>}</summary>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <Field label="Set aside (total)"><Input inputMode="decimal" value={budget} placeholder="e.g. 20" onChange={(e) => setBudget(e.target.value)} aria-label="Allowance budget" /></Field>
          <Field label="Flow per hour"><Input inputMode="decimal" value={perHour} placeholder="e.g. 0.5" onChange={(e) => setPerHour(e.target.value)} aria-label="Allowance per hour" /></Field>
        </div>
        <Button className="mt-3" busy={busy === "fund"} onClick={fund}>Start allowance</Button>
        <Proof tx={tx} label="Allowance started" />
      </details>

      <details className="mt-3 rounded-xl border border-line p-3">
        <summary className="cursor-pointer text-sm font-semibold">Daily limits by level</summary>
        <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {L.map((v, i) => (
            <Field key={i} label={`Level ${i + 1}`}>
              <Input inputMode="decimal" value={v} onChange={(e) => setLimits(L.map((x, j) => (j === i ? e.target.value : x)))} aria-label={`Level ${i + 1} limit`} />
            </Field>
          ))}
        </div>
        <p className="mt-2 text-xs text-dim">Payments above the limit wait for you. A first payment over {fmt(view.threshold)} to someone new is held for {Math.round(view.holdSeconds / 60)} min.</p>
        <Button className="mt-3" variant="ghost" busy={busy === "lim"} disabled={!limits} onClick={saveLimits}>Save limits</Button>
      </details>
    </Card>
  );
}

// ───────────────────────── invites and gift links ─────────────────────────

function InviteCard({ familyId }: { familyId: number }) {
  const { signer } = useWallet();
  const { busy, run } = useAct();
  const toast = useToast();
  const [link, setLink] = useState("");
  // Every field starts empty on purpose: the parent chooses each number. The placeholders are only examples.
  const [limits, setLimits] = useState(["", "", "", ""]);
  const [threshold, setThreshold] = useState("");
  const [firstDay, setFirstDay] = useState("");
  const [holdMin, setHoldMin] = useState("");
  const [strict, setStrict] = useState(false);

  async function make() {
    const lim = limits.map((x) => parseAmount(x));
    if (lim.some((x) => x === null)) return toast.err("Choose a daily limit for each of the four levels.");
    const L = lim as bigint[];
    for (let i = 1; i < 4; i++) if (L[i] < L[i - 1]) return toast.err("Each level's limit should be the same or higher than the one before.");
    const th = parseAmount(threshold);
    const fd = parseAmount(firstDay);
    if (!th || !fd) return toast.err("Fill in both safety amounts.");
    const mins = Number(holdMin);
    if (!Number.isFinite(mins) || mins < 0 || mins > 1440) return toast.err("How long should a hold last? Pick 0 to 1440 minutes.");

    const terms: Terms = { levelLimits: L, newPayeeThreshold: th, firstDayCap: fd, holdSeconds: Math.round(mins * 60), strictHolds: strict };
    const inv = await run("inv", () => signInvite(signer!, familyId, terms));
    if (!inv) return;
    const u = new URL("/join", window.location.origin);
    u.searchParams.set("f", String(inv.familyId));
    u.searchParams.set("i", inv.inviteId);
    u.searchParams.set("d", String(inv.deadline));
    u.searchParams.set("t", encodeTerms(terms));
    u.searchParams.set("s", inv.sig);
    setLink(u.toString());
  }

  return (
    <Card title="Invite a teen">
      <p className="text-sm text-muted">
        Choose the rules your teen starts with. They&apos;re signed into the link, so your teen can&apos;t change them, and you can adjust them any time later.
      </p>
      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {limits.map((v, i) => (
          <Field key={i} label={i === 0 ? "Daily limit now" : `At level ${i + 1}`}>
            <Input inputMode="decimal" value={v} placeholder={["5", "8", "12", "20"][i]} onChange={(e) => setLimits(limits.map((x, j) => (j === i ? e.target.value : x)))} aria-label={`Level ${i + 1} daily limit`} />
          </Field>
        ))}
      </div>
      <div className="mt-3 grid gap-3 sm:grid-cols-3">
        <Field label="Hold a first payment to someone new above">
          <Input inputMode="decimal" value={threshold} placeholder="3" onChange={(e) => setThreshold(e.target.value)} aria-label="New payee hold amount" />
        </Field>
        <Field label="In the first 24 hours, hold payments above">
          <Input inputMode="decimal" value={firstDay} placeholder="2" onChange={(e) => setFirstDay(e.target.value)} aria-label="First day hold amount" />
        </Field>
        <Field label="A hold lasts (minutes)">
          <Input inputMode="numeric" value={holdMin} placeholder="10" onChange={(e) => setHoldMin(e.target.value)} aria-label="Hold minutes" />
        </Field>
      </div>
      <label className="mt-3 flex items-start gap-2 text-sm text-muted">
        <input type="checkbox" checked={strict} onChange={(e) => setStrict(e.target.checked)} className="mt-0.5" aria-label="Parent must approve every hold" />
        <span>I must approve every held payment. (If off, your teen can release one after the wait if you haven&apos;t answered.)</span>
      </label>
      <Button className="mt-4" variant="soft" busy={busy === "inv"} onClick={make}>Create invite link</Button>
      {link && (
        <div className="pop mt-3 space-y-3">
          <p className="text-xs text-dim">Works for 7 days. The first person to open it joins your family, so send it only to your teen.</p>
          <Input readOnly value={link} onFocus={(e) => e.currentTarget.select()} aria-label="Invite link" />
          <div className="flex flex-wrap items-center gap-3">
            <Button variant="ghost" onClick={async () => { await navigator.clipboard?.writeText(link); toast.ok("Link copied"); }}>Copy link</Button>
            <QR value={link} size={120} />
          </div>
        </div>
      )}
    </Card>
  );
}

function GiftLink({ goalId }: { goalId: string }) {
  const toast = useToast();
  const [show, setShow] = useState(false);
  const url = typeof window === "undefined" ? "" : `${window.location.origin}/gift/${goalId}`;
  return (
    <div className="w-full">
      <div className="flex flex-wrap gap-2">
        <Button variant="soft" onClick={async () => { await navigator.clipboard?.writeText(url); toast.ok("Gift link copied. Send it to a relative."); }}>Copy gift link</Button>
        <Button variant="ghost" onClick={() => setShow((s) => !s)}>{show ? "Hide QR" : "Show QR"}</Button>
      </div>
      {show && <div className="pop mt-3"><QR value={url} size={140} /></div>}
    </div>
  );
}

export type { TeenView };
void cfg;
