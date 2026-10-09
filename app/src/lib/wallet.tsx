"use client";
import { createContext, lazy, ReactNode, Suspense, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { ethers } from "ethers";
import { cfg } from "./config";
import type { Signer } from "./relay";

/** Judge Mode / demo identities are derived from a name. These keys are PUBLIC BY DESIGN: they only ever hold valueless testnet tokens. */
export const demoKey = (name: string) => ethers.id(`famfi-demo-${name}`);

export type Bridge = { signer: Signer | null; login: () => void; logout: () => void; ready: boolean };

type Ctx = {
  signer: Signer | null;
  ready: boolean;
  /** true when the current session is a Judge Mode / demo wallet rather than a Dynamic login */
  isDemo: boolean;
  /** true when real Dynamic login is configured */
  hasDynamic: boolean;
  login: () => void;
  /** Sign in as a named Judge Mode persona (priya, alex, riya, aunt, canteen) or a brand-new demo wallet. */
  loginDemo: (name?: string) => void;
  logout: () => void;
};

const WalletCtx = createContext<Ctx>({
  signer: null, ready: false, isDemo: false, hasDynamic: false, login() {}, loginDemo() {}, logout() {},
});
export const useWallet = () => useContext(WalletCtx);

const DynamicShell = cfg.dynamicEnvId ? lazy(() => import("./dynamic-shell")) : null;

function demoSigner(key: string): Signer {
  const w = new ethers.Wallet(key);
  return { address: w.address, kind: "demo", signTypedData: (d, t, m) => w.signTypedData(d, t, m) };
}

export function WalletProvider({ children }: { children: ReactNode }) {
  const [demoKeyHex, setDemoKeyHex] = useState<string | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const [bridge, setBridge] = useState<Bridge>({ signer: null, login() {}, logout() {}, ready: !cfg.dynamicEnvId });

  // Demo sessions live in sessionStorage only (gone when the tab closes). Real logins live in Dynamic.
  useEffect(() => {
    try {
      const k = sessionStorage.getItem("famfi-demo-key");
      if (k) setDemoKeyHex(k);
    } catch {
      /* private mode: fine */
    }
    setHydrated(true);
  }, []);

  const loginDemo = useCallback((name?: string) => {
    const key = name ? demoKey(name) : ethers.Wallet.createRandom().privateKey;
    try {
      sessionStorage.setItem("famfi-demo-key", key);
    } catch {
      /* ignore */
    }
    setDemoKeyHex(key);
  }, []);

  const logout = useCallback(() => {
    try {
      sessionStorage.removeItem("famfi-demo-key");
    } catch {
      /* ignore */
    }
    setDemoKeyHex(null);
    bridge.logout();
  }, [bridge]);

  const demo = useMemo(() => (demoKeyHex ? demoSigner(demoKeyHex) : null), [demoKeyHex]);

  const value: Ctx = useMemo(
    () => ({
      signer: demo ?? bridge.signer,
      ready: hydrated && bridge.ready,
      isDemo: !!demo,
      hasDynamic: !!cfg.dynamicEnvId,
      login: cfg.dynamicEnvId ? bridge.login : () => loginDemo(),
      loginDemo,
      logout,
    }),
    [demo, bridge, hydrated, loginDemo, logout],
  );

  const inner = <WalletCtx.Provider value={value}>{children}</WalletCtx.Provider>;
  if (!DynamicShell) return inner;
  return (
    <Suspense fallback={<div className="p-8 text-center text-slate-500">Loading…</div>}>
      <DynamicShell onBridge={setBridge}>{inner}</DynamicShell>
    </Suspense>
  );
}
