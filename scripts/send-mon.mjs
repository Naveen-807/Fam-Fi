#!/usr/bin/env node
// Moves test MON between YOUR OWN three wallets (uses the keys in .wallets.json on your machine).
//   node scripts/send-mon.mjs --from treasury --to relayer --amount 2
import { createRequire } from "node:module";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const { ethers } = createRequire(path.join(root, "relayer", "package.json"))("ethers");
const arg = (n, d) => { const i = process.argv.indexOf(`--${n}`); return i > -1 ? process.argv[i + 1] : d; };
const RPC = arg("rpc", "https://testnet-rpc.monad.xyz");
const wallets = arg("wallets", path.join(root, ".wallets.json"));
const names = ["deployer", "relayer", "treasury"];
const from = arg("from"), to = arg("to"), amount = arg("amount");

const stop = (m) => { console.error("\n" + m + "\n"); process.exit(1); };
if (!existsSync(wallets)) stop("No .wallets.json here. Run this on the computer where you ran new-wallets.mjs.");
if (!names.includes(from) || !names.includes(to) || from === to) stop(`Use: node scripts/send-mon.mjs --from <${names.join("|")}> --to <another one> --amount <MON>`);
if (!amount || !(Number(amount) > 0)) stop("Give an --amount in MON, for example --amount 2");

const W = JSON.parse(readFileSync(wallets, "utf8"));
const provider = new ethers.JsonRpcProvider(RPC, undefined, { staticNetwork: true });
const signer = new ethers.Wallet(W[from].privateKey, provider);
const value = ethers.parseEther(amount);
const bal = await provider.getBalance(signer.address);
const reserve = ethers.parseEther("0.3"); // keep a little behind for the sender's own gas
if (bal < value + reserve) stop(`${from} has ${ethers.formatEther(bal)} MON, which is not enough to send ${amount} and keep a little for gas.`);

console.log(`Sending ${amount} MON from ${from} to ${to} (${W[to].address})…`);
const tx = await signer.sendTransaction({ to: W[to].address, value });
await tx.wait();
console.log(`Done: ${tx.hash}`);
console.log(`  ${from}: ${ethers.formatEther(await provider.getBalance(signer.address))} MON`);
console.log(`  ${to}: ${ethers.formatEther(await provider.getBalance(W[to].address))} MON`);
