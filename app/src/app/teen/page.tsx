"use client";
import Link from "next/link";
import { Workspace, teenSections, useWorkspaceView } from "@/components/workspace";
import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { ActionError, Button, Card, ConfirmDialog, Empty, Field, GoalCard, Input, Money, Pill, Proof, Shell, SignIn, Timeline, useToast } from "@/components/ui";
import { QR } from "@/components/qr";
import { Account, famIdBytes, ROLE, liveSpendable } from "@/lib/chain";
import { faucet, relay, TxResult } from "@/lib/relay";
import { Q, useGql } from "@/lib/gql";
import { useAct, useFamilyParent, useMe, useNow, useTeenView } from "@/lib/hooks";
import { useWallet } from "@/lib/wallet";
import { FamilyConnections, FeaturedGoal } from "@/components/family-visuals";
import { SavingStory } from "@/components/saving-story";
import { big, cap, fmt, parseAmount } from "@/lib/format";
import { usePrivate, type Bundle } from "@/lib/private";
import { FeatureGate, SyncNotice, useCapabilities } from "@/components/flow-status";
import { TeenMissions } from "@/components/missions";
import { Passport } from "@/components/passport";
import { TeenFutureFund } from "@/components/futurefund";

export default function TeenPage() {
  return (
    <Suspense fallback={<Shell><Empty>Loading…</Empty></Shell>}>
      <TeenInner />
    </Suspense>
  );
}

function TeenInner() {
  const { signer } = useWallet();
  const { acct, loaded, error: accountError, refresh: refreshAccount } = useMe();

  if (!signer)
    return (
      <Shell>
        <SignIn
          title="Teen sign in"
          blurb="Pay friends by name, save toward goals, and watch your limit grow."
        />
      </Shell>
    );
  if (!loaded) return <Shell><Empty>Loading…</Empty></Shell>;
  if (accountError) return <Shell><Card title="Couldn’t check your account"><p role="alert">{accountError}</p><Button onClick={() => void refreshAccount()}>Try again</Button></Card></Shell>;
  if (!acct || acct.role === ROLE.NONE)
    return (
      <Shell>
        <Card className="mx-auto mt-6 max-w-md text-center">
          <h1 className="text-xl font-bold">You need an invite</h1>
          <p className="mt-2 text-sm text-muted">Teens join with a link from a parent. Ask yours to open the Fam-Fi parent page and create an invite.</p>
          <Link href="/parent" className="link-button link-button-secondary mt-4">I&apos;m a parent</Link>
        </Card>
      </Shell>
    );
  if (acct.role !== ROLE.TEEN)
    return (
      <Shell famId={acct.famId}>
        <Card className="mx-auto mt-6 max-w-md text-center">
          <h1 className="text-xl font-bold">This account isn&apos;t a teen</h1>
          <p className="mt-2 text-sm text-muted">Signed in as @{acct.famId}.</p>
          <Link href={acct.role === ROLE.PARENT ? "/parent" : "/gift"} className="link-button link-button-secondary mt-4">Go to your view</Link>
        </Card>
      </Shell>
    );
  return <Shell famId={acct.famId} role="teen"><Dashboard key={signer.address.toLowerCase()} acct={acct} /></Shell>;
}

