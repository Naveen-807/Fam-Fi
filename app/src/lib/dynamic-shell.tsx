"use client";
import { ReactNode, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createDynamicClient, getActiveNetworkData, switchActiveNetwork } from "@dynamic-labs-sdk/client";
import { createWaasWalletAccounts, getChainsMissingWaasWalletAccounts } from "@dynamic-labs-sdk/client/waas";
import { addEvmExtension, isEvmWalletAccount } from "@dynamic-labs-sdk/evm";
import { createWalletClientForWalletAccount } from "@dynamic-labs-sdk/evm/viem";
import {
  DynamicProvider,
  useGetWalletAccounts,
  useInitStatus,
  useLogout,
  useOnEvent,
  useRegisterPasskey,
  useSendEmailOTP,
  useSignInWithPasskey,
  useUser,
  useVerifyOTP,
} from "@dynamic-labs-sdk/react-hooks";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cfg } from "./config";
import type { Bridge } from "./bridge";
import type { Signer } from "./relay";

/**
 * Real sign-in with Dynamic's headless SDK: email one-time code -> an embedded wallet is created for that
 * email (a new email gets a new wallet, the same email gets the same wallet back) -> optional passkey so
 * the next visit is just Face ID / fingerprint. The app draws every screen itself.
 *
 * Written from Dynamic's published docs; NOT yet exercised against a real environment ID (see README).
 * This module is only ever loaded in the browser (next/dynamic with ssr:false).
 */
// Dynamic signs typed data on the wallet's ACTIVE network, and a fresh environment only lists Ethereum.
// So we add our own chain to the SDK's list and make it the default.
const OUR_NETWORK = {
  blockExplorerUrls: ["https://testnet.monadvision.com"],
  chain: "EVM" as const,
  displayName: cfg.networkLabel,
  iconUrl: "",
  name: `famfi-${cfg.chainId}`,
  nativeCurrency: { decimals: 18, name: "Monad", symbol: "MON" },
  networkId: String(cfg.chainId),
  rpcUrls: { http: [cfg.rpcUrl] },
  testnet: true,
};

const dynamicClient = createDynamicClient({
  environmentId: cfg.dynamicEnvId,
  metadata: { name: "Fam-Fi", universalLink: window.location.origin },
  transformers: {
    networksData: (networks) => {
      const ours = networks.find((n) => n.chain === "EVM" && n.networkId === OUR_NETWORK.networkId) ?? (OUR_NETWORK as any);
      return [ours, ...networks.filter((n) => n !== ours)];
    },
  },
});
addEvmExtension();
const queryClient = new QueryClient();

const PASSKEY_FLAG = "famfi-passkey-on";
const readFlag = () => {
  try {
    return localStorage.getItem(PASSKEY_FLAG) === "1";
  } catch {
    return false;
  }
};

/** Dynamic's HTTP errors hide the useful part in the response body. Pull it out so the screen can say what went wrong. */
function detailOf(e: any): string | null {
  const d = e?.response?.data;
  if (!d) return null;
  if (typeof d === "string") return d.slice(0, 200);
  const m = d?.error?.message ?? d?.message ?? (typeof d?.error === "string" ? d.error : null) ?? d?.errors?.[0]?.message;
  return typeof m === "string" ? m.slice(0, 200) : JSON.stringify(d).slice(0, 200);
}

/** Turn SDK errors into words a family would understand. */
const msg = (e: unknown) => {
  const m: string = (e as any)?.message || String(e);
  if (/environment.*not found|not found.*environment/i.test(m)) return "Sign-in isn't set up correctly yet (check the Dynamic environment ID).";
  if (/invalid.*(code|otp)|otp.*invalid|incorrect|expired/i.test(m)) return "That code didn't work. Check it, or ask for a new one.";
  if (/rate|too many/i.test(m)) return "Too many tries. Wait a minute and try again.";
  if (/NotAllowed|cancel|abort/i.test(m)) return "Face ID / fingerprint was cancelled. Try again, or use your email.";
  return m.length > 160 ? m.slice(0, 160) + "…" : m;
};

/** Make sure the wallet is on our chain before it signs (Dynamic signs on the active network). */
async function ensureOurNetwork(walletAccount: any) {
  const { networkData } = await getActiveNetworkData({ walletAccount });
  if (String(networkData?.networkId) === OUR_NETWORK.networkId) return;
  await switchActiveNetwork({ walletAccount, networkId: OUR_NETWORK.networkId });
}

