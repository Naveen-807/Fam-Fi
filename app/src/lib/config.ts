// All public configuration. NEXT_PUBLIC_* values are inlined at build time.
export const cfg = {
  rpcUrl: process.env.NEXT_PUBLIC_RPC_URL || "https://testnet-rpc.monad.xyz",
  chainId: Number(process.env.NEXT_PUBLIC_CHAIN_ID || 10143),
  famfi: process.env.NEXT_PUBLIC_FAMFI || "",
  forwarder: process.env.NEXT_PUBLIC_FORWARDER || "",
  usdc: process.env.NEXT_PUBLIC_USDC || "0x534b2f3A21130d7a60830c2Df862319e593943A3",
  relayerUrl: process.env.NEXT_PUBLIC_RELAYER_URL || "http://127.0.0.1:8787",
  envioUrl: process.env.NEXT_PUBLIC_ENVIO_URL || "",
  envioWs: process.env.NEXT_PUBLIC_ENVIO_WS || "",
  explorerTx: process.env.NEXT_PUBLIC_EXPLORER_TX ?? "https://testnet.monadvision.com/tx/",
  networkLabel: process.env.NEXT_PUBLIC_NETWORK_LABEL || "Monad testnet",
  dynamicEnvId: process.env.NEXT_PUBLIC_DYNAMIC_ENV_ID || "",
};
