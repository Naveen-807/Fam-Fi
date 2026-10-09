"use client";
import Link from "next/link";
import { Suspense, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Button, Card, Empty, Field, GoalCard, Input, Money, Pill, Proof, Shell, SignIn, Timeline, useToast } from "@/components/ui";
import { QR } from "@/components/qr";
import { Account, famIdBytes, ROLE, liveSpendable } from "@/lib/chain";
import { faucet, relay, TxResult } from "@/lib/relay";
import { Q, useGql } from "@/lib/gql";
import { useAct, useMe, useNow, useTeenView } from "@/lib/hooks";
import { useWallet } from "@/lib/wallet";
import { big, cap, fmt, parseAmount } from "@/lib/format";

export default function TeenPage() {
  return (
    <Suspense fallback={<Shell><Empty>Loading…</Empty></Shell>}>
      <TeenInner />
    </Suspense>
  );
}

function TeenInner() {
  const { signer } = useWallet();
  const { acct, loaded } = useMe();

  if (!signer)
    return (
      <Shell>
        <SignIn
          title="Teen sign in"
          blurb="Pay friends by name, save toward goals, and watch your limit grow."
          personas={[{ name: "alex", label: "Judge Mode: Alex" }, { name: "riya", label: "Judge Mode: Riya" }]}
        />
      </Shell>
    );
  if (!loaded) return <Shell><Empty>Loading…</Empty></Shell>;
  if (!acct || acct.role === ROLE.NONE)
    return (
      <Shell>
        <Card className="mx-auto mt-6 max-w-md text-center">
          <h1 className="text-xl font-bold">You need an invite</h1>
          <p className="mt-2 text-sm text-slate-600">Teens join with a link from a parent. Ask yours to open the Fam-Fi parent page and create an invite.</p>
          <Link href="/parent"><Button className="mt-4" variant="ghost">I&apos;m a parent</Button></Link>
        </Card>
      </Shell>
    );
  if (acct.role !== ROLE.TEEN)
    return (
      <Shell famId={acct.famId}>
        <Card className="mx-auto mt-6 max-w-md text-center">
          <h1 className="text-xl font-bold">This account isn&apos;t a teen</h1>
          <p className="mt-2 text-sm text-slate-600">Signed in as @{acct.famId}.</p>
          <Link href={acct.role === ROLE.PARENT ? "/parent" : "/gift"}><Button className="mt-4" variant="ghost">Go to your view</Button></Link>
        </Card>
      </Shell>
    );
  return <Shell famId={acct.famId} role="teen"><Dashboard acct={acct} /></Shell>;
}

function Dashboard({ acct }: { acct: Account }) {
  const { signer } = useWallet();
  const me = signer!.address.toLowerCase();
  const { view, refresh } = useTeenView(signer!.address, 2000);
  const now = useNow(250);
  const [tab, setTab] = useState<"home" | "timeline">("home");
  const timeline = useGql<{ TimelineEntry: any[] }>(Q.timelineOf, { a: me }, `tl${me}`);

  if (!view) return <Empty>Loading your account…</Empty>;
  const spendable = liveSpendable(view, now);
  const limit = view.limits[view.level] ?? 0n;

  return (
    <div className="space-y-5">
      <Card>
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-sm text-slate-500">You can spend</p>
            <Money value={spendable} size="xl" />
            {view.rate > 0n && view.streamRemaining > 0n && <p className="mt-1 text-xs font-medium text-mint-600">▲ allowance flowing in</p>}
          </div>
          <div className="text-right">
            <Pill tone="mint">Level {view.level + 1}</Pill>
            <p className="mt-2 text-xs text-slate-500">Daily limit {fmt(limit)}</p>
          </div>
        </div>
        <div className="mt-4 rounded-xl bg-slate-50 px-4 py-3 text-sm">
          <span className="text-slate-500">Left to spend today: </span>
          <span className="num font-semibold">{fmt(view.remainingToday)}</span>
        </div>
        {view.frozen && (
          <p className="mt-3 rounded-xl bg-rose-100 px-4 py-3 text-sm font-medium text-rose-600" role="alert">
            Your parent has frozen spending for now. You can still save, and money can still come in.
          </p>
        )}
        <MyCode famId={acct.famId} />
        <AddMoney famId={acct.famId} onDone={refresh} />
      </Card>

      <div className="flex gap-2" role="tablist">
        {(["home", "timeline"] as const).map((t) => (
          <button key={t} role="tab" aria-selected={tab === t} onClick={() => setTab(t)} className={`rounded-full px-4 py-1.5 text-sm font-semibold ${tab === t ? "bg-ink text-white" : "bg-white text-slate-600 ring-1 ring-slate-200"}`}>
            {t === "home" ? "Home" : "Timeline"}
          </button>
        ))}
      </div>

      {tab === "timeline" ? (
        <Card title="Your timeline"><Timeline rows={timeline.data?.TimelineEntry} /></Card>
      ) : (
        <>
          <PayCard acct={acct} onDone={refresh} />
          <Held me={me} view={view} onDone={refresh} />
          <Requests acct={acct} me={me} onDone={refresh} />
          <SplitCard onDone={refresh} />
          <Goals acct={acct} me={me} view={view} onDone={refresh} />
        </>
      )}
    </div>
  );
}

