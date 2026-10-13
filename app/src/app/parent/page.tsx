"use client";
import Link from "next/link";
import { AnimatedOutline, FlowDiagram } from "@/components/effects";
import { Workspace, parentSections, useWorkspaceView } from "@/components/workspace";
import { FamilyConnections, Commitments, FeaturedGoal } from "@/components/family-visuals";
import { Passport } from "@/components/passport";
import { useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useState } from "react";
import { ActionError, Button, Card, ConfirmDialog, Empty, Field, GoalCard, Input, Money, Pill, Proof, Shell, SignIn, Timeline, useToast } from "@/components/ui";
import { Onboard } from "@/components/onboard";
import { Account, ROLE, readBalance, TeenView } from "@/lib/chain";
import { faucet, relay, signInvite, TxResult } from "@/lib/relay";
import { Q, useGql } from "@/lib/gql";
import { useAct, useMe, useNow, useTeenView } from "@/lib/hooks";
import { usePrivate, type Bundle } from "@/lib/private";
import { FeatureGate, SyncNotice, useCapabilities } from "@/components/flow-status";
import { ApprovalInbox } from "@/components/inbox";
import { ParentMissions } from "@/components/missions";
import { WeeklyBrief } from "@/components/brief";
import { SavingStory } from "@/components/saving-story";
import { WalletFunding } from "@/components/wallet-funding";
import { ParentFutureFund } from "@/components/futurefund";
import { useWallet } from "@/lib/wallet";
import { big, cap, fmt, parseAmount } from "@/lib/format";
import { cfg } from "@/lib/config";
import { inviteLink } from "@/lib/invite";
import { QR } from "@/components/qr";
import { Terms } from "@/lib/terms";

export default function ParentPage() {
  return <Suspense fallback={<Shell><Empty>Loading your family…</Empty></Shell>}><ParentInner /></Suspense>;
}
function ParentInner() {
  const { signer } = useWallet();
  const { acct, loaded, error: accountError, refresh } = useMe();

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
  if (accountError) return <Shell><Card title="Couldn’t check your account"><p role="alert">{accountError}</p><Button onClick={() => void refresh()}>Try again</Button></Card></Shell>;
  if (!acct || acct.role === ROLE.NONE) return <Shell><Onboard kind="parent" onDone={refresh} /></Shell>;
  if (acct.role !== ROLE.PARENT)
    return (
      <Shell famId={acct.famId}>
        <Card className="mx-auto mt-6 max-w-md text-center">
          <h1 className="text-xl font-bold">This account isn&apos;t a parent</h1>
          <p className="mt-2 text-sm text-muted">Signed in as @{acct.famId}. Try the teen or gift view instead.</p>
          <div className="mt-4 flex justify-center gap-2">
            <Link href="/teen" className="link-button link-button-secondary">Teen view</Link>
            <Link href="/gift" className="link-button link-button-secondary">Gift view</Link>
          </div>
        </Card>
      </Shell>
    );
  if (acct.familyId === 0) return <Shell famId={acct.famId}><FamilyStep onDone={refresh} /></Shell>;
  return <Shell famId={acct.famId} role="parent"><Dashboard key={signer.address.toLowerCase()} acct={acct} /></Shell>;
}

