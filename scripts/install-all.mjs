#!/usr/bin/env node
// Installs the dependencies of every part of Fam-Fi (contracts, relayer, indexer, app) in one go.
//   node scripts/install-all.mjs
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const [major, minor] = process.versions.node.split(".").map(Number);
console.log(`Node ${process.versions.node}`);
// The indexer's engine (envio) requires Node 22.15 or newer.
if (major < 22 || (major === 22 && minor < 15)) {
  console.error(`
Your Node (${process.versions.node}) is too old. Fam-Fi needs Node 22.15 or newer.

Easiest fix on a Mac: download the current LTS installer from https://nodejs.org and run it
(or, if you use Homebrew:  brew upgrade node ).
Then close and reopen Terminal, check that  node -v  shows 22.15 or higher, and run this again.
`);
  process.exit(1);
}

const parts = ["contracts", "relayer", "indexer", "app"];
for (const [i, part] of parts.entries()) {
  console.log(`\n[${i + 1}/${parts.length}] Installing ${part}… (this can take a minute)`);
  const r = spawnSync("npm", ["install", "--legacy-peer-deps", "--no-fund", "--no-audit"], { cwd: path.join(root, part), stdio: "inherit" });
  if (r.status !== 0) {
    console.error(`\nInstalling ${part} failed. Scroll up for the error, fix it, and run this command again; it picks up where it left off.\n`);
    process.exit(1);
  }
}
console.log("\nAll installed. Next:  node scripts/wallet-status.mjs   (then deploy-testnet.mjs, then start-testnet.mjs)");
