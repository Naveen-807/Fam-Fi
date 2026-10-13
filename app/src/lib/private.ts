"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { cfg } from "./config";
import { useWallet } from "./wallet";
import type { Signer } from "./relay";
import { readSessions, ReadAuthorizationError } from "./read-session";

/**
 * Family-private reads (missions, Progress Passport, Weekly Brief, FutureFund) go through the relayer's
 * /private/query. The person signs a short-lived "ReadAuth" message; the relayer checks the signature, takes the
 * role and family from the FamFi contract, and runs fixed queries. Nothing here trusts a role the browser claims.
 */

export type MissionRow = {
  id: string; familyId: number; parentFamId: string; teen: string; teenFamId: string; reward: string; deadline: number; goalId: string;
  status: "ACTIVE" | "SUBMITTED" | "REJECTED" | "APPROVED" | "CANCELLED" | "EXPIRED";
  title: string; description: string; feedback: string; createdAt: number; submittedAt: number; resolvedAt: number; savedToGoal: boolean;
  txHash: string; lastTxHash: string;
};
export type HoldRow = { id: string; fromFamId: string; toFamId: string; amount: string; kind: string; status: string; releaseAt: number; memo: string; createdAt: number; refKind: string; txHash: string };
export type GoalRow = { id: string; teen?: string; teenFamId: string; target: string; saved: string; matched: string; status: string; deadline: number; memo: string; sponsorOpen: boolean; namePending?: boolean };
export type ProgressRow = { id: string; teenFamId: string; missionsCompleted: number; missionRewards: string; savedTotal: string; matchedTotal: string; goalsCompleted: number; paymentsCompleted: number; lastEventTs: number; lastEventBlock: number };
export type WeekRow = { id: string; teen: string; teenFamId: string; week: number; weekStart: number; missionsCompleted: number; missionRewards: string; savedTotal: string; matchedTotal: string; goalsCompleted: number; paymentsCompleted: number; allowanceFunded: string; heldCount: number };
export type HistoryRow = { id: string; teen: string; kind: string; amount: string; text: string; weekId: string; ts: number; blockNumber: number; txHash: string };
export type FundRow = { id: string; teen?: string; teenFamId: string; name: string; purpose: string; target: string; funded: string; horizon: number; status: "OPEN" | "RELEASED"; createdAt: number; releasedAt: number };
export type FundEntryRow = { id: string; fundId: string; teen: string; kind: string; amount: string; text: string; ts: number; blockNumber: number; txHash: string };
export type RequestRow = { id: string; fromFamId: string; amount: string; memo: string; createdAt: number };
export type SavingReceiptRow = { id: string; goalId: string; teen: string; teenFamId: string; goalName: string; ownAmount: string; matchedAmount: string; totalAfter: string; target: string; source: string; missionId: string; missionTitle: string; ts: number; blockNumber: number; txHash: string };
export type MatchReleaseRow = { id: string; receiptId: string; goalId: string; giftId: string; sponsorFamId: string; amount: string; ts: number; blockNumber: number; txHash: string };

export type Bundle = {
  identities?: { parent: { id: string; famId: string } };
  commitments?: { coverage: "complete" | "partial" | "unavailable"; blockNumber: number | null; allowance: string | null; missions: string | null; futureFunds: string | null; reason?: string };
  role: "PARENT" | "TEEN";
  familyId: number;
  liveGoals?: "verified" | "unavailable";
  liveApprovals?: "verified" | "unavailable";
  indexerError?: string | null;
  freshness?: { indexedBlock: number | null; chainHead: number | null; lagBlocks: number | null; error?: string | null; syncedAt?: number };
  data: {
    timeline?: { id: string; text: string; amount: string | null; ts: number; kind: string; actor: string; counterparty: string | null; txHash: string }[];
    gifts?: { id: string; goalId: string; sponsorFamId: string; escrow: string; released: string; deadline: number }[];
    achievements?: { id: string; teen: string; familyId: number; kind: string; sourceEvent: string; txHash: string; blockNumber: number; logIndex: number; ts: number }[];
    teens?: { id: string; famId: string; level: number; frozen: boolean }[];
    family: { id: string; tzOffset: number }[];
    missions: MissionRow[];
    holds?: HoldRow[];
    goals: GoalRow[];
    requests?: RequestRow[];
    incomingRequests?: RequestRow[];
    outgoingRequests?: (RequestRow & { toFamId: string })[];
    teenHolds?: HoldRow[];
    progress: ProgressRow[];
    weeks: WeekRow[];
    history: HistoryRow[];
    funds: FundRow[];
    fundEntries: FundEntryRow[];
    savingReceipts: SavingReceiptRow[];
    matchReleases: MatchReleaseRow[];
  };
};

export async function privateQuery(signer: Signer): Promise<Bundle> {
  const auth = await readSessions.authorize(signer, cfg);
  const res = await fetch(cfg.relayerUrl + "/private/query", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ auth }),
    signal: AbortSignal.timeout(30000),
  });
  const body = await res.json().catch(() => ({}));
  if (res.status === 401) {
    readSessions.invalidate(signer, cfg);
    throw new ReadAuthorizationError();
  }
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
  const authorizationPaused = useRef(false);
  signerRef.current = signer;

  const refresh = useCallback(async () => {
    authorizationPaused.current = false;
    const s = signerRef.current;
    if (!s) return null;
    try {
      const b = await privateQuery(s);
      if (signerRef.current !== s) return null;
      latest.current = b;
      setBundle(b);
      setError(null);
      setFetchedAt(Date.now());
      return b;
    } catch (e: any) {
      if (signerRef.current !== s) return null;
      if (e instanceof ReadAuthorizationError) authorizationPaused.current = true;
      setError(e?.message || "couldn't load");
      return null;
    }
  }, []);

  useEffect(() => {
    setBundle(null);
    setError(null);
    setFetchedAt(0);
    latest.current = null;
    authorizationPaused.current = false;
    if (!addr) return;
    let alive = true;
    void refresh();
    const t = setInterval(() => alive && !authorizationPaused.current && void refresh(), pollMs);
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
        if (authorizationPaused.current) return false;
        await new Promise((r) => setTimeout(r, 1200));
      }
      return false;
    },
    [refresh],
  );

  return { bundle, error, fetchedAt, refresh, refreshUntil };
}
