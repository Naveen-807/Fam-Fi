import { createTestIndexer } from "envio";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const CONFIG_START = Number(/start_block:\s*(\d+)/.exec(readFileSync(new URL("../config.yaml", import.meta.url), "utf8"))?.[1] ?? 0);
const START = Math.max(100, CONFIG_START);
const id32 = (s: string) => "0x" + Buffer.from(s).toString("hex").padEnd(64, "0");
const PARENT = "0x00000000000000000000000000000000000000a1";
const TEEN = "0x00000000000000000000000000000000000000b2";
const SHOP = "0x00000000000000000000000000000000000000e5";
const U = (n: number) => BigInt(Math.round(n * 1e6));
const IST = 19800n;
// Sunday 2027-01-03 20:00 UTC is Monday 01:30 in IST, so it already belongs to the NEXT local week.
const SUN_EVENING_UTC = 1799006400;
const WED_UTC = 1799236800;

/** A tiny builder: each call is one event in its own transaction, in order. */
function story(baseTs: number) {
  let n = START;
  const events: any[] = [];
  const ev = (event: string, params: any, at = baseTs + (n - START) * 60, logIndex = 0) => {
    const e = {
      contract: "FamFi", event, params, logIndex,
      block: { number: n, timestamp: at },
      transaction: { hash: "0x" + (n++).toString(16).padStart(64, "0") },
    };
    events.push(e);
    return e;
  };
  return { ev, events, end: () => n + 5 };
}

function setup(s: ReturnType<typeof story>) {
  s.ev("FamIdRegistered", { user: PARENT, famId: id32("priya"), role: 1n });
  s.ev("FamilyCreated", { familyId: 1n, parent: PARENT, tzOffset: IST });
  s.ev("FamIdRegistered", { user: TEEN, famId: id32("alex"), role: 2n });
  s.ev("TeenAdded", { teen: TEEN, famId: id32("alex"), familyId: 1n });
  s.ev("FamIdRegistered", { user: SHOP, famId: id32("canteen"), role: 4n });
}

const created = (id: bigint, reward: number, title = "Wash the car") => ({
  missionId: id, parent: PARENT, teen: TEEN, reward: U(reward), deadline: 1_900_000_000n, goalId: 0n, title, description: "",
});

test("mission lifecycle: reject keeps it open, approval counts once, other endings never count", async () => {
  const indexer: any = createTestIndexer();
  const s = story(WED_UTC);
  setup(s);
  s.ev("MissionCreated", created(1n, 10));
  s.ev("MissionSubmitted", { missionId: 1n, teen: TEEN });
  s.ev("MissionRejected", { missionId: 1n, teen: TEEN, feedback: "Missed the wheels" });
  s.ev("MissionSubmitted", { missionId: 1n, teen: TEEN });
  s.ev("MissionApproved", { missionId: 1n, teen: TEEN, reward: U(10), savedToGoal: false });
  // a second mission that is rejected and then runs out of time; a third that is cancelled
  s.ev("MissionCreated", created(2n, 7, "Clean the garage"));
  s.ev("MissionSubmitted", { missionId: 2n, teen: TEEN });
  s.ev("MissionRejected", { missionId: 2n, teen: TEEN, feedback: "Not done" });
  s.ev("MissionExpired", { missionId: 2n, refunded: U(7) });
  s.ev("MissionCreated", created(3n, 4, "Mow the lawn"));
  s.ev("MissionCancelled", { missionId: 3n, refunded: U(4) });
  // out-of-order / replayed transitions on a finished mission are ignored
  s.ev("MissionSubmitted", { missionId: 1n, teen: TEEN });
  s.ev("MissionCancelled", { missionId: 1n, refunded: U(10) });

  await indexer.process({ chains: { 10143: { startBlock: START, endBlock: s.end(), simulate: s.events } } });

  const m1 = await indexer.Mission.get("1");
  assert.equal(m1.status, "APPROVED");
  assert.equal(m1.feedback, "Missed the wheels");
  assert.equal(m1.teenFamId, "alex");
  assert.equal(m1.familyId, 1);
  assert.equal(m1.reward, U(10));
  assert.ok(m1.resolvedAt > 0 && m1.submittedAt > 0);
  assert.equal((await indexer.Mission.get("2")).status, "EXPIRED");
  assert.equal((await indexer.Mission.get("3")).status, "CANCELLED");

  const p = await indexer.TeenProgress.get(TEEN);
  assert.equal(p.missionsCompleted, 1); // only the approved mission
  assert.equal(p.missionRewards, U(10));
  assert.equal(p.lastEventBlock > 0, true);

  const history = (await indexer.ProgressEvent.getAll()).filter((e: any) => e.kind === "MISSION_APPROVED");
  assert.equal(history.length, 1);
  assert.match(history[0].txHash, /^0x[0-9a-f]{64}$/); // every row links back to its source transaction

  const texts = (await indexer.TimelineEntry.getAll()).map((e: any) => e.text);
  assert.ok(texts.some((t: string) => t.includes("Priya sent \"Wash the car\" back") && t.includes("Missed the wheels")));
  assert.ok(texts.some((t: string) => t.includes("approved \"Wash the car\"")));
});

