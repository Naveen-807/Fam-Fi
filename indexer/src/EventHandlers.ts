import { indexer } from "envio";

// ───────────── helpers ─────────────
const ROLE = ["NONE", "PARENT", "TEEN", "SPONSOR", "MERCHANT"];
const KIND = ["OVER_LIMIT", "ANOMALY"];
const STATUS = ["NONE", "OPEN", "EXECUTED", "REJECTED", "CANCELLED"];
const REF = ["NONE", "SPLIT", "REQUEST"];

/** bytes32 hex -> the Fam-ID text it encodes (left aligned, zero padded). */
function famIdText(hex: string): string {
  const h = hex.startsWith("0x") ? hex.slice(2) : hex;
  let out = "";
  for (let i = 0; i < h.length; i += 2) {
    const c = parseInt(h.slice(i, i + 2), 16);
    if (c === 0) break;
    out += String.fromCharCode(c);
  }
  return out;
}

const lc = (a: string) => a.toLowerCase();
const money = (n: bigint) => (Number(n) / 1e6).toFixed(2);
const short = (a: string) => `${a.slice(0, 6)}…${a.slice(-4)}`;
const cap = (s: string) => (s ? s[0].toUpperCase() + s.slice(1) : s);
const ts = (e: { block: { timestamp: number } }) => e.block.timestamp;
const tx = (e: { transaction: { hash: string } }) => e.transaction.hash;
const eid = (e: { transaction: { hash: string }; logIndex: number }) => `${e.transaction.hash}-${e.logIndex}`;

type Ctx = any; // entity operations are fully typed by envio; helpers below only need get/set

async function person(context: Ctx, addr: string) {
  const u = await context.User.get(lc(addr));
  return { name: u ? cap(u.famId) : short(addr), familyId: u ? u.familyId : 0, user: u };
}

function timeline(
  context: Ctx,
  e: { transaction: { hash: string }; logIndex: number; block: { timestamp: number } },
  t: {
    kind: string;
    text: string;
    actor: string;
    actorFamily: number;
    counterparty?: string;
    counterpartyFamily?: number;
    amount?: bigint;
    suffix?: string;
  },
) {
  context.TimelineEntry.set({
    id: eid(e) + (t.suffix ?? ""),
    ts: e.block.timestamp,
    kind: t.kind,
    text: t.text,
    amount: t.amount,
    actor: lc(t.actor),
    counterparty: t.counterparty ? lc(t.counterparty) : undefined,
    familyId: t.actorFamily,
    counterpartyFamilyId: t.counterpartyFamily ?? 0,
    txHash: e.transaction.hash,
  });
}


// ───────────── Progress Passport helpers ─────────────
const DAY = 86400;
/** Local-week index (Monday start) of a UTC timestamp in a family's time zone. Day 0 (1970-01-01) was a Thursday. */
export const weekOf = (tsSec: number, tz: number) => Math.floor((Math.floor((tsSec + tz) / DAY) + 3) / 7);
/** UTC timestamp of local Monday 00:00 for a week index. */
export const weekStartTs = (week: number, tz: number) => (week * 7 - 3) * DAY - tz;

const blockNo = (e: { block: { number: number } }) => e.block.number;

type Counters = {
  missionsCompleted: number;
  missionRewards: bigint;
  savedTotal: bigint;
  goalsCompleted: number;
  paymentsCompleted: number;
};
const ZERO: Counters = { missionsCompleted: 0, missionRewards: 0n, savedTotal: 0n, goalsCompleted: 0, paymentsCompleted: 0 };

function bump(c: Counters, kind: string, amount: bigint): Counters {
  switch (kind) {
    case "MISSION_APPROVED": return { ...c, missionsCompleted: c.missionsCompleted + 1, missionRewards: c.missionRewards + amount };
    case "SAVED": return { ...c, savedTotal: c.savedTotal + amount };
    case "GOAL_COMPLETED": return { ...c, goalsCompleted: c.goalsCompleted + 1 };
    case "PAYMENT": return { ...c, paymentsCompleted: c.paymentsCompleted + 1 };
    default: return c;
  }
}

