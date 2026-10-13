import { ethers } from "ethers";
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

/** Discovery hints from mined TeenAdded logs. Membership is always rechecked on-chain when read. */
export function confirmedTeenStore(contract: ethers.Contract, path: string | null) {
  const address = String(contract.target).toLowerCase();
  const hints = new Map<string, { teen: string; txHash: string; blockNumber: number }>();
  if (path && existsSync(path)) {
    try {
      const stored = JSON.parse(readFileSync(path, "utf8"));
      if (stored.contract === address) for (const hint of (stored.teens ?? []).slice(0, 5000)) if (ethers.isAddress(hint.teen)) hints.set(hint.teen.toLowerCase(), hint);
    } catch { /* Missing/corrupt discovery hints never authorize membership. */ }
  }
  return {
    addresses: () => [...hints.keys()],
    record: (receipt: ethers.TransactionReceipt) => {
      if (receipt.status !== 1) return;
      let changed = false;
      for (const log of receipt.logs) {
        if (log.address.toLowerCase() !== address) continue;
        const event = contract.interface.parseLog(log);
        if (event?.name !== "TeenAdded") continue;
        const teen = String(event.args.teen).toLowerCase();
        hints.set(teen, { teen, txHash: receipt.hash, blockNumber: receipt.blockNumber }); changed = true;
      }
      if (changed && path) {
        mkdirSync(dirname(path), { recursive: true });
        writeFileSync(path + ".tmp", JSON.stringify({ contract: address, teens: [...hints.values()] }));
        renameSync(path + ".tmp", path);
      }
    },
  };
}

export function familyRosterReader(contract: ethers.Contract) {
  return async (familyId: number, candidates: string[]) => {
    const blockTag = await contract.runner?.provider?.getBlockNumber();
    const overrides = blockTag === undefined ? {} : { blockTag };
    const rows: { id: string; famId: string; level: number; frozen: boolean }[] = [];
    for (const address of [...new Set(candidates.map((a) => a.toLowerCase()))]) {
      if (!ethers.isAddress(address)) continue;
      const account = await contract.accounts(address, overrides);
      if (Number(account.role) !== 2 || Number(account.familyId) !== familyId) continue;
      const cfg = await contract.getTeenCfg(address, overrides);
      rows.push({ id: address, famId: ethers.decodeBytes32String(account.famId), level: Number(cfg.level), frozen: Boolean(cfg.frozen) });
    }
    return rows;
  };
}