test("a replayed event cannot count twice", async () => {
  const indexer: any = createTestIndexer();
  const s = story(WED_UTC);
  setup(s);
  s.ev("MissionCreated", created(1n, 10));
  s.ev("MissionSubmitted", { missionId: 1n, teen: TEEN });
  const approved = s.ev("MissionApproved", { missionId: 1n, teen: TEEN, reward: U(10), savedToGoal: false });
  s.ev("GoalSaved", { goalId: 9n, teen: TEEN, amount: U(3), saved: U(3), matched: 0n });
  // the same log (same transaction hash and log index) delivered again in a later block, e.g. after a re-sync
  s.events.push({ ...approved, block: { ...approved.block, number: s.end() } });
  await indexer.process({ chains: { 10143: { startBlock: START, endBlock: s.end() + 5, simulate: s.events } } });
  const p = await indexer.TeenProgress.get(TEEN);
  assert.equal(p.missionsCompleted, 1);
  assert.equal(p.missionRewards, U(10));
  assert.equal(p.savedTotal, 0n); // goal 9 was never indexed, so the save does not qualify
  assert.equal((await indexer.ProgressEvent.getAll()).length, 1);
});

test("weeks are cut at local Monday in the family's time zone, and only confirmed actions count", async () => {
  const indexer: any = createTestIndexer();
  const s = story(WED_UTC);
  setup(s);
  s.ev("GoalProposed", { goalId: 1n, teen: TEEN, target: U(20), deadline: 1_900_000_000n, memo: "Bike" });
  s.ev("GoalApproved", { goalId: 1n, sponsorOpen: false });
  // Sunday 18:00 UTC = Sunday 23:30 IST: still the previous local week
  s.ev("GoalSaved", { goalId: 1n, teen: TEEN, amount: U(2), saved: U(2), matched: 0n }, SUN_EVENING_UTC - 2 * 3600);
  // Sunday 20:00 UTC = Monday 01:30 IST: the next local week
  s.ev("GoalSaved", { goalId: 1n, teen: TEEN, amount: U(5), saved: U(7), matched: 0n }, SUN_EVENING_UTC);
  s.ev("Paid", { from: TEEN, to: SHOP, amount: U(2), memo: "snack" }, WED_UTC);
  // a held payment is not a completed payment until it is released; the allowance is context, not an achievement
  s.ev("PaymentHeld", { id: 1n, from: TEEN, to: SHOP, amount: U(9), kind: 0n, releaseAt: 0n, refKind: 0n, refId: 0n, memo: "big" }, WED_UTC);
  s.ev("PendingResolved", { id: 1n, outcome: 3n }, WED_UTC);
  s.ev("StreamFunded", { teen: TEEN, budget: U(20), rate: 1000n, remaining: U(20) }, WED_UTC);

  await indexer.process({ chains: { 10143: { startBlock: START, endBlock: s.end(), simulate: s.events } } });

  const weeks = (await indexer.WeeklyStat.getAll()).sort((a: any, b: any) => a.week - b.week);
  assert.equal(weeks.length, 2);
  const [prev, next] = weeks;
  assert.equal(next.week, prev.week + 1);
  assert.equal(prev.savedTotal, U(2));
  assert.equal(next.savedTotal, U(5));
  assert.equal(next.paymentsCompleted, 1);
  assert.equal(next.heldCount, 1);
  assert.equal(next.allowanceFunded, U(20));
  // weekStart is local Monday 00:00 IST expressed in UTC: Sunday 2027-01-03 18:30 UTC for the later week
  assert.equal(next.weekStart, 1799001000);
  assert.equal(next.weekStart - prev.weekStart, 7 * 86400);

  const p = await indexer.TeenProgress.get(TEEN);
  assert.equal(p.savedTotal, U(7));
  assert.equal(p.paymentsCompleted, 1); // the rejected hold never counted
  assert.equal(p.missionsCompleted, 0);
});

test("FutureFund keeps an honest, source-linked story and never claims an investment", async () => {
  const indexer: any = createTestIndexer();
  const s = story(WED_UTC);
  setup(s);
  s.ev("FundCreated", { fundId: 1n, parent: PARENT, teen: TEEN, target: U(100), horizon: 1_900_000_000n, name: "College", purpose: "Books" });
  s.ev("FundContributed", { fundId: 1n, parent: PARENT, amount: U(10), funded: U(10) });
  s.ev("FundContributed", { fundId: 1n, parent: PARENT, amount: U(15), funded: U(25) });
  s.ev("FundReleased", { fundId: 1n, teen: TEEN, amount: U(25), byTeen: false });
  await indexer.process({ chains: { 10143: { startBlock: START, endBlock: s.end(), simulate: s.events } } });

  const f = await indexer.FutureFund.get("1");
  assert.equal(f.funded, U(25));
  assert.equal(f.status, "RELEASED");
  assert.equal(f.teenFamId, "alex");
  const entries = (await indexer.FundEntry.getAll()).sort((a: any, b: any) => a.blockNumber - b.blockNumber);
  assert.deepEqual(entries.map((e: any) => e.kind), ["CREATED", "CONTRIBUTED", "CONTRIBUTED", "RELEASED"]);
  assert.ok(entries.every((e: any) => /^0x[0-9a-f]{64}$/.test(e.txHash)));
  assert.ok(entries[1].text.includes("confirmed") && entries[1].text.includes("not been invested"));
  assert.ok(entries.every((e: any) => !/yield|APY|profit|return of|invested at/i.test(e.text)));
});
