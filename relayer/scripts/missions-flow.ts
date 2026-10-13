/**
 * Real-stack check for missions, the Progress Passport, the Weekly Brief data and FutureFund. It starts a local
 * Hardhat chain and the dev indexer itself, deploys the contracts, and drives everything through the real
 * relayer (signed forward requests, zero-gas wallets) and the real Envio handlers. No browser, no demo data.
 *
 *   cd relayer && npx tsx scripts/missions-flow.ts
 */
import { ethers } from "ethers";
import { readFileSync, mkdtempSync, writeFileSync, symlinkSync, rmSync } from "fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawn, ChildProcess } from "node:child_process";
import { createApp } from "../src/app.js";
import { READ_SCOPE, READ_TYPES } from "../src/private.js";
import * as funding from "../../app/src/lib/wallet-funding.js";
// Next's package is CommonJS under tsx; tolerate its namespace wrapper in this ESM test runner.
const depositWalletUSDC: typeof funding.depositWalletUSDC = funding.depositWalletUSDC ?? (funding as any).default?.depositWalletUSDC;

const RPC_PORT = Number(process.env.FAMFI_TEST_RPC_PORT || 18545);
const RPC = `http://127.0.0.1:${RPC_PORT}`;
const INDEXER_PORT = Number(process.env.FAMFI_TEST_INDEXER_PORT || 18081);
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
let localIndexerProject: string | undefined;
// children run in their own process groups so npx's grandchildren (hardhat, tsx) are stopped too
const stop = () => {
  children.forEach((c) => { try { process.kill(-c.pid!, "SIGTERM"); } catch { /* already gone */ } });
  if (localIndexerProject) rmSync(localIndexerProject, { recursive: true, force: true });
};
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
  const node = spawn("npx", ["hardhat", "node", "--port", String(RPC_PORT)], { cwd: root + "contracts", stdio: ["ignore", "ignore", "inherit"], detached: true });
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

  // A local chain starts at zero, unlike the deployed Monad chain. Use an isolated config;
  // never rewrite production start_block or fabricate block numbers to satisfy TestIndexer.
  localIndexerProject = mkdtempSync(join(tmpdir(), "famfi-envio-flow-"));
  const localConfig = readFileSync(root + "indexer/config.yaml", "utf8")
    .replace(/start_block:\s*\d+/, "start_block: 0")
    .replace(/abi_file_path:\s*[^\n]+/, `abi_file_path: "${root}abi/FamFi.json"`);
  writeFileSync(join(localIndexerProject, "config.yaml"), localConfig);
  for (const file of ["schema.graphql", "src", "node_modules", "package.json"])
    symlinkSync(root + "indexer/" + file, join(localIndexerProject, file));
  const indexer = spawn(root + "indexer/node_modules/.bin/tsx", [root + "indexer/dev-server.ts"], {
    cwd: localIndexerProject,
    env: { ...process.env, ENVIO_FAMFI_ADDRESS: famAddr, FAMFI_ADDRESS: famAddr, RPC_URL: RPC, START_BLOCK: "0", PORT: String(INDEXER_PORT), POLL_MS: "500" },
    stdio: "ignore",
    detached: true,
  });
  children.push(indexer);
  await waitFor(async () => (await fetch(`http://127.0.0.1:${INDEXER_PORT}/healthz`)).ok, "dev indexer");

  const { app, ensureTreasuryAllowance } = createApp({
    rpcUrl: RPC, relayerKey: deployerKey, treasuryKey, famfi: famAddr, forwarder: await fwd.getAddress(), usdc: await usdc.getAddress(),
    allowedOrigin: "*", faucetAmount: U(100), faucetCooldownMs: 60000, maxGas: 3_000_000n, ratePerMinute: 1000, faucetStatePath: null,
    envioUrl: `http://127.0.0.1:${INDEXER_PORT}/v1/graphql`, rosterStatePath: null,
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
    const block = await provider.send("eth_getBlockByNumber", ["latest", false]);
    const deadline = parseInt(block.timestamp, 16) + 3600; // bypass cached blocks after time travel
    const msg = { from: user.address, to: famAddr, value: 0n, gas: 900000n, nonce, deadline, data };
    const signature = await user.signTypedData(fdomain, FTYPES, msg);
    const r = await post("/relay", { request: { from: msg.from, to: msg.to, value: "0", gas: msg.gas.toString(), deadline, data, signature } });
    if (r.status === 200) await waitTx(r.body.hash);
    return r;
  };
  const read = async (user: ethers.BaseWallet) => {
    const expiry = Math.floor(Date.now() / 1000) + 600;
    const signature = await user.signTypedData({ name: "FamFiRead", version: "1", chainId: net.chainId, verifyingContract: famAddr }, READ_TYPES, { reader: user.address, expiry: BigInt(expiry), scope: READ_SCOPE });
    return post("/private/query", { auth: { reader: user.address, expiry, signature } });
  };
  const fresh = () => ethers.Wallet.createRandom().connect(provider);
  const parent = fresh(), teen = fresh(), aunt = fresh(), stranger = fresh(), prototypeUser = fresh();
  const ledgerTotal = async () => {
    let sum = (await fam.missionEscrow()) + (await fam.fundEscrow());
    for (const w of [parent, teen, aunt, stranger, prototypeUser]) sum += await fam.balance(w.address) + (await fam.streams(w.address)).remaining;
    for (let i = 1; i <= Number(await fam.pendingCount()); i++) { const p = await fam.pendings(i); if (Number(p.status) === 1) sum += p.amount; }
    for (let i = 1; i <= Number(await fam.giftCount()); i++) sum += (await fam.gifts(i)).escrow;
    for (let i = 1; i <= Number(await fam.goalCount()); i++) { const g = await fam.goals(i); if (Number(g.status) === 2 || Number(g.status) === 3) sum += g.saved + g.matched; }
    return sum;
  };

  // ── setup: everything through the relayer with zero-gas wallets ──
  let r = await call(parent, "register", [fid("priya"), 1]);
  await call(parent, "createFamily", [19800]);
  await call(aunt, "register", [fid("aunt"), 3]);
  await call(prototypeUser, "register", [fid("constructor"), 3]);
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
  const joined = await waitFor(async () => { const x = await read(parent); return x.body.data.teens?.some((t: any) => t.id === teen.address.toLowerCase()) ? x : null; }, "joined teen on parent dashboard");
  check("parent roster includes the joined teen with verified family membership", joined.body.data.teens.length === 1 && joined.body.data.teens[0].famId === "alex");
  const concurrentTopups = await Promise.all([post("/faucet", { famId: "priya" }), post("/faucet", { famId: "priya" })]);
  check("simultaneous faucet requests broadcast only one top-up", concurrentTopups.filter(x => x.status === 200).length === 1 && concurrentTopups.filter(x => x.status === 429).length === 1);
  const topup = concurrentTopups.find(x => x.status === 200);
  if (!topup) throw new Error("Concurrent faucet test produced no successful top-up");
  await waitTx(topup.body.hash);
  check("duplicate faucet requests credit exactly one amount", await fam.balance(parent.address) === U(100));
  const teenTopup = await post("/faucet", { famId: "alex" }); await waitTx(teenTopup.body.hash);
  const prototypeTopups = await Promise.all([post("/faucet", { famId: "constructor" }), post("/faucet", { famId: "constructor" })]);
  check("prototype-named Fam-IDs cannot bypass faucet reservations", prototypeTopups.filter(x => x.status === 200).length === 1 && prototypeTopups.filter(x => x.status === 429).length === 1);
  const prototypeTopup = prototypeTopups.find(x => x.status === 200);
  if (!prototypeTopup) throw new Error("Prototype-named faucet test produced no top-up");
  await waitTx(prototypeTopup.body.hash);
  check("prototype-named top-up credits exactly one amount", await fam.balance(prototypeUser.address) === U(100));

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
  check("family commitments are scoped exact values rather than contract-wide recent-history estimates", pb.body.commitments?.missions === "0" && pb.body.commitments?.futureFunds === String(U(20)));
  check("family identity resolves the linked parent", pb.body.identities?.parent.id === parent.address.toLowerCase());
  check("Passport exposes first approved mission evidence", d.achievements?.some((a:any)=>a.kind === "MISSION_APPROVED" && a.teen === teen.address.toLowerCase() && /^0x[0-9a-f]{64}$/.test(a.txHash)));
  check("family activity comes through the authenticated gateway", d.timeline?.some((entry:any)=>entry.kind === "mission_approved"));
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
  check("teen achievements are scoped to the signed-in teen", tb.body.data.achievements?.every((a:any)=>a.teen === teen.address.toLowerCase()));
  const ob = await read(stranger);
  check("another family's parent sees none of this family's missions", ob.status === 200 && ob.body.data.missions.length === 0 && ob.body.data.funds.length === 0);
  check("another family's commitments exclude this family's future savings", ob.body.commitments?.futureFunds === "0");
  const ab = await read(aunt);
  check("a relative gets no child history", ab.status === 403);

  // Exercise the wallet-funding adapter against real local contracts. This is not a Dynamic service test.
  // The deployer is also this test's relayer. Use a separate unlocked local account so nonce ownership stays separate.
  const funder = await provider.getSigner(3);
  await waitTx((await funder.sendTransaction({ to: parent.address, value: ethers.parseEther("1") })).hash);
  await waitTx((await usdc.connect(funder).mint(parent.address, U(3))).hash);
  const directParent = new ethers.NonceManager(parent);
  const beforeDeposit = await fam.balance(parent.address);
  const deposited = await depositWalletUSDC({
    address: parent.address, kind: "dynamic",
    signTypedData: (...args) => parent.signTypedData(args[0], args[1], args[2]),
    sendTransaction: async (request) => (await directParent.sendTransaction(request)).hash,
  }, U(3), {
    chainId: Number(net.chainId), usdc: await usdc.getAddress(), famfi: famAddr,
    network: async () => (await provider.getNetwork()).chainId,
    balance: (a) => usdc.balanceOf(a), allowance: (a, spender) => usdc.allowance(a, spender),
    simulate: (request) => provider.estimateGas(request), wait: waitTx,
  });
  check("wallet funding: exact approved tokens arrive in the parent's own ledger", (await fam.balance(parent.address)) === beforeDeposit + U(3) && (await usdc.allowance(parent.address, famAddr)) === 0n);
  check("wallet funding preserves the ledger invariant", (await usdc.balanceOf(famAddr)) === (await ledgerTotal()), deposited.hash);

  // One real transaction produces reward -> saving -> match -> completion, then Envio reconstructs the receipt.
  const goalDeadline = Number((await provider.getBlock("latest"))!.timestamp) + 86400;
  const af = await post("/faucet", { famId: "aunt" }); await waitTx(af.body.hash);
  await call(teen, "proposeGoal", [U(10), goalDeadline, 5000, "Bike"]);
  await call(parent, "approveGoal", [1, true]);
  await call(aunt, "lockMatch", [1, U(5), U(1), goalDeadline]);
  await call(parent, "createMission", [teen.address, U(5), goalDeadline, 1, "Help in the garden", ""]);
  await call(teen, "submitMission", [4]);
  const approval = await call(parent, "approveMission", [4]);
  check("mission approval saves and matches in one transaction", approval.status === 200 && (await fam.goals(1)).saved === U(5) && (await fam.goals(1)).matched === U(5));
  const story = await waitFor(async () => {
    const x = await read(teen);
    return x.status === 200 && x.body.data.savingReceipts?.some((receipt: any) => receipt.txHash === approval.body.hash && receipt.source === "MISSION") ? x : null;
  }, "the mission-saving receipt to be indexed");
  const receipt = story.body.data.savingReceipts.find((r: any) => r.txHash === approval.body.hash);
  check("Envio receipt: 5 earned/saved + 5 matched = 10, linked to the mission", receipt.ownAmount === "5000000" && receipt.matchedAmount === "5000000" && receipt.totalAfter === "10000000" && receipt.missionId === "4");
  check("Envio receipt: matching has a named contributor and the same transaction proof", story.body.data.matchReleases.some((r: any) => r.receiptId === receipt.id && r.sponsorFamId === "aunt" && r.txHash === approval.body.hash));
  check("ledger reconciles after mission saving and matching", (await usdc.balanceOf(famAddr)) === (await ledgerTotal()));

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

  // ── Parent/teen interaction matrix, through signed relays and authenticated reads ──
  check("the teen is linked to the intended parent on-chain", await fam.familyParent((await fam.accounts(teen.address)).familyId) === parent.address);
  const bp = await fam.balance(parent.address);
  r = await call(parent, "fundStream", [teen.address, U(10), U(1)]);
  check("parent earmarks allowance and the teen sees its rate", r.status === 200 && (await fam.balance(parent.address)) === bp - U(10) && (await fam.streams(teen.address)).rate === U(1), r.body.error);
  r = await call(stranger, "fundStream", [teen.address, U(1), U(1)]);
  check("a different parent cannot fund or change this teen's allowance", r.status === 422);
  await provider.send("evm_increaseTime", [15]); await provider.send("evm_mine", []);
  check("allowance accrual is capped at the reserved budget", await fam.accrued(teen.address) === U(10));
  r = await call(parent, "setLimits", [teen.address, TERMS.levelLimits, U(3), U(2), 600, false]);
  check("parent changes rules and teen contract view receives them", r.status === 200 && (await fam.getTeenCfg(teen.address)).levelLimits[0] === U(5));
  await call(parent, "freeze", [teen.address]);
  r = await call(teen, "pay", [fid("otherparent"), U(1), "frozen attempt"]);
  check("freeze reaches teen state and prevents payment", (await fam.getTeenCfg(teen.address)).frozen && r.status === 422 && /frozen/.test(r.body.error));
  r = await call(stranger, "unfreeze", [teen.address]);
  check("a different parent cannot unfreeze the teen", r.status === 422);
  await call(parent, "unfreeze", [teen.address]);
  const bt = await fam.spendable(teen.address), bs = await fam.balance(stranger.address);
  r = await call(teen, "pay", [fid("otherparent"), U(1), "snack"]);
  check("unfreeze allows an ordinary payment and settles earned allowance", r.status === 200 && await fam.balance(stranger.address) === bs + U(1) && await fam.balance(teen.address) === bt - U(1));
  check("ledger reconciles including unused streams and held money", await usdc.balanceOf(famAddr) === await ledgerTotal());

  r = await call(teen, "createRequest", [fid("priya"), U(3), "school trip"]);
  const requestId = await fam.requestCount();
  const requested = await waitFor(async () => {
    const p = await read(parent), t = await read(teen);
    return p.body.data.requests?.some((x: any) => x.id === String(requestId)) && t.body.data.outgoingRequests?.some((x: any) => x.id === String(requestId)) ? p : null;
  }, "both sides of the money request");
  check("money request reaches the linked parent's inbox and teen's pending list", r.status === 200 && requested.body.liveApprovals === "verified");
  const otherInbox = await read(stranger);
  check("an unrelated parent's inbox does not contain that request", !otherInbox.body.data.requests.some((x: any) => x.id === String(requestId)));
  r = await call(stranger, "payRequest", [requestId]);
  check("only the requested parent can pay the request", r.status === 422);
  const reqP = await fam.balance(parent.address), reqT = await fam.balance(teen.address);
  r = await call(parent, "payRequest", [requestId]);
  check("accepting the request transfers exactly once from parent to teen", r.status === 200 && await fam.balance(parent.address) === reqP - U(3) && await fam.balance(teen.address) === reqT + U(3));
  r = await call(parent, "payRequest", [requestId]);
  check("duplicate request acceptance cannot transfer again", r.status === 422);
  await waitFor(async () => {
    const p = await read(parent), t = await read(teen);
    return !p.body.data.requests.some((x: any) => x.id === String(requestId)) && !t.body.data.outgoingRequests.some((x: any) => x.id === String(requestId));
  }, "paid request removed from both pending lists");
  check("paid request disappears on both dashboards", true);

  const hold = async () => { const before = await fam.pendingCount(); const x = await call(teen, "pay", [fid("otherparent"), U(12), "over limit"]); const id = await fam.pendingCount(); if (x.status !== 200 || id !== before + 1n) throw new Error("Expected an over-limit hold: " + JSON.stringify(x)); return id; };
  let heldId = await hold();
  const heldP = await waitFor(async () => { const x = await read(parent); return x.body.data.holds?.some((h: any) => h.id === String(heldId)) ? x : null; }, "held payment in parent inbox");
  const heldT = await waitFor(async () => { const x = await read(teen); return x.body.data.teenHolds?.some((h: any) => h.id === String(heldId)) ? x : null; }, "held payment on teen dashboard");
  check("over-limit payment is visible on both sides, with money reserved", heldP.body.liveApprovals === "verified" && heldT.body.liveApprovals === "verified" && (await fam.pendings(heldId)).kind === 0n);
  r = await call(teen, "finalizePending", [heldId]);
  check("teen cannot bypass parent approval of an over-limit payment", r.status === 422);
  r = await call(stranger, "approvePending", [heldId]);
  check("another parent cannot approve a held payment", r.status === 422);
  const heldBalance = await fam.balance(teen.address);
  r = await call(parent, "rejectPending", [heldId]);
  check("parent rejection returns the held money to the teen", r.status === 200 && await fam.balance(teen.address) === heldBalance + U(12));
  heldId = await hold();
  r = await call(teen, "cancelPending", [heldId]);
  check("teen cancellation returns money without asking the parent", r.status === 200 && (await fam.pendings(heldId)).status === 4n);
  heldId = await hold(); const recipientBefore = await fam.balance(stranger.address);
  r = await call(parent, "approvePending", [heldId]);
  check("parent approval pays the held recipient exactly once", r.status === 200 && await fam.balance(stranger.address) === recipientBefore + U(12));
  r = await call(parent, "approvePending", [heldId]);
  check("duplicate held-payment approval cannot pay twice", r.status === 422);
  check("all parent/teen transfers reconcile with tokens in custody", await usdc.balanceOf(famAddr) === await ledgerTotal());

  const goalNow = Number((await provider.getBlock("latest"))!.timestamp);
  await call(teen, "proposeGoal", [U(4), goalNow + 86400, 2500, "New headphones"]);
  const newGoal = await fam.goalCount();
  const goalInbox = await waitFor(async () => { const x = await read(parent); return x.body.data.goals.some((g: any) => g.id === String(newGoal) && g.status === "PROPOSED") ? x : null; }, "new savings goal in parent inbox");
  check("proposed goal reaches linked parent with verified chain state", goalInbox.body.liveGoals === "verified");
  r = await call(stranger, "approveGoal", [newGoal, true]);
  check("wrong family cannot approve the teen's goal", r.status === 422);
  await call(parent, "approveGoal", [newGoal, false]);
  const activeGoal = await waitFor(async () => { const x = await read(teen); return x.body.data.goals.some((g: any) => g.id === String(newGoal) && g.status === "ACTIVE") ? x : null; }, "approved goal on teen dashboard");
  check("parent approval unlocks teen saving without opening gifts", activeGoal.body.data.goals.find((g: any) => g.id === String(newGoal)).sponsorOpen === false);
  const beforeSaving = await fam.balance(teen.address);
  await call(teen, "saveToGoal", [newGoal, U(4)]);
  check("saving completes the goal and leaves the teen's spendable balance", (await fam.goals(newGoal)).status === 3n && await fam.balance(teen.address) === beforeSaving - U(4));
  const beforeShop = await fam.balance(stranger.address);
  await call(teen, "payFromGoal", [newGoal, fid("otherparent")]);
  check("completed goal can be spent once and then closes", (await fam.goals(newGoal)).status === 4n && await fam.balance(stranger.address) === beforeShop + U(4));
  r = await call(teen, "payFromGoal", [newGoal, fid("otherparent")]);
  check("closed goal cannot be spent twice", r.status === 422);
  check("final full-flow custody reconciliation", await usdc.balanceOf(famAddr) === await ledgerTotal());
  const closeDeadline = Number((await provider.getBlock("latest"))!.timestamp) + 60;
  await call(teen, "proposeGoal", [U(5), closeDeadline, 2500, "Overdue goal"]);
  const overdue = await fam.goalCount();
  await call(parent, "approveGoal", [overdue, false]);
  await call(teen, "saveToGoal", [overdue, U(2)]);
  r = await call(teen, "closeGoal", [overdue]);
  check("a goal cannot be closed for a refund before its deadline", r.status === 422);
  await provider.send("evm_increaseTime", [90]); await provider.send("evm_mine", []);
  r = await call(parent, "closeGoal", [overdue]);
  check("only the teen can recover their overdue goal's savings", r.status === 422);
  const closingBalance = await fam.balance(teen.address);
  r = await call(teen, "closeGoal", [overdue]);
  check("closing an overdue goal returns savings and closes it", r.status === 200 && await fam.balance(teen.address) === closingBalance + U(2) && (await fam.goals(overdue)).status === 4n);
  check("custody reconciles after recovering an overdue goal", await usdc.balanceOf(famAddr) === await ledgerTotal());

  server.close();
}

main()
  .catch((e) => { console.error("ERROR", e); failed++; })
  .finally(() => {
    console.log(failed ? `\n${failed} FAILED` : "\nall mission / passport / FutureFund checks passed");
    stop();
    setTimeout(() => process.exit(failed ? 1 : 0), 300);
  });
