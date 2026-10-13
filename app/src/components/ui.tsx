"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ThemeToggle } from "@/components/theme";
import { AnimatedOutline } from "@/components/effects";
import { GoalVisual } from "@/components/family-visuals";
import { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { cfg } from "@/lib/config";
import { explorerTx, TxResult } from "@/lib/relay";
import { useWallet } from "@/lib/wallet";
import { useRef } from "react";
import { fmt, timeAgo, cap, big } from "@/lib/format";

// ───────────── toasts ─────────────
type Toast = { id: number; kind: "ok" | "err"; text: string };
const ToastCtx = createContext<{ ok: (t: string) => void; err: (t: string) => void }>({ ok() {}, err() {} });
export const useToast = () => useContext(ToastCtx);
export function ActionError({ error }: { error?: string | null }) {
  return error ? <p className="mt-3 min-w-0 break-words text-sm text-bad" role="alert">{error}</p> : null;
}

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
            className={`pop pointer-events-auto min-w-0 max-w-md break-words rounded-2xl px-4 py-3 text-sm font-semibold shadow-glow ${
              t.kind === "ok" ? "bg-brand text-onbrand" : "bg-bad text-onbad"
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
    primary: "bg-brand text-onbrand hover:bg-brand-deep disabled:bg-line disabled:text-dim",
    soft: "bg-brand/10 text-brand ring-1 ring-brand/30 hover:bg-brand/20 disabled:text-dim disabled:ring-line",
    ghost: "bg-card2 text-fg ring-1 ring-line hover:ring-brand/50 hover:bg-card disabled:text-dim",
    danger: "bg-bad text-onbad hover:bg-bad/90 disabled:bg-line disabled:text-dim",
  }[variant];
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled || busy}
      className={`inline-flex items-center justify-center gap-2 rounded-xl px-5 py-3 text-sm font-semibold transition active:scale-[.98] disabled:cursor-not-allowed ${styles} ${full ? "w-full" : ""} ${className}`}
    >
      {busy && <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" />}
      {children}
    </button>
  );
}

export function Card({ children, className = "", title, right, hero }: { children: ReactNode; className?: string; title?: string; right?: ReactNode; hero?: boolean }) {
  return (
    <section className={`surface ${hero ? "surface-account" : ""} ${className}`}>
      {hero && <AnimatedOutline accent="mint" />}
      {(title || right) && (
        <div className="relative mb-3 flex items-center justify-between gap-3">
          {title && <h2 className="text-base font-semibold tracking-tight text-fg">{title}</h2>}
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
      className={`w-full rounded-xl border border-line bg-card px-4 py-3 text-sm text-fg outline-none transition placeholder:text-dim/70 focus:border-brand focus:ring-2 focus:ring-brand/15 ${props.className ?? ""}`}
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
      <div className={`h-full rounded-full transition-all duration-500 ${tone === "mint" ? "bg-brand" : "bg-warn"}`} style={{ width: `${pct}%` }} />
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
  return <p className="empty-state">{children}</p>;
}

// ───────────── layout ─────────────
export function Shell({ children, famId, role }: { children: ReactNode; famId?: string; role?: string }) {
  const { signer, logout } = useWallet();
  const landing = usePathname() === "/";
  return (
    <div className={`app-shell ${role ? "app-shell-workspace" : "app-shell-public"} ${landing ? "app-shell-landing" : ""}`}>
      <a href="#main-content" className="skip-link">Skip to content</a>
      <header className="app-header">
        <Link href="/" className="flex flex-none items-center gap-2 whitespace-nowrap font-bold tracking-tight">
          <span className="brand-symbol" aria-hidden="true">f.</span>
          <span className="brand-wordmark">fam-fi<span>.</span></span>
        </Link>
        {landing && <nav className="landing-nav" aria-label="Main navigation"><a href="#how-it-works">How it works</a><Link href="/parent">For parents</Link><Link href="/teen">For teens</Link></nav>}
        <div className="header-actions flex min-w-0 items-center gap-2"><ThemeToggle />
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
      {role || landing ? children : <main id="main-content" className="public-content">{children}</main>}
    </div>
  );
}

/** Shown when nobody is signed in. */
export function SignIn({ title, blurb }: { title: string; blurb: string }) {
  const { hasDynamic } = useWallet();
  return (
    <Card className="sign-in-surface mx-auto mt-10 max-w-md">
      <span className="brand-symbol mb-6">F</span>
      <h1 className="font-display text-4xl font-normal">{title}</h1>
      <p className="mt-2 text-sm text-muted">{blurb}</p>
      <div className="mt-5">
        {hasDynamic ? (
          <EmailLogin />
        ) : (
          <p className="text-sm text-bad">Sign-in is not configured. Set NEXT_PUBLIC_DYNAMIC_ENV_ID.</p>
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
        {auth.error && <><p className="mt-2 text-bad">{auth.error}</p><Button variant="soft" busy={auth.busy} onClick={() => void auth.retryWalletSetup()}>Retry account setup</Button></>}
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
  // Keep failures and confirmed success visible; never hide the explanation after a click.
  if (!signer || !auth || !auth.loggedIn || hidden || (auth.passkeyRegistered && !auth.passkeyStatus)) return null;
  return (
    <div className="passkey-notice pop flex flex-wrap items-center justify-between gap-3 text-sm text-fg">
      <p className="min-w-0 flex-1">
        <b className="text-brand">{auth.passkeyRegistered ? "Passkey added." : "An easier way back in."}</b> {auth.passkeyRegistered ? "Use your passkey next time you sign in." : "Create a passkey with your device. Your browser handles Touch ID, Face ID or a security key."}
        {auth.passkeyStatus && <span className="mt-1 block text-muted" role="status">{auth.passkeyStatus}</span>}
        {auth.passkeyError && <span className="mt-1 block text-bad" role="alert">{auth.passkeyError}</span>}
      </p>
      <div className="flex gap-2">
        {!auth.passkeyRegistered && <Button busy={auth.busy} onClick={() => void auth.registerPasskey()}>{auth.busy ? "Waiting for device…" : auth.passkeyError ? "Retry setup" : "Turn on"}</Button>}
        <Button variant="ghost" disabled={auth.busy} onClick={() => setHidden(true)}>{auth.passkeyRegistered ? "Done" : "Not now"}</Button>
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
    k.startsWith("hold") || k === "held" ? "bg-warn" : k === "freeze" ? "bg-bad" : k === "level_up" || k === "goal_complete" ? "bg-brand" : "bg-line";
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
    <div className="visual-goal rounded-2xl border border-line bg-card2/60 p-4">
      <GoalVisual goal={g}/>
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
            {fmt(saved)} saved{matched > 0n ? ` + ${fmt(matched)} family matching` : ""}
          </span>
          <span>of {fmt(target)}</span>
        </div>
      </div>
      {g.status === "CLOSED" && <p className="mt-2 text-xs text-muted">Closed goal · amounts show its history, not spendable funds.</p>}
      {children && <div className="mt-3 flex flex-wrap gap-2">{children}</div>}
    </div>
  );
}

/** A confirmation for anything that moves money: says exactly what will happen, then asks. Escape or the backdrop cancels. */
export function ConfirmDialog({
  open, title, lines, confirmLabel = "Confirm", danger, busy, onConfirm, onCancel,
}: {
  open: boolean; title: string; lines: ReactNode[]; confirmLabel?: string; danger?: boolean; busy?: boolean;
  onConfirm: () => void; onCancel: () => void;
}) {
  const ref = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const cancelRef = useRef(onCancel), busyRef = useRef(busy);
  cancelRef.current = onCancel; busyRef.current = busy;
  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement as HTMLElement | null;
    ref.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !busyRef.current) cancelRef.current();
      if (e.key !== "Tab") return;
      const nodes = dialogRef.current?.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), a[href], [tabindex="0"]');
      if (!nodes?.length) { e.preventDefault(); return; }
      const first = nodes[0], last = nodes[nodes.length-1];
      if (e.shiftKey && document.activeElement === first) {e.preventDefault();last.focus();}
      else if (!e.shiftKey && document.activeElement === last) {e.preventDefault();first.focus();}
    };
    window.addEventListener("keydown", onKey);
    return () => { window.removeEventListener("keydown", onKey); if (previous?.isConnected) previous.focus(); };
  }, [open]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-4 sm:items-center" onClick={() => !busy && onCancel()}>
      <div ref={dialogRef} role="dialog" aria-modal="true" aria-label={title} onClick={(e) => e.stopPropagation()} className="pop w-full max-w-md rounded-3xl border border-line bg-card p-5 shadow-glow">
        <h2 className="text-lg font-extrabold">{title}</h2>
        <ul className="mt-3 space-y-2 text-sm text-muted">
          {lines.map((l, i) => (
            <li key={i} className="flex gap-2"><span aria-hidden className="mt-1.5 h-1.5 w-1.5 flex-none rounded-full bg-brand" /><span>{l}</span></li>
          ))}
        </ul>
        <div className="mt-5 flex gap-2">
          <Button full variant={danger ? "danger" : "primary"} busy={busy} onClick={onConfirm}>
            {confirmLabel}
          </Button>
          <button ref={ref} type="button" disabled={busy} onClick={onCancel} className="w-full rounded-2xl bg-card2 px-5 py-3 text-sm font-bold ring-1 ring-line hover:ring-brand/50 disabled:text-dim">
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

/** A small "waiting for the indexer" / "last updated" strip, so confirmed chain facts and indexed summaries are never confused. */
export function FreshNote({ fetchedAt, error, blockNumber, freshness }: { fetchedAt: number; error?: string | null; blockNumber?: number; freshness?: { indexedBlock: number; chainHead: number; lagBlocks: number; error?: string | null } }) {
  if (error) return <p className="text-xs text-bad" role="status">Couldn&apos;t refresh this summary: {error}. What you see may be out of date; on-chain balances above are always live.</p>;
  if (!fetchedAt) return <p className="text-xs text-dim">Loading summary…</p>;
  return (
    <p className="text-xs text-dim">
      Summary from the Envio indexer, refreshed {timeAgo(Math.floor(fetchedAt / 1000))}
      {blockNumber ? ` · latest counted action at block ${blockNumber}` : ""}.
      {freshness ? ` Indexed through block ${freshness.indexedBlock}; chain head ${freshness.chainHead}; ${freshness.lagBlocks} blocks behind${freshness.error ? "; sync needs attention" : ""}.` : " Indexer freshness is unavailable; summaries may trail the chain."}
    </p>
  );
}
