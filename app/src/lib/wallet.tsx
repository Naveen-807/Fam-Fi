"use client";
import { createContext, ReactNode, useCallback, useContext, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { cfg } from "./config";
import type { Bridge, DynamicAuth } from "./bridge";
import type { Signer } from "./relay";

type Ctx = {
  signer: Signer | null;
  ready: boolean;
  /** true when real Dynamic login is configured */
  hasDynamic: boolean;
  /** the email / passkey sign-in controls */
  auth?: DynamicAuth;
  logout: () => void;
};

const WalletCtx = createContext<Ctx>({ signer: null, ready: false, hasDynamic: false, logout() {} });
export const useWallet = () => useContext(WalletCtx);

// The Dynamic SDK touches `window`, so it is only ever loaded in the browser.
const DynamicShell = cfg.dynamicEnvId
  ? dynamic(() => import("./dynamic-shell"), {
      ssr: false,
      loading: () => <div className="p-8 text-center text-slate-500">Loading…</div>,
    })
  : null;

export function WalletProvider({ children }: { children: ReactNode }) {
  const [bridge, setBridge] = useState<Bridge>({ signer: null, logout() {}, ready: !cfg.dynamicEnvId });

  const logout = useCallback(() => bridge.logout(), [bridge]);

  const value: Ctx = useMemo(
    () => ({
      signer: bridge.signer,
      ready: bridge.ready,
      hasDynamic: !!cfg.dynamicEnvId,
      auth: bridge.auth,
      logout,
    }),
    [bridge, logout],
  );

  const inner = <WalletCtx.Provider value={value}>{children}</WalletCtx.Provider>;
  if (!DynamicShell) return inner;
  return <DynamicShell onBridge={setBridge}>{inner}</DynamicShell>;
}