async function familyTz(context: Ctx, familyId: number): Promise<number> {
  const f = await context.Family.get(String(familyId));
  return f ? f.tzOffset : 0;
}

/**
 * Record one confirmed, qualifying action for a teen. The ProgressEvent id is the source event (txHash-logIndex + kind),
 * so replaying the same event is a no-op: totals can never count an action twice.
 */
async function recordProgress(
  context: Ctx,
  e: { transaction: { hash: string }; logIndex: number; block: { timestamp: number; number: number } },
  teenAddr: string,
  kind: string,
  amount: bigint,
  text: string,
) {
  const id = `${eid(e)}-${kind}`;
  if (await context.ProgressEvent.get(id)) return;
  const teen = await person(context, teenAddr);
  if (!teen.user || teen.user.role !== "TEEN") return;
  const tz = await familyTz(context, teen.familyId);
  const week = weekOf(ts(e), tz);
  const weekId = `${lc(teenAddr)}-${week}`;
  context.ProgressEvent.set({
    id, teen: lc(teenAddr), familyId: teen.familyId, kind, amount, text, weekId, ts: ts(e), blockNumber: blockNo(e), txHash: tx(e),
  });
  const wk = await getWeek(context, teenAddr, teen.user.famId, teen.familyId, week, tz);
  // Context rows for the weekly brief only: they are not Passport achievements.
  if (kind === "ALLOWANCE") return void context.WeeklyStat.set({ ...wk, allowanceFunded: wk.allowanceFunded + amount });
  if (kind === "HELD") return void context.WeeklyStat.set({ ...wk, heldCount: wk.heldCount + 1 });
  const total = await context.TeenProgress.get(lc(teenAddr));
  context.TeenProgress.set({
    id: lc(teenAddr),
    familyId: teen.familyId,
    teenFamId: teen.user.famId,
    ...bump(total ?? ZERO, kind, amount),
    lastEventTs: ts(e),
    lastEventBlock: blockNo(e),
  });
  context.WeeklyStat.set({ ...wk, ...bump(wk, kind, amount) });
}

async function getWeek(context: Ctx, teenAddr: string, teenFamId: string, familyId: number, week: number, tz: number) {
  const id = `${lc(teenAddr)}-${week}`;
  return (
    (await context.WeeklyStat.get(id)) ?? {
      id, teen: lc(teenAddr), teenFamId, familyId, week, weekStart: weekStartTs(week, tz), ...ZERO, allowanceFunded: 0n, heldCount: 0,
    }
  );
}

const on = (event: string, handler: (args: any) => Promise<void>) =>
  (indexer as any).onEvent({ contract: "FamFi", event }, handler);

// ───────────── people and families ─────────────
on("FamIdRegistered", async ({ event, context }) => {
  context.User.set({
    id: lc(event.params.user),
    famId: famIdText(event.params.famId),
    role: ROLE[Number(event.params.role)] ?? "NONE",
    familyId: 0,
    level: 0,
    frozen: false,
    createdAt: ts(event),
  });
});

on("FamilyCreated", async ({ event, context }) => {
  const parent = await context.User.get(lc(event.params.parent));
  const familyId = Number(event.params.familyId);
  context.Family.set({
    id: String(familyId),
    parent: lc(event.params.parent),
    parentFamId: parent?.famId ?? "",
    createdAt: ts(event),
    tzOffset: Number(event.params.tzOffset),
  });
  if (parent) context.User.set({ ...parent, familyId });
  timeline(context, event, {
    kind: "family",
    text: `${cap(parent?.famId ?? "A parent")} created a family`,
    actor: event.params.parent,
    actorFamily: familyId,
  });
});

on("TeenAdded", async ({ event, context }) => {
  const familyId = Number(event.params.familyId);
  const teen = await context.User.get(lc(event.params.teen));
  if (teen) context.User.set({ ...teen, familyId });
  const fam = await context.Family.get(String(familyId));
  timeline(context, event, {
    kind: "teen_joined",
    text: `${cap(famIdText(event.params.famId))} joined the family`,
    actor: event.params.teen,
    actorFamily: familyId,
    counterparty: fam?.parent,
    counterpartyFamily: familyId,
  });
});

