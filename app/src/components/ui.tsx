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
            className={`pop pointer-events-auto max-w-md rounded-2xl px-4 py-3 text-sm font-semibold shadow-glow ${
              t.kind === "ok" ? "bg-brand text-onbrand" : "bg-bad text-white"
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
    primary: "yellow-grad text-onbrand shadow-[0_6px_24px_-6px_rgba(255,214,10,.55)] hover:brightness-105 disabled:bg-none disabled:bg-line disabled:text-dim disabled:shadow-none",
    soft: "bg-brand/10 text-brand ring-1 ring-brand/30 hover:bg-brand/20 disabled:text-dim disabled:ring-line",
    ghost: "bg-card2 text-fg ring-1 ring-line hover:ring-brand/50 hover:bg-card disabled:text-dim",
    danger: "bg-bad text-white hover:bg-bad/90 disabled:bg-line disabled:text-dim",
  }[variant];
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled || busy}
      className={`inline-flex items-center justify-center gap-2 rounded-2xl px-5 py-3 text-sm font-bold transition active:scale-[.97] disabled:cursor-not-allowed ${styles} ${full ? "w-full" : ""} ${className}`}
    >
      {busy && <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" />}
      {children}
    </button>
  );
}

export function Card({ children, className = "", title, right, hero }: { children: ReactNode; className?: string; title?: string; right?: ReactNode; hero?: boolean }) {
  return (
    <section className={`relative overflow-hidden rounded-3xl border p-5 animate-fadeUp ${hero ? "border-brand/40 bg-gradient-to-br from-[#26220A] via-card to-card shadow-glow" : "border-line bg-card shadow-card"} ${className}`}>
      {hero && <div aria-hidden className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-brand/25 blur-3xl" />}
      {(title || right) && (
        <div className="relative mb-3 flex items-center justify-between gap-3">
          {title && <h2 className="text-xs font-bold uppercase tracking-[.14em] text-dim">{title}</h2>}
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
      <span className="mb-1.5 block text-xs font-bold text-muted">{label}</span>
      {children}
      {hint && <span className="mt-1.5 block text-xs text-dim">{hint}</span>}
    </label>
  );
}

export function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={`w-full rounded-2xl border border-line bg-card2 px-4 py-3 text-sm text-fg outline-none transition placeholder:text-dim focus:border-brand focus:ring-4 focus:ring-brand/15 ${props.className ?? ""}`}
    />
  );
}

export function Pill({ children, tone = "slate" }: { children: ReactNode; tone?: "slate" | "mint" | "sun" | "rose" }) {
  const t = {
    slate: "bg-card2 text-muted ring-1 ring-line",
    mint: "bg-brand/15 text-brand ring-1 ring-brand/30",
    sun: "bg-warn/15 text-warn ring-1 ring-warn/30",
    rose: "bg-bad/15 text-bad ring-1 ring-bad/30",
  }[tone];
  return <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-bold ${t}`}>{children}</span>;
}

export function Progress({ value, max, tone = "mint" }: { value: bigint; max: bigint; tone?: "mint" | "sun" }) {
  const pct = max > 0n ? Math.min(100, Number((value * 10000n) / max) / 100) : 0;
  return (
    <div className="h-2.5 w-full overflow-hidden rounded-full bg-card2 ring-1 ring-line" role="progressbar" aria-valuenow={Math.round(pct)} aria-valuemin={0} aria-valuemax={100}>
      <div className={`h-full rounded-full transition-all duration-500 ${tone === "mint" ? "yellow-grad shadow-[0_0_12px_rgba(255,214,10,.6)]" : "bg-warn"}`} style={{ width: `${pct}%` }} />
    </div>
  );
}

