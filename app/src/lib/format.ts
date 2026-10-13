export const USDC_DECIMALS = 6;

export function fmt(n: bigint | number | string | null | undefined, dp = 2): string {
  if (n === null || n === undefined) return "0.00";
  const v = typeof n === "bigint" ? n : BigInt(String(n));
  const neg = v < 0n;
  const abs = neg ? -v : v;
  const whole = abs / 1_000_000n;
  // Payment reviews and receipts must not turn tiny amounts into zero or conceal fractional cents.
  if (dp > 0) {
    const trailingZeroes = (abs % 1_000_000n).toString().padStart(6, "0").match(/0*$/)![0].length;
    dp = Math.min(6, Math.max(dp, 6 - trailingZeroes));
  }
  const frac = (abs % 1_000_000n).toString().padStart(6, "0").slice(0, dp);
  const w = whole.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return `${neg ? "-" : ""}${w}${dp > 0 ? "." + frac : ""}`;
}

/** "2.5" -> 2_500_000n. Returns null for anything that is not a positive amount with at most 6 decimals. */
export function parseAmount(s: string): bigint | null {
  const t = s.trim();
  if (!/^\d+(\.\d{1,6})?$/.test(t)) return null;
  const [w, f = ""] = t.split(".");
  const v = BigInt(w) * 1_000_000n + BigInt(f.padEnd(6, "0"));
  return v > 0n ? v : null;
}

export const big = (v: unknown): bigint => (v === null || v === undefined || v === "" ? 0n : BigInt(String(v)));
export const shortAddr = (a: string) => `${a.slice(0, 6)}…${a.slice(-4)}`;
export const cap = (s: string) => (s ? s[0].toUpperCase() + s.slice(1) : s);

export function timeAgo(ts: number): string {
  const d = Math.max(0, Math.floor(Date.now() / 1000) - ts);
  if (d < 10) return "just now";
  if (d < 60) return `${d}s ago`;
  if (d < 3600) return `${Math.floor(d / 60)}m ago`;
  if (d < 86400) return `${Math.floor(d / 3600)}h ago`;
  return `${Math.floor(d / 86400)}d ago`;
}

export const FAMID_RE = /^[a-z0-9_]{3,20}$/;

/** Byte length as the contract counts it (UTF-8), so the form can check limits before a transaction is wasted. */
export const byteLen = (s: string) => new TextEncoder().encode(s).length;

/** "2027-01-31" (a calendar day in the viewer's time zone) -> unix seconds at the END of that local day. */
export function endOfDay(dateStr: string): number | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return null;
  const d = new Date(`${dateStr}T23:59:59`);
  const t = d.getTime();
  return Number.isNaN(t) ? null : Math.floor(t / 1000);
}

export const dayString = (daysFromNow: number) => {
  const d = new Date(Date.now() + daysFromNow * 86400_000);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

export const dateTimeText = (ts: number) => new Date(ts * 1000).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
export const dateText = (ts: number) => new Date(ts * 1000).toLocaleDateString(undefined, { dateStyle: "medium" });
