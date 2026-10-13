import type { ethers } from "ethers";
export type CommitmentSummary = { coverage: "complete" | "partial" | "unavailable"; blockNumber: number | null; allowance: string | null; missions: string | null; futureFunds: string | null; reason?: string };
/** Exact scoped commitments, never totals inferred from a recent-history page. */
export async function familySummary(contract: ethers.Contract, parent: string, familyId: number, teens: { id: string }[], rosterComplete: boolean): Promise<CommitmentSummary> {
  try {
    const blockNumber = await contract.runner!.provider!.getBlockNumber();
    const at = { blockTag: blockNumber };
    const [mc, fc] = await Promise.all([contract.missionCount(at), contract.fundCount(at)]);
    if (mc > 500n || fc > 500n) return { coverage: "unavailable", blockNumber, allowance: null, missions: null, futureFunds: null, reason: "Commitment scan limit reached" };
    let allowance = 0n, missions = 0n, futureFunds = 0n;
    for (const teen of teens) {
      const [account, stream, accrued] = await Promise.all([contract.accounts(teen.id, at), contract.streams(teen.id, at), contract.accrued(teen.id, at)]);
      if (Number(account.role) !== 2 || Number(account.familyId) !== familyId) continue;
      const remaining = BigInt(stream.remaining), earned = BigInt(accrued);
      allowance += remaining > earned ? remaining - earned : 0n;
    }
    for (let start = 1; start <= Number(mc); start += 20) {
      const rows = await Promise.all(Array.from({ length: Math.min(20, Number(mc) - start + 1) }, (_, i) => contract.missions(start + i, at)));
      for (const m of rows) if (m.parent.toLowerCase() === parent.toLowerCase() && [1, 2, 3].includes(Number(m.status))) missions += m.reward;
    }
    for (let start = 1; start <= Number(fc); start += 20) {
      const rows = await Promise.all(Array.from({ length: Math.min(20, Number(fc) - start + 1) }, (_, i) => contract.funds(start + i, at)));
      for (const f of rows) if (f.parent.toLowerCase() === parent.toLowerCase() && Number(f.status) === 1) futureFunds += f.funded;
    }
    return { coverage: rosterComplete ? "complete" : "partial", blockNumber, allowance: rosterComplete ? String(allowance) : null, missions: String(missions), futureFunds: String(futureFunds), ...(!rosterComplete ? { reason: "Allowance total awaits complete family history" } : {}) };
  } catch { return { coverage: "unavailable", blockNumber: null, allowance: null, missions: null, futureFunds: null, reason: "Could not verify commitments" }; }
}
