import { fmt } from "./format";

/** The starting rules a parent chooses for a teen. All amounts are USDC base units (6 decimals). */
export type Terms = {
  levelLimits: bigint[]; // 4 daily limits, one per level, ascending
  newPayeeThreshold: bigint;
  firstDayCap: bigint;
  holdSeconds: number;
  strictHolds: boolean;
};

type Wire = { l: string[]; t: string; f: string; h: number; s: boolean };

const b64 = (s: string) => btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const unb64 = (s: string) => atob(s.replace(/-/g, "+").replace(/_/g, "/"));

/** Pack the terms into a URL-safe string for the invite link. The contract checks the parent's signature over them. */
export function encodeTerms(t: Terms): string {
  const w: Wire = { l: t.levelLimits.map(String), t: String(t.newPayeeThreshold), f: String(t.firstDayCap), h: t.holdSeconds, s: t.strictHolds };
  return b64(JSON.stringify(w));
}

export function decodeTerms(s: string | null): Terms | null {
  if (!s) return null;
  try {
    const w = JSON.parse(unb64(s)) as Wire;
    const big = (x: unknown) => {
      if (typeof x !== "string" || !/^\d+$/.test(x)) throw new Error("bad amount");
      return BigInt(x);
    };
    if (!Array.isArray(w.l) || w.l.length !== 4) return null;
    return { levelLimits: w.l.map(big), newPayeeThreshold: big(w.t), firstDayCap: big(w.f), holdSeconds: Number(w.h), strictHolds: !!w.s };
  } catch {
    return null;
  }
}

/** The same rules in plain words, for the teen to read before joining. */
export function describeTerms(t: Terms): string[] {
  return [
    `Daily spending limit: ${fmt(t.levelLimits[0])} to start, rising to ${fmt(t.levelLimits[3])} as you reach goals.`,
    `A first payment to someone new above ${fmt(t.newPayeeThreshold)} is held for ${Math.round(t.holdSeconds / 60)} min and your parent is alerted.`,
    `In your first 24 hours, payments above ${fmt(t.firstDayCap)} are held the same way.`,
    t.strictHolds ? "Held payments need your parent's approval." : "If your parent doesn't respond, you can release a held payment after the wait.",
  ];
}