// ───────────── money in ─────────────
on("Deposited", async ({ event, context }) => {
  const p = await person(context, event.params.user);
  timeline(context, event, {
    kind: "deposit",
    text: `${money(event.params.amount)} added to ${p.name}'s account`,
    actor: event.params.user,
    actorFamily: p.familyId,
    amount: event.params.amount,
  });
});

on("StreamFunded", async ({ event, context }) => {
  const teen = await person(context, event.params.teen);
  const fam = await context.Family.get(String(teen.familyId));
  context.Stream.set({
    id: lc(event.params.teen),
    remaining: event.params.remaining,
    rate: event.params.rate,
    updatedAt: ts(event),
  });
  const perHour = (Number(event.params.rate) * 3600) / 1e6;
  timeline(context, event, {
    kind: "allowance",
    text: `${cap(fam?.parentFamId ?? "A parent")} set aside ${money(event.params.budget)} for ${teen.name}'s allowance (about ${perHour.toFixed(2)} an hour)`,
    actor: fam?.parent ?? event.params.teen,
    actorFamily: teen.familyId,
    counterparty: event.params.teen,
    counterpartyFamily: teen.familyId,
    amount: event.params.budget,
  });
  await recordProgress(context, event, event.params.teen, "ALLOWANCE", event.params.budget, "Allowance funded");
});

// ───────────── payments ─────────────
on("Paid", async ({ event, context }) => {
  const from = await person(context, event.params.from);
  const to = await person(context, event.params.to);
  context.Payment.set({
    id: eid(event),
    fromAddr: lc(event.params.from),
    toAddr: lc(event.params.to),
    fromFamId: from.user?.famId ?? "",
    toFamId: to.user?.famId ?? "",
    amount: event.params.amount,
    memo: event.params.memo,
    ts: ts(event),
    txHash: tx(event),
  });
  const note = event.params.memo && !["split", "request", "goal"].includes(event.params.memo) ? ` for "${event.params.memo}"` : "";
  timeline(context, event, {
    kind: "payment",
    text: `${from.name} paid ${to.name} ${money(event.params.amount)}${note}`,
    actor: event.params.from,
    actorFamily: from.familyId,
    counterparty: event.params.to,
    counterpartyFamily: to.familyId,
    amount: event.params.amount,
  });
  // A Paid event only exists once money has really moved: inside the rules, approved by a parent, or released after a hold.
  if (event.params.memo !== "goal") {
    await recordProgress(context, event, event.params.from, "PAYMENT", event.params.amount, `Completed a payment to ${to.name}`);
  }
});

on("PaymentHeld", async ({ event, context }) => {
  const from = await person(context, event.params.from);
  const to = await person(context, event.params.to);
  const kind = KIND[Number(event.params.kind)] ?? "ANOMALY";
  context.Pending.set({
    id: String(event.params.id),
    fromAddr: lc(event.params.from),
    toAddr: lc(event.params.to),
    fromFamId: from.user?.famId ?? "",
    toFamId: to.user?.famId ?? "",
    familyId: from.familyId,
    amount: event.params.amount,
    kind,
    status: "OPEN",
    releaseAt: Number(event.params.releaseAt),
    refKind: REF[Number(event.params.refKind)] ?? "NONE",
    refId: String(event.params.refId),
    memo: event.params.memo,
    createdAt: ts(event),
    txHash: tx(event),
  });
  const why =
    kind === "OVER_LIMIT"
      ? "it is over today's limit, so a parent has to approve it"
      : "it looked unusual, so it is on a short hold and a parent was alerted";
  timeline(context, event, {
    kind: "held",
    text: `${from.name}'s payment of ${money(event.params.amount)} to ${to.name} is on hold: ${why}`,
    actor: event.params.from,
    actorFamily: from.familyId,
    counterparty: event.params.to,
    counterpartyFamily: to.familyId,
    amount: event.params.amount,
  });
  await recordProgress(context, event, event.params.from, "HELD", event.params.amount, "Payment held");
});

