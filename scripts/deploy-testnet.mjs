#!/usr/bin/env node
// Deploys Fam-Fi for real: checks your wallets are funded, deploys the contracts against Circle's real testnet
// USDC, and writes every config file the relayer, indexer and app need. Never prints a secret key.
//
//   node scripts/deploy-testnet.mjs --dynamic-env <id>
//   options: --rpc <url> --chain-id <n> --usdc <address> --wallets <file> --explorer <tx-url-prefix>
import { createRequire } from "node:module";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const { ethers } = createRequire(path.join(root, "relayer", "package.json"))("ethers");

const arg = (name, fallback) => {
  const i = process.argv.indexOf(`--${name}`);
  return i > -1 ? process.argv[i + 1] : fallback;
};
const RPC = arg("rpc", process.env.RPC_URL || "https://testnet-rpc.monad.xyz");
const CHAIN_ID = Number(arg("chain-id", "10143"));
const USDC = arg("usdc", "0x534b2f3A21130d7a60830c2Df862319e593943A3"); // Circle's Monad testnet USDC
const WALLETS = arg("wallets", path.join(root, ".wallets.json"));
const DYNAMIC = arg("dynamic-env", process.env.NEXT_PUBLIC_DYNAMIC_ENV_ID || "");
const EXPLORER = arg("explorer", CHAIN_ID === 10143 ? "https://testnet.monadvision.com/tx/" : "");
const NETWORK_LABEL = CHAIN_ID === 10143 ? "Monad testnet" : `Chain ${CHAIN_ID}`;

const stop = (msg) => { console.error("\n" + msg + "\n"); process.exit(1); };
if (!existsSync(WALLETS)) stop(`No wallets file at ${WALLETS}. Run:  node scripts/new-wallets.mjs`);
const W = JSON.parse(readFileSync(WALLETS, "utf8"));
if (!DYNAMIC) console.warn("Note: no --dynamic-env given. Real email sign-in stays off until you add NEXT_PUBLIC_DYNAMIC_ENV_ID to app/.env.local.\n");

const provider = new ethers.JsonRpcProvider(RPC, undefined, { staticNetwork: true });
const net = await provider.getNetwork().catch(() => stop(`Can't reach ${RPC}. Check your internet connection.`));
if (Number(net.chainId) !== CHAIN_ID) stop(`${RPC} is chain ${net.chainId}, but this deploy expects ${CHAIN_ID}.`);

// ── 1. are the wallets funded? ──
const need = { deployer: ethers.parseEther("1"), relayer: ethers.parseEther("1"), treasury: ethers.parseEther("0.2") };
const problems = [];
console.log(`Checking balances on ${NETWORK_LABEL}…`);
for (const k of ["deployer", "relayer", "treasury"]) {
  const bal = await provider.getBalance(W[k].address);
  const ok = bal >= need[k];
  console.log(`  ${k.padEnd(9)} ${W[k].address}  ${ethers.formatEther(bal)} MON  ${ok ? "✓" : "✗ needs at least " + ethers.formatEther(need[k])}`);
  if (!ok) problems.push(`${k} (${W[k].address}) needs MON → https://faucet.monad.xyz`);
}
const code = await provider.getCode(USDC);
if (code === "0x") stop(`There is no USDC contract at ${USDC} on this network.`);
const usdc = new ethers.Contract(USDC, ["function balanceOf(address) view returns (uint256)", "function decimals() view returns (uint8)"], provider);
const usdcBal = await usdc.balanceOf(W.treasury.address);
const dec = Number(await usdc.decimals());
console.log(`  treasury  ${ethers.formatUnits(usdcBal, dec)} USDC  ${usdcBal > 0n ? "✓" : "✗ empty"}`);
if (usdcBal === 0n) problems.push(`treasury (${W.treasury.address}) needs test USDC → https://faucet.circle.com (USDC, Monad Testnet)`);
if (problems.length) stop("Not ready yet. Please fix:\n  • " + problems.join("\n  • ") + "\n\nThen run this command again.");

// ── 2. deploy (the contract takes the USDC address as a parameter, nothing is mocked) ──
console.log("\nDeploying FamFi and the forwarder…");
const r = spawnSync("npx", ["hardhat", "run", "scripts/deploy.ts", "--network", "monadTestnet"], {
  cwd: path.join(root, "contracts"),
  env: { ...process.env, DEPLOYER_KEY: W.deployer.privateKey, MONAD_RPC_URL: RPC, MONAD_CHAIN_ID: String(CHAIN_ID), USDC_ADDRESS: USDC },
  encoding: "utf8",
});
if (r.status !== 0) stop("Deploy failed:\n" + (r.stdout + r.stderr).split("\n").filter((l) => !/PRIVATE|0x[0-9a-f]{64}/i.test(l)).slice(-15).join("\n"));
const dep = JSON.parse(readFileSync(path.join(root, "deployments", `${"monadTestnet"}.json`), "utf8"));
console.log(`  FamFi      ${dep.famFi}\n  Forwarder  ${dep.forwarder}\n  Deploy block ${dep.deployBlock}`);

// ── 3. write the config for every service ──
const write = (rel, body) => { writeFileSync(path.join(root, rel), body, { mode: 0o600 }); console.log(`  wrote ${rel}`); };
console.log("\nWriting config files…");
write("relayer/.env", [
  `RPC_URL=${RPC}`, `RELAYER_KEY=${W.relayer.privateKey}`, `TREASURY_KEY=${W.treasury.privateKey}`,
  `FAMFI_ADDRESS=${dep.famFi}`, `FORWARDER_ADDRESS=${dep.forwarder}`, `USDC_ADDRESS=${USDC}`,
  `ALLOWED_ORIGIN=*`, `FAUCET_AMOUNT=5`, `FAUCET_COOLDOWN_HOURS=24`, `PORT=8787`, "",
].join("\n"));
write("app/.env.local", [
  `NEXT_PUBLIC_RPC_URL=${RPC}`, `NEXT_PUBLIC_CHAIN_ID=${CHAIN_ID}`, `NEXT_PUBLIC_FAMFI=${dep.famFi}`,
  `NEXT_PUBLIC_FORWARDER=${dep.forwarder}`, `NEXT_PUBLIC_USDC=${USDC}`, `NEXT_PUBLIC_RELAYER_URL=http://localhost:8787`,
  `NEXT_PUBLIC_ENVIO_URL=http://localhost:8080/v1/graphql`, `NEXT_PUBLIC_EXPLORER_TX=${EXPLORER}`,
  `NEXT_PUBLIC_NETWORK_LABEL=${NETWORK_LABEL}`, `NEXT_PUBLIC_DYNAMIC_ENV_ID=${DYNAMIC}`, "",
].join("\n"));
write("indexer/.env", [`RPC_URL=${RPC}`, `FAMFI_ADDRESS=${dep.famFi}`, `START_BLOCK=${dep.deployBlock}`, `PORT=8080`, `ENVIO_FAMFI_ADDRESS=${dep.famFi}`, ""].join("\n"));

// Envio's hosted deploy reads start_block from config.yaml
const cfgPath = path.join(root, "indexer", "config.yaml");
writeFileSync(cfgPath, readFileSync(cfgPath, "utf8").replace(/start_block: \d+/, `start_block: ${dep.deployBlock}`));
console.log("  updated indexer/config.yaml start_block");

console.log(`
Done. Everything is real: your wallets, Circle's USDC, ${NETWORK_LABEL}. Nothing is mocked or pre-filled.

Start it all with:   node scripts/start-testnet.mjs
Then open http://localhost:3000 and sign in with your own email.
`);
