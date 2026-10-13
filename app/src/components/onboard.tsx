"use client";
import { useEffect, useState } from "react";
import { ActionError, Button, Card, Field, Input, Proof, useToast } from "./ui";
import { famIdBytes, famIdTaken, ROLE } from "@/lib/chain";
import { useWallet } from "@/lib/wallet";
import { relay, TxResult } from "@/lib/relay";
import { useAct } from "@/lib/hooks";
import { FAMID_RE } from "@/lib/format";

/** Check a Fam-ID as the person types: format first, then whether it is free on-chain. */
export function useFamIdCheck(value: string) {
  type Status = "empty" | "bad" | "checking" | "free" | "taken" | "unavailable";
  const [result, setResult] = useState<{ value: string; state: Status }>({ value: "", state: "empty" });
  useEffect(() => {
    const setState = (state: Status) => setResult({ value, state });
    if (!value) return setState("empty");
    if (!FAMID_RE.test(value)) return setState("bad");
    setState("checking");
    let alive = true;
    let retry: ReturnType<typeof setTimeout> | undefined;
    const check = async () => {
      try {
        const taken = await famIdTaken(value);
        if (alive) setState(taken ? "taken" : "free");
      } catch {
        if (alive) {
          setState("unavailable");
          retry = setTimeout(check, 3000);
        }
      }
    };
    const t = setTimeout(check, 250);
    return () => {
      alive = false;
      clearTimeout(t);
      if (retry) clearTimeout(retry);
    };
  }, [value]);
  return result.value === value ? result.state : !value ? "empty" : !FAMID_RE.test(value) ? "bad" : "checking";
}

const HINT = {
  empty: "3–20 letters, numbers or _",
  bad: "Use 3–20 lowercase letters, numbers or _",
  checking: "Checking…",
  free: "Available ✓",
  taken: "Already taken",
  unavailable: "Couldn't check availability. Retrying…",
} as const;

/** Pick a Fam-ID and create the account. `kind` decides the role and what happens after. */
export function Onboard({
  kind, onDone,
}: {
  kind: "parent" | "relative" | "friend";
  onDone?: () => void;
}) {
  const { signer } = useWallet();
  const { busy, run, error: actionError } = useAct();
  const toast = useToast();
  const [name, setName] = useState("");
  const [tx, setTx] = useState<TxResult | null>(null);
  const state = useFamIdCheck(name);

  const copy = {
    parent: { title: "Set up your family", blurb: "Pick the name your family will see. You can start sending allowance in a minute.", cta: "Create my family" },
    relative: { title: "Join to give a gift", blurb: "Pick a name so the family knows it's you.", cta: "Continue" },
    friend: { title: "Join to pay your share", blurb: "Pick a name so your friend sees who paid.", cta: "Continue" },
  }[kind];

  async function go() {
    if (!signer) return;
    const done = await run(
      "onboard",
      async () => {
        const first = await relay(signer, "register", [famIdBytes(name), kind === "parent" ? ROLE.PARENT : ROLE.SPONSOR]);
        if (kind === "parent") {
          const tz = -new Date().getTimezoneOffset() * 60;
          const second = await relay(signer, "createFamily", [tz]);
          return second;
        }
        return first;
      },
      `Welcome, @${name}!`,
    );
    if (done) {
      setTx(done);
      onDone?.();
    } else toast.err("Couldn't finish setting up. Try again.");
  }

  return (
    <Card className="mx-auto mt-6 max-w-md"><ActionError error={actionError}/>
      <h1 className="text-2xl font-bold">{copy.title}</h1>
      <p className="mt-1 text-sm text-slate-600">{copy.blurb}</p>
      <div className="mt-5 space-y-4">
        <Field label="Your Fam-ID" hint={HINT[state]}>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ""))}
            placeholder="e.g. priya"
            maxLength={20}
            autoFocus
            aria-label="Fam-ID"
          />
        </Field>
        <Button full busy={busy === "onboard"} disabled={state !== "free"} onClick={go}>
          {copy.cta}
        </Button>
      </div>
      <Proof tx={tx} label="Account ready" />
    </Card>
  );
}
