import assert from "node:assert/strict";
import { test } from "node:test";
import { ethers } from "ethers";
import { depositWalletUSDC, TOKEN_ABI, type FundingDeps } from "./wallet-funding";
import type { Signer } from "./relay";

const user = "0x0000000000000000000000000000000000000022";
const usdc = "0x0000000000000000000000000000000000000033";
const famfi = "0x0000000000000000000000000000000000000044";
const amount = 5_000_000n;
function fixture(allowance = 0n) {
  const sent: { to: string; data: string; value: bigint }[] = [];
  const stages: string[] = [];
  const signer: Signer = { address: user, kind: "dynamic", signTypedData: async () => "", sendTransaction: async (request) => {
    sent.push(request);
    return "0x" + sent.length.toString().padStart(64, "0");
  } };
  const deps: FundingDeps = { chainId: 10143, usdc, famfi,
    network: async () => 10143n, balance: async () => amount * 2n, allowance: async () => allowance,
    simulate: async () => {}, wait: async () => ({ status: 1, blockNumber: 100 }),
  };
  return { signer, deps, sent, stages, onStage: (stage: string) => { stages.push(stage); } };
}

test("funding approves the exact amount, waits, then deposits only to the signer", async () => {
  const f = fixture();
  let confirmed = 0;
  f.deps.wait = async () => { confirmed++; return { status: 1, blockNumber: 100 }; };
  const result = await depositWalletUSDC(f.signer, amount, f.deps, f.onStage);
  assert.equal(f.sent.length, 2);
  const approval = new ethers.Interface(TOKEN_ABI).parseTransaction(f.sent[0]);
  assert.equal(f.sent[0].to, usdc);
  assert.equal(approval?.args[0].toLowerCase(), famfi);
  assert.equal(approval?.args[1], amount);
  const deposit = new ethers.Interface(["function depositFor(address,uint256)"]).parseTransaction(f.sent[1]);
  assert.equal(f.sent[1].to, famfi);
  assert.equal(deposit?.args[0].toLowerCase(), user);
  assert.equal(deposit?.args[1], amount);
  assert.equal(confirmed, 2);
  assert.equal(result.blockNumber, 100);
  assert.equal(f.stages.at(-1), "confirmed");
});

test("an existing allowance skips approval", async () => {
  const f = fixture(amount);
  await depositWalletUSDC(f.signer, amount, f.deps);
  assert.equal(f.sent.length, 1);
  assert.equal(f.sent[0].to, famfi);
});
test("a wallet with no MON is stopped before any funding signature",async()=>{
  const f=fixture();f.deps.nativeBalance=async()=>0n;
  await assert.rejects(depositWalletUSDC(f.signer,amount,f.deps),/test MON/);
  assert.equal(f.sent.length,0);
});

test("failed or unconfirmed approval never proceeds to deposit", async () => {
  for (const receipt of [null, { status: 0, blockNumber: 100 }]) {
    const f = fixture();
    f.deps.wait = async () => receipt;
    await assert.rejects(depositWalletUSDC(f.signer, amount, f.deps));
    assert.equal(f.sent.length, 1);
    assert.equal(f.sent[0].to, usdc);
  }
});

test("wrong chain, insufficient balance and invalid amounts never request a signature", async () => {
  const f = fixture();
  f.deps.network = async () => 1n;
  await assert.rejects(depositWalletUSDC(f.signer, amount, f.deps), /network/);
  f.deps.network = async () => 10143n;
  f.deps.balance = async () => 0n;
  await assert.rejects(depositWalletUSDC(f.signer, amount, f.deps), /enough/);
  await assert.rejects(depositWalletUSDC(f.signer, 0n, f.deps), /greater than zero/);
  assert.equal(f.sent.length, 0);
});

test("reverted deposits are never labelled confirmed", async () => {
  const f = fixture(amount);
  f.deps.wait = async () => ({ status: 0, blockNumber: 100 });
  await assert.rejects(depositWalletUSDC(f.signer, amount, f.deps, f.onStage), /failed/);
  assert.ok(!f.stages.includes("confirmed"));
});
