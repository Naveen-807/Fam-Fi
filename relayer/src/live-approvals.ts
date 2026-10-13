import { ethers } from "ethers";

/** Read current request/hold states while event history is still syncing.
 * The gateway supplies the authenticated reader; it never accepts a family filter from the browser.
 */
export function liveApprovalsReader(contract: ethers.Contract) {
  let cache: { at: number; requests: any[]; holds: any[] } | undefined;
  let pending: Promise<NonNullable<typeof cache>> | undefined;
  async function snapshot() {
    if (cache && Date.now() - cache.at < 2000) return cache;
    if (pending) return pending;
    pending = (async () => {
      const blockTag = await contract.runner?.provider?.getBlockNumber();
      const overrides = blockTag === undefined ? {} : { blockTag };
      const [rc, pc] = await Promise.all([contract.requestCount(overrides), contract.pendingCount(overrides)]);
      const people = new Map<string, Promise<any>>();
      const person = (a: string) => {
        a = a.toLowerCase();
        if (!people.has(a)) people.set(a, contract.accounts(a, overrides).then((x: any) => ({ familyId: Number(x.familyId), famId: ethers.decodeBytes32String(x.famId) })));
        return people.get(a)!;
      };
      const read = async (count: bigint, kind: "requests" | "pendings") => {
        const n = Number(count);
        if (!Number.isSafeInteger(n) || n > 500) throw new Error("Live approval scan exceeds its limit");
        const rows: any[] = [];
        for (let i = 1; i <= n; i += 10) {
          rows.push(...await Promise.all(Array.from({ length: Math.min(10, n - i + 1) }, async (_, j) => {
            const id = String(i + j), r = await contract[kind](id, overrides);
            const [from, to] = await Promise.all([person(String(r.from)), person(String(r.to))]);
            return { id, fromAddr: String(r.from).toLowerCase(), toAddr: String(r.to).toLowerCase(), familyId: from.familyId,
              fromFamId: from.famId, toFamId: to.famId, amount: String(r.amount),
              status: Number(r.status) === 1 ? "OPEN" : "RESOLVED", createdAt: Number(r.createdAt ?? 0),
              releaseAt: Number(r.releaseAt ?? 0), kind: Number(r.kind) === 0 ? "OVER_LIMIT" : "ANOMALY",
              refKind: ["NONE", "SPLIT", "REQUEST"][Number(r.refKind ?? 0)],
            };
          })));
        }
        return rows;
      };
      const [requests, holds] = await Promise.all([read(rc, "requests"), read(pc, "pendings")]);
      cache = { at: Date.now(), requests, holds };
      return cache;
    })();
    try { return await pending; } finally { pending = undefined; }
  }
  return async (reader: string, familyId: number, parent: boolean, indexed: { requests?: any[]; holds?: any[]; incomingRequests?: any[]; outgoingRequests?: any[] }) => {
    const rows = await snapshot(), address = reader.toLowerCase();
    const decorate = (row: any, previous: any[]) => {
      const old = previous.find((x) => String(x.id) === row.id);
      const { fromAddr: _from, toAddr: _to, familyId: _family, ...safe } = row;
      return { ...old, ...safe, createdAt: row.createdAt || old?.createdAt || 0, memo: old?.memo ?? "", txHash: old?.txHash ?? "" };
    };
    return {
      candidates: [...new Set([...rows.requests, ...rows.holds].flatMap((r) => [r.fromAddr, r.toAddr]))],
      incomingRequests: rows.requests.filter((r) => r.toAddr === address && r.status === "OPEN").map((r) => decorate(r, indexed.requests ?? indexed.incomingRequests ?? [])),
      outgoingRequests: rows.requests.filter((r) => r.fromAddr === address && r.status === "OPEN").map((r) => decorate(r, indexed.outgoingRequests ?? [])),
      holds: rows.holds.filter((h) => h.status === "OPEN" && (parent ? h.familyId === familyId : h.fromAddr === address)).map((h) => decorate(h, indexed.holds ?? [])),
    };
  };
}
