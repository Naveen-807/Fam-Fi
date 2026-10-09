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
  });
  const json = await res.json();
  if (json.errors?.length) throw new Error(json.errors[0].message);
  return json.data as T;
}

let wsClient: ReturnType<typeof createClient> | null = null;
const ws = () => (wsClient ??= createClient({ url: cfg.envioWs, retryAttempts: 2 }));

/**
 * Live query. Uses an Envio GraphQL subscription when NEXT_PUBLIC_ENVIO_WS is set, and falls back to
 * polling the same query (also what the local dev indexer uses). `key` must change when the variables do.
 */
export function useGql<T = any>(query: string | null, variables: Record<string, unknown>, key: string, pollMs = 1500) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const vars = useRef(variables);
  vars.current = variables;

  useEffect(() => {
    if (!query) return;
    let alive = true;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let unsub: (() => void) | undefined;

    const poll = async () => {
      try {
        const d = await gql<T>(query, vars.current);
        if (alive) {
          setData(d);
          setError(null);
        }
      } catch (e: any) {
        if (alive) setError(e?.message || "query failed");
      }
      if (alive) timer = setTimeout(poll, pollMs);
    };

    if (cfg.envioWs) {
      try {
        unsub = ws().subscribe<T>(
          { query: query.trim().replace(/^query/, "subscription"), variables: vars.current },
          {
            next: (m) => alive && m.data && (setData(m.data as T), setError(null)),
            error: () => {
              unsub = undefined;
              if (alive) poll();
            },
            complete: () => {},
          },
        );
      } catch {
        poll();
      }
    } else {
      poll();
    }
    return () => {
      alive = false;
      if (timer) clearTimeout(timer);
      unsub?.();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, key, pollMs]);

  return { data, error };
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
  family: `query($f:Int!){ Family(where:{id:{_eq:$f}}){ id parent parentFamId } }`,
  openGoals: `query{ Goal(where:{status:{_eq:"ACTIVE"}, sponsorOpen:{_eq:true}}, order_by:{createdAt:desc}, limit:20){ id teenFamId target saved matched status deadline memo } }`,
  users: `query{ User(order_by:{createdAt:desc}, limit:200){ id famId role } }`,
};