function AddMoney({ famId, onDone }: { famId: string; onDone: () => void }) {
  const { busy, run } = useAct();
  return (
    <div className="mt-3">
      <button
        className="text-sm font-semibold text-mint-700 underline disabled:opacity-50"
        disabled={busy === "add"}
        onClick={() => run("add", async () => { const r = await faucet(famId); onDone(); return r; }, (r) => `Added ${r.amount} test dollars`)}
      >
        {busy === "add" ? "Adding…" : "+ Add test USDC"}
      </button>
    </div>
  );
}

// ───────────────────────── receive / scan ─────────────────────────

function MyCode({ famId }: { famId: string }) {
  const [open, setOpen] = useState(false);
  const url = typeof window === "undefined" ? "" : `${window.location.origin}/teen?pay=${famId}`;
  return (
    <div className="mt-3 flex flex-wrap items-center gap-3">
      <span className="rounded-lg bg-mint-50 px-3 py-1.5 text-sm font-semibold text-mint-700">Your Fam-ID: @{famId}</span>
      <button className="text-sm font-semibold text-slate-500 underline" onClick={() => setOpen((o) => !o)}>{open ? "Hide my pay code" : "Show my pay code"}</button>
      {open && <div className="pop w-full"><QR value={url} size={150} /><p className="mt-1 text-xs text-slate-500">Friends scan this to pay you.</p></div>}
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
  const { busy, run } = useAct();
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
    <Card title="Pay someone">
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
        <p className={`pop mt-3 rounded-xl px-4 py-3 text-sm ${note.tone === "ok" ? "bg-mint-50 text-mint-700" : "bg-sun-100 text-sun-700"}`} role="status">{note.text}</p>
      )}
      <Proof tx={tx} label={tx?.held ? "Held" : "Paid"} />
    </Card>
  );
}

// ───────────────────────── held payments ─────────────────────────

