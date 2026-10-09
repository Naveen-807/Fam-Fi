#!/usr/bin/env node
// Boots the entire Fam-Fi stack on your machine with no accounts or keys:
//   local chain -> contracts -> relayer -> dev indexer -> demo family seed -> (optional) the web app.
// Usage:  node scripts/local-stack.mjs [--app]
import { spawn, spawnSync } from "node:child_process";
import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
import net from "node:net";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const withApp = process.argv.includes("--app");
const children = [];
const log = (tag, line) => console.log(`[${tag}] ${line}`);

function run(tag, cmd, args, cwd, env = {}) {
  const p = spawn(cmd, args, { cwd: path.join(root, cwd), env: { ...process.env, ...env }, stdio: ["ignore", "pipe", "pipe"] });
  const pipe = (s) => s.on("data", (d) => d.toString().split("\n").filter(Boolean).forEach((l) => log(tag, l)));
  pipe(p.stdout); pipe(p.stderr);
  children.push(p);
  return p;
}
function runOnce(tag, cmd, args, cwd, env = {}) {
  const r = spawnSync(cmd, args, { cwd: path.join(root, cwd), env: { ...process.env, ...env }, encoding: "utf8" });
  (r.stdout + r.stderr).split("\n").filter(Boolean).forEach((l) => log(tag, l));
  if (r.status !== 0) throw new Error(`${tag} failed`);
}
const waitPort = (port) => new Promise((res, rej) => {
  const t0 = Date.now();
  (function tryOnce() {
    const s = net.connect(port, "127.0.0.1");
    s.on("connect", () => { s.destroy(); res(); });
    s.on("error", () => { s.destroy(); Date.now() - t0 > 60000 ? rej(new Error(`port ${port} never opened`)) : setTimeout(tryOnce, 400); });
  })();
});
const stop = () => { children.forEach((c) => c.kill("SIGTERM")); process.exit(0); };
process.on("SIGINT", stop); process.on("SIGTERM", stop);

run("chain", "npx", ["hardhat", "node", "--hostname", "127.0.0.1"], "contracts", { HARDHAT_INTERVAL: "1000" });
await waitPort(8545);
runOnce("deploy", "npx", ["hardhat", "run", "scripts/deploy-local.ts", "--network", "localhost"], "contracts");
const st = JSON.parse(readFileSync(path.join(root, ".local/stack.json"), "utf8"));

run("relayer", "npx", ["tsx", "src/server.ts"], "relayer", {
  RPC_URL: st.rpcUrl, RELAYER_KEY: st.relayerKey, TREASURY_KEY: st.treasuryKey,
  FAMFI_ADDRESS: st.famFi, FORWARDER_ADDRESS: st.forwarder, USDC_ADDRESS: st.usdc,
  PORT: "8787", FAUCET_AMOUNT: "10", FAUCET_COOLDOWN_HOURS: "0.0003", FAUCET_STATE_PATH: "none", RATE_PER_MINUTE: "600",
});
run("indexer", "npx", ["tsx", "dev-server.ts"], "indexer", { RPC_URL: st.rpcUrl, FAMFI_ADDRESS: st.famFi, START_BLOCK: String(st.deployBlock), PORT: "8080" });
await waitPort(8787); await waitPort(8080);
await new Promise((r) => setTimeout(r, 1500)); // let the relayer finish its treasury approval

runOnce("seed", "npx", ["tsx", "scripts/seed-demo.ts"], "relayer", {
  RPC_URL: st.rpcUrl, RELAYER_URL: "http://127.0.0.1:8787", FAMFI_ADDRESS: st.famFi, FORWARDER_ADDRESS: st.forwarder,
});

const appEnv = [
  `NEXT_PUBLIC_RPC_URL=${st.rpcUrl}`, `NEXT_PUBLIC_CHAIN_ID=${st.chainId}`,
  `NEXT_PUBLIC_FAMFI=${st.famFi}`, `NEXT_PUBLIC_FORWARDER=${st.forwarder}`, `NEXT_PUBLIC_USDC=${st.usdc}`,
  `NEXT_PUBLIC_RELAYER_URL=http://127.0.0.1:8787`, `NEXT_PUBLIC_ENVIO_URL=http://127.0.0.1:8080/v1/graphql`,
  `NEXT_PUBLIC_EXPLORER_TX=`, `NEXT_PUBLIC_NETWORK_LABEL=Local demo chain`,
  `NEXT_PUBLIC_JUDGE_MODE=1`, // ready-made demo people are for local demos only

  // Optional: turn on real email sign-in against a Dynamic environment, e.g.
  //   NEXT_PUBLIC_DYNAMIC_ENV_ID=<your id> node scripts/local-stack.mjs --app
  ...(process.env.NEXT_PUBLIC_DYNAMIC_ENV_ID ? [`NEXT_PUBLIC_DYNAMIC_ENV_ID=${process.env.NEXT_PUBLIC_DYNAMIC_ENV_ID}`] : []),
].join("\n") + "\n";
mkdirSync(path.join(root, "app"), { recursive: true });
writeFileSync(path.join(root, "app/.env.local"), appEnv);
log("stack", "READY. chain :8545  relayer :8787  indexer :8080/v1/graphql  (app env written to app/.env.local)");

if (withApp) run("app", "npm", ["run", "dev", "--", "-p", "3000"], "app");
else log("stack", "start the app with:  cd app && npm run dev");
await new Promise(() => {});
