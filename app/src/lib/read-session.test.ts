import assert from "node:assert/strict";
import { test } from "node:test";
import { ReadSessions, ReadAuthorizationError } from "./read-session";
import type { Signer } from "./relay";

const context = { chainId: 10143, famfi: "0x0000000000000000000000000000000000000011", relayerUrl: "https://relay.example" };
const address = "0x0000000000000000000000000000000000000022";

test("persistent wallet denial exposes same-account recovery without leaking service errors", async () => {
  const sessions = new ReadSessions();
  const signer: Signer = { address, kind: "dynamic", signTypedData: async () => {
    throw new Error("Your wallet signing access needs to be renewed. internal-service-detail");
  } };
  await assert.rejects(sessions.authorize(signer, context, 1000), (error: unknown) => {
    assert.ok(error instanceof ReadAuthorizationError);
    assert.match(error.message, /same teen account/);
    assert.doesNotMatch(error.message, /internal-service-detail/);
    return true;
  });
});

test("concurrent family screens share one bounded, deployment-specific signature", async () => {
  const sessions = new ReadSessions();
  let calls = 0;
  const signer: Signer = { address, kind: "dynamic", signTypedData: async (domain, _types, message, primaryType) => {
    calls++;
    assert.equal(domain.verifyingContract, context.famfi);
    assert.equal(primaryType, "ReadAuth");
    assert.equal(message.expiry, 2800n);
    assert.equal(message.scope, "famfi-private-read");
    return "0xsignature";
  } };
  const results = await Promise.all(Array.from({ length: 8 }, () => sessions.authorize(signer, context, 1000)));
  assert.equal(calls, 1);
  assert.ok(results.every((result) => result === results[0]));
  await sessions.authorize(signer, context, 1100);
  assert.equal(calls, 1);
});

test("wallet changes, deployment changes and grant expiry require new authorization", async () => {
  const sessions = new ReadSessions();
  let calls = 0;
  const signer: Signer = { address, kind: "dynamic", signTypedData: async () => { calls++; return "0xsig"; } };
  await sessions.authorize(signer, context, 1000);
  await sessions.authorize({ ...signer, address: "0x0000000000000000000000000000000000000033" }, context, 1000);
  await sessions.authorize(signer, { ...context, famfi: "0x0000000000000000000000000000000000000044" }, 1000);
  await sessions.authorize(signer, context, 2790);
  assert.equal(calls, 4);
  sessions.clear();
  await sessions.authorize(signer, context, 2791);
  assert.equal(calls, 5);
});

test("logout during signing cannot restore an old read grant", async () => {
  const sessions = new ReadSessions();
  let resolve!: (signature: string) => void;
  let calls = 0;
  const signer: Signer = { address, kind: "dynamic", signTypedData: () => {
    calls++;
    return new Promise((done) => { resolve = done; });
  } };
  const request = sessions.authorize(signer, context, 1000);
  await Promise.resolve();
  sessions.clear();
  resolve("0xold");
  await assert.rejects(request, /account changed/);
  const newRequest = sessions.authorize(signer, context, 1000);
  await Promise.resolve();
  resolve("0xnew");
  assert.equal((await newRequest).signature, "0xnew");
  assert.equal(calls, 2);
});

test("a cancelled signature can be explicitly retried", async () => {
  const sessions = new ReadSessions();
  let calls = 0;
  const signer: Signer = { address, kind: "dynamic", signTypedData: async () => {
    if (++calls === 1) throw new Error("Cancelled");
    return "0xnew";
  } };
  await assert.rejects(sessions.authorize(signer, context, 1000), ReadAuthorizationError);
  assert.equal((await sessions.authorize(signer, context, 1000)).signature, "0xnew");
});
