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
