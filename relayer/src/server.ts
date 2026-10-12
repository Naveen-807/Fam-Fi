import "dotenv/config";
import { ethers } from "ethers";
import { createApp, RelayerConfig } from "./app.js";

const need = (k: string) => {
  const v = process.env[k];
  if (!v) throw new Error(`Missing env ${k} (see .env.example)`);
  return v;
};

const cfg: RelayerConfig = {
  rpcUrl: process.env.RPC_URL || "https://testnet-rpc.monad.xyz",
  relayerKey: need("RELAYER_KEY"),
  treasuryKey: need("TREASURY_KEY"),
  famfi: need("FAMFI_ADDRESS"),
  forwarder: need("FORWARDER_ADDRESS"),
  usdc: process.env.USDC_ADDRESS || "0x534b2f3A21130d7a60830c2Df862319e593943A3",
  allowedOrigin: process.env.ALLOWED_ORIGIN || "*",
  faucetAmount: ethers.parseUnits(process.env.FAUCET_AMOUNT || "5", 6),
  faucetCooldownMs: Number(process.env.FAUCET_COOLDOWN_HOURS || "24") * 3600_000,
  maxGas: BigInt(process.env.MAX_GAS || "1000000"),
  ratePerMinute: Number(process.env.RATE_PER_MINUTE || "30"),
  envioUrl: process.env.ENVIO_URL || "",
  faucetStatePath: process.env.FAUCET_STATE_PATH === "none" ? null : process.env.FAUCET_STATE_PATH || ".faucet-state.json",
};

const { app, ensureTreasuryAllowance } = createApp(cfg);
const port = Number(process.env.PORT || 8787);
app.listen(port, async () => {
  console.log(`FamFi relayer listening on :${port}`);
  try {
    await ensureTreasuryAllowance();
    console.log("treasury allowance ok");
  } catch (e: any) {
    console.warn("could not set treasury allowance (is the treasury funded with MON?):", e?.shortMessage || e?.message);
  }
});
