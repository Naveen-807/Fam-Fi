"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { Account, friendlyError, readAccount, readTeen, TeenView } from "./chain";
import { useWallet } from "./wallet";
import { useToast } from "@/components/ui";

/** The signed-in person's on-chain account (role, Fam-ID, family). Refreshes every few seconds. */
export function useMe() {
  const { signer, ready } = useWallet();
  const [acct, setAcct] = useState<Account | null>(null);
  const [loaded, setLoaded] = useState(false);
  const addr = signer?.address;

  const refresh = useCallback(async () => {
    if (!addr) {
      setAcct(null);
      setLoaded(true);
      return;
    }
    try {
      setAcct(await readAccount(addr));
    } catch {
      /* keep the last good value */
    } finally {
      setLoaded(true);
    }
  }, [addr]);

  useEffect(() => {
    setLoaded(false);
    void refresh();
    const t = setInterval(refresh, 3000);
    return () => clearInterval(t);
  }, [refresh]);

  return { acct, loaded: loaded && ready, refresh, address: addr };
}

/** A teen's live numbers, read straight from the chain (always correct, never stale). */
export function useTeenView(address?: string, pollMs = 2500) {
  const [view, setView] = useState<TeenView | null>(null);
  const alive = useRef(true);
  const refresh = useCallback(async () => {
    if (!address) return;
    try {
      const v = await readTeen(address);
      if (alive.current) setView(v);
    } catch {
      /* ignore */
    }
  }, [address]);
  useEffect(() => {
    alive.current = true;
    setView(null);
    void refresh();
    const t = setInterval(refresh, pollMs);
    return () => {
      alive.current = false;
      clearInterval(t);
    };
  }, [refresh, pollMs]);
  return { view, refresh };
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
  const run = useCallback(
    async <T,>(label: string, fn: () => Promise<T>, okMsg?: string | ((r: T) => string)): Promise<T | undefined> => {
      setBusy(label);
      try {
        const r = await fn();
        if (okMsg) toast.ok(typeof okMsg === "function" ? okMsg(r) : okMsg);
        return r;
      } catch (e) {
        toast.err(friendlyError(e));
        return undefined;
      } finally {
        setBusy(null);
      }
    },
    [toast],
  );
  return { busy, run };
}
