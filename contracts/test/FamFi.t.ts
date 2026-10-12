import { expect } from "chai";
import { ethers } from "hardhat";
import { loadFixture, time } from "@nomicfoundation/hardhat-network-helpers";
import type { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";

const U = (n: number) => BigInt(Math.round(n * 1e6));
const fid = (s: string) => ethers.encodeBytes32String(s);
const DAY = 86400;

// enums mirrored from the contract
const Role = { NONE: 0, PARENT: 1, TEEN: 2, SPONSOR: 3, MERCHANT: 4 };
const PendingKind = { OVER_LIMIT: 0, ANOMALY: 1 };
const PStatus = { NONE: 0, OPEN: 1, EXECUTED: 2, REJECTED: 3, CANCELLED: 4 };
const GStatus = { NONE: 0, PROPOSED: 1, ACTIVE: 2, COMPLETE: 3, CLOSED: 4 };
const ReqStatus = { NONE: 0, OPEN: 1, PAID: 2 };
const MStatus = { NONE: 0, ACTIVE: 1, SUBMITTED: 2, REJECTED: 3, APPROVED: 4, CANCELLED: 5, EXPIRED: 6 };
const FStatus = { NONE: 0, OPEN: 1, RELEASED: 2 };

type Terms = {
  levelLimits: bigint[];
  newPayeeThreshold: bigint;
  firstDayCap: bigint;
  holdSeconds: number;
  strictHolds: boolean;
};
// What a parent might choose. The contract has no built-in numbers; every invite carries its own.
const TERMS: Terms = { levelLimits: [U(5), U(8), U(12), U(20)], newPayeeThreshold: U(3), firstDayCap: U(2), holdSeconds: 600, strictHolds: false };

async function inviteSig(fam: any, parent: HardhatEthersSigner, familyId: number, inviteId: string, deadline: number, terms: Terms = TERMS) {
  const net = await ethers.provider.getNetwork();
  const domain = { name: "FamFi", version: "1", chainId: net.chainId, verifyingContract: await fam.getAddress() };
  const types = {
    Invite: [
      { name: "familyId", type: "uint32" },
      { name: "inviteId", type: "bytes32" },
      { name: "deadline", type: "uint256" },
      { name: "levelLimits", type: "uint128[4]" },
      { name: "newPayeeThreshold", type: "uint128" },
      { name: "firstDayCap", type: "uint128" },
      { name: "holdSeconds", type: "uint32" },
      { name: "strictHolds", type: "bool" },
    ],
  };
  return parent.signTypedData(domain, types, { familyId, inviteId, deadline, ...terms });
}

async function deployBase() {
  const [deployer, treasury, parent, teen, friend, sponsor, shop, relayer, stranger] = await ethers.getSigners();
  const usdc = await (await ethers.getContractFactory("MockUSDC")).deploy();
  const fwd = await (await ethers.getContractFactory("FamFiForwarder")).deploy();
  const fam = await (await ethers.getContractFactory("FamFi")).deploy(await usdc.getAddress(), await fwd.getAddress());

  await usdc.mint(treasury.address, U(100000));
  await usdc.connect(treasury).approve(await fam.getAddress(), ethers.MaxUint256);

  await fam.connect(parent).register(fid("priya"), Role.PARENT);
  await fam.connect(parent).createFamily(19800); // IST
  await fam.connect(sponsor).register(fid("aunt"), Role.SPONSOR);
  await fam.connect(shop).register(fid("canteen"), Role.MERCHANT);

  const deadline = (await time.latest()) + 7 * DAY;
  for (const [i, [who, name]] of ([[teen, "alex"], [friend, "riya"]] as [HardhatEthersSigner, string][]).entries()) {
    const inviteId = ethers.id(`invite-${i}`);
    const sig = await inviteSig(fam, parent, 1, inviteId, deadline);
    await fam.connect(who).acceptInvite(1, inviteId, deadline, TERMS, sig, fid(name));
  }

  await fam.connect(treasury).depositFor(parent.address, U(200));
  await fam.connect(treasury).depositFor(teen.address, U(50));
  await fam.connect(treasury).depositFor(friend.address, U(50));
  await fam.connect(treasury).depositFor(sponsor.address, U(100));

  return { deployer, treasury, parent, teen, friend, sponsor, shop, relayer, stranger, usdc, fwd, fam };
}

/** Same as base, but a day later so the "first 24 hours" cap no longer applies. */
async function deployMatured() {
  const ctx = await deployBase();
  await time.increase(DAY + 10);
  return ctx;
}

async function totalLedger(ctx: any, addrs: string[]) {
  const { fam } = ctx;
  let sum = 0n;
  for (const a of addrs) {
    sum += await fam.balance(a);
    sum += (await fam.streams(a)).remaining;
  }
  const pc = Number(await fam.pendingCount());
  for (let i = 1; i <= pc; i++) {
    const p = await fam.pendings(i);
    if (p.status === BigInt(PStatus.OPEN)) sum += p.amount;
  }
  const gc = Number(await fam.goalCount());
  for (let i = 1; i <= gc; i++) {
    const g = await fam.goals(i);
    if (g.status === BigInt(GStatus.ACTIVE) || g.status === BigInt(GStatus.COMPLETE)) sum += g.saved + g.matched;
  }
  const gfc = Number(await fam.giftCount());
  for (let i = 1; i <= gfc; i++) sum += (await fam.gifts(i)).escrow;
  sum += await fam.missionEscrow();
  sum += await fam.fundEscrow();
  return sum;
}

async function expectInvariant(ctx: any) {
  const addrs = [ctx.parent, ctx.teen, ctx.friend, ctx.sponsor, ctx.shop].map((s: any) => s.address);
  expect(await ctx.usdc.balanceOf(await ctx.fam.getAddress())).to.equal(await totalLedger(ctx, addrs));
}

async function openGoal(ctx: any, target = U(40), minOwnBps = 2500, sponsorOpen = true) {
  const { fam, teen, parent } = ctx;
  const deadline = (await time.latest()) + 30 * DAY;
  await fam.connect(teen).proposeGoal(target, deadline, minOwnBps, "Headphones");
  const id = await fam.goalCount();
  await fam.connect(parent).approveGoal(id, sponsorOpen);
  return { id, deadline };
}

describe("FamFi: registration and invites", () => {
  it("validates Fam-IDs and roles", async () => {
    const { fam, stranger, sponsor } = await loadFixture(deployBase);
    await expect(fam.connect(stranger).register(fid("ab"), Role.SPONSOR)).to.be.revertedWith("bad fam-id");
    await expect(fam.connect(stranger).register(fid("Alex"), Role.SPONSOR)).to.be.revertedWith("bad fam-id");
    await expect(fam.connect(stranger).register(fid("a-b-c"), Role.SPONSOR)).to.be.revertedWith("bad fam-id");
    await expect(fam.connect(stranger).register(fid("alex"), Role.SPONSOR)).to.be.revertedWith("fam-id taken");
    await expect(fam.connect(stranger).register(fid("newbie"), Role.TEEN)).to.be.revertedWith("role not allowed");
    await fam.connect(stranger).register(fid("a_1_b"), Role.SPONSOR);
    await expect(fam.connect(sponsor).register(fid("another"), Role.SPONSOR)).to.be.revertedWith("already registered");
  });

  it("only a valid, unused, unexpired parent invite makes a teen", async () => {
    const { fam, parent, stranger, sponsor } = await loadFixture(deployBase);
    const deadline = (await time.latest()) + DAY;
    const id1 = ethers.id("x1");
    const badSig = await inviteSig(fam, sponsor, 1, id1, deadline);
    await expect(fam.connect(stranger).acceptInvite(1, id1, deadline, TERMS, badSig, fid("kid"))).to.be.revertedWith("bad invite sig");
    const sig = await inviteSig(fam, parent, 1, id1, deadline);
    await fam.connect(stranger).acceptInvite(1, id1, deadline, TERMS, sig, fid("kid"));
    expect((await fam.accounts(stranger.address)).role).to.equal(Role.TEEN);
    await expect(fam.connect(sponsor).acceptInvite(1, id1, deadline, TERMS, sig, fid("kid2"))).to.be.revertedWith("invite used");
    const id2 = ethers.id("x2");
    const sig2 = await inviteSig(fam, parent, 1, id2, deadline);
    await time.increase(2 * DAY);
    await expect(fam.connect(sponsor).acceptInvite(1, id2, deadline, TERMS, sig2, fid("kid3"))).to.be.revertedWith("invite expired");
  });

  it("the teen gets exactly the numbers the parent signed, and nothing is built in", async () => {
    const { fam, parent, stranger } = await loadFixture(deployBase);
    const mine: Terms = { levelLimits: [U(1.5), U(2), U(2), U(9)], newPayeeThreshold: U(0.75), firstDayCap: U(1), holdSeconds: 90, strictHolds: true };
    const deadline = (await time.latest()) + DAY;
    const inviteId = ethers.id("custom");
    const sig = await inviteSig(fam, parent, 1, inviteId, deadline, mine);
    await fam.connect(stranger).acceptInvite(1, inviteId, deadline, mine, sig, fid("kid"));
    const c = await fam.getTeenCfg(stranger.address);
    expect(Array.from(c.levelLimits)).to.deep.equal(mine.levelLimits);
    expect(c.newPayeeThreshold).to.equal(mine.newPayeeThreshold);
    expect(c.firstDayCap).to.equal(mine.firstDayCap);
    expect(c.holdSeconds).to.equal(90n);
    expect(c.strictHolds).to.equal(true);
  });

  it("a teen cannot change the parent's numbers; zero or out-of-order limits are refused", async () => {
    const { fam, parent, stranger } = await loadFixture(deployBase);
    const deadline = (await time.latest()) + DAY;
    const inviteId = ethers.id("tamper");
    const sig = await inviteSig(fam, parent, 1, inviteId, deadline, TERMS);
    const greedy: Terms = { ...TERMS, levelLimits: [U(500), U(800), U(1200), U(2000)] };
    await expect(fam.connect(stranger).acceptInvite(1, inviteId, deadline, greedy, sig, fid("kid"))).to.be.revertedWith("bad invite sig");
    const zero: Terms = { ...TERMS, levelLimits: [0n, U(1), U(2), U(3)] };
    await expect(fam.connect(stranger).acceptInvite(1, inviteId, deadline, zero, sig, fid("kid"))).to.be.revertedWith("set a daily limit");
    const down: Terms = { ...TERMS, levelLimits: [U(5), U(3), U(8), U(9)] };
    await expect(fam.connect(stranger).acceptInvite(1, inviteId, deadline, down, sig, fid("kid"))).to.be.revertedWith("limits not ascending");
    const slow: Terms = { ...TERMS, holdSeconds: 3 * DAY };
    await expect(fam.connect(stranger).acceptInvite(1, inviteId, deadline, slow, sig, fid("kid"))).to.be.revertedWith("hold too long");
  });

  it("depositFor needs a known user", async () => {
    const { fam, treasury, stranger } = await loadFixture(deployBase);
    await expect(fam.connect(treasury).depositFor(stranger.address, U(1))).to.be.revertedWith("unknown user");
  });
});

describe("FamFi: allowance stream", () => {
  it("accrues by time, belongs to the teen, settles on action, and is capped by the budget", async () => {
    const ctx = await loadFixture(deployMatured);
    const { fam, parent, teen, shop } = ctx;
    const before = await fam.balance(teen.address);
    await fam.connect(parent).fundStream(teen.address, U(50), 10000n); // 0.01 USDC/s
    expect(await fam.balance(parent.address)).to.equal(U(150));
    await time.increase(100);
    const acc = await fam.accrued(teen.address);
    expect(acc).to.be.closeTo(U(1), 20000n);
    expect(await fam.spendable(teen.address)).to.be.closeTo(before + U(1), 20000n);
    await fam.connect(teen).pay(fid("canteen"), U(1), "snack");
    expect(await fam.balance(teen.address)).to.be.closeTo(before + U(1) - U(1), 30000n);
    expect((await fam.streams(teen.address)).remaining).to.be.closeTo(U(50) - U(1), 30000n);
    await expectInvariant(ctx);

    // cap: a tiny budget cannot accrue past itself
    await fam.connect(parent).fundStream(friend(ctx).address, U(1), U(1));
    await time.increase(100);
    expect(await fam.accrued(friend(ctx).address)).to.equal(U(1));
    void shop;
  });

  it("only the teen's parent can fund a stream", async () => {
    const { fam, sponsor, teen } = await loadFixture(deployMatured);
    await expect(fam.connect(sponsor).fundStream(teen.address, U(1), 1n)).to.be.revertedWith("not parent of teen");
  });
});
const friend = (ctx: any) => ctx.friend;

describe("FamFi: payments and holds", () => {
  it("pays directly within the limit and tracks the day", async () => {
    const ctx = await loadFixture(deployMatured);
    const { fam, teen, shop } = ctx;
    await expect(fam.connect(teen).pay(fid("canteen"), U(2), "snack")).to.emit(fam, "Paid");
    expect(await fam.balance(shop.address)).to.equal(U(2));
    expect(await fam.remainingToday(teen.address)).to.equal(U(3));
    await expectInvariant(ctx);
  });

  it("resets the limit on a new day (IST buckets)", async () => {
    const { fam, teen } = await loadFixture(deployMatured);
    await fam.connect(teen).pay(fid("canteen"), U(3), "a"); // at threshold, direct
    await fam.connect(teen).pay(fid("canteen"), U(2), "b");
    expect(await fam.remainingToday(teen.address)).to.equal(0n);
    await time.increase(DAY);
    expect(await fam.remainingToday(teen.address)).to.equal(U(5));
  });

  it("OVER_LIMIT: escrows, does not count, parent approves / rejects, teen cancels", async () => {
    const ctx = await loadFixture(deployMatured);
    const { fam, teen, parent, shop } = ctx;
    await fam.connect(teen).pay(fid("canteen"), U(2), "x");
    const bal = await fam.balance(teen.address);
    await expect(fam.connect(teen).pay(fid("canteen"), U(4), "big")).to.emit(fam, "PaymentHeld");
    const id = await fam.pendingCount();
    expect((await fam.pendings(id)).kind).to.equal(PendingKind.OVER_LIMIT);
    expect(await fam.balance(teen.address)).to.equal(bal - U(4));
    expect(await fam.remainingToday(teen.address)).to.equal(U(3)); // unchanged by the hold
    await expectInvariant(ctx);

    await expect(fam.connect(teen).finalizePending(id)).to.be.revertedWith("needs parent");
    await fam.connect(parent).approvePending(id);
    expect(await fam.balance(shop.address)).to.equal(U(6));
    expect(await fam.remainingToday(teen.address)).to.equal(U(3)); // approval is an uncounted exception

    // reject path
    await fam.connect(teen).pay(fid("canteen"), U(4), "big2");
    const id2 = await fam.pendingCount();
    const b2 = await fam.balance(teen.address);
    await fam.connect(parent).rejectPending(id2);
    expect(await fam.balance(teen.address)).to.equal(b2 + U(4));
    await expect(fam.connect(parent).approvePending(id2)).to.be.revertedWith("not open");

    // cancel path
    await fam.connect(teen).pay(fid("canteen"), U(4), "big3");
    const id3 = await fam.pendingCount();
    await fam.connect(teen).cancelPending(id3);
    expect((await fam.pendings(id3)).status).to.equal(PStatus.CANCELLED);
    await expectInvariant(ctx);
  });

  it("ANOMALY (new payee over threshold): counts now, teen finalizes after the hold", async () => {
    const ctx = await loadFixture(deployMatured);
    const { fam, teen, shop } = ctx;
    await fam.connect(teen).pay(fid("canteen"), U(4), "first big");
    const id = await fam.pendingCount();
    expect((await fam.pendings(id)).kind).to.equal(PendingKind.ANOMALY);
    expect(await fam.remainingToday(teen.address)).to.equal(U(1)); // counted at creation
    await expect(fam.connect(teen).finalizePending(id)).to.be.revertedWith("still held");
    await time.increase(601);
    await fam.connect(teen).finalizePending(id);
    expect(await fam.balance(shop.address)).to.equal(U(4));
    // the payee is now known: a second big payment is not flagged
    await time.increase(DAY);
    await fam.connect(teen).pay(fid("canteen"), U(4), "again");
    expect(await fam.pendingCount()).to.equal(id);
    await expectInvariant(ctx);
  });

  it("ANOMALY: strict holds need the parent; rejection restores today's limit only the same day", async () => {
    const ctx = await loadFixture(deployMatured);
    const { fam, teen, parent } = ctx;
    await fam.connect(parent).setLimits(teen.address, [U(5), U(8), U(12), U(20)], U(3), U(2), 600, true);
    await fam.connect(teen).pay(fid("canteen"), U(4), "held");
    const id = await fam.pendingCount();
    await time.increase(700);
    await expect(fam.connect(teen).finalizePending(id)).to.be.revertedWith("strict holds");
    await fam.connect(parent).rejectPending(id);
    expect(await fam.remainingToday(teen.address)).to.equal(U(5)); // restored (same IST day)

    await fam.connect(teen).pay(fid("canteen"), U(4), "held2");
    const id2 = await fam.pendingCount();
    await time.increase(DAY);
    await fam.connect(parent).rejectPending(id2);
    expect(await fam.remainingToday(teen.address)).to.equal(U(5)); // new day, nothing double-restored
    await expectInvariant(ctx);
  });

  it("first-24h cap holds even a known payee; a day later it passes", async () => {
    const ctx = await loadFixture(deployBase);
    const { fam, teen } = ctx;
    await fam.connect(teen).pay(fid("canteen"), U(2.5), "new kid");
    expect((await fam.pendings(await fam.pendingCount())).kind).to.equal(PendingKind.ANOMALY);
    await time.increase(DAY + 10);
    const count = await fam.pendingCount();
    await fam.connect(teen).pay(fid("canteen"), U(2.5), "later");
    expect(await fam.pendingCount()).to.equal(count);
  });

  it("freeze blocks spending, still allows saving; only the parent can freeze", async () => {
    const ctx = await loadFixture(deployMatured);
    const { fam, teen, parent, sponsor } = ctx;
    await expect(fam.connect(sponsor).freeze(teen.address)).to.be.revertedWith("not parent of teen");
    await fam.connect(parent).freeze(teen.address);
    await expect(fam.connect(teen).pay(fid("canteen"), U(1), "x")).to.be.revertedWith("frozen");
    const { id } = await openGoal(ctx);
    await fam.connect(teen).saveToGoal(id, U(5));
    await fam.connect(parent).unfreeze(teen.address);
    await fam.connect(teen).pay(fid("canteen"), U(1), "x");
  });

  it("non-teens pay freely; teens cannot overspend their balance", async () => {
    const { fam, parent, teen } = await loadFixture(deployMatured);
    await fam.connect(parent).pay(fid("canteen"), U(100), "no limits for parents");
    await expect(fam.connect(teen).pay(fid("canteen"), U(1000), "x")).to.be.revertedWith("insufficient");
    await expect(fam.connect(teen).pay(fid("alex"), U(1), "self")).to.be.revertedWith("bad payee");
    await expect(fam.connect(teen).pay(fid("nobody"), U(1), "x")).to.be.revertedWith("unknown fam-id");
  });
});

describe("FamFi: goals and matched gifts", () => {
  it("releases the match as the teen saves, completes, levels up, and pays the shop", async () => {
    const ctx = await loadFixture(deployMatured);
    const { fam, teen, sponsor, shop } = ctx;
    const { id, deadline } = await openGoal(ctx);
    await fam.connect(sponsor).lockMatch(id, U(20), 1_000_000n, deadline);
    expect((await fam.gifts(1)).escrow).to.equal(U(20));

    await fam.connect(teen).saveToGoal(id, U(10));
    let g = await fam.goals(id);
    expect([g.saved, g.matched]).to.deep.equal([U(10), U(10)]);
    await expectInvariant(ctx);

    await expect(fam.connect(teen).saveToGoal(id, U(10))).to.emit(fam, "GoalCompleted").and.to.emit(fam, "LevelUp");
    g = await fam.goals(id);
    expect(g.status).to.equal(GStatus.COMPLETE);
    expect((await fam.getTeenCfg(teen.address)).level).to.equal(1);
    expect(await fam.remainingToday(teen.address)).to.equal(U(8));

    await fam.connect(teen).payFromGoal(id, fid("canteen"));
    expect(await fam.balance(shop.address)).to.equal(U(40));
    expect((await fam.goals(id)).status).to.equal(GStatus.CLOSED);
    await expect(fam.connect(sponsor).reclaimGift(1)).to.be.revertedWith("nothing to reclaim");
    await expectInvariant(ctx);
  });

  it("no level-up when a gift does most of the work (own-savings minimum)", async () => {
    const ctx = await loadFixture(deployMatured);
    const { fam, teen, sponsor } = ctx;
    const { id, deadline } = await openGoal(ctx, U(40), 5000);
    await fam.connect(sponsor).lockMatch(id, U(30), 3_000_000n, deadline);
    await fam.connect(teen).saveToGoal(id, U(10));
    const g = await fam.goals(id);
    expect([g.saved, g.matched, g.status]).to.deep.equal([U(10), U(30), BigInt(GStatus.COMPLETE)]);
    expect((await fam.getTeenCfg(teen.address)).level).to.equal(0);
  });

  it("sponsor reclaims unmatched escrow after completion; double reclaim fails", async () => {
    const ctx = await loadFixture(deployMatured);
    const { fam, teen, sponsor } = ctx;
    const { id, deadline } = await openGoal(ctx);
    await fam.connect(sponsor).lockMatch(id, U(30), 1_000_000n, deadline);
    await expect(fam.connect(sponsor).reclaimGift(1)).to.be.revertedWith("gift still active");
    await fam.connect(teen).saveToGoal(id, U(20)); // 20 + 20 = 40, complete
    const before = await fam.balance(sponsor.address);
    await fam.connect(sponsor).reclaimGift(1);
    expect(await fam.balance(sponsor.address)).to.equal(before + U(10));
    await expect(fam.connect(sponsor).reclaimGift(1)).to.be.revertedWith("nothing to reclaim");
    await expectInvariant(ctx);
  });

  it("unfinished goal: closeGoal returns saved + matched to the teen after the deadline", async () => {
    const ctx = await loadFixture(deployMatured);
    const { fam, teen, sponsor } = ctx;
    const { id, deadline } = await openGoal(ctx);
    await fam.connect(sponsor).lockMatch(id, U(20), 1_000_000n, deadline);
    await fam.connect(teen).saveToGoal(id, U(5));
    await expect(fam.connect(teen).closeGoal(id)).to.be.revertedWith("not ended");
    await time.increase(31 * DAY);
    const bal = await fam.balance(teen.address);
    await fam.connect(teen).closeGoal(id);
    expect(await fam.balance(teen.address)).to.equal(bal + U(10));
    const sb = await fam.balance(sponsor.address);
    await fam.connect(sponsor).reclaimGift(1);
    expect(await fam.balance(sponsor.address)).to.equal(sb + U(15));
    await expectInvariant(ctx);
  });

  it("gating: sponsors need an open goal; the parent can always match; caps and bad inputs revert", async () => {
    const ctx = await loadFixture(deployMatured);
    const { fam, teen, parent, sponsor, stranger } = ctx;
    const closed = await openGoal(ctx, U(40), 2500, false);
    await expect(fam.connect(sponsor).lockMatch(closed.id, U(5), 1_000_000n, closed.deadline)).to.be.revertedWith("not allowed");
    await fam.connect(parent).lockMatch(closed.id, U(5), 1_000_000n, closed.deadline);
    await expect(fam.connect(sponsor).lockMatch(999, U(5), 1_000_000n, closed.deadline)).to.be.revertedWith("goal not active");
    const open = await openGoal(ctx);
    await expect(fam.connect(sponsor).lockMatch(open.id, U(5), 0n, open.deadline)).to.be.revertedWith("bad ratio");
    await expect(fam.connect(sponsor).lockMatch(open.id, U(5), 11_000_000n, open.deadline)).to.be.revertedWith("bad ratio");
    await expect(fam.connect(stranger).proposeGoal(U(1), open.deadline, 0, "x")).to.be.revertedWith("not teen");
    await expect(fam.connect(teen).saveToGoal(open.id, U(41))).to.be.revertedWith("exceeds goal");
    for (let i = 0; i < 5; i++) await fam.connect(sponsor).lockMatch(open.id, U(1), 1_000_000n, open.deadline);
    await expect(fam.connect(sponsor).lockMatch(open.id, U(1), 1_000_000n, open.deadline)).to.be.revertedWith("too many gifts");
  });

  it("rounds the match down and never over-releases (fuzz)", async () => {
    const ctx = await loadFixture(deployMatured);
    const { fam, teen, sponsor } = ctx;
    const { id, deadline } = await openGoal(ctx, U(40), 0);
    await fam.connect(sponsor).lockMatch(id, 7n, 333_333n, deadline); // tiny escrow, odd ratio
    await fam.connect(teen).saveToGoal(id, 5n);
    const gf = await fam.gifts(1);
    expect(gf.released + gf.escrow).to.equal(7n);
    expect(gf.released).to.equal((5n * 333_333n) / 1_000_000n);
    await expectInvariant(ctx);
  });

  it("round-up moves spare change into the goal and triggers the match", async () => {
    const ctx = await loadFixture(deployMatured);
    const { fam, teen, parent, sponsor } = ctx;
    await fam.connect(parent).setLimits(teen.address, [U(20), U(20), U(20), U(20)], U(10), U(10), 600, false);
    const { id, deadline } = await openGoal(ctx);
    await fam.connect(sponsor).lockMatch(id, U(20), 1_000_000n, deadline);
    await fam.connect(teen).setRoundUp(U(1), id);
    const bal = await fam.balance(teen.address);
    await fam.connect(teen).pay(fid("canteen"), U(7.4), "lunch");
    expect(await fam.balance(teen.address)).to.equal(bal - U(7.4) - U(0.6));
    const g = await fam.goals(id);
    expect([g.saved, g.matched]).to.deep.equal([U(0.6), U(0.6)]);
    await expectInvariant(ctx);
  });
});

describe("FamFi: splits and requests", () => {
  it("a friend pays a share once; slots are limited; shares follow the payer's own rules", async () => {
    const ctx = await loadFixture(deployMatured);
    const { fam, teen, friend, sponsor, parent } = ctx;
    await fam.connect(friend).createSplit(U(1.6), 1, "pizza");
    await expect(fam.connect(friend).paySplitShare(1)).to.be.revertedWith("creator");
    const rb = await fam.balance(friend.address);
    await fam.connect(teen).paySplitShare(1);
    expect(await fam.balance(friend.address)).to.equal(rb + U(1.6));
    await expect(fam.connect(teen).paySplitShare(1)).to.be.revertedWith("already paid");
    await expect(fam.connect(sponsor).paySplitShare(1)).to.be.revertedWith("split full");

    // a big share to a new payee gets held; rejecting frees the slot again
    await fam.connect(friend).createSplit(U(4), 2, "trip");
    await fam.connect(teen).paySplitShare(2);
    const pid = await fam.pendingCount();
    expect((await fam.splits(2)).paid).to.equal(1);
    await expect(fam.connect(teen).paySplitShare(2)).to.be.revertedWith("already paid");
    await fam.connect(parent).rejectPending(pid);
    expect((await fam.splits(2)).paid).to.equal(0);
    await fam.connect(teen).paySplitShare(2);
    await expectInvariant(ctx);
  });

  it("a teen asks the parent for money and the parent pays; held requests reopen on reject", async () => {
    const ctx = await loadFixture(deployMatured);
    const { fam, teen, parent, friend } = ctx;
    await fam.connect(teen).createRequest(fid("priya"), U(5), "book");
    const before = await fam.balance(teen.address);
    await expect(fam.connect(teen).payRequest(1)).to.be.revertedWith("not payer");
    await fam.connect(parent).payRequest(1);
    expect(await fam.balance(teen.address)).to.equal(before + U(5));
    expect((await fam.requests(1)).status).to.equal(ReqStatus.PAID);

    await fam.connect(friend).createRequest(fid("alex"), U(4), "lend");
    await fam.connect(teen).payRequest(2); // new payee over threshold: held
    const pid = await fam.pendingCount();
    expect((await fam.requests(2)).status).to.equal(ReqStatus.PAID);
    await fam.connect(parent).rejectPending(pid);
    expect((await fam.requests(2)).status).to.equal(ReqStatus.OPEN);
    await expectInvariant(ctx);
  });
});

describe("FamFi: gasless via the forwarder", () => {
  it("a relayer submits the teen's signed payment and pays the gas", async () => {
    const ctx = await loadFixture(deployMatured);
    const { fam, fwd, teen, relayer, shop, usdc } = ctx;
    const famAddr = await fam.getAddress();
    const data = fam.interface.encodeFunctionData("pay", [fid("canteen"), U(2), "relayed"]);
    const net = await ethers.provider.getNetwork();
    const domain = { name: "FamFiForwarder", version: "1", chainId: net.chainId, verifyingContract: await fwd.getAddress() };
    const types = {
      ForwardRequest: [
        { name: "from", type: "address" },
        { name: "to", type: "address" },
        { name: "value", type: "uint256" },
        { name: "gas", type: "uint256" },
        { name: "nonce", type: "uint256" },
        { name: "deadline", type: "uint48" },
        { name: "data", type: "bytes" },
      ],
    };
    const nonce = await fwd.nonces(teen.address);
    const deadline = (await time.latest()) + 3600;
    const msg = { from: teen.address, to: famAddr, value: 0n, gas: 500000n, nonce, deadline, data };
    const signature = await teen.signTypedData(domain, types, msg);
    const req = { from: msg.from, to: msg.to, value: 0n, gas: msg.gas, deadline, data, signature };

    const relayerEth = await ethers.provider.getBalance(relayer.address);
    await fwd.connect(relayer).execute(req);
    expect(await fam.balance(shop.address)).to.equal(U(2));
    expect(await ethers.provider.getBalance(relayer.address)).to.be.lt(relayerEth); // relayer paid gas
    expect(await usdc.balanceOf(relayer.address)).to.equal(0n);

    // replay is rejected (nonce consumed)
    await expect(fwd.connect(relayer).execute(req)).to.be.reverted;
  });
});

describe("FamFi: randomized money-conservation invariant", () => {
  it("contract USDC always equals ledger + streams + escrows + goal funds", async () => {
    const ctx = await loadFixture(deployMatured);
    const { fam, teen, friend, sponsor, parent, shop } = ctx;
    const people = [teen, friend, sponsor, parent, shop];
    const names = ["alex", "riya", "aunt", "priya", "canteen"];
    let seed = 12345;
    const rnd = (n: number) => {
      seed = (seed * 1103515245 + 12345) & 0x7fffffff;
      return seed % n;
    };
    const goal = await openGoal(ctx);
    await fam.connect(sponsor).lockMatch(goal.id, U(25), 1_500_000n, goal.deadline);
    await fam.connect(parent).fundStream(teen.address, U(30), 5000n);

    let ok = 0;
    const okOps = new Set<number>();
    for (let i = 0; i < 80; i++) {
      const who = people[rnd(5)];
      const other = names[rnd(5)];
      const amt = U(rnd(80) / 10 + 0.1);
      const op = rnd(9);
      try {
        if (op === 0) await fam.connect(who).pay(fid(other), amt, "f");
        else if (op === 1) await fam.connect(teen).saveToGoal(goal.id, U(rnd(8) + 1));
        else if (op === 2) await fam.connect(parent).approvePending(1 + rnd(Number(await fam.pendingCount()) + 1));
        else if (op === 3) await fam.connect(parent).rejectPending(1 + rnd(Number(await fam.pendingCount()) + 1));
        else if (op === 4) await fam.connect(teen).finalizePending(1 + rnd(Number(await fam.pendingCount()) + 1));
        else if (op === 5) await fam.connect(teen).cancelPending(1 + rnd(Number(await fam.pendingCount()) + 1));
        else if (op === 6) await time.increase(rnd(2 * DAY));
        else if (op === 7) await fam.connect(friend).createSplit(U(rnd(6) + 1), 3, "s");
        else await fam.connect(who).paySplitShare(1 + rnd(Number(await fam.splitCount()) + 1));
        ok++;
        okOps.add(op);
      } catch {
        /* reverts are fine; the invariant must hold either way */
      }
      await expectInvariant(ctx);
    }
    // the fuzz must really exercise the contract, not just revert
    expect(ok).to.be.greaterThan(25);
    expect(okOps.size).to.be.greaterThan(4);
  });
});

// ───────────────────────────── missions ─────────────────────────────

async function newMission(ctx: any, reward = U(10), goalId = 0n, days = 7) {
  const { fam, parent, teen } = ctx;
  const deadline = (await time.latest()) + days * DAY;
  await fam.connect(parent).createMission(teen.address, reward, deadline, goalId, "Wash the car", "Inside and out");
  return { id: await fam.missionCount(), deadline };
}

describe("FamFi: funded money missions", () => {
  it("create reserves the reward from the parent; approve pays the teen exactly once", async () => {
    const ctx = await loadFixture(deployMatured);
    const { fam, parent, teen } = ctx;
    const p0 = await fam.balance(parent.address);
    const t0 = await fam.balance(teen.address);
    const { id } = await newMission(ctx, U(10));
    expect(await fam.balance(parent.address)).to.equal(p0 - U(10));
    expect(await fam.missionEscrow()).to.equal(U(10));
    expect((await fam.missions(id)).status).to.equal(MStatus.ACTIVE);
    await expectInvariant(ctx);

    await expect(fam.connect(teen).submitMission(id)).to.emit(fam, "MissionSubmitted").withArgs(id, teen.address);
    expect((await fam.missions(id)).status).to.equal(MStatus.SUBMITTED);
    await expect(fam.connect(parent).approveMission(id)).to.emit(fam, "MissionApproved").withArgs(id, teen.address, U(10), false);
    expect(await fam.balance(teen.address)).to.equal(t0 + U(10));
    expect(await fam.missionEscrow()).to.equal(0n);
    expect(await fam.openMissions(teen.address)).to.equal(0n);
    await expectInvariant(ctx);

    // replay: a second approval, a cancel, an expiry and a resubmit all fail; nothing moves
    await expect(fam.connect(parent).approveMission(id)).to.be.revertedWith("not submitted");
    await expect(fam.connect(parent).cancelMission(id)).to.be.revertedWith("not open");
    await time.increase(8 * DAY);
    await expect(fam.expireMission(id)).to.be.revertedWith("not open");
    await expect(fam.connect(teen).submitMission(id)).to.be.revertedWith("not open");
    expect(await fam.balance(teen.address)).to.equal(t0 + U(10));
    await expectInvariant(ctx);
  });

  it("reserved rewards cannot be spent, streamed, locked or paid elsewhere", async () => {
    const ctx = await loadFixture(deployMatured);
    const { fam, parent, sponsor } = ctx;
    const bal = await fam.balance(parent.address);
    await newMission(ctx, bal); // reserve everything
    expect(await fam.balance(parent.address)).to.equal(0n);
    await expect(fam.connect(parent).pay(fid("aunt"), U(1), "x")).to.be.revertedWith("insufficient");
    await expect(fam.connect(parent).fundStream(ctx.teen.address, U(1), 1n)).to.be.revertedWith("insufficient");
    await expect(fam.connect(parent).createMission(ctx.teen.address, U(1), (await time.latest()) + DAY, 0, "t", "")).to.be.revertedWith("insufficient");
    await expect(fam.connect(parent).createFutureFund(ctx.teen.address, U(5), (await time.latest()) + DAY, "f", "")).not.to.be.reverted;
    await expect(fam.connect(parent).contributeFutureFund(1, U(1))).to.be.revertedWith("insufficient");
    await expectInvariant(ctx);
  });

  it("only the designated parent creates; only that teen submits; only that parent decides", async () => {
    const ctx = await loadFixture(deployMatured);
    const { fam, parent, teen, friend, stranger, sponsor } = ctx;
    const dl = (await time.latest()) + DAY;
    // a second family: stranger becomes a parent of their own, with no teens
    await fam.connect(stranger).register(fid("otherparent"), Role.PARENT);
    await fam.connect(stranger).createFamily(0);
    await expect(fam.connect(stranger).createMission(teen.address, U(1), dl, 0, "t", "")).to.be.revertedWith("not parent of teen");
    await expect(fam.connect(sponsor).createMission(teen.address, U(1), dl, 0, "t", "")).to.be.revertedWith("not parent of teen");
    await expect(fam.connect(teen).createMission(teen.address, U(1), dl, 0, "t", "")).to.be.revertedWith("not parent of teen");

    const { id } = await newMission(ctx);
    await expect(fam.connect(friend).submitMission(id)).to.be.revertedWith("not your mission"); // another teen
    await expect(fam.connect(parent).submitMission(id)).to.be.revertedWith("not your mission");
    await fam.connect(teen).submitMission(id);
    await expect(fam.connect(stranger).approveMission(id)).to.be.revertedWith("not your mission");
    await expect(fam.connect(teen).approveMission(id)).to.be.revertedWith("not your mission");
    await expect(fam.connect(stranger).rejectMission(id, "no")).to.be.revertedWith("not your mission");
    await expect(fam.connect(teen).rejectMission(id, "no")).to.be.revertedWith("not your mission");
    await expect(fam.connect(stranger).cancelMission(id)).to.be.revertedWith("not your mission");
    await expectInvariant(ctx);
  });

  it("reject keeps the reward reserved, allows a resubmit before the deadline, then approve pays once", async () => {
    const ctx = await loadFixture(deployMatured);
    const { fam, parent, teen } = ctx;
    const { id } = await newMission(ctx, U(6));
    await expect(fam.connect(parent).rejectMission(id, "too early")).to.be.revertedWith("not submitted");
    await fam.connect(teen).submitMission(id);
    await expect(fam.connect(parent).rejectMission(id, "Missed a spot")).to.emit(fam, "MissionRejected").withArgs(id, teen.address, "Missed a spot");
    expect((await fam.missions(id)).status).to.equal(MStatus.REJECTED);
    expect(await fam.missionEscrow()).to.equal(U(6));
    await expect(fam.connect(parent).approveMission(id)).to.be.revertedWith("not submitted");
    await fam.connect(teen).submitMission(id);
    const t0 = await fam.balance(teen.address);
    await fam.connect(parent).approveMission(id);
    expect(await fam.balance(teen.address)).to.equal(t0 + U(6));
    await expectInvariant(ctx);
  });

  it("cancel and expiry refund the parent exactly once; submitted missions never expire", async () => {
    const ctx = await loadFixture(deployMatured);
    const { fam, parent, teen, stranger } = ctx;
    const p0 = await fam.balance(parent.address);
    const a = await newMission(ctx, U(4));
    const b = await newMission(ctx, U(5));
    const c = await newMission(ctx, U(7));

    await fam.connect(parent).cancelMission(a.id);
    expect((await fam.missions(a.id)).status).to.equal(MStatus.CANCELLED);
    await expect(fam.connect(parent).cancelMission(a.id)).to.be.revertedWith("not open");

    await expect(fam.expireMission(b.id)).to.be.revertedWith("not ended");
    await fam.connect(teen).submitMission(c.id);
    await time.increase(8 * DAY);
    await expect(fam.connect(teen).submitMission(b.id)).to.be.revertedWith("mission ended");
    await expect(fam.connect(stranger).expireMission(b.id)).to.emit(fam, "MissionExpired").withArgs(b.id, U(5)); // anyone may
    await expect(fam.expireMission(b.id)).to.be.revertedWith("not open");
    await expect(fam.expireMission(c.id)).to.be.revertedWith("not open"); // submitted: the parent decides
    await expect(fam.connect(parent).cancelMission(c.id)).to.be.revertedWith("not open");
    expect(await fam.balance(parent.address)).to.equal(p0 - U(7)); // only c is still reserved
    expect(await fam.missionEscrow()).to.equal(U(7));
    await fam.connect(parent).approveMission(c.id); // approving after the deadline is still the parent's call
    expect(await fam.missionEscrow()).to.equal(0n);
    await expectInvariant(ctx);
  });

  it("a rejected mission past its deadline can be expired and refunded", async () => {
    const ctx = await loadFixture(deployMatured);
    const { fam, parent, teen } = ctx;
    const p0 = await fam.balance(parent.address);
    const { id } = await newMission(ctx, U(3), 0n, 1);
    await fam.connect(teen).submitMission(id);
    await fam.connect(parent).rejectMission(id, "no");
    await time.increase(2 * DAY);
    await fam.expireMission(id);
    expect(await fam.balance(parent.address)).to.equal(p0);
    await expectInvariant(ctx);
  });

  it("enforces bounds on reward, deadline, text, goal ownership and open-mission count", async () => {
    const ctx = await loadFixture(deployMatured);
    const { fam, parent, teen, friend } = ctx;
    const now = await time.latest();
    const mk = (r: bigint, d: number, g = 0n, t = "ok", ds = "") => fam.connect(parent).createMission(teen.address, r, d, g, t, ds);
    await expect(mk(0n, now + DAY)).to.be.revertedWith("zero");
    await expect(mk(U(1), now - 1)).to.be.revertedWith("bad deadline");
    await expect(mk(U(1), now + 366 * DAY)).to.be.revertedWith("bad deadline");
    await expect(mk(U(1), now + DAY, 0n, "")).to.be.revertedWith("bad title");
    await expect(mk(U(1), now + DAY, 0n, "x".repeat(81))).to.be.revertedWith("bad title");
    await expect(mk(U(1), now + DAY, 0n, "ok", "x".repeat(281))).to.be.revertedWith("bad description");
    await expect(mk(U(1), now + DAY, 99n)).to.be.revertedWith("not your goal");
    // a goal that belongs to a different teen is refused
    await fam.connect(friend).proposeGoal(U(10), now + 30 * DAY, 0, "mine");
    await expect(mk(U(1), now + DAY, await fam.goalCount())).to.be.revertedWith("not your goal");
    for (let i = 0; i < 10; i++) await mk(U(1), now + 5 * DAY);
    await expect(mk(U(1), now + 5 * DAY)).to.be.revertedWith("too many missions");
    await expectInvariant(ctx);
  });

  it("respects freeze: no new missions or submissions, but the parent can always settle", async () => {
    const ctx = await loadFixture(deployMatured);
    const { fam, parent, teen } = ctx;
    const { id } = await newMission(ctx, U(2));
    await fam.connect(parent).freeze(teen.address);
    await expect(fam.connect(teen).submitMission(id)).to.be.revertedWith("frozen");
    await expect(fam.connect(parent).createMission(teen.address, U(1), (await time.latest()) + DAY, 0, "t", "")).to.be.revertedWith("frozen");
    await fam.connect(parent).unfreeze(teen.address);
    await fam.connect(teen).submitMission(id);
    await fam.connect(parent).freeze(teen.address);
    await fam.connect(parent).approveMission(id); // earning is not spending; the reward still arrives
    await expectInvariant(ctx);
  });

  it("approval saves into a linked active goal (and unlocks the match), else falls back to the balance", async () => {
    const ctx = await loadFixture(deployMatured);
    const { fam, parent, teen, sponsor } = ctx;
    const goal = await openGoal(ctx, U(40), 0);
    await fam.connect(sponsor).lockMatch(goal.id, U(10), 1_000_000n, goal.deadline);
    const { id } = await newMission(ctx, U(10), goal.id);
    await fam.connect(teen).submitMission(id);
    const t0 = await fam.balance(teen.address);
    await expect(fam.connect(parent).approveMission(id)).to.emit(fam, "MissionApproved").withArgs(id, teen.address, U(10), true);
    const g = await fam.goals(goal.id);
    expect(g.saved).to.equal(U(10));
    expect(g.matched).to.equal(U(10));
    expect(await fam.balance(teen.address)).to.equal(t0); // credited then saved, net zero
    await expectInvariant(ctx);

    // a goal that cannot take the reward (too big for the room left) falls back to the balance
    const small = await openGoal(ctx, U(5), 0, false);
    const m2 = await newMission(ctx, U(10), small.id);
    await fam.connect(teen).submitMission(m2.id);
    await expect(fam.connect(parent).approveMission(m2.id)).to.emit(fam, "MissionApproved").withArgs(m2.id, teen.address, U(10), false);
    expect(await fam.balance(teen.address)).to.equal(t0 + U(10));
    await expectInvariant(ctx);
  });

  it("gasless: the forwarded call keeps the real signer's identity", async () => {
    const ctx = await loadFixture(deployMatured);
    const { fam, fwd, teen, parent, relayer } = ctx;
    const { id } = await newMission(ctx, U(3));
    const net = await ethers.provider.getNetwork();
    const domain = { name: "FamFiForwarder", version: "1", chainId: net.chainId, verifyingContract: await fwd.getAddress() };
    const types = {
      ForwardRequest: [
        { name: "from", type: "address" }, { name: "to", type: "address" }, { name: "value", type: "uint256" },
        { name: "gas", type: "uint256" }, { name: "nonce", type: "uint256" }, { name: "deadline", type: "uint48" }, { name: "data", type: "bytes" },
      ],
    };
    const send = async (who: HardhatEthersSigner, fn: string, args: any[]) => {
      const data = fam.interface.encodeFunctionData(fn, args);
      const nonce = await fwd.nonces(who.address);
      const deadline = (await time.latest()) + 3600;
      const msg = { from: who.address, to: await fam.getAddress(), value: 0n, gas: 500000n, nonce, deadline, data };
      const signature = await who.signTypedData(domain, types, msg);
      return fwd.connect(relayer).execute({ ...msg, signature });
    };
    await send(teen, "submitMission", [id]);
    expect((await fam.missions(id)).status).to.equal(MStatus.SUBMITTED);
    // the relayer cannot approve on the parent's behalf: a request signed by the teen is not the parent
    await expect(send(teen, "approveMission", [id])).to.be.reverted;
    await send(parent, "approveMission", [id]);
    expect((await fam.missions(id)).status).to.equal(MStatus.APPROVED);
    await expectInvariant(ctx);
  });

  it("randomized mission and fund operations keep the ledger reconciled", async () => {
    const ctx = await loadFixture(deployMatured);
    const { fam, parent, teen, stranger } = ctx;
    let seed = 777;
    const rnd = (n: number) => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff), seed % n);
    let ok = 0;
    for (let i = 0; i < 120; i++) {
      const id = 1 + rnd(8);
      const op = rnd(10);
      try {
        if (op === 0 || op === 1) await newMission(ctx, U(rnd(20) + 1), 0n, 1 + rnd(3));
        else if (op === 2) await fam.connect(teen).submitMission(id);
        else if (op === 3) await fam.connect(parent).approveMission(id);
        else if (op === 4) await fam.connect(parent).rejectMission(id, "again");
        else if (op === 5) await fam.connect(parent).cancelMission(id);
        else if (op === 6) await fam.connect(stranger).expireMission(id);
        else if (op === 7) await time.increase(rnd(2 * DAY));
        else if (op === 8) await fam.connect(parent).createFutureFund(teen.address, U(50), (await time.latest()) + 3 * DAY, "fund", "later");
        else await fam.connect(parent).contributeFutureFund(1 + rnd(3), U(rnd(10) + 1));
        ok++;
      } catch {
        /* reverts are fine; the invariant must hold either way */
      }
      await expectInvariant(ctx);
    }
    expect(ok).to.be.greaterThan(40);
  });
});