on("PendingResolved", async ({ event, context }) => {
  const p = await context.Pending.get(String(event.params.id));
  if (!p) return;
  const outcome = STATUS[Number(event.params.outcome)] ?? "EXECUTED";
  context.Pending.set({ ...p, status: outcome });

  if (outcome === "REJECTED" || outcome === "CANCELLED") {
    // the share / request goes back to being unpaid
    if (p.refKind === "SPLIT") {
      const shareId = `${p.refId}-${p.fromAddr}`;
      const share = await context.SplitShare.get(shareId);
      if (share && share.active) context.SplitShare.set({ ...share, active: false });
      const split = await context.Split.get(p.refId);
      if (split && split.paid > 0) context.Split.set({ ...split, paid: split.paid - 1 });
    } else if (p.refKind === "REQUEST") {
      const r = await context.Request.get(p.refId);
      if (r) context.Request.set({ ...r, status: "OPEN" });
    }
  }
  const verb =
    outcome === "EXECUTED" ? "went through" : outcome === "REJECTED" ? "was rejected and returned" : "was cancelled and returned";
  timeline(context, event, {
    kind: outcome === "EXECUTED" ? "released" : "hold_" + outcome.toLowerCase(),
    text: `${cap(p.fromFamId)}'s held payment of ${money(p.amount)} to ${cap(p.toFamId)} ${verb}`,
    actor: p.fromAddr,
    actorFamily: p.familyId,
    counterparty: p.toAddr,
    amount: p.amount,
  });
});

// ───────────── parent controls ─────────────
on("LimitsSet", async ({ event, context }) => {
  const teen = await person(context, event.params.teen);
  const fam = await context.Family.get(String(teen.familyId));
  timeline(context, event, {
    kind: "limits",
    text: `${cap(fam?.parentFamId ?? "A parent")} updated ${teen.name}'s spending rules (level 1 limit ${money(event.params.levelLimits[0])} a day)`,
    actor: fam?.parent ?? event.params.teen,
    actorFamily: teen.familyId,
    counterparty: event.params.teen,
    counterpartyFamily: teen.familyId,
  });
});

for (const [name, frozen] of [["Frozen", true], ["Unfrozen", false]] as const) {
  on(name, async ({ event, context }) => {
    const teen = await person(context, event.params.teen);
    if (teen.user) context.User.set({ ...teen.user, frozen });
    const fam = await context.Family.get(String(teen.familyId));
    timeline(context, event, {
      kind: frozen ? "freeze" : "unfreeze",
      text: `${cap(fam?.parentFamId ?? "A parent")} ${frozen ? "froze" : "unfroze"} ${teen.name}'s spending`,
      actor: fam?.parent ?? event.params.teen,
      actorFamily: teen.familyId,
      counterparty: event.params.teen,
      counterpartyFamily: teen.familyId,
    });
  });
}

on("RoundUpSet", async ({ event, context }) => {
  const teen = await person(context, event.params.teen);
  timeline(context, event, {
    kind: "roundup",
    text:
      event.params.unit === 0n
        ? `${teen.name} turned off round-up`
        : `${teen.name} turned on round-up to the nearest ${money(event.params.unit)}`,
    actor: event.params.teen,
    actorFamily: teen.familyId,
  });
});

// ───────────── goals and matched gifts ─────────────
on("GoalProposed", async ({ event, context }) => {
  const teen = await person(context, event.params.teen);
  context.Goal.set({
    id: String(event.params.goalId),
    teen: lc(event.params.teen),
    teenFamId: teen.user?.famId ?? "",
    familyId: teen.familyId,
    target: event.params.target,
    saved: 0n,
    matched: 0n,
    status: "PROPOSED",
    deadline: Number(event.params.deadline),
    memo: event.params.memo,
    sponsorOpen: false,
    createdAt: ts(event),
  });
  timeline(context, event, {
    kind: "goal_proposed",
    text: `${teen.name} wants to save ${money(event.params.target)} for "${event.params.memo}"`,
    actor: event.params.teen,
    actorFamily: teen.familyId,
    amount: event.params.target,
  });
});

