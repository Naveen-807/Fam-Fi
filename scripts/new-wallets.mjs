#!/usr/bin/env node
// Creates the three throwaway TESTNET wallets Fam-Fi needs and saves their secret keys to .wallets.json
// (git-ignored, readable only by you). Only the public addresses are printed.
//   deployer : puts the contract on the network once
//   relayer  : pays the gas for every user's action, so users never need any
//   treasury : holds the testnet USDC that the "Add test USDC" button hands out
import { createRequire } from "node:module";
import { existsSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const { ethers } = createRequire(path.join(root, "relayer", "package.json"))("ethers");
const file = path.join(root, ".wallets.json");

if (existsSync(file)) {
  console.error(`\n.wallets.json already exists, so I will not overwrite your keys.\nDelete it yourself only if you are sure you do not need those wallets.\n`);
  const w = JSON.parse((await import("node:fs")).readFileSync(file, "utf8"));
  for (const k of ["deployer", "relayer", "treasury"]) console.error(`  ${k.padEnd(9)} ${w[k].address}`);
  process.exit(1);
}

const out = {};
for (const k of ["deployer", "relayer", "treasury"]) {
  const w = ethers.Wallet.createRandom();
  out[k] = { address: w.address, privateKey: w.privateKey };
}
writeFileSync(file, JSON.stringify(out, null, 2) + "\n", { mode: 0o600 });

console.log(`
Three testnet wallets created. Secret keys are saved in .wallets.json (never share or commit it).

  deployer  ${out.deployer.address}
  relayer   ${out.relayer.address}
  treasury  ${out.treasury.address}

Next:
  1. Get test MON (for gas) at https://faucet.monad.xyz — paste each of the three addresses above and claim.
  2. Get test USDC at https://faucet.circle.com — choose USDC, then Monad Testnet, paste the TREASURY address,
     and click Send. You can request again every 2 hours; ~100 USDC is plenty.
  3. Run:  node scripts/deploy-testnet.mjs --dynamic-env <your Dynamic environment ID>
`);
