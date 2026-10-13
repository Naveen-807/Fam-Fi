import { test } from "node:test";
import assert from "node:assert/strict";
import { withWalletAuthRefresh } from "./wallet-auth";

test("refreshes a rejected signature once before retrying", async () => {
  let signs = 0, refreshes = 0;
  const result = await withWalletAuthRefresh(async () => {
    if (++signs === 1) throw new Error("WalletApiError: Forbidden");
    return "signature";
  }, async () => { refreshes++; });
  assert.equal(result, "signature");
  assert.equal(signs, 2);
  assert.equal(refreshes, 1);
});
test("persistent denial gives recovery instructions without looping", async () => {
  let signs = 0;
  await assert.rejects(withWalletAuthRefresh(async () => {
    signs++; throw { response: { status: 403 } };
  }, async () => {}), /same email/);
  assert.equal(signs, 2);
});
test("does not retry cancellation or other signing failures", async () => {
  let refreshes = 0;
  await assert.rejects(withWalletAuthRefresh(async () => { throw new Error("User cancelled"); }, async () => { refreshes++; }), /cancelled/);
  assert.equal(refreshes, 0);
});