function Dashboard({ acct }: { acct: Account }) {
  const { signer } = useWallet();
  const me = signer!.address.toLowerCase();
  const { view, refresh, error: balanceError } = useTeenView(signer!.address, 2000);
  const now = useNow(250);
  const section = useWorkspaceView(teenSections);

  const priv = usePrivate();
  const capabilities = useCapabilities();
  const parentId = useFamilyParent(acct.familyId);
  const toast = useToast();
  const changed = useCallback(
    async (until?: (b: Bundle) => boolean) => {
      await refresh();
      if (!until) return void (await priv.refresh());
      if (!(await priv.refreshUntil(until, 10000))) toast.ok("Confirmed on-chain. The summary is still catching up and will update shortly.");
    },
    [refresh, priv, toast],
  );

  if (!view) return <Empty>Loading your account…</Empty>;
  const spendable = liveSpendable(view, now);
  const limit = view.limits[view.level] ?? 0n;
  const historyReady = !!priv.bundle && !priv.error && !priv.bundle.indexerError && priv.bundle.freshness?.lagBlocks != null && priv.bundle.freshness.lagBlocks <= 10;

  return (
    <Workspace sections={teenSections} view={section} famId={acct.famId} role="teen">
      <SyncNotice bundle={priv.bundle} />
      {balanceError && <p className="service-notice" role="status">{balanceError} <Button variant="ghost" onClick={()=>void refresh()}>Retry balances</Button></p>}
      {parentId && <FamilyConnections parent={parentId} teens={[{id: me, famId: acct.famId, frozen:view.frozen}]}/>}
      {section === "overview" && <Card hero>
        <div className="relative flex items-start justify-between gap-3">
          <div>
            <p className="text-sm text-dim">My money</p>
            <Money value={spendable} size="xl" />
            {view.rate > 0n && view.streamRemaining > 0n && <p className="mt-1 text-xs font-medium text-brand">Allowance accrues continuously · {fmt(view.rate * 3600n)} / hour</p>}
          </div>
          <div className="text-right">
            <Pill tone="mint">Level {view.level + 1}</Pill>
            <p className="mt-2 text-xs text-dim">Daily limit {fmt(limit)}</p>
          </div>
        </div>
        <div className="mt-4 rounded-xl bg-card2 px-4 py-3 text-sm">
          <span className="text-dim">Left to spend today: </span>
          <span className="num font-semibold">{fmt(view.remainingToday)}</span>
        </div>
        {view.frozen && (
          <p className="mt-3 rounded-xl bg-bad/15 px-4 py-3 text-sm font-medium text-bad" role="alert">
            Your parent has frozen spending for now. You can still save, and money can still come in.
          </p>
        )}
        <p className="mt-3 text-sm text-muted">Allowance budget remaining: {fmt(view.streamRemaining > view.accrued ? view.streamRemaining - view.accrued : 0n)}{view.rate > 0n && view.streamRemaining > view.accrued ? ` · estimated end ${new Date(view.fetchedAt + Number((view.streamRemaining-view.accrued)/view.rate)*1000).toLocaleString()}` : ""}</p>
        <Link className="link-button mt-3" href="/teen?view=payments&ask=parent">Ask my parent</Link>
        <MyCode famId={acct.famId} />
        <AddMoney famId={acct.famId} onDone={refresh} />
      </Card>}

      {priv.error && <p className="service-notice" role="status">Your history is temporarily unavailable. Your spending balance comes directly from the network; <span>{priv.error}</span> <Button variant="ghost" onClick={() => void priv.refresh()}>Retry family access</Button></p>}
      {section === "overview" && priv.bundle && <FeaturedGoal goals={priv.bundle.data.goals}/>}
      {section === "overview" && priv.bundle && (historyReady ? <TeenMissions missions={priv.bundle.data.missions.filter(m=>m.status==="ACTIVE" || m.status==="REJECTED" || m.status==="SUBMITTED").sort((a,b)=>Number(a.status==="SUBMITTED")-Number(b.status==="SUBMITTED")).slice(0,1)} frozen={view.frozen} onChanged={changed}/> : <Card title="Missions"><Empty>Mission history is catching up. Existing rewards remain reserved in the contract.</Empty></Card>)}
      {section === "overview" && <div className="overview-columns"><Passport bundle={priv.bundle} fetchedAt={priv.fetchedAt} error={priv.error} /><Held me={me} view={view} bundle={priv.bundle} onDone={() => { void refresh(); void priv.refresh(); }} /></div>}
      {section === "payments" && <div className="grid gap-8 lg:grid-cols-2"><div className="space-y-8"><PayCard acct={acct} onDone={refresh} /><Held me={me} view={view} bundle={priv.bundle} onDone={() => { void refresh(); void priv.refresh(); }} /></div><div className="space-y-8"><Requests parentId={parentId} bundle={priv.bundle} me={me} onDone={() => { void refresh(); void priv.refresh(); }} /><SplitCard onDone={refresh} /></div></div>}
      {section === "missions" && <FeatureGate supported={capabilities.missions} label="Missions">{!historyReady ? <Card title="Missions"><Empty>{priv.error || priv.bundle?.indexerError ? "Mission history is unavailable until family access is restored. Your parent's reserved rewards remain in the contract." : "Loading confirmed missions while history catches up…"}</Empty></Card> : <TeenMissions missions={priv.bundle!.data.missions} frozen={view.frozen} onChanged={changed} />}</FeatureGate>}
      {section === "savings" && <div className="space-y-8"><SavingStory bundle={priv.bundle} fetchedAt={priv.fetchedAt} error={priv.error} onRetry={priv.refresh} /><Goals acct={acct} me={me} view={view} bundle={priv.bundle} onDone={() => { refresh(); void priv.refresh(); }} /><FeatureGate supported={capabilities.futureFund} label="FutureFund"><TeenFutureFund bundle={priv.bundle} onChanged={changed} fetchedAt={priv.fetchedAt} error={priv.error} /></FeatureGate></div>}
      {section === "activity" && <Passport bundle={priv.bundle} fetchedAt={priv.fetchedAt} error={priv.error}/>}
      {section === "activity" && <Card title="Your timeline">{priv.error || priv.bundle?.indexerError ? <Empty>Activity is unavailable while the indexer catches up.</Empty> : <Timeline rows={priv.bundle?.data.timeline} />}</Card>}
    </Workspace>
  );
}