on("GoalApproved", async ({ event, context }) => {
  const g = await context.Goal.get(String(event.params.goalId));
  if (!g) return;
  context.Goal.set({ ...g, status: "ACTIVE", sponsorOpen: event.params.sponsorOpen });
  const fam = await context.Family.get(String(g.familyId));
  timeline(context, event, {
    kind: "goal_approved",
    text: `${cap(fam?.parentFamId ?? "A parent")} approved ${cap(g.teenFamId)}'s goal "${g.memo}"${event.params.sponsorOpen ? " and opened it for gifts" : ""}`,
    actor: fam?.parent ?? g.teen,
    actorFamily: g.familyId,
    counterparty: g.teen,
    counterpartyFamily: g.familyId,
  });
});

on("GiftLocked", async ({ event, context }) => {
  const sponsor = await person(context, event.params.sponsor);
  const g = await context.Goal.get(String(event.params.goalId));
  context.Gift.set({
    id: String(event.params.giftId),
    goalId: String(event.params.goalId),
    sponsor: lc(event.params.sponsor),
    sponsorFamId: sponsor.user?.famId ?? "",
    amount: event.params.amount,
    escrow: event.params.amount,
    released: 0n,
    ratio: event.params.ratio,
    deadline: Number(event.params.deadline),
    createdAt: ts(event),
  });
  const r = Number(event.params.ratio) / 1e6;
  const ratioText = r === 1 ? "1 for 1" : `${r} for every 1`;
  timeline(context, event, {
    kind: "gift_locked",
    text: `${sponsor.name} put ${money(event.params.amount)} behind "${g?.memo ?? "a goal"}", matching ${ratioText} as ${cap(g?.teenFamId ?? "the teen")} saves`,
    actor: event.params.sponsor,
    actorFamily: sponsor.familyId,
    counterparty: g?.teen,
    counterpartyFamily: g?.familyId ?? 0,
    amount: event.params.amount,
  });
});

on("GiftReleased", async ({ event, context }) => {
  const gf = await context.Gift.get(String(event.params.giftId));
  if (!gf) return;
  context.Gift.set({ ...gf, escrow: gf.escrow - event.params.amount, released: gf.released + event.params.amount });
  const g = await context.Goal.get(String(event.params.goalId));
  timeline(context, event, {
    kind: "gift_released",
    text: `${cap(gf.sponsorFamId)}'s gift released ${money(event.params.amount)} into "${g?.memo ?? "the goal"}"`,
    actor: gf.sponsor,
    actorFamily: 0,
    counterparty: g?.teen,
    counterpartyFamily: g?.familyId ?? 0,
    amount: event.params.amount,
    suffix: "-gift",
  });
});

on("GoalSaved", async ({ event, context }) => {
  const g = await context.Goal.get(String(event.params.goalId));
  if (!g) return;
  context.Goal.set({ ...g, saved: event.params.saved, matched: event.params.matched });
  timeline(context, event, {
    kind: "goal_saved",
    text: `${cap(g.teenFamId)} saved ${money(event.params.amount)} toward "${g.memo}" (${money(event.params.saved + event.params.matched)} of ${money(g.target)})`,
    actor: g.teen,
    actorFamily: g.familyId,
    amount: event.params.amount,
  });
  await recordProgress(context, event, g.teen, "SAVED", event.params.amount, `Saved ${money(event.params.amount)} toward "${g.memo}"`);
});

on("GoalCompleted", async ({ event, context }) => {
  const g = await context.Goal.get(String(event.params.goalId));
  if (!g) return;
  context.Goal.set({ ...g, status: "COMPLETE" });
  timeline(context, event, {
    kind: "goal_complete",
    text: `${cap(g.teenFamId)} reached the goal "${g.memo}"`,
    actor: g.teen,
    actorFamily: g.familyId,
    amount: event.params.total,
  });
  await recordProgress(context, event, g.teen, "GOAL_COMPLETED", event.params.total, `Reached the goal "${g.memo}"`);
});

on("LevelUp", async ({ event, context }) => {
  const teen = await person(context, event.params.teen);
  if (teen.user) context.User.set({ ...teen.user, level: Number(event.params.newLevel) });
  timeline(context, event, {
    kind: "level_up",
    text: `${teen.name} moved up to level ${Number(event.params.newLevel) + 1}: a higher daily limit`,
    actor: event.params.teen,
    actorFamily: teen.familyId,
  });
});

