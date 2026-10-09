"use client";
import Link from "next/link";
import { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { cfg } from "@/lib/config";
import { explorerTx, TxResult } from "@/lib/relay";
import { useWallet } from "@/lib/wallet";
import { fmt, timeAgo, cap, big } from "@/lib/format";

// ───────────── toasts ─────────────
type Toast = { id: number; kind: "ok" | "err"; text: string };
const ToastCtx = createContext<{ ok: (t: string) => void; err: (t: string) => void }>({ ok() {}, err() {} });
export const useToast = () => useContext(ToastCtx);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<Toast[]>([]);
  const push = useCallback((kind: Toast["kind"], text: string) => {
    const id = Date.now() + Math.random();
    setItems((x) => [...x.slice(-2), { id, kind, text }]);
    setTimeout(() => setItems((x) => x.filter((i) => i.id !== id)), kind === "err" ? 6000 : 3500);
  }, []);
  const api = useMemo(() => ({ ok: (t: string) => push("ok", t), err: (t: string) => push("err", t) }), [push]);
  return (
    <ToastCtx.Provider value={api}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 bottom-4 z-50 flex flex-col items-center gap-2 px-4" aria-live="polite">
        {items.map((t) => (
          <div
            key={t.id}
            role={t.kind === "err" ? "alert" : "status"}
            className={`pop pointer-events-auto max-w-md rounded-xl px-4 py-3 text-sm font-medium shadow-card ${
              t.kind === "ok" ? "bg-ink text-white" : "bg-rose-600 text-white"
            }`}
          >
            {t.text}
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}

// ───────────── primitives ─────────────
export function Button({
  children, onClick, variant = "primary", busy, disabled, type = "button", className = "", full,
}: {
  children: ReactNode; onClick?: () => void; variant?: "primary" | "ghost" | "danger" | "soft"; busy?: boolean;
  disabled?: boolean; type?: "button" | "submit"; className?: string; full?: boolean;
}) {
  const styles = {
    primary: "bg-mint-600 text-white hover:bg-mint-700 disabled:bg-slate-300",
    soft: "bg-mint-50 text-mint-700 hover:bg-mint-100 disabled:text-slate-400",
    ghost: "bg-white text-ink ring-1 ring-slate-200 hover:bg-slate-50 disabled:text-slate-400",
    danger: "bg-rose-600 text-white hover:bg-rose-600/90 disabled:bg-slate-300",
  }[variant];
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled || busy}
      className={`inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition active:scale-[.98] disabled:cursor-not-allowed ${styles} ${full ? "w-full" : ""} ${className}`}
    >
      {busy && <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" />}
      {children}
    </button>
  );
}

export function Card({ children, className = "", title, right }: { children: ReactNode; className?: string; title?: string; right?: ReactNode }) {
  return (
    <section className={`rounded-2xl bg-white p-5 shadow-card ${className}`}>
      {(title || right) && (
        <div className="mb-3 flex items-center justify-between gap-3">
          {title && <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">{title}</h2>}
          {right}
        </div>
      )}
      {children}
    </section>
  );
}

export function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-semibold text-slate-600">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-xs text-slate-500">{hint}</span>}
    </label>
  );
}

export function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={`w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none ring-mint-500/0 transition focus:border-mint-500 focus:ring-4 focus:ring-mint-500/15 ${props.className ?? ""}`}
    />
  );
}

