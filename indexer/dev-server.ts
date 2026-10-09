/**
 * LOCAL DEV INDEXER. Reads FamFi events from any RPC, replays them through the real Envio handlers
 * (via Envio's TestIndexer, so no Docker or Postgres), and answers the same Hasura-style GraphQL
 * queries the app sends to Envio in production. Use it for local demos; production uses Envio itself.
 *
 *   FAMFI_ADDRESS=0x.. RPC_URL=http://127.0.0.1:8545 START_BLOCK=0 npx tsx dev-server.ts
 */
import { createTestIndexer } from "envio";
import { ethers } from "ethers";
import { readFileSync } from "node:fs";
import http from "node:http";
import { parse, valueFromASTUntyped, Kind, type FieldNode, type SelectionSetNode } from "graphql";

const RPC = process.env.RPC_URL || "http://127.0.0.1:8545";
const FAMFI = process.env.FAMFI_ADDRESS;
if (!FAMFI) throw new Error("FAMFI_ADDRESS is required");
const PORT = Number(process.env.PORT || 8080);
let nextBlock = Number(process.env.START_BLOCK || 0);

const abi = JSON.parse(readFileSync(new URL("../abi/FamFi.json", import.meta.url), "utf8"));
const iface = new ethers.Interface(abi);
const provider = new ethers.JsonRpcProvider(RPC, undefined, { staticNetwork: true });
const indexer: any = createTestIndexer();
const ENTITIES = ["User", "Family", "Stream", "Payment", "Pending", "Goal", "Gift", "Split", "SplitShare", "Request", "TimelineEntry"];

const blockTs = new Map<number, number>();
async function tsOf(n: number) {
  if (!blockTs.has(n)) blockTs.set(n, (await provider.getBlock(n))!.timestamp);
  return blockTs.get(n)!;
}

const plain = (v: any): any => {
  if (v && typeof v === "object" && typeof v.toArray === "function") return v.toArray().map(plain);
  if (Array.isArray(v)) return v.map(plain);
  return v;
};

let busy = false;
async function sync() {
  if (busy) return;
  busy = true;
  try {
    const head = await provider.getBlockNumber();
    if (head < nextBlock) return;
    const logs = await provider.getLogs({ address: FAMFI, fromBlock: nextBlock, toBlock: head });
    const simulate: any[] = [];
    for (const log of logs) {
      const parsed = iface.parseLog(log);
      if (!parsed) continue;
      const params: Record<string, any> = {};
      parsed.fragment.inputs.forEach((inp, i) => (params[inp.name] = plain(parsed.args[i])));
      simulate.push({
        contract: "FamFi",
        event: parsed.name,
        params,
        logIndex: log.index,
        block: { number: log.blockNumber, timestamp: await tsOf(log.blockNumber), hash: log.blockHash },
        transaction: { hash: log.transactionHash },
      });
    }
    if (simulate.length) {
      await indexer.process({ chains: { 10143: { startBlock: nextBlock, endBlock: head, simulate } } });
      console.log(`indexed ${simulate.length} events up to block ${head}`);
    }
    nextBlock = head + 1;
  } catch (e: any) {
    console.error("sync error:", e?.message || e);
  } finally {
    busy = false;
  }
}

// ── a small Hasura-dialect query evaluator: where / order_by / limit / offset / field selection ──
const norm = (v: any) => (typeof v === "bigint" ? v.toString() : v);
const cmp = (a: any, b: any) => {
  const x = norm(a), y = norm(b);
  if (typeof x === "string" && typeof y === "string" && /^-?\d+$/.test(x) && /^-?\d+$/.test(y)) return BigInt(x) < BigInt(y) ? -1 : BigInt(x) > BigInt(y) ? 1 : 0;
  return x < y ? -1 : x > y ? 1 : 0;
};
const eq = (a: any, b: any) => norm(a) === norm(b) || String(norm(a)) === String(norm(b));

