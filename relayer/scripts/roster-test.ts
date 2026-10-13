import { test } from "node:test";
import assert from "node:assert/strict";
import { ethers } from "ethers";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { confirmedTeenStore, familyRosterReader } from "../src/roster.js";

const teen = "0x0000000000000000000000000000000000000012", sibling = "0x0000000000000000000000000000000000000013";
const parent = "0x0000000000000000000000000000000000000011", stranger = "0x0000000000000000000000000000000000000022";
test("roster hints cannot add a different family's teen or a parent", async () => {
  const chain = {
    accounts: async (a: string) => ({ role: a === parent ? 1 : 2, familyId: a === stranger ? 2 : 1, famId: ethers.encodeBytes32String(a === teen ? "alex" : "other") }),
    getTeenCfg: async () => ({ level: 1n, frozen: true }),
  } as any;
  const rows = await familyRosterReader(chain)(1, [teen, teen, parent, stranger, "bad address", sibling]);
  assert.deepEqual(rows.map(r => r.id), [teen, sibling]);
  assert.equal(rows[0].famId, "alex"); assert.equal(rows[0].frozen, true);
});
test("only a successful TeenAdded log from this contract persists across restart", () => {
  const temp = mkdtempSync(join(tmpdir(), "famfi-roster-"));
  try {
    const iface = new ethers.Interface(["event TeenAdded(address indexed teen,bytes32 indexed famId,uint32 indexed familyId)"]);
    const target = "0x00000000000000000000000000000000000000aa";
    const chain = { target, interface: iface } as any;
    const event = iface.encodeEventLog(iface.getEvent("TeenAdded")!, [teen, ethers.encodeBytes32String("alex"), 1]);
    const receipt = { status: 1, hash: ethers.id("join"), blockNumber: 10, logs: [{ address: target, ...event }] } as any;
    const path = join(temp, "teens.json"), store = confirmedTeenStore(chain, path);
    store.record({ ...receipt, status: 0 }); assert.deepEqual(store.addresses(), []);
    store.record({ ...receipt, logs: [{ address: stranger, ...event }] }); assert.deepEqual(store.addresses(), []);
    store.record(receipt); store.record(receipt);
    assert.deepEqual(confirmedTeenStore(chain, path).addresses(), [teen]);
    assert.deepEqual(confirmedTeenStore({ ...chain, target: stranger }, path).addresses(), []);
  } finally { rmSync(temp, { recursive: true, force: true }); }
});