function Held({ me, view, onDone }: { me: string; view: { strictHolds: boolean }; onDone: () => void }) {
  const { signer } = useWallet();
  const { busy, run } = useAct();
  const now = useNow(1000) / 1000;
  const { data } = useGql<{ Pending: any[] }>(Q.pendingOf, { a: me }, `h${me}`);
  const rows = data?.Pending ?? [];
  if (!rows.length) return null;
  return (
    <Card title="On hold">
      <div className="space-y-3">
        {rows.map((p) => {
          const over = p.kind === "OVER_LIMIT";
          const left = Math.max(0, Number(p.releaseAt) - now);
          const canRelease = !over && !view.strictHolds && left <= 0;
          return (
            <div key={p.id} className="rounded-xl border border-sun-100 bg-sun-100/40 p-4">
              <p className="font-semibold">{fmt(big(p.amount))} to {cap(p.toFamId)}</p>
              <p className="mt-1 text-sm text-slate-600">
                {over ? "Waiting for your parent to approve." : view.strictHolds ? "Waiting for your parent to approve." : left > 0 ? `You can release it in ${Math.ceil(left)}s unless your parent says no.` : "The hold is over. You can release it now."}
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

function Requests({ acct, me, onDone }: { acct: Account; me: string; onDone: () => void }) {
  const { signer } = useWallet();
  const { busy, run } = useAct();
  const toast = useToast();
  const fam = useGql<{ Family: { parentFamId: string }[] }>(Q.family, { f: acct.familyId }, `f${acct.familyId}`, 10000);
  const incoming = useGql<{ Request: any[] }>(Q.requestsTo, { a: me }, `r${me}`);
  const [to, setTo] = useState("");
  const [amount, setAmount] = useState("");
  const [memo, setMemo] = useState("");
  const parentId = fam.data?.Family?.[0]?.parentFamId ?? "";
  const target = to || parentId;

  async function ask() {
    const amt = parseAmount(amount);
    if (!target) return toast.err("Who are you asking?");
    if (!amt) return toast.err("Enter an amount.");
    if (await run("ask", () => relay(signer!, "createRequest", [famIdBytes(target), amt, memo.trim().slice(0, 60)]), `Asked @${target} for ${fmt(amt)}`)) { setAmount(""); setMemo(""); }
  }

  return (
    <Card title="Ask for money">
      <div className="grid gap-3 sm:grid-cols-[1fr_9rem]">
        <Field label="Ask who?" hint={parentId && !to ? "Your parent, unless you pick someone else." : undefined}>
          <Input value={to} onChange={(e) => setTo(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ""))} placeholder={parentId || "Fam-ID"} aria-label="Ask who" />
        </Field>
        <Field label="Amount"><Input inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="5.00" aria-label="Request amount" /></Field>
      </div>
      <div className="mt-3"><Field label="What for?"><Input value={memo} onChange={(e) => setMemo(e.target.value)} placeholder="school trip" maxLength={60} aria-label="Request note" /></Field></div>
      <Button className="mt-4" variant="soft" busy={busy === "ask"} onClick={ask}>Send request</Button>

      {(incoming.data?.Request ?? []).length > 0 && (
        <div className="mt-5 space-y-2 border-t border-slate-100 pt-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Asking you</p>
          {incoming.data!.Request.map((r) => (
            <div key={r.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-slate-50 p-3">
              <p className="text-sm"><span className="font-semibold">{cap(r.fromFamId)}</span> asks for <span className="num font-semibold">{fmt(big(r.amount))}</span>{r.memo ? ` · ${r.memo}` : ""}</p>
              <Button busy={busy === "pr" + r.id} onClick={async () => { if (await run("pr" + r.id, () => relay(signer!, "payRequest", [BigInt(r.id)]), "Paid")) onDone(); }}>Pay</Button>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}

// ───────────────────────── split a bill ─────────────────────────

function SplitCard({ onDone }: { onDone: () => void }) {
  const { signer } = useWallet();
  const { busy, run } = useAct();
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
    <Card title="Split a bill">
      <p className="mb-3 text-sm text-slate-600">Paid for everyone? Share a link. Each friend pays their part straight to you, and you can watch it fill up.</p>
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
            <Link href={link.replace(window.location.origin, "")}><Button variant="ghost">Watch it fill up</Button></Link>
            <QR value={link} size={110} />
          </div>
        </div>
      )}
    </Card>
  );
}

// ───────────────────────── goals ─────────────────────────

function Goals({ acct, me, view, onDone }: { acct: Account; me: string; view: { roundUpGoal: number; roundUpUnit: bigint }; onDone: () => void }) {
  const { signer } = useWallet();
  const { busy, run } = useAct();
  const toast = useToast();
  const goals = useGql<{ Goal: any[] }>(Q.goalsOf, { a: me }, `go${me}`);
  const [title, setTitle] = useState("");
  const [target, setTarget] = useState("");
  const [days, setDays] = useState("30");
  const [save, setSave] = useState<Record<string, string>>({});
  const [shop, setShop] = useState("");

  async function propose() {
    const t = parseAmount(target);
    const d = Number(days);
    if (!title.trim()) return toast.err("What are you saving for?");
    if (!t) return toast.err("How much does it cost?");
    if (!Number.isFinite(d) || d < 1) return toast.err("Pick a number of days.");
    const deadline = Math.floor(Date.now() / 1000) + d * 86400;
    if (await run("prop", () => relay(signer!, "proposeGoal", [t, deadline, 2500, title.trim().slice(0, 40)]), "Sent to your parent for approval")) { setTitle(""); setTarget(""); }
  }

  void acct;
  return (
    <Card title="Goals">
      <div className="space-y-3">
        {goals.data?.Goal.length === 0 && <Empty>Saving for something? Add a goal. A relative can match what you save.</Empty>}
        {goals.data?.Goal.map((g) => (
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
          </GoalCard>
        ))}
      </div>

      <div className="mt-5 border-t border-slate-100 pt-4">
        <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-400">New goal</p>
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