function matches(row: any, where: any): boolean {
  if (!where) return true;
  return Object.entries(where).every(([k, v]: [string, any]) => {
    if (k === "_and") return (v as any[]).every((w) => matches(row, w));
    if (k === "_or") return (v as any[]).some((w) => matches(row, w));
    if (k === "_not") return !matches(row, v);
    const val = row[k];
    return Object.entries(v).every(([op, arg]: [string, any]) => {
      switch (op) {
        case "_eq": return eq(val, arg);
        case "_neq": return !eq(val, arg);
        case "_in": return (arg as any[]).some((a) => eq(val, a));
        case "_nin": return !(arg as any[]).some((a) => eq(val, a));
        case "_gt": return cmp(val, arg) > 0;
        case "_gte": return cmp(val, arg) >= 0;
        case "_lt": return cmp(val, arg) < 0;
        case "_lte": return cmp(val, arg) <= 0;
        case "_is_null": return (val == null) === arg;
        default: throw new Error(`unsupported operator ${op}`);
      }
    });
  });
}

function project(row: any, sel: SelectionSetNode | undefined): any {
  if (!sel) return norm(row);
  const out: any = {};
  for (const s of sel.selections) {
    if (s.kind !== Kind.FIELD) continue;
    const f = s as FieldNode;
    out[f.alias?.value ?? f.name.value] = f.name.value === "__typename" ? "Row" : norm(row[f.name.value]) ?? null;
  }
  return out;
}

async function runQuery(query: string, variables: any = {}) {
  const doc = parse(query);
  const op = doc.definitions.find((d) => d.kind === Kind.OPERATION_DEFINITION) as any;
  const data: any = {};
  for (const sel of op.selectionSet.selections as FieldNode[]) {
    const name = sel.name.value;
    const key = sel.alias?.value ?? name;
    const byPk = name.endsWith("_by_pk");
    const entity = byPk ? name.slice(0, -6) : name;
    if (!ENTITIES.includes(entity)) throw new Error(`unknown entity ${entity}`);
    const args: any = {};
    for (const a of sel.arguments ?? []) args[a.name.value] = valueFromASTUntyped(a.value, variables);
    let rows: any[] = await indexer[entity].getAll();
    if (byPk) {
      data[key] = rows.filter((r) => eq(r.id, args.id)).map((r) => project(r, sel.selectionSet))[0] ?? null;
      continue;
    }
    rows = rows.filter((r) => matches(r, args.where));
    const orders = ([] as any[]).concat(args.order_by ?? []);
    if (orders.length) {
      rows.sort((a, b) => {
        for (const o of orders) {
          for (const [col, dir] of Object.entries(o)) {
            const c = cmp(a[col], b[col]);
            if (c !== 0) return String(dir).startsWith("desc") ? -c : c;
          }
        }
        return 0;
      });
    }
    if (args.offset) rows = rows.slice(args.offset);
    if (args.limit != null) rows = rows.slice(0, args.limit);
    data[key] = rows.map((r) => project(r, sel.selectionSet));
  }
  return data;
}

const server = http.createServer(async (req, res) => {
  res.setHeader("access-control-allow-origin", "*");
  res.setHeader("access-control-allow-headers", "content-type");
  if (req.method === "OPTIONS") return res.writeHead(204).end();
  if (req.url === "/healthz") return res.writeHead(200).end(JSON.stringify({ ok: true, nextBlock }));
  if (req.method === "POST" && req.url?.startsWith("/v1/graphql")) {
    let body = "";
    for await (const c of req) body += c;
    try {
      const { query, variables } = JSON.parse(body);
      await sync(); // read-your-writes: catch up to the chain head before answering
      const data = await runQuery(query, variables);
      res.writeHead(200, { "content-type": "application/json" }).end(JSON.stringify({ data }));
    } catch (e: any) {
      res.writeHead(200, { "content-type": "application/json" }).end(JSON.stringify({ errors: [{ message: e?.message || String(e) }] }));
    }
    return;
  }
  res.writeHead(404).end();
});

await sync();
setInterval(sync, 700);
server.listen(PORT, () => console.log(`dev indexer on :${PORT}/v1/graphql (reading ${FAMFI} via ${RPC})`));
