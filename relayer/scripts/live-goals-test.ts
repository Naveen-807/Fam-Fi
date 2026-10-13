import { test } from "node:test";
import assert from "node:assert/strict";
import { ethers } from "ethers";
import { liveGoalsReader } from "../src/live-goals.js";

const teen1 = "0x0000000000000000000000000000000000000001";
const teen2 = "0x0000000000000000000000000000000000000002";
function chain(status = 1, fail = false) {
  return {
    runner: { provider: { getBlockNumber: async () => 123 } },
    goalCount: async () => 2n,
    goals: async (id: string, overrides: any) => {
      assert.equal(overrides.blockTag, 123);
      if (fail) throw new Error("RPC offline");
      return { teen: id === "1" ? teen1 : teen2, target: 20_000_000n, saved: 0n, matched: 0n, deadline: 1794460785n, status, sponsorOpen: status === 2 };
    },
    accounts: async (address: string, overrides: any) => {
      assert.equal(overrides.blockTag, 123);
      return { familyId: address === teen1 ? 3n : 4n, famId: ethers.encodeBytes32String(address === teen1 ? "michael" : "other") };
    },
  } as any;
}

test("unindexed proposal appears immediately, only in its parent's family", async () => {
  const rows = await liveGoalsReader(chain())(ethers.ZeroAddress, 3, true, []);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].id, "1");
  assert.equal(rows[0].teenFamId, "michael");
  assert.equal(rows[0].status, "PROPOSED");
  assert.equal(rows[0].target, "20000000");
  assert.equal(rows[0].namePending, true);
});
test("teen reads only their own goals, even with a different family argument", async () => {
  const rows = await liveGoalsReader(chain())(teen1, 4, false, []);
  assert.deepEqual(rows.map(g => g.id), ["1"]);
});
test("chain status overrides a stale indexed proposal without duplicates", async () => {
  const rows = await liveGoalsReader(chain(2))(ethers.ZeroAddress, 3, true, [{ id: "1", memo: "Headphones", status: "PROPOSED" }]);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].status, "ACTIVE");
  assert.equal(rows[0].memo, "Headphones");
  assert.equal(rows[0].namePending, false);
});
test("failed reads and excessive scans cannot be reported as an empty verified inbox", async () => {
  await assert.rejects(liveGoalsReader(chain(1, true))(teen1, 3, false, []), /RPC offline/);
  const c = chain(); c.goalCount = async () => 501n;
  await assert.rejects(liveGoalsReader(c)(teen1, 3, false, []), /limit/);
});
