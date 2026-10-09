#!/usr/bin/env node
// Shows whether your three wallets are ready for Fam-Fi, and says exactly what to do about any that are not.
// Reads .wallets.json, or take addresses directly (public addresses are safe to share):
//   node scripts/wallet-status.mjs
//   node scripts/wallet-status.mjs --deployer 0x.. --relayer 0x.. --treasury 0x..
import { createRequire } from "node:module";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const { ethers } = createRequire(path.join(root, "relayer", "package.json"))("ethers");
const arg = (n, d) => { const i = process.argv.indexOf(`--${n}`); return i > -1 ? process.argv[i + 1] : d; };
const RPC = arg("rpc", "https://testnet-rpc.monad.xyz");
const USDC = arg("usdc", "0x534b2f3A21130d7a60830c2Df862319e593943A3");

const file = path.join(root, ".wallets.json");
const W = {};
for (const k of ["deployer", "relayer", "treasury"]) {
  const a = arg(k);
  if (a) W[k] = a;
  else if (existsSync(file)) W[k] = JSON.parse(readFileSync(file, "utf8"))[k].address;
}
if (Object.keys(W).length < 3) {
  console.error("No wallets found. Run `node scripts/new-wallets.mjs` first, or pass --deployer/--relayer/--treasury addresses.");
  process.exit(1);
}

const provider = new ethers.JsonRpcProvider(RPC, undefined, { staticNetwork: true });
const usdc = new ethers.Contract(USDC, ["function balanceOf(address) view returns (uint256)"], provider);
const need = { deployer: 1, relayer: 1, treasury: 0.2 };
const why = {
  deployer: "puts the contract on the network (one time)",
  relayer: "pays the gas for every user action, so users never need any",
  treasury: "hands out the test USDC (needs a little MON to move it)",
};

console.log(`Network: ${(await provider.getNetwork()).chainId}   latest block: ${await provider.getBlockNumber()}\n`);
const todo = [];
for (const k of ["deployer", "relayer", "treasury"]) {
  const mon = Number(ethers.formatEther(await provider.getBalance(W[k])));
  const ok = mon >= need[k];
  console.log(`${ok ? "✓" : "✗"} ${k.padEnd(9)} ${W[k]}  ${mon} MON${ok ? "" : `  (needs at least ${need[k]})`}`);
  console.log(`            ${why[k]}`);
  if (!ok) todo.push(`${k} needs MON. Get some at https://faucet.monad.xyz, or send some from a wallet that has extra:\n      node scripts/send-mon.mjs --from treasury --to ${k} --amount 2`);
}
const u = await usdc.balanceOf(W.treasury);
console.log(`${u > 0n ? "✓" : "✗"} treasury  ${ethers.formatUnits(u, 6)} USDC${u > 0n ? "" : "  (needs some)"}`);
if (u === 0n) todo.push(`treasury needs test USDC. Go to https://faucet.circle.com, choose USDC and Monad Testnet, paste ${W.treasury} and click Send.`);

if (todo.length) console.log("\nTo do:\n  • " + todo.join("\n  • ") + "\n\nThen run this again to check.");
else console.log("\nAll set. Next:  node scripts/deploy-testnet.mjs --dynamic-env <your Dynamic environment id>");
