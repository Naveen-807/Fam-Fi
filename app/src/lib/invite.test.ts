import { test } from "node:test";
import assert from "node:assert/strict";
import { ethers } from "ethers";
import { INVITE_TYPES, inviteDomain, inviteLink, inviteMessage, inviteSigner, parseInvite } from "./invite";
import { decodeTerms, encodeTerms } from "./terms";

const network = { chainId: 10143, famfi: "0x00000000000000000000000000000000000000F1" };
const terms = { levelLimits: [5000000n, 8000000n, 12000000n, 20000000n], newPayeeThreshold: 3000000n, firstDayCap: 2000000n, holdSeconds: 600, strictHolds: false };
const unsigned = { familyId: 7, inviteId: ethers.hexlify(ethers.randomBytes(32)), deadline: 1900000000, terms };

test("copied URL preserves the signed rules and parent identity", async () => {
  const parent = ethers.Wallet.createRandom();
  const sig = await parent.signTypedData(inviteDomain(network), INVITE_TYPES, inviteMessage(unsigned));
  const u = new URL(inviteLink("https://famfi.example", { ...unsigned, sig }, network));
  const result = parseInvite(u.searchParams, network);
  assert.equal(u.pathname, "/join");
  assert.equal(result.error, null);
  assert.deepEqual(result.invite?.terms, terms);
  assert.equal(inviteSigner(result.invite!, network), parent.address);
  const legacy = new URL(u); legacy.searchParams.delete("c"); legacy.searchParams.delete("a");
  assert.equal(inviteSigner(parseInvite(legacy.searchParams, network).invite!, network), parent.address);
  u.searchParams.set("t", encodeTerms({ ...terms, firstDayCap: 999n }));
  assert.notEqual(inviteSigner(parseInvite(u.searchParams, network).invite!, network), parent.address);
});
test("different deployments and malformed invite fields fail before joining", async () => {
  const parent = ethers.Wallet.createRandom();
  const sig = await parent.signTypedData(inviteDomain(network), INVITE_TYPES, inviteMessage(unsigned));
  const q = new URL(inviteLink("http://localhost:3000", { ...unsigned, sig }, network)).searchParams;
  assert.equal(parseInvite(q, { ...network, chainId: 31337 }).invite, null);
  assert.equal(parseInvite(q, { ...network, famfi: ethers.ZeroAddress }).invite, null);
  for (const [key, value] of [["f", "4294967296"], ["f", "1.2"], ["d", "Infinity"], ["s", "0xab"], ["i", "0x123"]]) {
    const bad = new URLSearchParams(q); bad.set(key, value);
    assert.equal(parseInvite(bad, network).invite, null);
  }
});
test("wire rules enforce Solidity bounds without coercing booleans or hold time", () => {
  assert.equal(decodeTerms(encodeTerms({ ...terms, levelLimits: [5n, 4n, 8n, 10n] })), null);
  assert.equal(decodeTerms(encodeTerms({ ...terms, levelLimits: [0n, 1n, 2n, 3n] })), null);
  assert.equal(decodeTerms(encodeTerms({ ...terms, firstDayCap: 1n << 128n })), null);
  assert.equal(decodeTerms(encodeTerms({ ...terms, holdSeconds: 86401 })), null);
  const wire = { l: ["1", "2", "3", "4"], t: "0", f: "0", h: 10, s: "false" };
  assert.equal(decodeTerms(btoa(JSON.stringify(wire))), null);
});