on("GiftReclaimed", async ({ event, context }) => {
  const gf = await context.Gift.get(String(event.params.giftId));
  if (gf) context.Gift.set({ ...gf, escrow: 0n });
  const sponsor = await person(context, event.params.sponsor);
  timeline(context, event, {
    kind: "gift_reclaimed",
    text: `${sponsor.name} took back the unmatched ${money(event.params.amount)}`,
    actor: event.params.sponsor,
    actorFamily: sponsor.familyId,
    amount: event.params.amount,
  });
});

on("GoalClosed", async ({ event, context }) => {
  const g = await context.Goal.get(String(event.params.goalId));
  if (!g) return;
  context.Goal.set({ ...g, status: "CLOSED" });
  timeline(context, event, {
    kind: "goal_closed",
    text: `${cap(g.teenFamId)}'s goal "${g.memo}" ended; ${money(event.params.returned)} went back to their balance`,
    actor: g.teen,
    actorFamily: g.familyId,
    amount: event.params.returned,
  });
});

on("GoalSpent", async ({ event, context }) => {
  const g = await context.Goal.get(String(event.params.goalId));
  if (g) context.Goal.set({ ...g, status: "CLOSED" });
  const to = await person(context, event.params.to);
  timeline(context, event, {
    kind: "goal_spent",
    text: `${cap(g?.teenFamId ?? "A teen")} bought "${g?.memo ?? "their goal"}" from ${to.name} for ${money(event.params.amount)}`,
    actor: event.params.teen,
    actorFamily: g?.familyId ?? 0,
    counterparty: event.params.to,
    counterpartyFamily: to.familyId,
    amount: event.params.amount,
    suffix: "-spent",
  });
});

// ───────────── splits and requests ─────────────
on("SplitCreated", async ({ event, context }) => {
  const c = await person(context, event.params.creator);
  context.Split.set({
    id: String(event.params.splitId),
    creator: lc(event.params.creator),
    creatorFamId: c.user?.famId ?? "",
    perShare: event.params.perShare,
    slots: Number(event.params.slots),
    paid: 0,
    memo: event.params.memo,
    createdAt: ts(event),
  });
  timeline(context, event, {
    kind: "split_created",
    text: `${c.name} split "${event.params.memo}": ${money(event.params.perShare)} each between ${Number(event.params.slots)} friends`,
    actor: event.params.creator,
    actorFamily: c.familyId,
    amount: event.params.perShare,
  });
});

on("SplitSharePaid", async ({ event, context }) => {
  const split = await context.Split.get(String(event.params.splitId));
  const payer = await person(context, event.params.payer);
  context.SplitShare.set({
    id: `${event.params.splitId}-${lc(event.params.payer)}`,
    splitId: String(event.params.splitId),
    payer: lc(event.params.payer),
    payerFamId: payer.user?.famId ?? "",
    active: true,
    ts: ts(event),
  });
  if (split) context.Split.set({ ...split, paid: Number(event.params.paidCount) });
  timeline(context, event, {
    kind: "split_share",
    text: `${payer.name} took a share of "${split?.memo ?? "a split"}" (${Number(event.params.paidCount)} of ${split?.slots ?? "?"})`,
    actor: event.params.payer,
    actorFamily: payer.familyId,
    counterparty: split?.creator,
    suffix: "-split",
  });
});

on("RequestCreated", async ({ event, context }) => {
  const from = await person(context, event.params.from);
  const to = await person(context, event.params.to);
  context.Request.set({
    id: String(event.params.requestId),
    fromAddr: lc(event.params.from),
    toAddr: lc(event.params.to),
    fromFamId: from.user?.famId ?? "",
    toFamId: to.user?.famId ?? "",
    amount: event.params.amount,
    status: "OPEN",
    memo: event.params.memo,
    createdAt: ts(event),
  });
  timeline(context, event, {
    kind: "request",
    text: `${from.name} asked ${to.name} for ${money(event.params.amount)}${event.params.memo ? ` ("${event.params.memo}")` : ""}`,
    actor: event.params.from,
    actorFamily: from.familyId,
    counterparty: event.params.to,
    counterpartyFamily: to.familyId,
    amount: event.params.amount,
  });
});

