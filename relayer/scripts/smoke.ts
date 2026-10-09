/**
 * End-to-end smoke test on a LOCAL chain (run `npx hardhat node` in /contracts first).
 * Brand-new wallets with zero ETH talk to the contract only through the relayer, proving the flow is gasless.
 */
import { ethers } from "ethers";
import { readFileSync } from "fs";
import { createApp } from "../src/app.js";

const RPC = process.env.SMOKE_RPC || "http://127.0.0.1:8545";
const art = (p: string) => JSON.parse(readFileSync(new URL(`../../contracts/artifacts/src/${p}`, import.meta.url), "utf8"));
const U = (n: number) => BigInt(Math.round(n * 1e6));
const fid = (s: string) => ethers.encodeBytes32String(s);

let failed = 0;
const check = (name: string, ok: boolean, extra = "") => {
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${extra ? "  " + extra : ""}`);
  if (!ok) failed++;
};

async function main() {
  const provider = new ethers.JsonRpcProvider(RPC);
  // well-known hardhat dev keys #0 and #1 (local node only)
  const deployer = new ethers.Wallet("0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80", provider);
  const treasuryKey = "0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d";

  const deploy = async (a: any, ...args: any[]) => {
    const c = await new ethers.ContractFactory(a.abi, a.bytecode, deployer).deploy(...args);
    await c.waitForDeployment();
    return c;
  };
  const usdc: any = await deploy(art("mocks/MockUSDC.sol/MockUSDC.json"));
  const fwd: any = await deploy(art("FamFiForwarder.sol/FamFiForwarder.json"));
  const fam: any = await deploy(art("FamFi.sol/FamFi.json"), await usdc.getAddress(), await fwd.getAddress());
  const treasuryAddr = new ethers.Wallet(treasuryKey).address;
  await (await usdc.mint(treasuryAddr, U(1000))).wait();

  const { app, ensureTreasuryAllowance } = createApp({
    rpcUrl: RPC,
    relayerKey: "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80",
    treasuryKey,
    famfi: await fam.getAddress(),
    forwarder: await fwd.getAddress(),
    usdc: await usdc.getAddress(),
    allowedOrigin: "*",
    faucetAmount: U(5),
    faucetCooldownMs: 3600_000,
    maxGas: 1_000_000n,
    ratePerMinute: 100,
    faucetStatePath: null,
  });
  await ensureTreasuryAllowance();
  const server = app.listen(0);
  const base = `http://127.0.0.1:${(server.address() as any).port}`;
  const post = async (path: string, body: any) => {
    const r = await fetch(base + path, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
    return { status: r.status, body: (await r.json()) as any };
  };

  const net = await provider.getNetwork();
  const domain = { name: "FamFiForwarder", version: "1", chainId: net.chainId, verifyingContract: await fwd.getAddress() };
  const types = {
    ForwardRequest: [
      { name: "from", type: "address" }, { name: "to", type: "address" }, { name: "value", type: "uint256" },
      { name: "gas", type: "uint256" }, { name: "nonce", type: "uint256" }, { name: "deadline", type: "uint48" },
      { name: "data", type: "bytes" },
    ],
  };
  const sign = async (user: ethers.BaseWallet, to: string, data: string, over: any = {}) => {
    const nonce = await fwd.nonces(user.address);
    const deadline = Math.floor(Date.now() / 1000) + 3600;
    const msg = { from: user.address, to, value: 0n, gas: 600000n, nonce, deadline, data, ...over };
    const signature = await user.signTypedData(domain, types, msg);
    return { from: msg.from, to: msg.to, value: "0", gas: msg.gas.toString(), deadline, data, signature };
  };
  const famAddr = await fam.getAddress();
  const call = async (user: ethers.BaseWallet, fn: string, args: any[]) => {
    const data = fam.interface.encodeFunctionData(fn, args);
    const r = await post("/relay", { request: await sign(user, famAddr, data) });
    if (r.status === 200) await provider.waitForTransaction(r.body.hash);
    return r;
  };

  // three people, each with a brand-new wallet that holds NO gas token
  const parent = ethers.Wallet.createRandom().connect(provider);
  const teen = ethers.Wallet.createRandom().connect(provider);
  const aunt = ethers.Wallet.createRandom().connect(provider);
  const shop = ethers.Wallet.createRandom().connect(provider);
  check("users start with 0 gas token", (await provider.getBalance(parent.address)) === 0n && (await provider.getBalance(teen.address)) === 0n);

  const health = await (await fetch(base + "/health")).json() as any;
  check("health endpoint", health.ok === true && health.chainId === Number(net.chainId), `treasury usdc=${health.treasury?.usdc}`);

  // sign-up, all relayed
  let r = await call(parent, "register", [fid("priya"), 1]);
  check("parent registers (relayed)", r.status === 200, r.body.error);
  r = await call(parent, "createFamily", [19800]);
  check("parent creates family (relayed)", r.status === 200, r.body.error);
  r = await call(aunt, "register", [fid("aunt"), 3]);
  check("sponsor registers", r.status === 200, r.body.error);
  r = await call(shop, "register", [fid("canteen"), 4]);
  check("merchant registers", r.status === 200, r.body.error);

  const inviteId = ethers.id("smoke-invite");
  const inviteDeadline = Math.floor(Date.now() / 1000) + 86400;
  const inviteSig = await parent.signTypedData(
    { name: "FamFi", version: "1", chainId: net.chainId, verifyingContract: famAddr },
    { Invite: [{ name: "familyId", type: "uint32" }, { name: "inviteId", type: "bytes32" }, { name: "deadline", type: "uint256" }] },
    { familyId: 1, inviteId, deadline: inviteDeadline },
  );
  r = await call(teen, "acceptInvite", [1, inviteId, inviteDeadline, inviteSig, fid("alex")]);
  check("teen joins with parent invite (relayed)", r.status === 200, r.body.error);

  // faucet: treasury credits ledger balances
  r = await post("/faucet", { famId: "priya" });
  check("faucet credits parent", r.status === 200, r.body.error);
  await provider.waitForTransaction(r.body.hash);
  check("parent ledger = 5 USDC", (await fam.balance(parent.address)) === U(5));
  r = await post("/faucet", { famId: "priya" });
  check("faucet cooldown enforced", r.status === 429, r.body.error);
  r = await post("/faucet", { famId: "nobody" });
  check("faucet rejects unknown fam-id", r.status === 404);
  await post("/faucet", { famId: "alex" }).then((x) => provider.waitForTransaction(x.body.hash));

  // allowance stream, then a payment, all gasless
  r = await call(parent, "fundStream", [teen.address, U(4), 100000n]);
  check("parent funds the allowance stream", r.status === 200, r.body.error);

  // new teen, first 24h: a 2.5 payment is flagged (cap is 2) and held
  r = await call(teen, "pay", [fid("canteen"), U(2.5), "snack"]);
  check("teen payment accepted by relayer", r.status === 200, r.body.error);
  check("payment was held (first-24h cap)", (await fam.pendingCount()) === 1n);
  r = await call(parent, "approvePending", [1]);
  check("parent approves the hold", r.status === 200, r.body.error);
  check("shop received 2.5 USDC", (await fam.balance(shop.address)) === U(2.5));

  // a small payment goes straight through
  r = await call(teen, "pay", [fid("canteen"), U(1), "gum"]);
  check("small payment settles instantly", r.status === 200 && (await fam.balance(shop.address)) === U(3.5), r.body.error);

  // freeze: relayer must return a readable reason and not waste gas
  await call(parent, "freeze", [teen.address]);
  r = await call(teen, "pay", [fid("canteen"), U(1), "blocked"]);
  check("frozen teen gets a readable error", r.status === 422 && r.body.error === "frozen", JSON.stringify(r.body));

  // guard rails
  const data = fam.interface.encodeFunctionData("depositFor", [teen.address, 1n]);
  r = await post("/relay", { request: await sign(teen, famAddr, data) });
  check("depositFor is not relayable", r.status === 400, r.body.error);
  r = await post("/relay", { request: await sign(teen, shop.address, "0x12345678") });
  check("wrong target rejected", r.status === 400, r.body.error);
  const good = await sign(parent, famAddr, fam.interface.encodeFunctionData("unfreeze", [teen.address]));
  await post("/relay", { request: good }).then((x) => provider.waitForTransaction(x.body.hash));
  r = await post("/relay", { request: good });
  check("replayed request rejected", r.status === 400, r.body.error);
  r = await post("/relay", { request: { ...good, signature: good.signature.slice(0, -4) + "0000" } });
  check("bad signature rejected", r.status >= 400, r.body.error);

  // money conservation
  const sum = [parent, teen, aunt, shop].reduce(async (acc, w) => (await acc) + (await fam.balance(w.address)), Promise.resolve(0n));
  const streams = (await fam.streams(teen.address)).remaining;
  const pend = (await fam.pendings(1)).status === 1n ? (await fam.pendings(1)).amount : 0n;
  check("contract USDC == ledger + streams + holds", (await usdc.balanceOf(famAddr)) === (await sum) + streams + pend);

  // still no gas token spent by any user
  check("users never held or spent gas", (await provider.getBalance(parent.address)) === 0n && (await provider.getBalance(teen.address)) === 0n);

  server.close();
  console.log(failed === 0 ? "\nALL SMOKE CHECKS PASSED" : `\n${failed} CHECK(S) FAILED`);
  process.exit(failed === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
