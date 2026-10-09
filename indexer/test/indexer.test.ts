import { createTestIndexer } from "envio";
import assert from "node:assert/strict";
import { test } from "node:test";

const id32 = (s: string) => "0x" + Buffer.from(s).toString("hex").padEnd(64, "0");
const PARENT = "0x00000000000000000000000000000000000000a1";
const TEEN = "0x00000000000000000000000000000000000000b2";
const FRIEND = "0x00000000000000000000000000000000000000c3";
const AUNT = "0x00000000000000000000000000000000000000d4";
const SHOP = "0x00000000000000000000000000000000000000e5";
const U = (n: number) => BigInt(Math.round(n * 1e6));

test("a family story becomes plain-language timeline and live entities", async () => {
  const indexer: any = createTestIndexer();
  let block = 100;
  const ev = (event: string, params: any, extra: any = {}) => ({
    contract: "FamFi",
    event,
    params,
    block: { number: block++, timestamp: 1_800_000_000 + block * 10 },
    transaction: { hash: "0x" + block.toString(16).padStart(64, "0") },
    ...extra,
  });

  const simulate = [
    ev("FamIdRegistered", { user: PARENT, famId: id32("priya"), role: 1n }),
    ev("FamilyCreated", { familyId: 1n, parent: PARENT, tzOffset: 19800n }),
    ev("FamIdRegistered", { user: TEEN, famId: id32("alex"), role: 2n }),
    ev("TeenAdded", { teen: TEEN, famId: id32("alex"), familyId: 1n }),
    ev("FamIdRegistered", { user: FRIEND, famId: id32("riya"), role: 2n }),
    ev("TeenAdded", { teen: FRIEND, famId: id32("riya"), familyId: 1n }),
    ev("FamIdRegistered", { user: AUNT, famId: id32("aunt"), role: 3n }),
    ev("FamIdRegistered", { user: SHOP, famId: id32("canteen"), role: 4n }),
    ev("Paid", { from: TEEN, to: SHOP, amount: U(2), memo: "snack" }),
    // a held payment that the parent rejects
    ev("PaymentHeld", { id: 1n, from: TEEN, to: SHOP, amount: U(4), kind: 1n, releaseAt: 1_800_000_900n, refKind: 0n, refId: 0n, memo: "big" }),
    ev("PendingResolved", { id: 1n, outcome: 3n }),
    // a split share that is held, then rejected: the share must be undone
    ev("SplitCreated", { splitId: 1n, creator: FRIEND, perShare: U(4), slots: 3n, memo: "pizza" }),
    ev("SplitSharePaid", { splitId: 1n, payer: TEEN, paidCount: 1n }),
    ev("PaymentHeld", { id: 2n, from: TEEN, to: FRIEND, amount: U(4), kind: 1n, releaseAt: 1_800_000_900n, refKind: 1n, refId: 1n, memo: "split" }),
    ev("PendingResolved", { id: 2n, outcome: 3n }),
    // goal with a matched gift
    ev("GoalProposed", { goalId: 1n, teen: TEEN, target: U(40), deadline: 1_900_000_000n, memo: "Headphones" }),
    ev("GoalApproved", { goalId: 1n, sponsorOpen: true }),
    ev("GiftLocked", { giftId: 1n, goalId: 1n, sponsor: AUNT, amount: U(20), ratio: 1_000_000n, deadline: 1_900_000_000n }),
    ev("GiftReleased", { giftId: 1n, goalId: 1n, amount: U(10) }),
    ev("GoalSaved", { goalId: 1n, teen: TEEN, amount: U(10), saved: U(10), matched: U(10) }),
    ev("GoalSaved", { goalId: 1n, teen: TEEN, amount: U(10), saved: U(20), matched: U(10) }),
    ev("GiftReleased", { giftId: 1n, goalId: 1n, amount: U(10) }),
    ev("GoalCompleted", { goalId: 1n, total: U(40) }),
    ev("LevelUp", { teen: TEEN, newLevel: 1n }),
    ev("Frozen", { teen: TEEN }),
  ];

  await indexer.process({ chains: { 10143: { startBlock: 100, endBlock: block + 5, simulate } } });

  const teen = await indexer.User.get(TEEN);
  assert.equal(teen.famId, "alex");
  assert.equal(teen.role, "TEEN");
  assert.equal(teen.familyId, 1);
  assert.equal(teen.level, 1);
  assert.equal(teen.frozen, true);

  const pend1 = await indexer.Pending.get("1");
  assert.equal(pend1.status, "REJECTED");
  assert.equal(pend1.kind, "ANOMALY");

  // the held split share was undone when it was rejected
  const split = await indexer.Split.get("1");
  assert.equal(split.paid, 0);
  assert.equal((await indexer.SplitShare.get(`1-${TEEN}`)).active, false);

  const goal = await indexer.Goal.get("1");
  assert.equal(goal.status, "COMPLETE");
  assert.equal(goal.saved, U(20));
  assert.equal(goal.matched, U(10));
  const gift = await indexer.Gift.get("1");
  assert.equal(gift.escrow, U(0));
  assert.equal(gift.released, U(20));

  const entries = await indexer.TimelineEntry.getAll();
  const texts = entries.map((e: any) => e.text);
  console.log(texts.join("\n"));
  assert.ok(texts.includes("Alex paid Canteen 2.00 for \"snack\""));
  assert.ok(texts.some((t: string) => t.includes("on hold") && t.includes("a parent was alerted")));
  assert.ok(texts.some((t: string) => t.includes("Aunt put 20.00 behind \"Headphones\"")));
  assert.ok(texts.some((t: string) => t.includes("Alex moved up to level 2")));
  assert.ok(texts.some((t: string) => t.includes("Priya froze Alex's spending")));
  // a parent can find everything about their family by familyId
  assert.ok(entries.filter((e: any) => e.familyId === 1).length >= 8);
});
