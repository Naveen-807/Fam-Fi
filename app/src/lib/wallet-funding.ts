import { ethers } from "ethers";
import type { Signer } from "./signer";

export const TOKEN_ABI = [
  "function balanceOf(address) view returns (uint256)",
  "function allowance(address,address) view returns (uint256)",
  "function approve(address,uint256) returns (bool)",
];
const tokenInterface = new ethers.Interface(TOKEN_ABI);
const depositInterface = new ethers.Interface(["function depositFor(address user,uint256 amount)"]);
export type FundingStage = "checking" | "approving" | "depositing" | "confirmed";
type Receipt = { status: number | null; blockNumber: number };
export type FundingDeps = {
  chainId: number; usdc: string; famfi: string;
  network: () => Promise<bigint>;
  balance: (address: string) => Promise<bigint>;
  nativeBalance?: (address: string) => Promise<bigint>;
  allowance: (owner: string, spender: string) => Promise<bigint>;
  simulate: (request: { from: string; to: string; data: string }) => Promise<unknown>;
  wait: (hash: string) => Promise<Receipt | null>;
};

/** Deposit this person's own tokens into their own ledger. No unlimited approval, treasury access or relayer key. */
export async function depositWalletUSDC(
  signer: Signer, amount: bigint, deps: FundingDeps,
  onStage: (stage: FundingStage, hash?: string) => void = () => {},
) {
  if (amount <= 0n) throw new Error("Enter an amount greater than zero.");
  if (!ethers.isAddress(deps.famfi) || !ethers.isAddress(deps.usdc) || deps.famfi === ethers.ZeroAddress || deps.usdc === ethers.ZeroAddress)
    throw new Error("Wallet funding is not configured for this deployment.");
  if (!signer.sendTransaction) throw new Error("Wallet funding is not available for this account.");
  onStage("checking");
  if (await deps.network() !== BigInt(deps.chainId)) throw new Error("The funding network does not match Fam-Fi.");
  if (await deps.balance(signer.address) < amount) throw new Error("Your wallet does not have enough test USDC.");
  if (deps.nativeBalance && await deps.nativeBalance(signer.address) === 0n) throw new Error("Add test MON to your wallet for deposit network fees. Normal family actions have sponsored gas.");
  const send = async (to: string, data: string, stage: FundingStage) => {
    await deps.simulate({ from: signer.address, to, data });
    onStage(stage);
    const hash = await signer.sendTransaction!({ to, data, value: 0n });
    onStage(stage, hash);
    const receipt = await deps.wait(hash);
    if (!receipt) throw new Error("Still waiting for confirmation. Check the transaction before trying again.");
    if (receipt.status !== 1) throw new Error("The transaction failed. The deposit was not completed.");
    return { hash, blockNumber: receipt.blockNumber };
  };
  if (await deps.allowance(signer.address, deps.famfi) < amount) {
    await send(deps.usdc, tokenInterface.encodeFunctionData("approve", [deps.famfi, amount]), "approving");
  }
  // Approval does not fund the family balance. Only this separate, successful transaction does.
  const result = await send(deps.famfi, depositInterface.encodeFunctionData("depositFor", [signer.address, amount]), "depositing");
  onStage("confirmed", result.hash);
  return result;
}
