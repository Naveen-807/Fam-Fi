"use client";
import { useEffect, useRef, useState } from "react";
import { createClient } from "graphql-ws";
import { cfg } from "./config";

export async function gql<T = any>(query: string, variables: Record<string, unknown> = {}): Promise<T> {
  if (!cfg.envioUrl) throw new Error("NEXT_PUBLIC_ENVIO_URL is not set");
  const res = await fetch(cfg.envioUrl, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ query, variables }),
    signal: AbortSignal.timeout(12000),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(`Family history is unavailable (${res.status})`);
  if (json.errors?.length) throw new Error(json.errors[0].message);
  if (!json.data) throw new Error("Family history returned no data");
  return json.data as T;
}

let wsClient: ReturnType<typeof createClient> | null = null;
const ws = () => (wsClient ??= createClient({ url: cfg.envioWs, retryAttempts: 2 }));

/**
 * Live query. Uses an Envio GraphQL subscription when NEXT_PUBLIC_ENVIO_WS is set, and falls back to
 * polling the same query (also what the local dev indexer uses). `key` must change when the variables do.
 */
export function useGql<T = any>(query: string | null, variables: Record<string, unknown>, key: string, pollMs = 1500) {
  const identity = `${query ?? ""}:${key}`;
  const [state, setState] = useState<{ identity: string; data: T | null; error: string | null }>({ identity, data: null, error: null });
  const vars = useRef(variables);
  vars.current = variables;

  useEffect(() => {
    setState({ identity, data: null, error: null });
    if (!query) return;
    const scopedVariables = vars.current;
    let alive = true;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let unsub: (() => void) | undefined;
    let fallbackStarted = false;

    const poll = async () => {
      try {
        const d = await gql<T>(query, scopedVariables);
        if (alive) {
          setState({ identity, data: d, error: null });
        }
      } catch (e: any) {
        if (alive) setState((s) => ({ ...s, identity, error: e?.message || "query failed" }));
      }
      if (alive) timer = setTimeout(poll, pollMs);
    };
    const fallback = () => { if (alive && !fallbackStarted) { fallbackStarted = true; void poll(); } };

    if (cfg.envioWs) {
      try {
        unsub = ws().subscribe<T>(
          { query: query.trim().replace(/^query/, "subscription"), variables: scopedVariables },
          {
            next: (m) => { if (alive && m.data) setState({ identity, data: m.data as T, error: null }); },
            error: () => {
              unsub = undefined;
              fallback();
            },
            complete: fallback,
          },
        );
      } catch {
        fallback();
      }
    } else {
      fallback();
    }
    return () => {
      alive = false;
      if (timer) clearTimeout(timer);
      unsub?.();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, key, pollMs]);

  return state.identity === identity ? { data: state.data, error: state.error } : { data: null, error: null };
}

// ── the queries the app uses ──
export const Q = {
  teens: `query($f:Int!){ User(where:{familyId:{_eq:$f}, role:{_eq:"TEEN"}}){ id famId level frozen } }`,
  pendingFamily: `query($f:Int!){ Pending(where:{familyId:{_eq:$f}, status:{_eq:"OPEN"}}, order_by:{createdAt:desc}){ id fromFamId toFamId amount kind releaseAt memo createdAt refKind } }`,
  pendingOf: `query($a:String!){ Pending(where:{fromAddr:{_eq:$a}, status:{_eq:"OPEN"}}, order_by:{createdAt:desc}){ id toFamId amount kind releaseAt memo createdAt } }`,
  goalsFamily: `query($f:Int!){ Goal(where:{familyId:{_eq:$f}}, order_by:{createdAt:desc}){ id teenFamId target saved matched status deadline memo sponsorOpen } }`,
  goalsOf: `query($a:String!){ Goal(where:{teen:{_eq:$a}}, order_by:{createdAt:desc}){ id target saved matched status deadline memo sponsorOpen } }`,
  goal: `query($id:String!){ Goal(where:{id:{_eq:$id}}){ id teenFamId target saved matched status deadline memo sponsorOpen } }`,
  giftsOfGoal: `query($id:String!){ Gift(where:{goalId:{_eq:$id}}){ id sponsorFamId amount escrow released ratio } }`,
  timelineFamily: `query($f:Int!){ TimelineEntry(where:{_or:[{familyId:{_eq:$f}},{counterpartyFamilyId:{_eq:$f}}]}, order_by:{ts:desc}, limit:40){ id ts text kind amount txHash } }`,
  timelineOf: `query($a:String!){ TimelineEntry(where:{_or:[{actor:{_eq:$a}},{counterparty:{_eq:$a}}]}, order_by:{ts:desc}, limit:40){ id ts text kind amount txHash } }`,
  split: `query($id:String!){ Split(where:{id:{_eq:$id}}){ id creatorFamId creator perShare slots paid memo } }`,
  splitShares: `query($id:String!){ SplitShare(where:{splitId:{_eq:$id}, active:{_eq:true}}){ id payerFamId } }`,
  requestsTo: `query($a:String!){ Request(where:{toAddr:{_eq:$a}, status:{_eq:"OPEN"}}, order_by:{createdAt:desc}){ id fromFamId amount memo createdAt } }`,
  family: `query($f:String!){ Family(where:{id:{_eq:$f}}){ id parent parentFamId } }`,
  openGoals: `query{ Goal(where:{status:{_eq:"ACTIVE"}, sponsorOpen:{_eq:true}}, order_by:{createdAt:desc}, limit:20){ id teenFamId target saved matched status deadline memo } }`,
  users: `query{ User(order_by:{createdAt:desc}, limit:200){ id famId role } }`,
};
