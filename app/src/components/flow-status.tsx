"use client";
import { useEffect, useState, type ReactNode } from "react";
import { cfg } from "@/lib/config";
import { Card } from "./ui";
import type { Bundle } from "@/lib/private";

export function useCapabilities() {
  const [state, setState] = useState<{ missions: boolean | null; futureFund: boolean | null; goalDecline: boolean | null; missionReviewTimeout: boolean | null }>({ missions: null, futureFund: null, goalDecline: null, missionReviewTimeout: null });
  useEffect(() => {
    let alive = true;
    const load = async () => {
      try {
        const r = await fetch(cfg.relayerUrl + "/capabilities", { signal: AbortSignal.timeout(12000) });
        const data = await r.json();
        if (!r.ok || String(data.contract).toLowerCase() !== cfg.famfi.toLowerCase()) throw new Error("Wrong deployment");
        if (alive) setState({ missions: typeof data.missions === "boolean" ? data.missions : null, futureFund: typeof data.futureFund === "boolean" ? data.futureFund : null, goalDecline: typeof data.goalDecline === "boolean" ? data.goalDecline : null, missionReviewTimeout: typeof data.missionReviewTimeout === "boolean" ? data.missionReviewTimeout : null });
      } catch { if (alive) setState({ missions: null, futureFund: null, goalDecline: null, missionReviewTimeout: null }); }
    };
    void load(); const timer = setInterval(load, 30000);
    return () => { alive = false; clearInterval(timer); };
  }, []);
  return state;
}

export function FeatureGate({ supported, label, children }: { supported: boolean | null; label: string; children: ReactNode }) {
  return supported === true ? children : <Card title={label}><p className="text-sm text-muted" role="status">{supported === false
    ? `${label} is not available on this deployment yet. It needs the updated Fam-Fi contract.`
    : `Checking whether ${label.toLowerCase()} is available on the network. Actions stay paused until confirmed.`}</p></Card>;
}

export function SyncNotice({ bundle }: { bundle: Bundle | null }) {
  if (!bundle) return <p className="service-notice" role="status">Connecting confirmed family history…</p>;
  if (bundle?.indexerError) return <p className="service-notice" role="status">Family history is temporarily unavailable. Verified goal requests and payment approvals are still available; other summaries may be missing.</p>;
  const lag = bundle?.freshness?.lagBlocks;
  if (bundle?.freshness && (bundle.freshness.indexedBlock === null || bundle.freshness.error)) return <p className="service-notice" role="status">Family history is waiting for the network. Current balances and verified approvals come directly from the contract.</p>;
  if (lag == null || lag <= 10) return null;
  return <p className="service-notice" role="status">Family history is catching up ({lag.toLocaleString()} blocks behind). {bundle?.liveGoals === "verified" && bundle?.liveApprovals === "verified" ? "Goal requests and payment approvals are checked live." : "Some approvals may not have arrived yet."}</p>;
}
