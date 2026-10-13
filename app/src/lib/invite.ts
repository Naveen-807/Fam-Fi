import { ethers } from "ethers";
import { decodeTerms, encodeTerms, type Terms } from "./terms";

export const INVITE_TYPES = { Invite: [
  { name: "familyId", type: "uint32" }, { name: "inviteId", type: "bytes32" },
  { name: "deadline", type: "uint256" }, { name: "levelLimits", type: "uint128[4]" },
  { name: "newPayeeThreshold", type: "uint128" }, { name: "firstDayCap", type: "uint128" },
  { name: "holdSeconds", type: "uint32" }, { name: "strictHolds", type: "bool" },
] };
export type Invite = { familyId: number; inviteId: string; deadline: number; terms: Terms; sig: string };
export type InviteNetwork = { chainId: number; famfi: string };
export const inviteDomain = (network: InviteNetwork) => ({ name: "FamFi", version: "1", chainId: BigInt(network.chainId), verifyingContract: network.famfi });
export const inviteMessage = (invite: Omit<Invite, "sig">) => ({ familyId: invite.familyId, inviteId: invite.inviteId, deadline: BigInt(invite.deadline), ...invite.terms });
export function inviteSigner(invite: Invite, network: InviteNetwork): string {
  return ethers.verifyTypedData(inviteDomain(network), INVITE_TYPES, inviteMessage(invite), invite.sig);
}
export function inviteLink(origin: string, invite: Invite, network: InviteNetwork): string {
  const u = new URL("/join", origin);
  for (const [key, value] of Object.entries({ f: invite.familyId, i: invite.inviteId, d: invite.deadline, t: encodeTerms(invite.terms), s: invite.sig, c: network.chainId, a: network.famfi })) u.searchParams.set(key, String(value));
  return u.toString();
}
export function parseInvite(q: URLSearchParams, network: InviteNetwork): { invite: Invite | null; error: string | null } {
  const bad = (error: string) => ({ invite: null, error });
  if ((q.has("c") && q.get("c") !== String(network.chainId)) || (q.has("a") && q.get("a")!.toLowerCase() !== network.famfi.toLowerCase())) return bad("This invite belongs to a different Fam-Fi deployment. Ask your parent for a link from this app.");
  const familyId = Number(q.get("f")), deadline = Number(q.get("d"));
  const inviteId = q.get("i") || "", sig = q.get("s") || "", terms = decodeTerms(q.get("t"));
  if (!Number.isSafeInteger(familyId) || familyId < 1 || familyId > 0xffffffff || !Number.isSafeInteger(deadline) || deadline < 1 || !/^0x[0-9a-fA-F]{64}$/.test(inviteId) || !/^0x[0-9a-fA-F]{130}$/.test(sig) || !terms) return bad("This invite link is incomplete or its rules are invalid. Ask your parent to copy a fresh link.");
  return { invite: { familyId, inviteId, deadline, sig, terms }, error: null };
}
