"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { cfg } from "./config";
import { useWallet } from "./wallet";
import type { Signer } from "./relay";

/**
 * Family-private reads (missions, Progress Passport, Weekly Brief, FutureFund) go through the relayer's
 * /private/query. The person signs a short-lived "ReadAuth" message; the relayer checks the signature, takes the
 * role and family from the FamFi contract, and runs fixed queries. Nothing here trusts a role the browser claims.
 */
const READ_SCOPE = "famfi-private-read";
const READ_TYPES = {
  ReadAuth: [
    { name: "reader", type: "address" },
    { name: "expiry", type: "uint256" },
    { name: "scope", type: "string" },
  ],
};
const AUTH_SECONDS = 1800;

type Auth = { reader: string; expiry: number; signature: string };
const authCache = new Map<string, Auth>();

async function authFor(signer: Signer): Promise<Auth> {
  const key = signer.address.toLowerCase();
  const now = Math.floor(Date.now() / 1000);
  const hit = authCache.get(key);
  if (hit && hit.expiry - now > 120) return hit;
  const expiry = now + AUTH_SECONDS;
  const domain = { name: "FamFiRead", version: "1", chainId: BigInt(cfg.chainId) };
  const signature = await signer.signTypedData(domain, READ_TYPES, { reader: signer.address, expiry: BigInt(expiry), scope: READ_SCOPE }, "ReadAuth");
  const a = { reader: signer.address, expiry, signature };
  authCache.set(key, a);
  return a;
}

export type MissionRow = {
  id: string; familyId: number; parentFamId: string; teen: string; teenFamId: string; reward: string; deadline: number; goalId: string;
  status: "ACTIVE" | "SUBMITTED" | "REJECTED" | "APPROVED" | "CANCELLED" | "EXPIRED";
  title: string; description: string; feedback: string; createdAt: number; submittedAt: number; resolvedAt: number; savedToGoal: boolean;
  txHash: string; lastTxHash: string;
};
export type HoldRow = { id: string; fromFamId: string; toFamId: string; amount: string; kind: string; status: string; releaseAt: number; memo: string; createdAt: number; refKind: string; txHash: string };
export type GoalRow = { id: string; teenFamId: string; target: string; saved: string; matched: string; status: string; deadline: number; memo: string; sponsorOpen: boolean };
export type ProgressRow = { id: string; teenFamId: string; missionsCompleted: number; missionRewards: string; savedTotal: string; goalsCompleted: number; paymentsCompleted: number; lastEventTs: number; lastEventBlock: number };
export type WeekRow = { id: string; teen: string; teenFamId: string; week: number; weekStart: number; missionsCompleted: number; missionRewards: string; savedTotal: string; goalsCompleted: number; paymentsCompleted: number; allowanceFunded: string; heldCount: number };
export type HistoryRow = { id: string; teen: string; kind: string; amount: string; text: string; weekId: string; ts: number; blockNumber: number; txHash: string };
export type FundRow = { id: string; teenFamId: string; name: string; purpose: string; target: string; funded: string; horizon: number; status: "OPEN" | "RELEASED"; createdAt: number; releasedAt: number };
export type FundEntryRow = { id: string; fundId: string; teen: string; kind: string; amount: string; text: string; ts: number; blockNumber: number; txHash: string };
export type RequestRow = { id: string; fromFamId: string; amount: string; memo: string; createdAt: number };

export type Bundle = {
  role: "PARENT" | "TEEN";
  familyId: number;
  data: {
    family: { id: string; tzOffset: number }[];
    missions: MissionRow[];
    holds?: HoldRow[];
    goals: GoalRow[];
    requests?: RequestRow[];
    progress: ProgressRow[];
    weeks: WeekRow[];
    history: HistoryRow[];
    funds: FundRow[];
    fundEntries: FundEntryRow[];
  };
};

export async function privateQuery(signer: Signer): Promise<Bundle> {
  const auth = await authFor(signer);
  const res = await fetch(cfg.relayerUrl + "/private/query", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ auth }),
  });
  const body = await res.json().catch(() => ({}));
  if (res.status === 401) authCache.delete(signer.address.toLowerCase());
  if (!res.ok) throw new Error(body.error || `couldn't load your family's data (${res.status})`);
  return body as Bundle;
}

/** The signed-in parent's or teen's private bundle, refreshed every few seconds. `refreshUntil` waits for the indexer to catch up. */
export function usePrivate(pollMs = 4000) {
  const { signer } = useWallet();
  const addr = signer?.address;
  const [bundle, setBundle] = useState<Bundle | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [fetchedAt, setFetchedAt] = useState(0);
  const latest = useRef<Bundle | null>(null);
  const signerRef = useRef(signer);
  signerRef.current = signer;

  const refresh = useCallback(async () => {
    const s = signerRef.current;
    if (!s) return null;
    try {
      const b = await privateQuery(s);
      latest.current = b;
      setBundle(b);
      setError(null);
      setFetchedAt(Date.now());
      return b;
    } catch (e: any) {
      setError(e?.message || "couldn't load");
      return null;
    }
  }, []);

  useEffect(() => {
    if (!addr) return;
    let alive = true;
    void refresh();
    const t = setInterval(() => alive && void refresh(), pollMs);
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, [addr, pollMs, refresh]);

  /** Poll quickly until `done(bundle)` is true or the timeout passes. Resolves true if the indexer caught up. */
  const refreshUntil = useCallback(
    async (done: (b: Bundle) => boolean, timeoutMs = 20000) => {
      const end = Date.now() + timeoutMs;
      while (Date.now() < end) {
        const b = await refresh();
        if (b && done(b)) return true;
        await new Promise((r) => setTimeout(r, 1200));
      }
      return false;
    },
    [refresh],
  );

  return { bundle, error, fetchedAt, refresh, refreshUntil };
}
