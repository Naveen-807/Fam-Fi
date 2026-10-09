#!/usr/bin/env node
// Starts relayer + indexer + the web app against the REAL network configured by deploy-testnet.mjs.
// No local chain, no seeded people, no mock tokens.
import { spawn } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import net from "node:net";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const [nodeMajor, nodeMinor] = process.versions.node.split(".").map(Number);
if (nodeMajor < 22 || (nodeMajor === 22 && nodeMinor < 15)) {
  console.error(`\nYour Node (${process.versions.node}) is too old for the indexer. Install Node 22.15 or newer from https://nodejs.org, reopen Terminal, and run  node scripts/install-all.mjs  again.\n`);
  process.exit(1);
}
for (const f of ["relayer/.env", "indexer/.env", "app/.env.local"]) {
  if (!existsSync(path.join(root, f))) {
    console.error(`\nMissing ${f}. Run first:  node scripts/deploy-testnet.mjs --dynamic-env <id>\n`);
    process.exit(1);
  }
}
for (const part of ["relayer", "indexer", "app"]) {
  if (!existsSync(path.join(root, part, "node_modules"))) {
    console.error(`\nThe ${part} folder isn't installed yet. Run:  node scripts/install-all.mjs\n`);
    process.exit(1);
  }
}
const envOf = (rel) =>
  Object.fromEntries(readFileSync(path.join(root, rel), "utf8").split("\n").filter((l) => l.includes("=") && !l.startsWith("#")).map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1)]));

const children = [];
const run = (tag, cmd, args, cwd, env = {}) => {
  const p = spawn(cmd, args, { cwd: path.join(root, cwd), env: { ...process.env, ...env }, stdio: ["ignore", "pipe", "pipe"] });
  const pipe = (s) => s.on("data", (d) => d.toString().split("\n").filter(Boolean).forEach((l) => console.log(`[${tag}] ${l}`)));
  pipe(p.stdout); pipe(p.stderr);
  p.on("exit", (c) => c && console.log(`[${tag}] stopped with code ${c}`));
  children.push(p);
};
const stop = () => { children.forEach((c) => c.kill("SIGTERM")); process.exit(0); };
process.on("SIGINT", stop); process.on("SIGTERM", stop);

const busy = (port) => new Promise((res) => { const s = net.connect(port, "127.0.0.1"); s.on("connect", () => { s.destroy(); res(true); }); s.on("error", () => res(false)); });
for (const port of [8787, 8080, 3000]) if (await busy(port)) { console.error(`\nPort ${port} is already in use. Close whatever is using it and try again.\n`); process.exit(1); }

run("relayer", "npx", ["tsx", "src/server.ts"], "relayer", envOf("relayer/.env"));
run("indexer", "npx", ["tsx", "dev-server.ts"], "indexer", envOf("indexer/.env"));
run("app", "npm", ["run", "dev", "--", "-p", "3000"], "app");
console.log("\nStarting… open http://localhost:3000 in about 20 seconds (the first page takes a moment to build).\nPress Ctrl+C to stop.\n");
await new Promise(() => {});