function FamilyStep({ onDone }: { onDone: () => void }) {
  const { signer } = useWallet();
  const { busy, run, error: actionError } = useAct();
  return (
    <Card className="mx-auto mt-6 max-w-md text-center">
      <h1 className="text-xl font-bold">One more step</h1><ActionError error={actionError}/>
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
// ───────────────────────── dashboard ─────────────────────────
function visibleGoals(bundle: Bundle | null) { return bundle?.data.goals; }

function Dashboard({ acct }: { acct: Account }) {
  const { signer } = useWallet();
  const f = acct.familyId;
  const query = useSearchParams();
  const [selectedTeen, setSelectedTeen] = useState(query.get("teen") ?? "");
  const [balance, setBalance] = useState<bigint | null>(null);
  const [balanceError, setBalanceError] = useState(false);
  const { busy, run, error: actionError } = useAct();

  const refreshBalance = useCallback(async () => {
    try { if (signer) { setBalance(await readBalance(signer.address)); setBalanceError(false); } }
    catch { setBalanceError(true); }
  }, [signer]);
  useEffect(() => {
    void refreshBalance();
    const t = setInterval(refreshBalance, 2500);
    return () => clearInterval(t);
  }, [refreshBalance]);



  // Family-private summaries (missions, inbox, brief, FutureFund) come from the authenticated gateway.
  const priv = usePrivate();
  const capabilities = useCapabilities();
  const toast = useToast();
  const changed = useCallback(
    async (until?: (b: Bundle) => boolean) => {
      await refreshBalance();
      if (!until) return void (await priv.refresh());
      if (!(await priv.refreshUntil(until, 10000))) toast.ok("Confirmed on-chain. The summary is still catching up and will update shortly.");
    },
    [refreshBalance, priv, toast],
  );
  const teenList = priv.bundle?.data.teens ?? [];
  const goalRows = visibleGoals(priv.bundle);
  const view = useWorkspaceView(parentSections);
  const selected = teenList.find(t => t.id === selectedTeen);
  const visibleTeens = selected ? [selected] : teenList;
  const visibleBundle = priv.bundle && selected ? { ...priv.bundle, data: { ...priv.bundle.data,
    goals: priv.bundle.data.goals.filter(g => g.teenFamId === selected.famId),
    missions: priv.bundle.data.missions.filter(m => m.teen.toLowerCase() === selected.id.toLowerCase()),
    funds: priv.bundle.data.funds.filter(g => g.teenFamId === selected.famId),
    requests: priv.bundle.data.requests?.filter(r => r.fromFamId === selected.famId),
    holds: priv.bundle.data.holds?.filter(h => h.fromFamId === selected.famId),
    achievements: priv.bundle.data.achievements?.filter(a => a.teen === selected.id.toLowerCase()),
    progress: priv.bundle.data.progress.filter(p => p.teenFamId === selected.famId),
    weeks: priv.bundle.data.weeks.filter(w => w.teen.toLowerCase() === selected.id.toLowerCase()),
    history: priv.bundle.data.history.filter(h => h.teen === selected.id.toLowerCase()),
    timeline: priv.bundle.data.timeline?.filter(h => h.actor === selected.id.toLowerCase() || h.counterparty === selected.id.toLowerCase()),
    savingReceipts: priv.bundle.data.savingReceipts.filter(r => r.teen === selected.id.toLowerCase()),
  } } : priv.bundle;

  return <Workspace sections={parentSections} view={view} famId={acct.famId} role="parent">
    <SyncNotice bundle={priv.bundle} />
    {priv.bundle ? <FamilyConnections parent={acct.famId} teens={teenList} selected={selected?.id} onSelect={setSelectedTeen}/> : <p className="text-sm text-muted mb-4">Connecting your family…</p>}
    {view === "overview" && <>
      <div className="balance-strip"><AnimatedOutline accent="mint" animated={false}/><div><span className="eyebrow">AVAILABLE TO ALLOCATE</span><div className="mt-2">{balance === null ? <span className="text-sm text-muted">Connecting to your balance…</span> : <Money value={balance} />}</div><p>Your spendable Fam-Fi balance · Test USDC</p></div><Button variant="ghost" busy={busy === "add"} onClick={() => run("add", async () => { const r = await faucet(acct.famId); await refreshBalance(); return r; }, (r) => `Added ${r.amount} test dollars`)}>Get test funds <span aria-hidden="true">↗</span></Button></div>
      <Commitments bundle={priv.bundle}/><ActionError error={actionError}/>
      {balanceError && <p role="status" className="text-sm text-bad">Balance could not refresh. Last confirmed amount may be out of date. <Button variant="ghost" onClick={()=>void refreshBalance()}>Retry balance</Button></p>}
      <WalletFunding key={signer!.address} onDone={refreshBalance} />
      {priv.bundle && <FeaturedGoal goals={visibleBundle?.data.goals ?? []}/>}
      {selected && <TeenPanel key={selected.id} teen={selected} parentBalance={balance ?? 0n} onChange={refreshBalance}/>}
      {priv.error && <p className="service-notice" role="status">Family summaries are temporarily unavailable. Your balance is live. <span>{priv.error}</span> <Button variant="ghost" onClick={() => void priv.refresh()}>Retry family access</Button></p>}
      <div className="overview-columns"><ApprovalInbox bundle={visibleBundle} onChanged={changed} error={priv.error} /><div className="next-steps"><p className="eyebrow">MAKE A LITTLE PROGRESS</p><Link href="/parent?view=missions"><span>01</span><div><strong>Reward an achievement</strong><p>Create a mission with a funded reward.</p></div><span>↗</span></Link><Link href="/parent?view=savings"><span>02</span><div><strong>Plan for their future</strong><p>Goals, matched gifts and FutureFund.</p></div><span>↗</span></Link><Link href="/parent?view=activity"><span>03</span><div><strong>See the whole story</strong><p>Confirmed actions, in plain language.</p></div><span>↗</span></Link></div></div>
    </>}
    {view !== "overview" && priv.error && <p className="service-notice" role="status">Family history is temporarily unavailable. Missions, savings and teen summaries may be incomplete while it reconnects. <Button variant="ghost" onClick={() => void priv.refresh()}>Retry family access</Button></p>}
    {view === "family" && <div className="family-columns"><div><div className="section-intro"><h2>Your teens</h2><p>Allowance, spending limits and a little room to grow.</p></div>{priv.error ? <Empty>We couldn't load your teen list. Retry family access above.</Empty> : !priv.bundle ? <Empty>Connecting to your family…</Empty> : teenList.length === 0 ? <div className="family-empty"><FlowDiagram compact variant="allowance" /><h3>A family starts with an invitation.</h3><p>Choose your teen's rules, create a link, and let them join with their own email.</p></div> : <div className="space-y-6">{visibleTeens.map((t) => <TeenPanel key={t.id} teen={t} parentBalance={balance ?? 0n} onChange={refreshBalance} />)}</div>}</div><InviteCard familyId={f} /></div>}
    {view === "missions" && <FeatureGate supported={capabilities.missions} label="Money missions"><ParentMissions teens={visibleTeens} missions={visibleBundle?.data.missions ?? []} goals={visibleBundle?.data.goals ?? []} balance={balance ?? 0n} onChanged={changed} /></FeatureGate>}
    {view === "savings" && <div className="space-y-8"><SavingStory bundle={visibleBundle} fetchedAt={priv.fetchedAt} error={priv.error} onRetry={priv.refresh} /><FeatureGate supported={capabilities.futureFund} label="FutureFund"><ParentFutureFund teens={visibleTeens} funds={visibleBundle?.data.funds ?? []} entries={priv.bundle?.data.fundEntries ?? []} missions={priv.bundle?.data.missions ?? []} balance={balance ?? 0n} onChanged={changed} fetchedAt={priv.fetchedAt} error={priv.error} /></FeatureGate><Card title="Goals & matched gifts">{(priv.error || priv.bundle?.indexerError) && priv.bundle?.liveGoals !== "verified" ? <Empty>Goal summaries are unavailable. Please try again shortly.</Empty> : goalRows?.length ? <div className="grid gap-4 md:grid-cols-2">{goalRows.filter((g) => !selected || g.teenFamId === selected.famId).map((g) => <GoalCard key={g.id} g={g}>{g.status === "ACTIVE" && <GiftLink goalId={g.id} />}{g.status === "PROPOSED" && <Link href="/parent?view=overview" className="text-link">Review in approval inbox →</Link>}</GoalCard>)}</div> : <Empty>When your teen proposes a goal, approve it in your inbox. Then relatives can help them save.</Empty>}</Card></div>}
    {view === "activity" && <div className="space-y-8"><Passport bundle={visibleBundle} fetchedAt={priv.fetchedAt} error={priv.error}/><WeeklyBrief bundle={visibleBundle} fetchedAt={priv.fetchedAt} error={priv.error} /><Card title="Family timeline">{priv.error || priv.bundle?.indexerError ? <Empty>Activity is unavailable while the indexer catches up.</Empty> : <Timeline rows={visibleBundle?.data.timeline} />}</Card></div>}
  </Workspace>;
}

// ───────────────────────── approvals ─────────────────────────

// ───────────────────────── a teen's controls ─────────────────────────

function TeenPanel({ teen, parentBalance, onChange }: { teen: { id: string; famId: string; level: number; frozen: boolean }; parentBalance: bigint; onChange: () => void }) {
  const { signer } = useWallet();
  const { view, refresh } = useTeenView(teen.id);
  const { busy, run, error: actionError } = useAct();
  const toast = useToast();
  const fundingQuery = useSearchParams();
  const [budget, setBudget] = useState(fundingQuery.get("allocate") === "allowance" ? fundingQuery.get("amount") ?? "" : "");
  const [perHour, setPerHour] = useState("");
  const [confirmAllowance, setConfirmAllowance] = useState(false);
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
    if (h < 3600n) return toast.err("Choose at least 0.0036 USDC per hour; the contract streams whole token base units each second.");
    if (b > parentBalance) return toast.err("You don't have that much. Add test USDC first.");
    const rate = h / 3600n;
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
    <Card hero><ActionError error={actionError}/>
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
          <Field label="Flow per hour (approx.)" hint="The confirmed rate is rounded down to whole token base units per second."><Input inputMode="decimal" value={perHour} placeholder="e.g. 0.5" onChange={(e) => setPerHour(e.target.value)} aria-label="Allowance per hour" /></Field>
        </div>
        <Button className="mt-3" busy={busy === "fund"} onClick={()=>setConfirmAllowance(true)}>Review allowance</Button>
        <ConfirmDialog open={confirmAllowance} title="Reserve this allowance?" confirmLabel="Start allowance" busy={busy === "fund"} lines={[`Reserve ${budget || "0"} test USDC for @${teen.famId}. It leaves your available balance.`, `Effective continuous rate: ${fmt(((parseAmount(perHour) ?? 0n) / 3600n) * 3600n,6)} USDC per hour, capped by the budget.`, "Accrued money belongs to your teen. This is separate from mission rewards and locked future savings."]} onCancel={()=>setConfirmAllowance(false)} onConfirm={async()=>{await fund();setConfirmAllowance(false);}}/>
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
  const { busy, run, error: actionError } = useAct();
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
    if (!holdMin.trim() || !Number.isFinite(mins) || mins < 0 || mins > 1440) return toast.err("How long should a hold last? Pick 0 to 1440 minutes.");
    if ([...L, th, fd].some((n) => n > (1n << 128n) - 1n)) return toast.err("Those amounts are too large. Choose smaller limits.");

    const terms: Terms = { levelLimits: L, newPayeeThreshold: th, firstDayCap: fd, holdSeconds: Math.round(mins * 60), strictHolds: strict };
    const inv = await run("inv", () => signInvite(signer!, familyId, terms));
    if (!inv) return;
    setLink(inviteLink(window.location.origin, inv, cfg));
  }

  return (
    <Card title="Invite a teen" className="invite-panel"><ActionError error={actionError}/>
      <AnimatedOutline accent="blue" animated={false} />
      <p className="text-sm text-muted">
        Choose the rules your teen starts with. They&apos;re signed into the link, so your teen can&apos;t change them, and you can adjust them any time later.
      </p>
      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {limits.map((v, i) => (
          <Field key={i} label={i === 0 ? "Daily limit now" : `At level ${i + 1}`}>
            <Input inputMode="decimal" value={v} placeholder={["e.g. 5", "e.g. 8", "e.g. 12", "e.g. 20"][i]} onChange={(e) => setLimits(limits.map((x, j) => (j === i ? e.target.value : x)))} aria-label={`Level ${i + 1} daily limit`} />
          </Field>
        ))}
      </div>
      <div className="mt-3 grid gap-3 sm:grid-cols-3">
        <Field label="Hold a first payment to someone new above">
          <Input inputMode="decimal" value={threshold} placeholder="e.g. 3" onChange={(e) => setThreshold(e.target.value)} aria-label="New payee hold amount" />
        </Field>
        <Field label="In the first 24 hours, hold payments above">
          <Input inputMode="decimal" value={firstDay} placeholder="e.g. 2" onChange={(e) => setFirstDay(e.target.value)} aria-label="First day hold amount" />
        </Field>
        <Field label="A hold lasts (minutes)">
          <Input inputMode="numeric" value={holdMin} placeholder="e.g. 10" onChange={(e) => setHoldMin(e.target.value)} aria-label="Hold minutes" />
        </Field>
      </div>
      <label className="mt-3 flex items-start gap-2 text-sm text-muted">
        <input type="checkbox" checked={strict} onChange={(e) => setStrict(e.target.checked)} className="mt-0.5" aria-label="Parent must approve every hold" />
        <span>I must approve every held payment. (If off, your teen can release one after the wait if you haven&apos;t answered.)</span>
      </label>
      <p className="mt-4 text-xs text-dim">Fill in every field. Example values are suggestions, not saved rules.</p>
      <Button className="mt-4" busy={busy === "inv"} disabled={limits.some((v) => !v.trim()) || !threshold.trim() || !firstDay.trim() || !holdMin.trim()} onClick={make}>Create invite link <span aria-hidden="true">↗</span></Button>
      {link && (
        <div className="pop mt-3 space-y-3">
          <p className="text-xs text-dim">Works for 7 days. The first person to sign in and confirm joining uses it, so send it only to your teen. Opening it does not use it.</p>
          {(new URL(link).hostname === "localhost" || new URL(link).hostname === "127.0.0.1") && <p className="text-xs text-warn">This local link works on this computer. For now, your teen can open it in a separate browser or private window and use their own email. To use another device, create the invite from your hosted app.</p>}
          <Input readOnly value={link} onFocus={(e) => e.currentTarget.select()} aria-label="Invite link" />
          <div className="flex flex-wrap items-center gap-3">
            <Button variant="ghost" onClick={async () => {
              try {
                if (!navigator.clipboard) throw new Error("Clipboard unavailable");
                await navigator.clipboard.writeText(link);
                toast.ok("Link copied");
              } catch { toast.err("Couldn't copy automatically. Select the invite link and copy it manually."); }
            }}>Copy link</Button>
            <Link href={link} className="text-sm font-semibold underline">Open invite</Link>
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
