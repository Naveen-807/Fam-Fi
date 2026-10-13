import { test } from "node:test";
import assert from "node:assert/strict";
import { ethers } from "ethers";
import { liveApprovalsReader } from "../src/live-approvals.js";
import { capabilitiesReader } from "../src/capabilities.js";

const parent = "0x0000000000000000000000000000000000000011", teen = "0x0000000000000000000000000000000000000012";
const other = "0x0000000000000000000000000000000000000021", otherTeen = "0x0000000000000000000000000000000000000022";
function contract(status = 1) {
  return {
    runner: { provider: { getBlockNumber: async () => 100 } },
    requestCount: async () => 2n, pendingCount: async () => 2n,
    accounts: async (address: string, opts: any) => {
      assert.equal(opts.blockTag, 100);
      return { familyId: address === parent || address === teen ? 1n : 2n, famId: ethers.encodeBytes32String(address === teen ? "alex" : address === parent ? "priya" : "other") };
    },
    requests: async (id: string) => ({ from: id === "1" ? teen : otherTeen, to: id === "1" ? parent : other, amount: 3000000n, status }),
    pendings: async (id: string) => ({ from: id === "1" ? teen : otherTeen, to: other, amount: 6000000n, status, kind: 0n, refKind: 0n, releaseAt: 900n, createdAt: 800n }),
  } as any;
}
test("parent sees only requests addressed to them and holds from their family", async () => {
  const result = await liveApprovalsReader(contract())(parent, 1, true, {});
  assert.deepEqual(result.incomingRequests.map(x => x.id), ["1"]);
  assert.deepEqual(result.holds.map(x => x.id), ["1"]);
  assert.deepEqual(result.outgoingRequests, []);
});
test("teen sees their own outgoing request and hold, not siblings or other families", async () => {
  const result = await liveApprovalsReader(contract())(teen, 1, false, {});
  assert.deepEqual(result.outgoingRequests.map(x => x.id), ["1"]);
  assert.deepEqual(result.holds.map(x => x.id), ["1"]);
  assert.deepEqual(result.incomingRequests, []);
});
test("resolved contract state removes stale indexed requests and held payments", async () => {
  const result = await liveApprovalsReader(contract(2))(parent, 1, true, { requests: [{ id: "1", status: "OPEN" }], holds: [{ id: "1", status: "OPEN" }] });
  assert.deepEqual(result.incomingRequests, []); assert.deepEqual(result.holds, []);
});
test("indexed notes remain available while amounts and status come from chain", async () => {
  const result = await liveApprovalsReader(contract())(parent, 1, true, { requests: [{ id: "1", memo: "school trip", amount: "999", createdAt: 700 }] });
  assert.equal(result.incomingRequests[0].amount, "3000000");
  assert.equal(result.incomingRequests[0].memo, "school trip");
  assert.equal(result.incomingRequests[0].createdAt, 700);
});
test("oversized scans cannot masquerade as verified empty inboxes", async () => {
  const c = contract(); c.requestCount = async () => 501n;
  await assert.rejects(liveApprovalsReader(c)(parent, 1, true, {}), /limit/);
});
test("capability detection distinguishes current contract, legacy contract, and network failure", async () => {
  assert.deepEqual(await capabilitiesReader({ missionCount: async () => 0n, fundCount: async () => 0n } as any)(), { missions: true, futureFund: true, goalDecline:false, missionReviewTimeout:false });
  const missing = async () => { throw Object.assign(new Error("missing method"), { code: "CALL_EXCEPTION" }); };
  assert.deepEqual(await capabilitiesReader({ missionCount: missing, fundCount: missing } as any)(), { missions: false, futureFund: false, goalDecline:false, missionReviewTimeout:false });
  const offline = async () => { throw Object.assign(new Error("offline"), { code: "NETWORK_ERROR" }); };
  assert.deepEqual(await capabilitiesReader({ missionCount: offline, fundCount: offline } as any)(), { missions: null, futureFund: null, goalDecline:false, missionReviewTimeout:false });
});
