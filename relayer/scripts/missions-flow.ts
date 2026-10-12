/**
 * Real-stack check for missions, the Progress Passport, the Weekly Brief data and FutureFund. It starts a local
 * Hardhat chain and the dev indexer itself, deploys the contracts, and drives everything through the real
 * relayer (signed forward requests, zero-gas wallets) and the real Envio handlers. No browser, no demo data.
 *
 *   cd relayer && npx tsx scripts/missions-flow.ts
 */
import { ethers } from "ethers";
import { readFileSync } from "fs";
import { spawn, ChildProcess } from "node:child_process";
import { createApp } from "../src/app.js";
import { READ_SCOPE, READ_TYPES } from "../src/private.js";

const RPC = "http://127.0.0.1:8545";
const INDEXER_PORT = 18080;
const root = new URL("../../", import.meta.url).pathname;
const art = (p: string) => JSON.parse(readFileSync(`${root}contracts/artifacts/src/${p}`, "utf8"));
const U = (n: number) => BigInt(Math.round(n * 1e6));
const fid = (s: string) => ethers.encodeBytes32String(s);
const TERMS = { levelLimits: [U(5), U(8), U(12), U(20)], newPayeeThreshold: U(3), firstDayCap: U(2), holdSeconds: 600, strictHolds: false };
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