export function Pill({ children, tone = "slate" }: { children: ReactNode; tone?: "slate" | "mint" | "sun" | "rose" }) {
  const t = {
    slate: "bg-slate-100 text-slate-600",
    mint: "bg-mint-100 text-mint-700",
    sun: "bg-sun-100 text-sun-700",
    rose: "bg-rose-100 text-rose-600",
  }[tone];
  return <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${t}`}>{children}</span>;
}

export function Progress({ value, max, tone = "mint" }: { value: bigint; max: bigint; tone?: "mint" | "sun" }) {
  const pct = max > 0n ? Math.min(100, Number((value * 10000n) / max) / 100) : 0;
  return (
    <div className="h-2.5 w-full overflow-hidden rounded-full bg-slate-100" role="progressbar" aria-valuenow={Math.round(pct)} aria-valuemin={0} aria-valuemax={100}>
      <div className={`h-full rounded-full transition-all duration-500 ${tone === "mint" ? "bg-mint-500" : "bg-sun-500"}`} style={{ width: `${pct}%` }} />
    </div>
  );
}

export function Money({ value, size = "md" }: { value: bigint; size?: "sm" | "md" | "xl" }) {
  const cls = size === "xl" ? "text-5xl font-bold tracking-tight" : size === "md" ? "text-2xl font-bold" : "text-sm font-semibold";
  const [w, f] = fmt(value).split(".");
  return (
    <span className={`num ${cls}`}>
      <span className="text-slate-400">$</span>
      {w}
      <span className={size === "xl" ? "text-2xl text-slate-400" : "text-slate-400"}>.{f}</span>
    </span>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return <p className="rounded-xl bg-slate-50 px-4 py-6 text-center text-sm text-slate-500">{children}</p>;
}

// ───────────── layout ─────────────
export function Shell({ children, famId, role }: { children: ReactNode; famId?: string; role?: string }) {
  const { signer, logout, isDemo } = useWallet();
  return (
    <div className="mx-auto min-h-screen max-w-3xl px-4 pb-24 pt-5">
      <header className="mb-6 flex items-center justify-between gap-2">
        <Link href="/" className="flex flex-none items-center gap-2 whitespace-nowrap font-bold tracking-tight">
          <span className="grid h-8 w-8 place-items-center rounded-xl bg-mint-600 text-white">F</span>
          <span className="text-lg">Fam-Fi</span>
        </Link>
        <div className="flex min-w-0 items-center gap-2">
          <span className="hidden sm:inline"><Pill tone={isDemo ? "sun" : "slate"}>{isDemo ? "Judge/demo wallet" : cfg.networkLabel}</Pill></span>
          <span className="sm:hidden"><Pill tone={isDemo ? "sun" : "slate"}>{isDemo ? "Demo" : "Test"}</Pill></span>
          {signer && (
            <button onClick={logout} className="truncate whitespace-nowrap rounded-lg px-2 py-1 text-xs font-semibold text-slate-500 hover:bg-slate-100" aria-label="Sign out">
              {famId ? `@${famId}${role ? " · " + role : ""} ·` : ""} Sign out
            </button>
          )}
        </div>
      </header>
      <PasskeyPrompt />
      {children}
    </div>
  );
}

/** Shown when nobody is signed in. */
export function SignIn({ title, blurb, personas }: { title: string; blurb: string; personas?: { name: string; label: string }[] }) {
  const { login, loginDemo, hasDynamic, ready } = useWallet();
  return (
    <Card className="mx-auto mt-6 max-w-md text-center">
      <h1 className="text-2xl font-bold">{title}</h1>
      <p className="mt-2 text-sm text-slate-600">{blurb}</p>
      <div className="mt-5">
        {hasDynamic ? (
          <EmailLogin />
        ) : (
          <Button full onClick={login} disabled={!ready}>
            Create a demo account
          </Button>
        )}
      </div>
      {personas && personas.length > 0 && (
        <div className="mt-5 border-t border-slate-100 pt-4">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">Judge Mode: try a ready-made account</p>
          <div className="flex flex-wrap justify-center gap-2">
            {personas.map((p) => (
              <Button key={p.name} variant="soft" onClick={() => loginDemo(p.name)}>
                {p.label}
              </Button>
            ))}
          </div>
        </div>
      )}
    </Card>
  );
}

/** Email one-time code, plus a Face ID / fingerprint shortcut for people who turned it on before. */
function EmailLogin() {
  const { auth, ready } = useWallet();
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  if (!auth) return <p className="text-sm text-slate-500">Loading…</p>;

  if (auth.step === "wallet")
    return (
      <div className="text-sm text-slate-600" role="status">
        <p className="font-semibold text-ink">Setting up your account…</p>
        <p className="mt-1">Creating your private wallet. This takes a few seconds and you only do it once.</p>
        {auth.error && <p className="mt-2 text-rose-600">{auth.error}</p>}
      </div>
    );

  if (auth.step === "code")
    return (
      <form
        className="space-y-3 text-left"
        onSubmit={(e) => {
          e.preventDefault();
          void auth.verifyCode(code);
        }}
      >
        <Field label={`Enter the code we emailed to ${auth.userEmail ?? "you"}`}>
          <Input value={code} onChange={(e) => setCode(e.target.value.replace(/\s/g, ""))} inputMode="numeric" autoComplete="one-time-code" placeholder="123456" autoFocus aria-label="One-time code" />
        </Field>
        {auth.error && <p className="text-sm text-rose-600" role="alert">{auth.error}</p>}
        <Button full type="submit" busy={auth.busy} disabled={code.length < 4}>Verify and continue</Button>
        <button type="button" className="w-full text-center text-xs font-semibold text-slate-500 underline" onClick={auth.reset}>Use a different email</button>
      </form>
    );

  return (
    <form
      className="space-y-3 text-left"
      onSubmit={(e) => {
        e.preventDefault();
        void auth.sendCode(email.trim());
      }}
    >
      <Field label="Your email" hint="We email you a one-time code. No passwords, no wallet to set up.">
        <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" autoComplete="email" aria-label="Email" />
      </Field>
      {auth.error && <p className="text-sm text-rose-600" role="alert">{auth.error}</p>}
      <Button full type="submit" busy={auth.busy} disabled={!ready || !/^\S+@\S+\.\S+$/.test(email.trim())}>Email me a code</Button>
      <button type="button" className="w-full text-center text-xs font-semibold text-slate-500 underline" onClick={() => void auth.signInWithPasskey()}>
        Already turned on Face ID or fingerprint? Sign in with it
      </button>
    </form>
  );
}

/** Shown once after the first email login: turn on Face ID / fingerprint for next time. */
function PasskeyPrompt() {
  const { auth, signer, isDemo } = useWallet();
  const [hidden, setHidden] = useState(false);
  if (isDemo || !signer || !auth || !auth.loggedIn || auth.passkeyRegistered || hidden) return null;
  return (
    <div className="pop mb-5 flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-mint-50 p-4 text-sm text-mint-700">
      <p className="min-w-0 flex-1">
        <b>Next time, skip the email.</b> Turn on Face ID or fingerprint on this device.
        {auth.error && <span className="mt-1 block text-rose-600">{auth.error}</span>}
      </p>
      <div className="flex gap-2">
        <Button busy={auth.busy} onClick={() => void auth.registerPasskey()}>Turn on</Button>
        <Button variant="ghost" onClick={() => setHidden(true)}>Not now</Button>
      </div>
    </div>
  );
}

// ───────────── shared widgets ─────────────
export function Proof({ tx, label }: { tx: TxResult | null; label?: string }) {
  if (!tx) return null;
  const link = explorerTx(tx.hash);
  return (
    <div className="pop mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 rounded-xl bg-mint-50 px-4 py-3 text-sm text-mint-700">
      <span className="font-bold">
        {label ?? "Done"} in {(tx.includedMs / 1000).toFixed(2)}s
      </span>
      {tx.finalMs !== undefined && <span>final in {(tx.finalMs / 1000).toFixed(2)}s</span>}
      {link ? (
        <a className="underline" href={link} target="_blank" rel="noreferrer">
          see proof
        </a>
      ) : (
        <span className="font-mono text-xs opacity-70">{tx.hash.slice(0, 10)}…</span>
      )}
    </div>
  );
}

export type TimelineRow = { id: string; ts: number; text: string; kind: string; amount?: unknown; txHash?: string };

export function Timeline({ rows }: { rows: TimelineRow[] | undefined }) {
  const [, tick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => tick((x) => x + 1), 15000);
    return () => clearInterval(t);
  }, []);
  if (!rows) return <Empty>Loading…</Empty>;
  if (!rows.length) return <Empty>Nothing yet. Everything that happens shows up here, in plain words.</Empty>;
  const tone = (k: string) =>
    k.startsWith("hold") || k === "held" ? "bg-sun-500" : k === "freeze" ? "bg-rose-600" : k === "level_up" || k === "goal_complete" ? "bg-mint-500" : "bg-slate-300";
  return (
    <ol className="space-y-3">
      {rows.map((r) => {
        const link = r.txHash ? explorerTx(r.txHash) : "";
        return (
          <li key={r.id} className="flex gap-3">
            <span className={`mt-1.5 h-2.5 w-2.5 flex-none rounded-full ${tone(r.kind)}`} />
            <div className="min-w-0 flex-1">
              <p className="text-sm leading-snug text-ink">{r.text}</p>
              <p className="mt-0.5 text-xs text-slate-400">
                {timeAgo(Number(r.ts))}
                {link ? (
                  <>
                    {" · "}
                    <a className="underline" href={link} target="_blank" rel="noreferrer">
                      proof
                    </a>
                  </>
                ) : r.txHash ? (
                  <span className="font-mono"> · {r.txHash.slice(0, 10)}…</span>
                ) : null}
              </p>
            </div>
            {r.amount !== undefined && r.amount !== null && big(r.amount) > 0n && (
              <span className="num flex-none text-sm font-semibold text-slate-500">{fmt(big(r.amount))}</span>
            )}
          </li>
        );
      })}
    </ol>
  );
}

export function GoalCard({
  g, children,
}: {
  g: { id: string; memo: string; target: unknown; saved: unknown; matched: unknown; status: string; teenFamId?: string };
  children?: ReactNode;
}) {
  const target = big(g.target), saved = big(g.saved), matched = big(g.matched);
  const tone = g.status === "COMPLETE" ? "mint" : g.status === "PROPOSED" ? "sun" : "slate";
  return (
    <div className="rounded-xl border border-slate-100 p-4">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="font-semibold">{g.memo || "Goal"}</p>
          {g.teenFamId && <p className="text-xs text-slate-500">for {cap(g.teenFamId)}</p>}
        </div>
        <Pill tone={tone as any}>{g.status === "PROPOSED" ? "waiting for a parent" : g.status.toLowerCase()}</Pill>
      </div>
      <div className="mt-3">
        <Progress value={saved + matched} max={target} />
        <div className="num mt-1.5 flex justify-between text-xs text-slate-500">
          <span>
            {fmt(saved)} saved{matched > 0n ? ` + ${fmt(matched)} from gifts` : ""}
          </span>
          <span>of {fmt(target)}</span>
        </div>
      </div>
      {children && <div className="mt-3 flex flex-wrap gap-2">{children}</div>}
    </div>
  );
}