function AddMoney({ famId, onDone }: { famId: string; onDone: () => void }) {
  const { busy, run, error: actionError } = useAct();
  return (
    <div className="mt-3">
      <button
        className="text-sm font-semibold text-brand underline disabled:opacity-50"
        disabled={busy === "add"}
        onClick={() => run("add", async () => { const r = await faucet(famId); onDone(); return r; }, (r) => `Added ${r.amount} test dollars`)}
      >
        {busy === "add" ? "Adding…" : "+ Add test USDC"}
      </button>
      <ActionError error={actionError}/>
    </div>
  );
}

// ───────────────────────── receive / scan ─────────────────────────

function MyCode({ famId }: { famId: string }) {
  const [open, setOpen] = useState(false);
  const url = typeof window === "undefined" ? "" : `${window.location.origin}/teen?pay=${famId}`;
  return (
    <div className="mt-3 flex flex-wrap items-center gap-3">
      <span className="rounded-lg bg-brand/10 px-3 py-1.5 text-sm font-semibold text-brand">Your Fam-ID: @{famId}</span>
      <button className="text-sm font-semibold text-dim underline" onClick={() => setOpen((o) => !o)}>{open ? "Hide my pay code" : "Show my pay code"}</button>
      {open && <div className="pop w-full"><QR value={url} size={150} /><p className="mt-1 text-xs text-dim">Friends scan this to pay you.</p></div>}
    </div>
  );
}

function ScanButton({ onFound }: { onFound: (famId: string) => void }) {
  const [on, setOn] = useState(false);
  const video = useRef<HTMLVideoElement>(null);
  const supported = typeof window !== "undefined" && "BarcodeDetector" in window && !!navigator.mediaDevices?.getUserMedia;
  useEffect(() => {
    if (!on) return;
    let stop = false;
    let stream: MediaStream | undefined;
    (async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
        if (video.current) { video.current.srcObject = stream; await video.current.play(); }
        const det = new (window as any).BarcodeDetector({ formats: ["qr_code"] });
        while (!stop) {
          const codes = await det.detect(video.current!);
          const raw: string | undefined = codes[0]?.rawValue;
          if (raw) {
            let id = raw;
            try { id = new URL(raw).searchParams.get("pay") || raw; } catch { /* plain text */ }
            onFound(id.replace(/^@/, "").toLowerCase());
            setOn(false);
            return;
          }
          await new Promise((r) => setTimeout(r, 250));
        }
      } catch { setOn(false); }
    })();
    return () => { stop = true; stream?.getTracks().forEach((t) => t.stop()); };
  }, [on, onFound]);
  if (!supported) return null;
  return (
    <>
      <Button variant="ghost" onClick={() => setOn((o) => !o)}>{on ? "Close camera" : "Scan"}</Button>
      {on && <video ref={video} className="mt-3 w-full max-w-xs rounded-xl" muted playsInline />}
    </>
  );
}

// ───────────────────────── pay ─────────────────────────