let failed = 0;
const check = (name: string, ok: boolean, extra = "") => {
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${extra ? "  " + extra : ""}`);
  if (!ok) failed++;
};
// Poll for the receipt instead of provider.waitForTransaction, which can stall after the test moves chain time.
const waitTx = async (hash: string) => {
  const end = Date.now() + 20000;
  while (Date.now() < end) {
    const rc = await provider.getTransactionReceipt(hash);
    if (rc) return rc;
    await sleep(100);
  }
  throw new Error("tx not mined: " + hash);
};
let provider!: ethers.JsonRpcProvider;
const children: ChildProcess[] = [];
// children run in their own process groups so npx's grandchildren (hardhat, tsx) are stopped too
const stop = () => children.forEach((c) => { try { process.kill(-c.pid!, "SIGTERM"); } catch { /* already gone */ } });
process.on("exit", stop);

async function waitFor<T>(fn: () => Promise<T | null | false>, what: string, ms = 30000): Promise<T> {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    try { const v = await fn(); if (v) return v as T; } catch { /* retry */ }
    await sleep(400);
  }
  throw new Error("timed out waiting for " + what);
}

async function main() {
  const node = spawn("npx", ["hardhat", "node", "--port", "8545"], { cwd: root + "contracts", stdio: ["ignore", "ignore", "inherit"], detached: true });
  children.push(node);
  provider = new ethers.JsonRpcProvider(RPC, undefined, { staticNetwork: false, batchMaxCount: 1 });
  await waitFor(async () => (await provider.getBlockNumber()) >= 0, "hardhat node");

  const deployerKey = "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80";
  const treasuryKey = "0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d";
  const deployer = new ethers.Wallet(deployerKey, provider);
  let dn = await provider.getTransactionCount(deployer.address);
  const deploy = async (a: any, ...args: any[]) => {
    const c = await new ethers.ContractFactory(a.abi, a.bytecode, deployer).deploy(...args, { nonce: dn++ });
    await c.waitForDeployment();
    return c;
  };
  const usdc: any = await deploy(art("mocks/MockUSDC.sol/MockUSDC.json"));
  const fwd: any = await deploy(art("FamFiForwarder.sol/FamFiForwarder.json"));
  const fam: any = await deploy(art("FamFi.sol/FamFi.json"), await usdc.getAddress(), await fwd.getAddress());
  const famAddr = await fam.getAddress();
  await (await usdc.mint(new ethers.Wallet(treasuryKey).address, U(10000), { nonce: dn++ })).wait();

  const indexer = spawn("npx", ["tsx", "dev-server.ts"], {
    cwd: root + "indexer",
    env: { ...process.env, FAMFI_ADDRESS: famAddr, RPC_URL: RPC, START_BLOCK: "0", PORT: String(INDEXER_PORT), POLL_MS: "500" },
    stdio: "ignore",
    detached: true,
  });
  children.push(indexer);
  await waitFor(async () => (await fetch(`http://127.0.0.1:${INDEXER_PORT}/healthz`)).ok, "dev indexer");

  const { app, ensureTreasuryAllowance } = createApp({
    rpcUrl: RPC, relayerKey: deployerKey, treasuryKey, famfi: famAddr, forwarder: await fwd.getAddress(), usdc: await usdc.getAddress(),
    allowedOrigin: "*", faucetAmount: U(100), faucetCooldownMs: 0, maxGas: 3_000_000n, ratePerMinute: 1000, faucetStatePath: null,
    envioUrl: `http://127.0.0.1:${INDEXER_PORT}/v1/graphql`,
  });
  await ensureTreasuryAllowance();
  const server = app.listen(0);
  const base = `http://127.0.0.1:${(server.address() as any).port}`;
  const post = async (path: string, body: any) => {
    const r = await fetch(base + path, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body), signal: AbortSignal.timeout(20000) });
    return { status: r.status, body: (await r.json()) as any };
  };

  const net = await provider.getNetwork();
  const FTYPES = { ForwardRequest: [
    { name: "from", type: "address" }, { name: "to", type: "address" }, { name: "value", type: "uint256" },
    { name: "gas", type: "uint256" }, { name: "nonce", type: "uint256" }, { name: "deadline", type: "uint48" }, { name: "data", type: "bytes" } ] };
  const fdomain = { name: "FamFiForwarder", version: "1", chainId: net.chainId, verifyingContract: await fwd.getAddress() };
  const call = async (user: ethers.BaseWallet, fn: string, args: any[]) => {
    const data = fam.interface.encodeFunctionData(fn, args);
    const nonce = await fwd.nonces(user.address);
    const deadline = Number((await provider.getBlock("latest"))!.timestamp) + 3600; // chain time: the test moves it forward
    const msg = { from: user.address, to: famAddr, value: 0n, gas: 900000n, nonce, deadline, data };
    const signature = await user.signTypedData(fdomain, FTYPES, msg);
    const r = await post("/relay", { request: { from: msg.from, to: msg.to, value: "0", gas: msg.gas.toString(), deadline, data, signature } });
    if (r.status === 200) await waitTx(r.body.hash);
    return r;
  };
  const read = async (user: ethers.BaseWallet) => {
    const expiry = Math.floor(Date.now() / 1000) + 600;
    const signature = await user.signTypedData({ name: "FamFiRead", version: "1", chainId: net.chainId }, READ_TYPES, { reader: user.address, expiry: BigInt(expiry), scope: READ_SCOPE });
    return post("/private/query", { auth: { reader: user.address, expiry, signature } });
  };
  const fresh = () => ethers.Wallet.createRandom().connect(provider);
  const parent = fresh(), teen = fresh(), aunt = fresh(), stranger = fresh();
  const ledgerTotal = async () => {
    let sum = (await fam.missionEscrow()) + (await fam.fundEscrow());
    for (const w of [parent, teen, aunt]) sum += await fam.balance(w.address);
    for (let i = 1; i <= Number(await fam.goalCount()); i++) { const g = await fam.goals(i); if (Number(g.status) === 2 || Number(g.status) === 3) sum += g.saved + g.matched; }
    return sum;
  };

  // ── setup: everything through the relayer with zero-gas wallets ──
  let r = await call(parent, "register", [fid("priya"), 1]);
  await call(parent, "createFamily", [19800]);
  await call(aunt, "register", [fid("aunt"), 3]);
  await call(stranger, "register", [fid("otherparent"), 1]);
  await call(stranger, "createFamily", [0]);
  const inviteId = ethers.id("flow-invite");
  const dl = Math.floor(Date.now() / 1000) + 86400;
  const sig = await parent.signTypedData(
    { name: "FamFi", version: "1", chainId: net.chainId, verifyingContract: famAddr },
    { Invite: [
      { name: "familyId", type: "uint32" }, { name: "inviteId", type: "bytes32" }, { name: "deadline", type: "uint256" },
      { name: "levelLimits", type: "uint128[4]" }, { name: "newPayeeThreshold", type: "uint128" }, { name: "firstDayCap", type: "uint128" },
      { name: "holdSeconds", type: "uint32" }, { name: "strictHolds", type: "bool" } ] },
    { familyId: 1, inviteId, deadline: dl, ...TERMS },
  );
  r = await call(teen, "acceptInvite", [1, inviteId, dl, TERMS, sig, fid("alex")]);
  check("family set up through the relayer (users hold no gas)", r.status === 200 && (await provider.getBalance(parent.address)) === 0n, r.body.error);
  for (const id of ["priya", "alex"]) { const f = await post("/faucet", { famId: id }); await waitTx(f.body.hash); }

  // ── Feature A/B: a funded mission, end to end ──
  const p0 = await fam.balance(parent.address);
  const t0 = await fam.balance(teen.address);
  const deadline = Math.floor(Date.now() / 1000) + 5 * 86400;
  r = await call(parent, "createMission", [teen.address, U(10), deadline, 0, "Wash the car", "Inside and out"]);
  check("parent creates a funded mission", r.status === 200, r.body.error);
  check("reward is reserved from the parent's spendable balance", (await fam.balance(parent.address)) === p0 - U(10) && (await fam.missionEscrow()) === U(10));
  check("ledger reconciles with the USDC held", (await usdc.balanceOf(famAddr)) === (await ledgerTotal()));

  r = await call(stranger, "createMission", [teen.address, U(1), deadline, 0, "x", ""]);
  check("another family's parent cannot create a mission for this teen", r.status === 422 && /not parent of teen/.test(r.body.error), r.body.error);
  r = await call(parent, "submitMission", [1]);
  check("the parent cannot submit on the teen's behalf", r.status === 422, r.body.error);

  r = await call(teen, "submitMission", [1]);
  check("the teen submits the mission", r.status === 200, r.body.error);
  r = await call(teen, "approveMission", [1]);
  check("the teen cannot approve their own mission", r.status === 422, r.body.error);
  r = await call(parent, "rejectMission", [1, "Missed the wheels"]);
  check("the parent sends it back with feedback", r.status === 200, r.body.error);
  check("rejection pays nothing and keeps the reward reserved", (await fam.balance(teen.address)) === t0 && (await fam.missionEscrow()) === U(10));
  await call(teen, "submitMission", [1]);
  r = await call(parent, "approveMission", [1]);
  check("the parent approves; reward released", r.status === 200 && (await fam.balance(teen.address)) === t0 + U(10), r.body.error);
  r = await call(parent, "approveMission", [1]);
  check("a second approval cannot pay again", r.status === 422 && /not submitted/.test(r.body.error), r.body.error);
  check("escrow is empty and the ledger still reconciles", (await fam.missionEscrow()) === 0n && (await usdc.balanceOf(famAddr)) === (await ledgerTotal()));

  // ── cancel + expiry refunds ──
  const soon = Math.floor(Date.now() / 1000) + 3600;
  await call(parent, "createMission", [teen.address, U(4), soon, 0, "Mow the lawn", ""]);
  await call(parent, "createMission", [teen.address, U(6), soon, 0, "Clean the garage", ""]);
  const before = await fam.balance(parent.address);
  r = await call(parent, "cancelMission", [2]);
  check("cancelling refunds the parent", r.status === 200 && (await fam.balance(parent.address)) === before + U(4), r.body.error);
  await provider.send("evm_increaseTime", [2 * 3600]);
  await provider.send("evm_mine", []);
  r = await call(stranger, "expireMission", [3]);
  check("after the deadline anyone can expire it; the reward returns to the parent", r.status === 200 && (await fam.balance(parent.address)) === before + U(10), r.body.error);
  check("ledger reconciles after cancel and expiry", (await usdc.balanceOf(famAddr)) === (await ledgerTotal()));

  // ── Feature E: FutureFund, tracked and locked ──
  const horizon = Math.floor(Date.now() / 1000) + 3 * 86400 + 7200;
  r = await call(parent, "createFutureFund", [teen.address, U(100), horizon, "College", "Books"]);
  check("parent opens a FutureFund", r.status === 200, r.body.error);
  r = await call(parent, "contributeFutureFund", [1, U(20)]);
  check("parent contributes from their ledger balance", r.status === 200 && (await fam.fundEscrow()) === U(20), r.body.error);
  r = await call(teen, "claimFutureFund", [1]);
  check("the teen cannot claim before the target date", r.status === 422 && /not yet/.test(r.body.error), r.body.error);
  check("ledger reconciles with the fund locked", (await usdc.balanceOf(famAddr)) === (await ledgerTotal()));

  // ── Envio, authenticated reads ──
  const pb = await waitFor(async () => {
    const x = await read(parent);
    return x.status === 200 && x.body.data.missions.length >= 3 && x.body.data.funds.length === 1 && x.body.data.fundEntries.length >= 2 ? x : null;
  }, "the indexer to catch up");
  const d = pb.body.data;
  const m1 = d.missions.find((m: any) => m.id === "1");
  check("indexer: mission 1 is APPROVED with the parent's feedback kept", m1?.status === "APPROVED" && m1.feedback === "Missed the wheels");
  check("indexer: cancelled and expired missions", d.missions.find((m: any) => m.id === "2")?.status === "CANCELLED" && d.missions.find((m: any) => m.id === "3")?.status === "EXPIRED");
  const prog = d.progress.find((p: any) => p.teenFamId === "alex");
  check("Passport: exactly one completed mission and 10 USDC earned (rejected/cancelled/expired don't count)", prog?.missionsCompleted === 1 && prog.missionRewards === "10000000", JSON.stringify(prog));
  check("Weekly Brief data: this week's stats exist for the teen", d.weeks.some((w: any) => w.teenFamId === "alex" && w.missionsCompleted === 1));
  check("Passport history links every row to its source transaction", d.history.length >= 1 && d.history.every((h: any) => /^0x[0-9a-f]{64}$/.test(h.txHash)));
  check("FutureFund story is honest: confirmed, not invested", d.fundEntries.some((e: any) => /confirmed/.test(e.text) && /not been invested/.test(e.text)) && d.funds[0].funded === "20000000");

  const tb = await read(teen);
  check("the teen sees their own mission data", tb.status === 200 && tb.body.role === "TEEN" && tb.body.data.missions.length >= 3);
  check("the teen's view has no parent-only data (holds/requests)", tb.body.data.holds === undefined && tb.body.data.requests === undefined);
  const ob = await read(stranger);
  check("another family's parent sees none of this family's missions", ob.status === 200 && ob.body.data.missions.length === 0 && ob.body.data.funds.length === 0);
  const ab = await read(aunt);
  check("a relative gets no child history", ab.status === 403);

  // ── FutureFund claim after the horizon ──
  await provider.send("evm_increaseTime", [4 * 86400]);
  await provider.send("evm_mine", []);
  const tb0 = await fam.balance(teen.address);
  r = await call(teen, "claimFutureFund", [1]);
  check("the teen claims the FutureFund after the target date", r.status === 200 && (await fam.balance(teen.address)) === tb0 + U(20) && (await fam.fundEscrow()) === 0n, r.body.error);
  r = await call(teen, "claimFutureFund", [1]);
  check("it cannot be claimed twice", r.status === 422, r.body.error);
  check("final ledger reconciles", (await usdc.balanceOf(famAddr)) === (await ledgerTotal()));
  const after = await waitFor(async () => {
    const x = await read(teen);
    return x.body.data.funds[0]?.status === "RELEASED" ? x : null;
  }, "the fund release to be indexed");
  check("indexer shows the release in the money story", after.body.data.fundEntries.some((e: any) => e.kind === "RELEASED" && /claimed/.test(e.text)));

  server.close();
}

main()
  .catch((e) => { console.error("ERROR", e); failed++; })
  .finally(() => {
    console.log(failed ? `\n${failed} FAILED` : "\nall mission / passport / FutureFund checks passed");
    stop();
    setTimeout(() => process.exit(failed ? 1 : 0), 300);
  });
