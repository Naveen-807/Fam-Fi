import { ethers } from "ethers";

const STATUSES = ["NONE", "PROPOSED", "ACTIVE", "COMPLETE", "CLOSED", "DECLINED"];

/** Small-deployment fallback for approvals while Envio replays history.
 * Never writes to the indexer, and never accepts a client-supplied family.
 * All reads use one block so a concurrent approval cannot create a mixed snapshot.
 */
export function liveGoalsReader(contract: ethers.Contract) {
  let cached: { at: number; rows: any[] } | undefined;
  let pending: Promise<any[]> | undefined;
  async function snapshot() {
    if (cached && Date.now() - cached.at < 2000) return cached.rows;
    if (pending) return pending;
    pending = (async () => {
      const provider = contract.runner?.provider;
      const blockTag = provider ? await provider.getBlockNumber() : undefined;
      const overrides = blockTag === undefined ? {} : { blockTag };
      const count = Number(await contract.goalCount(overrides));
      // A bounded fallback must never silently omit older pending approvals.
      if (!Number.isSafeInteger(count) || count > 500) throw new Error("Live goal scan exceeds its limit; wait for the indexer.");
      const rows: any[] = [];
      const people = new Map<string, any>();
      for (let start = 1; start <= count; start += 10) {
        const batch = await Promise.all(Array.from({ length: Math.min(10, count - start + 1) }, async (_, i) => {
          const id = String(start + i);
          const g = await contract.goals(id, overrides);
          const address = String(g.teen).toLowerCase();
          if (!people.has(address)) people.set(address, contract.accounts(address, overrides));
          const account = await people.get(address);
          return {
            id, teen: address, familyId: Number(account.familyId),
            teenFamId: ethers.decodeBytes32String(account.famId),
            target: String(g.target), saved: String(g.saved), matched: String(g.matched),
            deadline: Number(g.deadline), status: STATUSES[Number(g.status)] ?? "NONE", sponsorOpen: Boolean(g.sponsorOpen),
          };
        }));
        rows.push(...batch);
      }
      cached = { at: Date.now(), rows };
      return rows;
    })();
    try { return await pending; } finally { pending = undefined; }
  }
  return async (reader: string, familyId: number, parent: boolean, indexed: any[]) => {
    const rows = await snapshot();
    const names = new Map(indexed.map((g) => [String(g.id), g.memo]));
    return rows.filter((g) => parent ? g.familyId === familyId : g.teen === reader.toLowerCase())
      .map(({ familyId: _familyId, ...g }) => ({ ...g, memo: names.get(g.id) || `Goal #${g.id}`, namePending: !names.get(g.id) }));
  };
}