function PayCard({ acct, onDone }: { acct: Account; onDone: () => void }) {
  const { signer } = useWallet();
  const { busy, run, error: actionError } = useAct();
  const toast = useToast();
  const params = useSearchParams();
  const [to, setTo] = useState((params.get("pay") || "").toLowerCase());
  const [amount, setAmount] = useState("");
  const [memo, setMemo] = useState("");
  const [tx, setTx] = useState<TxResult | null>(null);
  const [note, setNote] = useState<{ tone: "ok" | "hold"; text: string } | null>(null);
  const users = useGql<{ User: { famId: string; role: string }[] }>(Q.users, {}, "users", 4000);
  const options = (users.data?.User ?? []).filter((u) => u.famId !== acct.famId);
  const lookalike = (() => {
    const norm = (s: string) => s.replace(/[01]/g, (c) => (c === "0" ? "o" : "l")).replace(/_/g, "");
    const hit = options.find((u) => u.famId !== to && norm(u.famId) === norm(to) && to.length > 2);
    return hit?.famId;
  })();

  async function pay() {
    const amt = parseAmount(amount);
    if (!to) return toast.err("Who are you paying? Type their Fam-ID.");
    if (!amt) return toast.err("Enter an amount like 2.50.");
    setTx(null); setNote(null);
    const r = await run("pay", () => relay(signer!, "pay", [famIdBytes(to), amt, memo.trim().slice(0, 60)]));
    if (!r) return;
    setTx(r);
    if (r.held) {
      setNote(
        r.held.kind === 0
          ? { tone: "hold", text: `That's over today's limit, so ${"your parent"} has been asked to OK it. The money is set aside, not spent.` }
          : { tone: "hold", text: `On hold for a few minutes because it's a big first payment to someone new. Your parent was alerted. You can release or cancel it below.` },
      );
    } else {
      setNote({ tone: "ok", text: `Sent ${fmt(amt)} to @${to}.` });
      setAmount(""); setMemo("");
    }
    onDone();
  }

  return (
    <Card title="Pay someone"><ActionError error={actionError}/>
      <div className="grid gap-3 sm:grid-cols-[1fr_9rem]">
        <Field label="To (Fam-ID)" hint={lookalike ? `Careful: this looks a lot like @${lookalike}.` : undefined}>
          <Input list="famids" value={to} onChange={(e) => setTo(e.target.value.toLowerCase().replace(/^@/, "").replace(/[^a-z0-9_]/g, ""))} placeholder="e.g. canteen" aria-label="Pay to Fam-ID" />
          <datalist id="famids">{options.map((u) => <option key={u.famId} value={u.famId} />)}</datalist>
        </Field>
        <Field label="Amount">
          <Input inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="2.50" aria-label="Amount" />
        </Field>
      </div>
      <div className="mt-3"><Field label="What for? (optional)"><Input value={memo} onChange={(e) => setMemo(e.target.value)} maxLength={60} placeholder="snack" aria-label="Note" /></Field></div>
      <div className="mt-4 flex flex-wrap items-center gap-2">
        <Button busy={busy === "pay"} onClick={pay}>Pay</Button>
        <ScanButton onFound={setTo} />
      </div>
      {note && (
        <p className={`pop mt-3 rounded-xl px-4 py-3 text-sm ${note.tone === "ok" ? "bg-brand/10 text-brand" : "bg-warn/15 text-warn"}`} role="status">{note.text}</p>
      )}
      <Proof tx={tx} label={tx?.held ? "Held" : "Paid"} />
    </Card>
  );
}

// ───────────────────────── held payments ─────────────────────────

