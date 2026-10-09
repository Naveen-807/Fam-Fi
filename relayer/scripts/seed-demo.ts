/**
 * Creates the Judge Mode family through the real relayer: priya (parent), alex + riya (teens),
 * aunt (sponsor), canteen (shop). Safe to re-run: it skips anything that already exists.
 *
 *   FAMFI_ADDRESS=0x.. FORWARDER_ADDRESS=0x.. RELAYER_URL=http://127.0.0.1:8787 RPC_URL=... npx tsx scripts/seed-demo.ts
 */
import { ethers } from "ethers";
import { demoKey, fid, makeClient, SEED_TERMS, U } from "../src/client.js";

const need = (k: string) => { const v = process.env[k]; if (!v) throw new Error(`Missing env ${k}`); return v; };
const c = makeClient({
  rpcUrl: process.env.RPC_URL || "http://127.0.0.1:8545",
  relayerUrl: need("RELAYER_URL"),
  famfi: need("FAMFI_ADDRESS"),
  forwarder: need("FORWARDER_ADDRESS"),
});
const wallet = (name: string) => new ethers.Wallet(demoKey(name), c.provider);
const roleOf = async (w: ethers.Wallet) => Number((await c.fam.accounts(w.address)).role);
const step = (m: string) => console.log("  •", m);

async function main() {
  const [priya, alex, riya, aunt, canteen] = ["priya", "alex", "riya", "aunt", "canteen"].map(wallet);
  console.log("seeding demo family…");

  if ((await roleOf(priya)) === 0) { await c.send(priya, "register", [fid("priya"), 1]); step("priya registered"); }
  if (Number((await c.fam.accounts(priya.address)).familyId) === 0) { await c.send(priya, "createFamily", [19800]); step("family created"); }
  const familyId = Number((await c.fam.accounts(priya.address)).familyId);

  for (const [w, name] of [[alex, "alex"], [riya, "riya"]] as const) {
    if ((await roleOf(w)) !== 0) continue;
    const inviteId = ethers.id(`seed-invite-${name}-${Date.now()}`);
    const deadline = Math.floor(Date.now() / 1000) + 86400;
    const sig = await c.inviteSignature(priya, familyId, inviteId, deadline, SEED_TERMS);
    await c.send(w, "acceptInvite", [familyId, inviteId, deadline, SEED_TERMS, sig, fid(name)]);
    step(`${name} joined as a teen`);
  }
  if ((await roleOf(aunt)) === 0) { await c.send(aunt, "register", [fid("aunt"), 3]); step("aunt registered"); }
  if ((await roleOf(canteen)) === 0) { await c.send(canteen, "register", [fid("canteen"), 4]); step("canteen registered"); }

  for (const name of ["priya", "alex", "riya", "aunt"]) {
    const r = await c.post("/faucet", { famId: name });
    step(`faucet ${name}: ${r.status === 200 ? "+" + r.body.amount : r.body.error}`);
    if (r.status === 200) await c.provider.waitForTransaction(r.body.hash);
  }

  if ((await c.fam.streams(alex.address)).remaining === 0n && (await c.fam.balance(priya.address)) >= U(3)) {
    await c.send(priya, "fundStream", [alex.address, U(3), 300n]);
    step("alex's allowance stream started");
  }
  console.log("done. Judge Mode logins: priya (parent), alex (teen), riya (teen friend), aunt (relative), canteen (shop)");
}
main().catch((e) => { console.error(e); process.exit(1); });
