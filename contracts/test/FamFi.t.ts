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

async function inviteSig(fam: any, parent: HardhatEthersSigner, familyId: number, inviteId: string, deadline: number) {
  const net = await ethers.provider.getNetwork();
  const domain = { name: "FamFi", version: "1", chainId: net.chainId, verifyingContract: await fam.getAddress() };
  const types = {
    Invite: [
      { name: "familyId", type: "uint32" },
      { name: "inviteId", type: "bytes32" },
      { name: "deadline", type: "uint256" },
    ],
  };
  return parent.signTypedData(domain, types, { familyId, inviteId, deadline });
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
    await fam.connect(who).acceptInvite(1, inviteId, deadline, sig, fid(name));
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
    await expect(fam.connect(stranger).acceptInvite(1, id1, deadline, badSig, fid("kid"))).to.be.revertedWith("bad invite sig");
    const sig = await inviteSig(fam, parent, 1, id1, deadline);
    await fam.connect(stranger).acceptInvite(1, id1, deadline, sig, fid("kid"));
    expect((await fam.accounts(stranger.address)).role).to.equal(Role.TEEN);
    await expect(fam.connect(sponsor).acceptInvite(1, id1, deadline, sig, fid("kid2"))).to.be.revertedWith("invite used");
    const id2 = ethers.id("x2");
    const sig2 = await inviteSig(fam, parent, 1, id2, deadline);
    await time.increase(2 * DAY);
    await expect(fam.connect(sponsor).acceptInvite(1, id2, deadline, sig2, fid("kid3"))).to.be.revertedWith("invite expired");
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
