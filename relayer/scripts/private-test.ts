/**
 * Tests for the authenticated /private/query gateway. No chain needed: the contract lookup is a stub and the
 * indexer is a tiny local server that records exactly which variables it was asked for.
 */
import express from "express";
import http from "node:http";
import { ethers } from "ethers";
import { mountPrivate, READ_SCOPE, READ_TYPES } from "../src/private.js";

let failed = 0;
const check = (name: string, ok: boolean, extra = "") => {
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${extra ? "  " + extra : ""}`);
  if (!ok) failed++;
};

const CHAIN = 10143n;
const CONTRACT = "0x0000000000000000000000000000000000000011";
const parent = ethers.Wallet.createRandom();
const teen = ethers.Wallet.createRandom();
const teen2 = ethers.Wallet.createRandom(); // a teen in a DIFFERENT family
const relative = ethers.Wallet.createRandom();
const nobody = ethers.Wallet.createRandom();
const accounts: Record<string, { role: number; familyId: number }> = {
  [parent.address]: { role: 1, familyId: 1 },
  [teen.address]: { role: 2, familyId: 1 },
  [teen2.address]: { role: 2, familyId: 2 },
  [relative.address]: { role: 3, familyId: 0 },
};

const seen: { query: string; variables: any }[] = [];
let envioFails = false;
const envio = http.createServer(async (req, res) => {
  let body = "";
  for await (const c of req) body += c;
  const { query, variables } = JSON.parse(body);
  seen.push({ query, variables });
  res.writeHead(200, { "content-type": "application/json" });
  res.end(JSON.stringify(envioFails ? { errors: [{ message: "boom" }] } : { data: { missions: [], marker: variables.a } }));
});
await new Promise<void>((r) => envio.listen(0, r));
const envioUrl = `http://127.0.0.1:${(envio.address() as any).port}/v1/graphql`;

const app = express();
app.use(express.json());
const hits = new Map<string, number>();
mountPrivate({
  app,
  famfiRead: {
    getAddress: async () => CONTRACT,
    accounts: async (a: string) => ({ ...(accounts[ethers.getAddress(a)] ?? { role: 0, familyId: 0 }), famId: ethers.encodeBytes32String(a.slice(2, 10)) }),
    goalCount: async () => 0n, requestCount: async () => 1n, pendingCount: async () => 0n,
    requests: async () => ({ from: teen.address, to: parent.address, amount: 3000000n, status: 1n }),
  } as any,
  chainId: CHAIN,
  envioUrl,
  limited: (k) => {
    hits.set(k, (hits.get(k) ?? 0) + 1);
    return (hits.get(k) ?? 0) > 20;
  },
});
const server = app.listen(0);
const base = `http://127.0.0.1:${(server.address() as any).port}`;

const sign = async (w: ethers.BaseWallet, over: any = {}) => {
  const expiry = over.expiry ?? Math.floor(Date.now() / 1000) + 600;
  const signature = await w.signTypedData({ name: "FamFiRead", version: "1", chainId: CHAIN, verifyingContract: over.contract ?? CONTRACT }, READ_TYPES, {
    reader: over.reader ?? w.address, expiry: BigInt(expiry), scope: over.scope ?? READ_SCOPE,
  });
  return { reader: over.reader ?? w.address, expiry, signature };
};
const call = async (auth: any, extra: any = {}) => {
  const r = await fetch(base + "/private/query", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ auth, ...extra }) });
  return { status: r.status, body: (await r.json()) as any };
};

let r = await call(await sign(parent));
check("a parent reads their own family", r.status === 200 && r.body.role === "PARENT" && r.body.familyId === 1);
check("authenticated parent receives the live request addressed to them", r.body.liveApprovals === "verified" && r.body.data.requests.length === 1 && r.body.data.requests[0].amount === "3000000");
check("the indexer was asked only about family 1 and this parent", seen.at(-1)!.variables.f === 1 && seen.at(-1)!.variables.a === parent.address.toLowerCase());
check("the parent query is the fixed one", seen.at(-1)!.query.includes("Mission(where:{familyId") && seen.at(-1)!.query.includes("Request(where:{toAddr"));