export function Money({ value, size = "md" }: { value: bigint; size?: "sm" | "md" | "xl" }) {
  const cls = size === "xl" ? "text-5xl font-extrabold tracking-tight" : size === "md" ? "text-2xl font-bold" : "text-sm font-semibold";
  const [w, f] = fmt(value).split(".");
  return (
    <span className={`num ${cls}`}>
      <span className="opacity-50">$</span>
      {w}
      <span className={size === "xl" ? "text-2xl opacity-50" : "opacity-50"}>.{f}</span>
    </span>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return <p className="rounded-2xl border border-dashed border-line bg-card2/50 px-4 py-6 text-center text-sm text-dim">{children}</p>;
}

// ───────────── layout ─────────────
export function Shell({ children, famId, role }: { children: ReactNode; famId?: string; role?: string }) {
  const { signer, logout } = useWallet();
  return (
    <div className="mx-auto min-h-screen max-w-6xl px-5 pb-24 pt-6 lg:px-10">
      <header className="mb-6 flex items-center justify-between gap-2">
        <Link href="/" className="flex flex-none items-center gap-2 whitespace-nowrap font-bold tracking-tight">
          <span className="yellow-grad grid h-9 w-9 place-items-center rounded-xl text-lg font-black text-onbrand shadow-glow">F</span>
          <span className="text-lg font-extrabold">Fam<span className="text-brand">-Fi</span></span>
        </Link>
        <div className="flex min-w-0 items-center gap-2">
          <span className="hidden sm:inline"><Pill tone="slate">{cfg.networkLabel}</Pill></span>
          <span className="sm:hidden"><Pill tone="slate">Test</Pill></span>
          {signer && (
            <button onClick={logout} className="truncate whitespace-nowrap rounded-lg px-2 py-1 text-xs font-semibold text-dim hover:bg-card2 hover:text-fg" aria-label="Sign out">
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

/** Shown when nobody is signed in. Sign-up and login are the same step: a new email gets a new wallet, a known email gets its wallet back. */
export function SignIn({ title, blurb }: { title: string; blurb: string }) {
  const { hasDynamic } = useWallet();
  return (
    <Card className="mx-auto mt-6 max-w-md text-center shadow-glow">
      <span className="yellow-grad mx-auto mb-4 grid h-14 w-14 place-items-center rounded-2xl text-2xl font-black text-onbrand animate-float">F</span>
      <h1 className="text-2xl font-extrabold">{title}</h1>
      <p className="mt-2 text-sm text-muted">{blurb}</p>
      <div className="mt-5">
        {hasDynamic ? (
          <EmailLogin />
        ) : (
          <p className="text-sm text-bad" role="alert">
            Sign-in isn&apos;t configured. Set NEXT_PUBLIC_DYNAMIC_ENV_ID in app/.env.local and restart.
          </p>
        )}
      </div>
    </Card>
  );
}

/** Email one-time code, plus a Face ID / fingerprint shortcut for people who turned it on before. */
function EmailLogin() {
  const { auth, ready } = useWallet();
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  if (!auth) return <p className="text-sm text-dim">Loading…</p>;

  if (auth.step === "wallet")
    return (
      <div className="text-sm text-muted" role="status">
        <p className="font-semibold text-fg">Setting up your account…</p>
        <p className="mt-1">Creating your private wallet. This takes a few seconds and you only do it once.</p>
        {auth.error && <p className="mt-2 text-bad">{auth.error}</p>}
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
        {auth.error && <p className="text-sm text-bad" role="alert">{auth.error}</p>}
        <Button full type="submit" busy={auth.busy} disabled={code.length < 4}>Verify and continue</Button>
        <button type="button" className="w-full text-center text-xs font-semibold text-dim underline" onClick={auth.reset}>Use a different email</button>
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
      {auth.error && <p className="text-sm text-bad" role="alert">{auth.error}</p>}
      <Button full type="submit" busy={auth.busy} disabled={!ready || !/^\S+@\S+\.\S+$/.test(email.trim())}>Email me a code</Button>
      <button type="button" className="w-full text-center text-xs font-semibold text-dim underline" onClick={() => void auth.signInWithPasskey()}>
        Already turned on Face ID or fingerprint? Sign in with it
      </button>
    </form>
  );
}

/** Shown once after the first email login: turn on Face ID / fingerprint for next time. */
function PasskeyPrompt() {
  const { auth, signer } = useWallet();
  const [hidden, setHidden] = useState(false);
  // If this Dynamic environment has passkeys switched off, don't keep offering them.
  if (!signer || !auth || !auth.loggedIn || auth.passkeyRegistered || hidden || /not enabled/i.test(auth.error ?? "")) return null;
  return (
    <div className="pop mb-5 flex flex-wrap items-center justify-between gap-3 rounded-3xl border border-brand/30 bg-brand/10 p-4 text-sm text-fg">
      <p className="min-w-0 flex-1">
        <b className="text-brand">Next time, skip the email.</b> Turn on Face ID or fingerprint on this device.
        {auth.error && <span className="mt-1 block text-bad">{auth.error}</span>}
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
    <div className="pop mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 rounded-2xl border border-brand/30 bg-brand/10 px-4 py-3 text-sm text-brand">
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
    k.startsWith("hold") || k === "held" ? "bg-warn" : k === "freeze" ? "bg-bad" : k === "level_up" || k === "goal_complete" ? "bg-brand shadow-[0_0_8px_#FFD60A]" : "bg-line";
  return (
    <ol className="space-y-3">
      {rows.map((r) => {
        const link = r.txHash ? explorerTx(r.txHash) : "";
        return (
          <li key={r.id} className="flex gap-3">
            <span className={`mt-1.5 h-2.5 w-2.5 flex-none rounded-full ${tone(r.kind)}`} />
            <div className="min-w-0 flex-1">
              <p className="text-sm leading-snug text-fg">{r.text}</p>
              <p className="mt-0.5 text-xs text-dim">
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
              <span className="num flex-none text-sm font-semibold text-dim">{fmt(big(r.amount))}</span>
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
    <div className="rounded-2xl border border-line bg-card2/60 p-4">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="font-semibold">{g.memo || "Goal"}</p>
          {g.teenFamId && <p className="text-xs text-dim">for {cap(g.teenFamId)}</p>}
        </div>
        <Pill tone={tone as any}>{g.status === "PROPOSED" ? "waiting for a parent" : g.status.toLowerCase()}</Pill>
      </div>
      <div className="mt-3">
        <Progress value={saved + matched} max={target} />
        <div className="num mt-1.5 flex justify-between text-xs text-dim">
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
