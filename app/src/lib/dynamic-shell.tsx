"use client";
import { ReactNode, useEffect } from "react";
import { DynamicContextProvider, useDynamicContext } from "@dynamic-labs/sdk-react-core";
import { EthereumWalletConnectors, isEthereumWallet } from "@dynamic-labs/ethereum";
import { cfg } from "./config";
import type { Bridge } from "./wallet";

/**
 * Real login: Dynamic embedded wallets (email one-time code, then a passkey for Touch ID / Face ID).
 * Which sign-in methods appear is configured in the Dynamic dashboard for NEXT_PUBLIC_DYNAMIC_ENV_ID.
 * UNVERIFIED on Monad testnet until tested with a real environment ID (see README).
 */
const monadNetwork = {
  blockExplorerUrls: ["https://testnet.monadvision.com"],
  chainId: cfg.chainId,
  name: cfg.networkLabel,
  iconUrls: [],
  nativeCurrency: { decimals: 18, name: "Monad", symbol: "MON" },
  networkId: cfg.chainId,
  rpcUrls: [cfg.rpcUrl],
  vanityName: cfg.networkLabel,
};

function BridgeReporter({ onBridge }: { onBridge: (b: Bridge) => void }) {
  const { primaryWallet, setShowAuthFlow, handleLogOut, sdkHasLoaded } = useDynamicContext();
  const address = primaryWallet?.address;

  useEffect(() => {
    let signer: Bridge["signer"] = null;
    if (primaryWallet && isEthereumWallet(primaryWallet)) {
      signer = {
        address: primaryWallet.address,
        kind: "dynamic",
        signTypedData: async (domain, types, message, primaryType) => {
          const client: any = await primaryWallet.getWalletClient();
          return client.signTypedData({ account: primaryWallet.address, domain, types, primaryType, message });
        },
      };
    }
    onBridge({
      signer,
      ready: sdkHasLoaded,
      login: () => setShowAuthFlow(true),
      logout: () => {
        void handleLogOut();
      },
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [address, sdkHasLoaded]);

  return null;
}

export default function DynamicShell({ children, onBridge }: { children: ReactNode; onBridge: (b: Bridge) => void }) {
  return (
    <DynamicContextProvider
      settings={{
        environmentId: cfg.dynamicEnvId,
        walletConnectors: [EthereumWalletConnectors],
        overrides: { evmNetworks: [monadNetwork as any] },
      }}
    >
      <BridgeReporter onBridge={onBridge} />
      {children}
    </DynamicContextProvider>
  );
}