// the client cannot steer the query: extra fields in the body are ignored
const n = seen.length;
r = await call(await sign(parent), { query: "{ User { id } }", variables: { f: 2, a: teen2.address }, familyId: 2 });
check("client-supplied query, variables and family are ignored", r.status === 200 && seen.length === n + 1 && seen.at(-1)!.variables.f === 1 && !seen.at(-1)!.query.includes("User {"));

r = await call(await sign(teen));
check("a teen reads only their own records", r.status === 200 && r.body.role === "TEEN" && seen.at(-1)!.variables.a === teen.address.toLowerCase());
check("authenticated teen sees their outgoing request without parent inbox fields", r.body.data.outgoingRequests.length === 1 && !r.body.data.requests && !r.body.data.holds);
check("the teen query is scoped to the teen, including their own requests", seen.at(-1)!.query.includes("Mission(where:{teen:{_eq:$a}") && seen.at(-1)!.query.includes("Request(where:{toAddr:{_eq:$a}") && seen.at(-1)!.query.includes("Request(where:{fromAddr:{_eq:$a}") && !seen.at(-1)!.query.includes("Pending("));
check("saving receipts are scoped to the teen", seen.at(-1)!.query.includes("SavingReceipt(where:{teen:{_eq:$a}") && seen.at(-1)!.query.includes("MatchRelease(where:{teen:{_eq:$a}"));
check("achievements and reserved gifts are scoped to the teen", seen.at(-1)!.query.includes("Achievement(where:{teen:{_eq:$a}") && seen.at(-1)!.query.includes("Gift(where:{teen:{_eq:$a}"));
check("family activity uses fixed participant filters", seen.at(-1)!.query.includes("TimelineEntry(where:{_or:[{actor:{_eq:$a}},{counterparty:{_eq:$a}}]"));

r = await call(await sign(teen2));
check("a teen in another family gets only their own family", r.status === 200 && seen.at(-1)!.variables.f === 2 && seen.at(-1)!.variables.a === teen2.address.toLowerCase());
check("another family's teen cannot read that request", r.body.data.outgoingRequests.length === 0 && r.body.data.incomingRequests.length === 0);

r = await call(await sign(relative));
check("a relative gets no child's history (403)", r.status === 403);
r = await call(await sign(nobody));
check("an unregistered wallet gets nothing (403)", r.status === 403);

r = await call(await sign(parent, { expiry: Math.floor(Date.now() / 1000) - 5 }));
check("an expired sign-in is refused (401)", r.status === 401);
r = await call(await sign(parent, { expiry: Math.floor(Date.now() / 1000) + 86400 }));
check("an over-long sign-in is refused (400)", r.status === 400);

// someone else's signature cannot be presented as the parent's
const forged = await sign(relative, { reader: parent.address });
r = await call(forged);
check("a signature from a different wallet is refused (401)", r.status === 401);
r = await call(await sign(parent, { scope: "something-else" }));
check("a signature for a different purpose is refused (401)", r.status === 401);
r = await call(await sign(parent, { contract: ethers.ZeroAddress }));
check("a read grant for another deployment is refused (401)", r.status === 401);
r = await call({ reader: parent.address, expiry: 123.5, signature: "0x1234" });
check("fractional expiry is rejected (400)", r.status === 400);
r = await call({ reader: parent.address, expiry: Math.floor(Date.now() / 1000) + 60, signature: "0x1234" });
check("garbage signatures are refused (401)", r.status === 401);
r = await call({});
check("a missing sign-in is refused (400)", r.status === 400);

envioFails = true;
r = await call(await sign(parent));
check("an indexer outage preserves verified approvals and explicitly marks missing history", r.status === 200 && /boom/.test(r.body.indexerError) && r.body.liveApprovals === "verified" && r.body.data.requests.length === 1 && r.body.data.history.length === 0);
envioFails = false;

for (let i = 0; i < 25; i++) await call(await sign(teen));
r = await call(await sign(teen));
check("reads are rate limited per wallet (429)", r.status === 429);

server.close();
envio.close();
console.log(failed ? `\n${failed} FAILED` : "\nall gateway checks passed");
process.exit(failed ? 1 : 0);