// ───────────────────────────── FutureFund ─────────────────────────────

describe("FamFi: FutureFund (tracked and locked in Fam-Fi, not invested)", () => {
  async function newFund(ctx: any, days = 30, target = U(100)) {
    const { fam, parent, teen } = ctx;
    const horizon = (await time.latest()) + days * DAY;
    await fam.connect(parent).createFutureFund(teen.address, target, horizon, "College", "Books and a laptop");
    return { id: await fam.fundCount(), horizon };
  }

  it("a parent funds it from their balance; the money is locked and counted separately", async () => {
    const ctx = await loadFixture(deployMatured);
    const { fam, parent, teen } = ctx;
    const { id } = await newFund(ctx);
    const p0 = await fam.balance(parent.address);
    await expect(fam.connect(parent).contributeFutureFund(id, U(25))).to.emit(fam, "FundContributed").withArgs(id, parent.address, U(25), U(25));
    expect(await fam.balance(parent.address)).to.equal(p0 - U(25));
    expect((await fam.funds(id)).funded).to.equal(U(25));
    expect(await fam.fundEscrow()).to.equal(U(25));
    // the teen cannot spend it, and cannot claim early
    await expect(fam.connect(teen).claimFutureFund(id)).to.be.revertedWith("not yet");
    await expectInvariant(ctx);
  });

  it("only the parent creates, funds and releases early; only the teen claims, after the horizon", async () => {
    const ctx = await loadFixture(deployMatured);
    const { fam, parent, teen, stranger, friend } = ctx;
    const h = (await time.latest()) + 5 * DAY;
    await expect(fam.connect(teen).createFutureFund(teen.address, U(1), h, "x", "")).to.be.revertedWith("not parent of teen");
    await expect(fam.connect(stranger).createFutureFund(teen.address, U(1), h, "x", "")).to.be.revertedWith("not parent of teen");
    const { id, horizon } = await newFund(ctx, 5);
    await expect(fam.connect(stranger).contributeFutureFund(id, U(1))).to.be.revertedWith("not your fund");
    await expect(fam.connect(teen).contributeFutureFund(id, U(1))).to.be.revertedWith("not your fund");
    await fam.connect(parent).contributeFutureFund(id, U(20));
    await expect(fam.connect(teen).releaseFutureFund(id)).to.be.revertedWith("not your fund");
    await expect(fam.connect(friend).claimFutureFund(id)).to.be.revertedWith("not your fund");
    await expect(fam.connect(parent).claimFutureFund(id)).to.be.revertedWith("not your fund");
    await time.increaseTo(horizon);
    const t0 = await fam.balance(teen.address);
    await expect(fam.connect(teen).claimFutureFund(id)).to.emit(fam, "FundReleased").withArgs(id, teen.address, U(20), true);
    expect(await fam.balance(teen.address)).to.equal(t0 + U(20));
    expect(await fam.fundEscrow()).to.equal(0n);
    // once released: no second claim, no more contributions
    await expect(fam.connect(teen).claimFutureFund(id)).to.be.revertedWith("fund not open");
    await expect(fam.connect(parent).releaseFutureFund(id)).to.be.revertedWith("fund not open");
    await expect(fam.connect(parent).contributeFutureFund(id, U(1))).to.be.revertedWith("fund not open");
    await expectInvariant(ctx);
  });

  it("the parent can release early to the teen; empty funds and bad inputs are refused", async () => {
    const ctx = await loadFixture(deployMatured);
    const { fam, parent, teen } = ctx;
    const now = await time.latest();
    await expect(fam.connect(parent).createFutureFund(teen.address, 0n, now + DAY, "x", "")).to.be.revertedWith("zero");
    await expect(fam.connect(parent).createFutureFund(teen.address, U(1), now - 1, "x", "")).to.be.revertedWith("bad horizon");
    await expect(fam.connect(parent).createFutureFund(teen.address, U(1), now + 41 * 365 * DAY, "x", "")).to.be.revertedWith("bad horizon");
    await expect(fam.connect(parent).createFutureFund(teen.address, U(1), now + DAY, "", "")).to.be.revertedWith("bad name");
    await expect(fam.connect(parent).createFutureFund(teen.address, U(1), now + DAY, "x", "y".repeat(201))).to.be.revertedWith("bad purpose");
    const { id } = await newFund(ctx);
    await expect(fam.connect(parent).releaseFutureFund(id)).to.be.revertedWith("nothing in fund");
    await expect(fam.connect(parent).contributeFutureFund(id, 0n)).to.be.revertedWith("zero");
    await fam.connect(parent).contributeFutureFund(id, U(9));
    const t0 = await fam.balance(teen.address);
    await fam.connect(parent).releaseFutureFund(id);
    expect(await fam.balance(teen.address)).to.equal(t0 + U(9));
    await expectInvariant(ctx);
  });
});