on("RequestPaid", async ({ event, context }) => {
  const r = await context.Request.get(String(event.params.requestId));
  if (r) context.Request.set({ ...r, status: "PAID" });
});

// ───────────── missions ─────────────

on("MissionCreated", async ({ event, context }) => {
  const teen = await person(context, event.params.teen);
  const parent = await person(context, event.params.parent);
  context.Mission.set({
    id: String(event.params.missionId),
    familyId: teen.familyId,
    parent: lc(event.params.parent),
    parentFamId: parent.user?.famId ?? "",
    teen: lc(event.params.teen),
    teenFamId: teen.user?.famId ?? "",
    reward: event.params.reward,
    deadline: Number(event.params.deadline),
    goalId: String(event.params.goalId),
    status: "ACTIVE",
    title: event.params.title,
    description: event.params.description,
    feedback: "",
    createdAt: ts(event),
    submittedAt: 0,
    resolvedAt: 0,
    savedToGoal: false,
    txHash: tx(event),
    lastTxHash: tx(event),
  });
  timeline(context, event, {
    kind: "mission_created",
    text: `${parent.name} set a mission for ${teen.name}: "${event.params.title}" for ${money(event.params.reward)}, reserved up front`,
    actor: event.params.parent,
    actorFamily: teen.familyId,
    counterparty: event.params.teen,
    counterpartyFamily: teen.familyId,
    amount: event.params.reward,
  });
});

/** Move a mission to a new status only along a legal edge; a replayed or out-of-order event is ignored. */
async function transition(context: Ctx, id: bigint, from: string[], patch: (m: any) => any) {
  const m = await context.Mission.get(String(id));
  if (!m || !from.includes(m.status)) return null;
  const next = patch(m);
  context.Mission.set(next);
  return next;
}

on("MissionSubmitted", async ({ event, context }) => {
  const m = await transition(context, event.params.missionId, ["ACTIVE", "REJECTED"], (m) => ({
    ...m, status: "SUBMITTED", submittedAt: ts(event), lastTxHash: tx(event),
  }));
  if (!m) return;
  timeline(context, event, {
    kind: "mission_submitted",
    text: `${cap(m.teenFamId)} says "${m.title}" is done and is waiting for ${cap(m.parentFamId)} to review it`,
    actor: m.teen,
    actorFamily: m.familyId,
    counterparty: m.parent,
    counterpartyFamily: m.familyId,
    amount: m.reward,
  });
});

on("MissionRejected", async ({ event, context }) => {
  const m = await transition(context, event.params.missionId, ["SUBMITTED"], (m) => ({
    ...m, status: "REJECTED", feedback: event.params.feedback, lastTxHash: tx(event),
  }));
  if (!m) return;
  timeline(context, event, {
    kind: "mission_rejected",
    text: `${cap(m.parentFamId)} sent "${m.title}" back${event.params.feedback ? `: "${event.params.feedback}"` : ""}. The ${money(m.reward)} stays reserved and ${cap(m.teenFamId)} can try again before the deadline`,
    actor: m.parent,
    actorFamily: m.familyId,
    counterparty: m.teen,
    counterpartyFamily: m.familyId,
    amount: m.reward,
  });
});

on("MissionApproved", async ({ event, context }) => {
  const m = await transition(context, event.params.missionId, ["SUBMITTED"], (m) => ({
    ...m, status: "APPROVED", resolvedAt: ts(event), savedToGoal: event.params.savedToGoal, lastTxHash: tx(event),
  }));
  if (!m) return;
  timeline(context, event, {
    kind: "mission_approved",
    text: `${cap(m.parentFamId)} approved "${m.title}". ${cap(m.teenFamId)} earned ${money(event.params.reward)}${event.params.savedToGoal ? " and it went straight into their savings goal" : ""}`,
    actor: m.parent,
    actorFamily: m.familyId,
    counterparty: m.teen,
    counterpartyFamily: m.familyId,
    amount: event.params.reward,
  });
  await recordProgress(context, event, m.teen, "MISSION_APPROVED", event.params.reward, `Completed the mission "${m.title}"`);
});

