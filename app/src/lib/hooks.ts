"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { Account, bytesToFamId, fam, friendlyError, readAccount, readTeen, TeenView } from "./chain";
import { useWallet } from "./wallet";
import { useToast } from "@/components/ui";

/** The signed-in person's on-chain account (role, Fam-ID, family). Refreshes every few seconds. */
export function useMe() {
  const { signer, ready } = useWallet();
  const [state, setState] = useState<{ address?: string; acct: Account | null; loaded: boolean; error: string | null }>({ acct: null, loaded: false, error: null });
  const addr = signer?.address;
  const active = useRef(addr);
  active.current = addr;

  const refresh = useCallback(async () => {
    if (!addr) {
      setState({ address: addr, acct: null, loaded: true, error: null });
      return;
    }
    try {
      const acct = await readAccount(addr);
      if (active.current === addr) setState({ address: addr, acct, loaded: true, error: null });
    } catch {
      if (active.current === addr) setState((s) => ({ address: addr, acct: s.address === addr ? s.acct : null, loaded: true, error: "Couldn't load your account from the network. Please try again." }));
    }
  }, [addr]);

  useEffect(() => {
    setState({ address: addr, acct: null, loaded: false, error: null });
    void refresh();
    const t = setInterval(refresh, 3000);
    return () => clearInterval(t);
  }, [refresh]);

  const current = state.address === addr;
  return { acct: current ? state.acct : null, loaded: current && state.loaded && ready, error: current ? state.error : null, refresh, address: addr };
}

/** Resolve the linked parent from the contract, including before Envio has caught up. */
export function useFamilyParent(familyId: number) {
  const [state, setState] = useState<{ familyId: number; id: string }>({ familyId: 0, id: "" });
  useEffect(() => {
    let alive = true;
    const load = async () => {
      try {
        const address = await fam.familyParent(familyId);
        const account = await fam.accounts(address);
        if (alive) setState({ familyId, id: bytesToFamId(account.famId) });
      } catch { /* Retry without substituting a different parent. */ }
    };
    void load(); const timer = setInterval(load, 10000);
    return () => { alive = false; clearInterval(timer); };
  }, [familyId]);
  return state.familyId === familyId ? state.id : "";
}

/** A teen's live numbers, read straight from the chain (always correct, never stale). */
export function useTeenView(address?: string, pollMs = 2500) {
  const [view, setView] = useState<TeenView | null>(null);
  const [error, setError] = useState<string | null>(null);
  const alive = useRef(true);
  const currentAddress = useRef(address);
  currentAddress.current = address;
  const viewAddress = useRef<string | undefined>(undefined);
  const refresh = useCallback(async () => {
    if (!address) return;
    try {
      const v = await readTeen(address);
      if (alive.current && currentAddress.current === address) { viewAddress.current = address; setView(v); setError(null); }
    } catch {
      if (alive.current && currentAddress.current === address) setError("Could not refresh balances and rules. Last confirmed values may be out of date.");
    }
  }, [address]);
  useEffect(() => {
    alive.current = true;
    setView(null);
    setError(null);
    void refresh();
    const t = setInterval(refresh, pollMs);
    return () => {
      alive.current = false;
      clearInterval(t);
    };
  }, [refresh, pollMs]);
  return { view: viewAddress.current === address ? view : null, refresh, error };
}

/** Re-render every `ms` (used for ticking balances and hold countdowns). */
export function useNow(ms = 1000) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), ms);
    return () => clearInterval(t);
  }, [ms]);
  return now;
}

/** Wrap a button action: shows a spinner, a success message, or a plain-language error. */
export function useAct() {
  const toast = useToast();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const running = useRef(false);
  const run = useCallback(
    async <T,>(label: string, fn: () => Promise<T>, okMsg?: string | ((r: T) => string)): Promise<T | undefined> => {
      if (running.current) { toast.err("Another action is still finishing. Please wait."); return undefined; }
      running.current = true;
      setError(null);
      setBusy(label);
      try {
        const r = await fn();
        if (okMsg) toast.ok(typeof okMsg === "function" ? okMsg(r) : okMsg);
        return r;
      } catch (e) {
        const message = friendlyError(e);
        setError(message); toast.err(message);
        return undefined;
      } finally {
        running.current = false;
        setBusy(null);
      }
    },
    [toast],
  );
  return { busy, run, error };
}
