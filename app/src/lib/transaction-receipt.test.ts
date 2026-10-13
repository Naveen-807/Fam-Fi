import assert from "node:assert/strict";
import { test } from "node:test";
import { confirmedReceipt } from "./transaction-receipt";
const hash = "0x" + "a".repeat(64);
test("success requires a successful mined receipt", async () => {
  let reads = 0;
  const receipt = await confirmedReceipt(hash, async () => ++reads === 1 ? null : { status: 1 }, 2, 0);
  assert.equal(receipt.status, 1);
});
test("failed, pending and unreadable transactions cannot report success", async () => {
  await assert.rejects(confirmedReceipt(hash, async () => ({ status: 0 }), 1, 0), /failed/);
  await assert.rejects(confirmedReceipt(hash, async () => null, 1, 0), /pending/);
  await assert.rejects(confirmedReceipt(hash, async () => { throw new Error("RPC offline"); }, 1, 0), /before repeating/);
  await assert.rejects(confirmedReceipt(hash, async () => ({ status: null }), 1, 0), /unknown/);
});
test("malformed transaction hashes are rejected before RPC reads", async () => {
  let read = false;
  await assert.rejects(confirmedReceipt("bad", async () => { read = true; return {status:1}; }), /invalid/);
  assert.equal(read, false);
});