for (const [name, status, verb] of [
  ["MissionCancelled", "CANCELLED", "cancelled"],
  ["MissionExpired", "EXPIRED", "ran out of time"],
] as const) {
  on(name, async ({ event, context }) => {
    const m = await transition(context, event.params.missionId, ["ACTIVE", "REJECTED"], (m) => ({
      ...m, status, resolvedAt: ts(event), lastTxHash: tx(event),
    }));
    if (!m) return;
    timeline(context, event, {
      kind: "mission_" + status.toLowerCase(),
      text: `The mission "${m.title}" ${verb}. The reserved ${money(event.params.refunded)} went back to ${cap(m.parentFamId)}`,
      actor: m.parent,
      actorFamily: m.familyId,
      counterparty: m.teen,
      counterpartyFamily: m.familyId,
      amount: event.params.refunded,
    });
  });
}

// ───────────── FutureFund ─────────────
function fundEntry(
  context: Ctx,
  e: { transaction: { hash: string }; logIndex: number; block: { timestamp: number; number: number } },
  f: { id: string; teen: string; familyId: number },
  kind: string,
  amount: bigint,
  text: string,
) {
  context.FundEntry.set({
    id: eid(e), fundId: f.id, teen: f.teen, familyId: f.familyId, kind, amount, text, ts: ts(e), blockNumber: blockNo(e), txHash: tx(e),
  });
}

on("FundCreated", async ({ event, context }) => {
  const teen = await person(context, event.params.teen);
  const parent = await person(context, event.params.parent);
  const f = {
    id: String(event.params.fundId),
    familyId: teen.familyId,
    parent: lc(event.params.parent),
    teen: lc(event.params.teen),
    teenFamId: teen.user?.famId ?? "",
    name: event.params.name,
    purpose: event.params.purpose,
    target: event.params.target,
    funded: 0n,
    horizon: Number(event.params.horizon),
    status: "OPEN",
    createdAt: ts(event),
    releasedAt: 0,
  };
  context.FutureFund.set(f);
  const text = `${parent.name} opened the FutureFund "${event.params.name}" for ${teen.name}, aiming for ${money(event.params.target)}. Money in it is held in Fam-Fi and is not invested`;
  fundEntry(context, event, f, "CREATED", event.params.target, text);
  timeline(context, event, {
    kind: "fund_created", text, actor: event.params.parent, actorFamily: teen.familyId,
    counterparty: event.params.teen, counterpartyFamily: teen.familyId, amount: event.params.target,
  });
});

on("FundContributed", async ({ event, context }) => {
  const f = await context.FutureFund.get(String(event.params.fundId));
  if (!f || f.status !== "OPEN") return;
  // `funded` comes straight from the contract's running total, so replaying the event cannot double count.
  context.FutureFund.set({ ...f, funded: event.params.funded });
  const parent = await person(context, event.params.parent);
  const text = `${parent.name} added ${money(event.params.amount)} to ${cap(f.teenFamId)}'s FutureFund "${f.name}". The contribution is confirmed; it is held in Fam-Fi and has not been invested`;
  fundEntry(context, event, f, "CONTRIBUTED", event.params.amount, text);
  timeline(context, event, {
    kind: "fund_contributed", text, actor: event.params.parent, actorFamily: f.familyId,
    counterparty: f.teen, counterpartyFamily: f.familyId, amount: event.params.amount,
  });
});

on("FundReleased", async ({ event, context }) => {
  const f = await context.FutureFund.get(String(event.params.fundId));
  if (!f || f.status !== "OPEN") return;
  context.FutureFund.set({ ...f, status: "RELEASED", releasedAt: ts(event) });
  const text = event.params.byTeen
    ? `${cap(f.teenFamId)} claimed ${money(event.params.amount)} from the FutureFund "${f.name}" after its target date`
    : `${cap(f.teenFamId)}'s parent released ${money(event.params.amount)} from the FutureFund "${f.name}" early`;
  fundEntry(context, event, f, "RELEASED", event.params.amount, text);
  timeline(context, event, {
    kind: "fund_released", text, actor: event.params.byTeen ? f.teen : f.parent, actorFamily: f.familyId,
    counterparty: event.params.byTeen ? f.parent : f.teen, counterpartyFamily: f.familyId, amount: event.params.amount,
  });
});
