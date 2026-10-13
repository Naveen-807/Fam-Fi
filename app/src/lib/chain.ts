import { ethers } from "ethers";
import famAbi from "@abi/FamFi.json";
import fwdAbi from "@abi/FamFiForwarder.json";
import { cfg } from "./config";
import { big } from "./format";

export const provider = new ethers.JsonRpcProvider(cfg.rpcUrl, cfg.chainId, { staticNetwork: true });
export const fam = new ethers.Contract(cfg.famfi || ethers.ZeroAddress, famAbi, provider);
export const fwd = new ethers.Contract(cfg.forwarder || ethers.ZeroAddress, fwdAbi, provider);

export const famIdBytes = (s: string) => ethers.encodeBytes32String(s);
export function bytesToFamId(b: string): string {
  try {
    return ethers.decodeBytes32String(b);
  } catch {
    return "";
  }
}

export const ROLE = { NONE: 0, PARENT: 1, TEEN: 2, SPONSOR: 3, MERCHANT: 4 } as const;
export const ROLE_NAME = ["none", "parent", "teen", "relative", "shop"];

export type Account = { role: number; familyId: number; famId: string; linkedAt: number };

export async function readAccount(addr: string): Promise<Account> {
  const a = await fam.accounts(addr);
  return { role: Number(a.role), familyId: Number(a.familyId), famId: bytesToFamId(a.famId), linkedAt: Number(a.linkedAt) };
}

export async function famIdAddress(id: string): Promise<string> {
  return fam.famIdToAddr(famIdBytes(id));
}

export async function famIdTaken(id: string): Promise<boolean> {
  return (await famIdAddress(id)) !== ethers.ZeroAddress;
}

export const readBalance = async (addr: string): Promise<bigint> => fam.balance(addr);

export type TeenView = {
  balance: bigint; // settled balance
  accrued: bigint; // streamed but not yet settled
  streamRemaining: bigint;
  rate: bigint; // per second
  fetchedAt: number; // ms, anchor for the live ticker
  remainingToday: bigint;
  level: number;
  frozen: boolean;
  strictHolds: boolean;
  limits: bigint[];
  threshold: bigint;
  firstDayCap: bigint;
  holdSeconds: number;
  roundUpUnit: bigint;
  roundUpGoal: number;
};

export async function readTeen(addr: string): Promise<TeenView> {
  const blockTag = await provider.getBlockNumber();
  const [balance, accrued, stream, remainingToday, c] = await Promise.all([
    fam.balance(addr, { blockTag }),
    fam.accrued(addr, { blockTag }),
    fam.streams(addr, { blockTag }),
    fam.remainingToday(addr, { blockTag }),
    fam.getTeenCfg(addr, { blockTag }),
  ]);
  return {
    balance,
    accrued,
    streamRemaining: stream.remaining,
    rate: stream.rate,
    fetchedAt: Date.now(),
    remainingToday,
    level: Number(c.level),
    frozen: c.frozen,
    strictHolds: c.strictHolds,
    limits: Array.from(c.levelLimits as bigint[]).map((x) => big(x)),
    threshold: c.newPayeeThreshold,
    firstDayCap: c.firstDayCap,
    holdSeconds: Number(c.holdSeconds),
    roundUpUnit: c.roundUpUnit,
    roundUpGoal: Number(c.roundUpGoal),
  };
}

/** What a teen can spend right now, ticking up while the allowance streams. */
export function liveSpendable(t: TeenView, nowMs = Date.now()): bigint {
  const elapsed = BigInt(Math.max(0, Math.floor((nowMs - t.fetchedAt) / 1000)));
  const extraCap = t.streamRemaining - t.accrued;
  let extra = t.rate * elapsed;
  if (extra > extraCap) extra = extraCap < 0n ? 0n : extraCap;
  return t.balance + t.accrued + extra;
}

export const MSTATUS = ["NONE", "ACTIVE", "SUBMITTED", "REJECTED", "APPROVED", "CANCELLED", "EXPIRED"] as const;
export type ChainMission = { parent: string; teen: string; reward: bigint; deadline: number; status: (typeof MSTATUS)[number]; goalId: bigint };

/** The contract is the authority for a mission's state; the app re-reads it before acting so it never acts on a stale screen. */
export async function readMission(id: bigint | string): Promise<ChainMission> {
  const m = await fam.missions(id);
  return { parent: m.parent, teen: m.teen, reward: m.reward, deadline: Number(m.deadline), status: MSTATUS[Number(m.status)] ?? "NONE", goalId: m.goalId };
}

export type ChainFund = { parent: string; teen: string; target: bigint; funded: bigint; horizon: number; status: "NONE" | "OPEN" | "RELEASED" };
export async function readFund(id: bigint | string): Promise<ChainFund> {
  const f = await fam.funds(id);
  return { parent: f.parent, teen: f.teen, target: f.target, funded: f.funded, horizon: Number(f.horizon), status: (["NONE", "OPEN", "RELEASED"] as const)[Number(f.status)] };
}

/** Contract revert strings -> words a family would use. */
const FRIENDLY: Record<string, string> = {
  frozen: "Spending is frozen by your parent.",
  insufficient: "Not enough balance for that.",
  "unknown fam-id": "No one has that Fam-ID.",
  "bad payee": "You can't pay that person.",
  "fam-id taken": "That Fam-ID is already taken.",
  "bad fam-id": "Fam-IDs are 3–20 letters, numbers or _.",
  "still held": "Still on hold. Try again when the timer ends.",
  "strict holds": "This hold needs your parent to approve it.",
  "needs parent": "Only a parent can release this one.",
  "invite used": "That invite was already used.",
  "invite expired": "That invite has expired. Ask for a new one.",
  "bad invite sig": "That invite isn't valid.",
  "goal not active": "That goal isn't open.",
  "exceeds goal": "That's more than the goal needs.",
  "not allowed": "This goal isn't open for gifts.",
  "already paid": "You've already paid your share.",
  "split full": "Everyone has already paid.",
  "slow down": "Too many requests. Wait a few seconds.",
  "gift still active": "Not yet. You can take it back once the goal is reached or its time is up.",
  "nothing to reclaim": "There's nothing left to take back.",
  "not submitted": "That mission isn't waiting for review any more. Refreshing.",
  "not your mission": "That mission isn't yours to change.",
  "mission ended": "The deadline for that mission has passed.",
  "too many missions": "That teen already has 10 open missions. Finish or cancel one first.",
  "bad title": "Give the mission a short title (up to 80 characters).",
  "bad description": "The description is too long (280 characters at most).",
  "bad feedback": "Keep the feedback short (140 characters at most).",
  "bad deadline": "Pick a deadline between now and a year from now.",
  "not your goal": "That goal doesn't belong to this teen.",
  "not ended": "That mission's deadline hasn't passed yet.",
  "fund not open": "That FutureFund has already been paid out.",
  "not your fund": "That FutureFund isn't yours to change.",
  "nothing in fund": "There's nothing in that FutureFund yet.",
  "not yet": "That FutureFund can be claimed once its target date arrives.",
  "bad horizon": "Pick a date in the future, within 40 years.",
  "bad name": "Give the FutureFund a short name (up to 60 characters).",
  "bad purpose": "The purpose is too long (200 characters at most).",
};
export function friendlyError(e: any): string {
  const raw: string = e?.revert?.args?.[0] || e?.reason || e?.info?.error?.message || e?.shortMessage || e?.message || String(e);
  for (const k of Object.keys(FRIENDLY)) if (raw.includes(k)) return FRIENDLY[k];
  return raw.length > 140 ? raw.slice(0, 140) + "…" : raw;
}
