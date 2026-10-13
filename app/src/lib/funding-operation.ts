import { ethers } from "ethers";
export type FundingOperation = { hash: string; stage: "approving" | "depositing"; amount: string };
export const fundingOperationKey = (chain: number, contract: string, wallet: string) => `famfi-funding:${chain}:${contract.toLowerCase()}:${wallet.toLowerCase()}`;
export function parseFundingOperation(text: string | null): FundingOperation | null {
  try {
    const x = JSON.parse(text ?? "null");
    return x && /^0x[0-9a-f]{64}$/i.test(x.hash) && ["approving", "depositing"].includes(x.stage) && /^\d+$/.test(x.amount) && BigInt(x.amount) > 0n ? x : null;
  } catch { return null; }
}
/** A persisted hash alone is not proof this wallet funded this ledger. */
export function matchesFundingOperation(op: FundingOperation, tx: { from: string; to: string | null; data: string }, scope: {wallet:string;token:string;contract:string}) {
  try {
    if (tx.from.toLowerCase() !== scope.wallet.toLowerCase()) return false;
    const expected = op.stage === "approving" ? scope.token : scope.contract;
    if (tx.to?.toLowerCase() !== expected.toLowerCase()) return false;
    const abi = op.stage === "approving" ? "function approve(address,uint256)" : "function depositFor(address,uint256)";
    const decoded = new ethers.Interface([abi]).parseTransaction({data:tx.data});
    const receiver = op.stage === "approving" ? scope.contract : scope.wallet;
    return decoded?.args[0].toLowerCase() === receiver.toLowerCase() && BigInt(decoded?.args[1]) === BigInt(op.amount);
  } catch { return false; }
}