function Held({ me, view, bundle, onDone }: { me: string; view: { strictHolds: boolean; frozen: boolean }; bundle: Bundle | null; onDone: () => void }) {
  const { signer } = useWallet();
  const { busy, run, error: actionError } = useAct();
  const now = useNow(1000) / 1000;
  const rows = bundle?.data.teenHolds ?? [];
  if (!rows.length) return null;
  return (
    <Card title="On hold"><ActionError error={actionError}/>
      <div className="space-y-3">
        {rows.map((p) => {
          const over = p.kind === "OVER_LIMIT";
          const left = Math.max(0, Number(p.releaseAt) - now);
          const canRelease = !over && !view.strictHolds && !view.frozen && left <= 0;
          return (
            <div key={p.id} className="rounded-xl border border-warn/30 bg-warn/10 p-4">
              <p className="font-semibold">{fmt(big(p.amount))} to {cap(p.toFamId)}</p>
              <p className="mt-1 text-sm text-muted">
                {over || view.strictHolds ? "Waiting for your parent to approve." : view.frozen ? "Spending is frozen. You can cancel this payment, or your parent can review it." : left > 0 ? `You can release it in ${Math.ceil(left)}s unless your parent says no.` : "The hold is over. You can release it now."}
              </p>
              <div className="mt-3 flex gap-2">
                {!over && !view.strictHolds && (
                  <Button busy={busy === "f" + p.id} disabled={!canRelease} onClick={async () => { if (await run("f" + p.id, () => relay(signer!, "finalizePending", [BigInt(p.id)]), "Sent")) onDone(); }}>Release</Button>
                )}
                <Button variant="ghost" busy={busy === "c" + p.id} onClick={async () => { if (await run("c" + p.id, () => relay(signer!, "cancelPending", [BigInt(p.id)]), "Cancelled. The money is back.")) onDone(); }}>Cancel</Button>
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}

// ───────────────────────── asking for and answering requests ─────────────────────────

function Requests({ parentId, bundle, me, onDone }: { parentId: string; bundle: Bundle | null; me: string; onDone: () => void }) {
  const { signer } = useWallet();
  const { busy, run, error: actionError } = useAct();
  const toast = useToast();
  const [to, setTo] = useState("");
  const [amount, setAmount] = useState("");
  const [memo, setMemo] = useState("");
  const target = to || parentId;
  const incomingRows = bundle?.data.incomingRequests ?? [];
  const [payingRequest, setPayingRequest] = useState<(typeof incomingRows)[number] | null>(null);

  async function ask() {
    const amt = parseAmount(amount);
    if (!target) return toast.err("Who are you asking?");
    if (!amt) return toast.err("Enter an amount.");
    if (await run("ask", () => relay(signer!, "createRequest", [famIdBytes(target), amt, memo.trim().slice(0, 60)]), `Asked @${target} for ${fmt(amt)}`)) { setAmount(""); setMemo(""); onDone(); }
  }

  return (
    <Card title="Ask for money"><ActionError error={actionError}/>
      <div className="grid gap-3 sm:grid-cols-[1fr_9rem]">
        <Field label="Ask who?" hint={parentId && !to ? "Your parent, unless you pick someone else." : undefined}>
          <Input value={to} onChange={(e) => setTo(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ""))} placeholder={parentId || "Fam-ID"} aria-label="Ask who" />
        </Field>
        <Field label="Amount"><Input inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="5.00" aria-label="Request amount" /></Field>
      </div>
      <div className="mt-3"><Field label="What for?"><Input value={memo} onChange={(e) => setMemo(e.target.value)} placeholder="school trip" maxLength={60} aria-label="Request note" /></Field></div>
      <Button className="mt-4" variant="soft" busy={busy === "ask"} disabled={!target} onClick={ask}>Send request</Button>

      {!!bundle?.data.outgoingRequests?.length && <div className="mt-4 space-y-2"><p className="text-xs font-semibold text-dim">Waiting for a reply</p>{bundle.data.outgoingRequests.map((r) => <p key={r.id} className="text-sm">Asked @{r.toFamId} for {fmt(big(r.amount))} · pending</p>)}</div>}
      {incomingRows.length > 0 && (
        <div className="mt-5 space-y-2 border-t border-line pt-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-dim">Asking you</p>
          {incomingRows.map((r) => (
            <div key={r.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-card2 p-3">
              <p className="text-sm"><span className="font-semibold">{cap(r.fromFamId)}</span> asks for <span className="num font-semibold">{fmt(big(r.amount))}</span>{r.memo ? ` · ${r.memo}` : ""}</p>
              <Button busy={busy === "pr" + r.id} onClick={() => setPayingRequest(r)}>Review payment</Button>
            </div>
          ))}
        </div>
      )}
      <ConfirmDialog open={!!payingRequest} title="Pay this request?" confirmLabel="Confirm payment" busy={busy === "pr" + payingRequest?.id} onCancel={() => setPayingRequest(null)} lines={payingRequest ? [`${fmt(big(payingRequest.amount))} test USDC goes from your money to @${payingRequest.fromFamId}.`, "Your daily limit and safety rules apply. If the payment is held, it stays pending until released; the recipient has not been paid."] : []} onConfirm={async () => {
        if (!payingRequest) return;
        const r = await run("pr" + payingRequest.id, () => relay(signer!, "payRequest", [BigInt(payingRequest.id)]), tx => tx.held ? "Payment held for review; not paid yet." : "Paid");
        if (r) { setPayingRequest(null); onDone(); }
      }}/>
    </Card>
  );
}

// ───────────────────────── split a bill ─────────────────────────

function SplitCard({ onDone }: { onDone: () => void }) {
  const { signer } = useWallet();
  const { busy, run, error: actionError } = useAct();
  const toast = useToast();
  const [total, setTotal] = useState("");
  const [people, setPeople] = useState("3");
  const [memo, setMemo] = useState("");
  const [link, setLink] = useState("");

  async function create() {
    const t = parseAmount(total);
    const n = Number(people);
    if (!t) return toast.err("Enter the total of the bill.");
    if (!Number.isInteger(n) || n < 1 || n > 50) return toast.err("How many friends owe you? (1–50)");
    const perShare = t / BigInt(n);
    if (perShare === 0n) return toast.err("That's too small to split.");
    const r = await run("split", () => relay(signer!, "createSplit", [perShare, n, memo.trim().slice(0, 40) || "bill"]));
    const id = r?.events.find((e) => e.name === "SplitCreated")?.args.splitId;
    if (id !== undefined) {
      setLink(`${window.location.origin}/split/${id}`);
      toast.ok(`Split ready: ${fmt(perShare)} each`);
      onDone();
    }
  }

  return (
    <Card title="Split a bill"><ActionError error={actionError}/>
      <p className="mb-3 text-sm text-muted">Paid for everyone? Share a link. Each friend pays their part straight to you, and you can watch it fill up.</p>
      <div className="grid gap-3 sm:grid-cols-3">
        <Field label="Total bill"><Input inputMode="decimal" value={total} onChange={(e) => setTotal(e.target.value)} placeholder="12.00" aria-label="Bill total" /></Field>
        <Field label="Friends who owe"><Input inputMode="numeric" value={people} onChange={(e) => setPeople(e.target.value)} aria-label="Friends who owe" /></Field>
        <Field label="What was it?"><Input value={memo} onChange={(e) => setMemo(e.target.value)} placeholder="pizza" maxLength={40} aria-label="Bill note" /></Field>
      </div>
      <Button className="mt-4" variant="soft" busy={busy === "split"} onClick={create}>Create split link</Button>
      {link && (
        <div className="pop mt-4 space-y-3">
          <Input readOnly value={link} onFocus={(e) => e.currentTarget.select()} aria-label="Split link" />
          <div className="flex flex-wrap items-center gap-3">
            <Button variant="ghost" onClick={async () => { await navigator.clipboard?.writeText(link); toast.ok("Link copied"); }}>Copy link</Button>
            <Link href={link.replace(window.location.origin, "")} className="link-button link-button-secondary">Watch it fill up</Link>
            <QR value={link} size={110} />
          </div>
        </div>
      )}
    </Card>
  );
}

// ───────────────────────── goals ─────────────────────────

function Goals({ acct, me, view, bundle, onDone }: { acct: Account; me: string; view: { roundUpGoal: number; roundUpUnit: bigint }; bundle: Bundle | null; onDone: () => void }) {
  const { signer } = useWallet();
  const { busy, run, error: actionError } = useAct();
  const toast = useToast();
  const rows = bundle?.data.goals;
  const [title, setTitle] = useState("");
  const [target, setTarget] = useState("");
  const [days, setDays] = useState("30");
  const [save, setSave] = useState<Record<string, string>>({});
  const [shop, setShop] = useState("");
  const now = useNow(1000) / 1000;
  const [closing, setClosing] = useState<{ id: string; memo: string; saved: string; matched: string } | null>(null);

  async function propose() {
    const t = parseAmount(target);
    const d = Number(days);
    if (!title.trim()) return toast.err("What are you saving for?");
    if (!t) return toast.err("How much does it cost?");
    if (!Number.isSafeInteger(d) || d < 1 || d > 3650) return toast.err("Pick a whole number of days between 1 and 3650.");
    const deadline = Math.floor(Date.now() / 1000) + d * 86400;
    if (await run("prop", () => relay(signer!, "proposeGoal", [t, deadline, 2500, title.trim().slice(0, 40)]), "Sent to your parent for approval")) { setTitle(""); setTarget(""); onDone(); }
  }

  void acct;
  return (
    <Card title="Goals"><ActionError error={actionError}/>
      <div className="space-y-3">
        {rows?.length === 0 && <Empty>Saving for something? Add a goal. A relative can match what you save.</Empty>}
        {rows?.map((g) => (
          <GoalCard key={g.id} g={g}>
            {g.status === "ACTIVE" && (
              <>
                <div className="flex w-full gap-2">
                  <Input inputMode="decimal" placeholder="Save how much?" value={save[g.id] ?? ""} onChange={(e) => setSave({ ...save, [g.id]: e.target.value })} aria-label={`Save toward ${g.memo}`} />
                  <Button
                    busy={busy === "s" + g.id}
                    onClick={async () => {
                      const a = parseAmount(save[g.id] ?? "");
                      if (!a) return toast.err("Enter an amount to save.");
                      const r = await run("s" + g.id, () => relay(signer!, "saveToGoal", [BigInt(g.id), a]));
                      if (r) {
                        const rel = r.events.filter((e) => e.name === "GiftReleased").reduce((s, e) => s + big(e.args.amount), 0n);
                        toast.ok(rel > 0n ? `Saved ${fmt(a)} and ${fmt(rel)} of gift money joined it` : `Saved ${fmt(a)}`);
                        if (r.events.some((e) => e.name === "LevelUp")) toast.ok("Level up! Your daily limit just went up.");
                        setSave({ ...save, [g.id]: "" });
                        onDone();
                      }
                    }}
                  >
                    Save
                  </Button>
                </div>
                <Button
                  variant="ghost"
                  busy={busy === "ru" + g.id}
                  onClick={async () => {
                    const on = view.roundUpGoal === Number(g.id) && view.roundUpUnit > 0n;
                    if (await run("ru" + g.id, () => relay(signer!, "setRoundUp", [on ? 0n : 1_000_000n, on ? 0n : BigInt(g.id)]), on ? "Round-up off" : "Round-up on: spare change goes to this goal")) onDone();
                  }}
                >
                  {view.roundUpGoal === Number(g.id) && view.roundUpUnit > 0n ? "Round-up is on" : "Round up my payments into this"}
                </Button>
              </>
            )}
            {g.status === "COMPLETE" && (
              <div className="flex w-full gap-2">
                <Input placeholder="Buy it from (Fam-ID), e.g. canteen" value={shop} onChange={(e) => setShop(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ""))} aria-label="Shop Fam-ID" />
                <Button busy={busy === "b" + g.id} onClick={async () => { if (!shop) return toast.err("Which shop?"); if (await run("b" + g.id, () => relay(signer!, "payFromGoal", [BigInt(g.id), famIdBytes(shop)]), "Bought it! 🎉")) onDone(); }}>Spend it</Button>
              </div>
            )}
            {g.status === "ACTIVE" && Number(g.deadline) < now && <Button variant="ghost" onClick={() => setClosing(g)}>Close and return my savings</Button>}
          </GoalCard>
        ))}
      </div>

      <ConfirmDialog open={!!closing} title="Close this goal?" confirmLabel="Close and return savings" busy={busy === "close-goal"}
        onCancel={() => setClosing(null)}
        onConfirm={async () => {
          if (!closing) return;
          const tx = await run("close-goal", () => relay(signer!, "closeGoal", [BigInt(closing.id)]), "Goal closed. Saved money returned to your balance.");
          if (tx) { setClosing(null); onDone(); }
        }}
        lines={closing ? [`${closing.memo} will close. ${fmt(big(closing.saved) + big(closing.matched))} returns to your spendable balance.`, "Unreleased gift money stays available for its contributor to reclaim."] : []} />

      <div className="mt-5 border-t border-line pt-4">
        <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-dim">New goal</p>
        <div className="grid gap-3 sm:grid-cols-[1fr_8rem_6rem]">
          <Field label="Saving for"><Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Headphones" maxLength={40} aria-label="Goal name" /></Field>
          <Field label="Costs"><Input inputMode="decimal" value={target} onChange={(e) => setTarget(e.target.value)} placeholder="40" aria-label="Goal cost" /></Field>
          <Field label="Days"><Input inputMode="numeric" value={days} onChange={(e) => setDays(e.target.value)} aria-label="Goal days" /></Field>
        </div>
        <Button className="mt-3" variant="soft" busy={busy === "prop"} onClick={propose}>Ask my parent</Button>
      </div>
    </Card>
  );
}