function BridgeReporter({ onBridge }: { onBridge: (b: Bridge) => void }) {
  const { data: init } = useInitStatus();
  const { data: user } = useUser();
  const { data: accounts = [] } = useGetWalletAccounts();
  const send = useSendEmailOTP();
  const verify = useVerifyOTP();
  const passkeyIn = useSignInWithPasskey();
  const passkeyReg = useRegisterPasskey();
  const logoutMut = useLogout();

  const [otp, setOtp] = useState<Awaited<ReturnType<typeof send.mutateAsync>> | null>(null);
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [passkeyOn, setPasskeyOn] = useState(readFlag);

  // A wallet is not created by sign-in itself. Create one the moment a user appears (docs: do it unconditionally).
  const creating = useRef(false);
  const makeWallet = useCallback(async () => {
    if (creating.current) return;
    creating.current = true;
    try {
      const missing = getChainsMissingWaasWalletAccounts();
      if (missing.length > 0) await createWaasWalletAccounts({ chains: missing });
    } catch (e) {
      setError(`Couldn't set up your account: ${msg(e)}`);
    } finally {
      creating.current = false;
    }
  }, []);
  useOnEvent({
    event: "userChanged",
    listener: async ({ user: u }) => {
      if (u) await makeWallet();
    },
  });

  const evm = accounts.find((a) => isEvmWalletAccount(a));
  const address = evm?.address;

  // A returning user whose wallet was never created (e.g. the tab closed mid-setup) gets it created now.
  useEffect(() => {
    if (init === "finished" && user && !evm) void makeWallet();
  }, [init, user, evm, makeWallet]);

  // Put a brand-new (or returning) wallet on our chain as soon as it exists, so the first signature just works.
  useEffect(() => {
    if (evm) void ensureOurNetwork(evm).catch(() => {});
  }, [evm]);

  const signer: Signer | null = useMemo(() => {
    if (!evm || !address) return null;
    return {
      address,
      kind: "dynamic",
      signTypedData: async (domain, types, message, primaryType) => {
        try {
          await ensureOurNetwork(evm);
          const walletClient: any = await createWalletClientForWalletAccount({ walletAccount: evm as any });
          return await walletClient.signTypedData({ domain, types, primaryType, message });
        } catch (e) {
          const d = detailOf(e);
          // eslint-disable-next-line no-console
          console.error("Dynamic signing failed", { status: (e as any)?.response?.status, body: (e as any)?.response?.data, error: e });
          throw new Error(d ? `Your wallet couldn't sign this: ${d}` : (e as any)?.message || "Your wallet couldn't sign this.");
        }
      },
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [address]);

  const wrap = useCallback(async (fn: () => Promise<unknown>) => {
    setBusy(true);
    setError(null);
    try {
      await fn();
    } catch (e) {
      setError(msg(e));
    } finally {
      setBusy(false);
    }
  }, []);

  const auth = useMemo<Bridge["auth"]>(
    () => ({
      step: user ? "wallet" : otp ? "code" : "email",
      loggedIn: !!user,
      userEmail: (user as any)?.email ?? (email || null),
      busy,
      error: error ?? (init === "failed" ? "Sign-in isn't set up correctly yet (check the Dynamic environment ID)." : null),
      passkeyRegistered: passkeyOn,
      sendCode: (e: string) =>
        wrap(async () => {
          setEmail(e);
          setOtp(await send.mutateAsync({ email: e }));
        }),
      verifyCode: (code: string) =>
        wrap(async () => {
          if (!otp) throw new Error("Ask for a code first.");
          await verify.mutateAsync({ otpVerification: otp, verificationToken: code.trim() });
          setOtp(null);
        }),
      reset: () => {
        setOtp(null);
        setError(null);
      },
      signInWithPasskey: () => wrap(async () => void (await passkeyIn.mutateAsync(undefined))),
      registerPasskey: () =>
        wrap(async () => {
          await passkeyReg.mutateAsync(undefined);
          setPasskeyOn(true);
          try {
            localStorage.setItem(PASSKEY_FLAG, "1");
          } catch {
            /* convenience only */
          }
        }),
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [user, otp, email, busy, error, passkeyOn, wrap, init],
  );

  useEffect(() => {
    onBridge({
      signer,
      ready: init === "finished" || init === "failed",
      logout: () => logoutMut.mutate(),
      auth,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signer, init, auth]);

  return null;
}

export default function DynamicShell({ children, onBridge }: { children: ReactNode; onBridge: (b: Bridge) => void }) {
  return (
    <QueryClientProvider client={queryClient}>
      <DynamicProvider client={dynamicClient}>
        <BridgeReporter onBridge={onBridge} />
        {children}
      </DynamicProvider>
    </QueryClientProvider>
  );
}
