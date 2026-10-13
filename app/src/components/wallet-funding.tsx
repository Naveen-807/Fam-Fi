"use client";
import { ethers } from "ethers";
import Link from "next/link";
import { fundingOperationKey, parseFundingOperation, matchesFundingOperation, type FundingOperation } from "@/lib/funding-operation";
import { useEffect, useState } from "react";
import { Button, Card, ConfirmDialog, Field, Input } from "./ui";
import { QR } from "./qr";
import { provider } from "@/lib/chain";
import { cfg } from "@/lib/config";
import { fmt, parseAmount } from "@/lib/format";
import { useWallet } from "@/lib/wallet";
import { explorerTx } from "@/lib/relay";
import { depositWalletUSDC, TOKEN_ABI, type FundingStage } from "@/lib/wallet-funding";

const token = new ethers.Contract(cfg.usdc, TOKEN_ABI, provider);
const labels: Record<FundingStage, string> = {
  checking: "Checking your wallet…", approving: "Authorizing this amount…",
  depositing: "Moving USDC into Fam-Fi…", confirmed: "Deposit confirmed",
};

/** Real embedded-wallet funding, separate from the treasury faucet. Approval is never presented as a deposit. */
export function WalletFunding({ onDone, family = true }: { onDone: () => void | Promise<void>; family?: boolean }) {
  const { signer } = useWallet();
  const [balance, setBalance] = useState<bigint | null>(null);
  const [nativeBalance, setNativeBalance] = useState<bigint | null>(null);
  const [amount, setAmount] = useState("");
  const [stage, setStage] = useState<FundingStage | null>(null);
  const [hash, setHash] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const [needsCheck, setNeedsCheck] = useState(false);
  const [operation, setOperation] = useState<FundingOperation | null>(null);
  const [confirmedAmount, setConfirmedAmount] = useState<string | null>(null);
  const address = signer?.address;
  const storageKey = address ? fundingOperationKey(cfg.chainId, cfg.famfi, address) : "";
  useEffect(() => {
    let alive = true;
    setBalance(null); setNativeBalance(null); setStage(null); setHash(null); setError(null); setNeedsCheck(false); setOperation(null); setConfirmedAmount(null);
    try {
      const pending = parseFundingOperation(localStorage.getItem(storageKey));
      if (pending) { setOperation(pending); setHash(pending.hash); setNeedsCheck(true); setStage(pending.stage); setAmount(ethers.formatUnits(pending.amount,6)); }
    } catch { setError("Browser storage is unavailable. Enable it to safely recover wallet deposits after reload."); }
    const refresh = async () => {
      if (!address) return;
      try { const [value, gas] = await Promise.all([token.balanceOf(address),provider.getBalance(address)]); if (alive) { setBalance(value); setNativeBalance(gas); } }
      catch { if (alive) { setBalance(null); setNativeBalance(null); } }
    };
    void refresh();
    const timer = setInterval(refresh, 5000);
    return () => { alive = false; clearInterval(timer); };
  }, [address, storageKey]);
  if (!signer?.sendTransaction) return null;
  const parsed = parseAmount(amount);
  const link = hash ? explorerTx(hash) : null;
  async function deposit() {
    if (!signer || !parsed) return;
    setConfirm(false); setBusy(true); setError(null); setHash(null);
    let submittedHash: string | undefined;
    try {
      // Validate recovery storage before requesting a signature.
      localStorage.setItem(storageKey + ":check", "1"); localStorage.removeItem(storageKey + ":check");
      await depositWalletUSDC(signer, parsed, {
        ...cfg, network: async () => (await provider.getNetwork()).chainId,
        balance: (a) => token.balanceOf(a), allowance: (a, spender) => token.allowance(a, spender),
        nativeBalance: (a) => provider.getBalance(a),
        simulate: (request) => provider.estimateGas(request),
        wait: (h) => provider.waitForTransaction(h, 1, 60000),
      }, (next, h) => {
        setStage(next);
        if (h) {
          submittedHash = h; setHash(h);
          if (next === "approving" || next === "depositing") {
            const op = { hash: h, stage: next, amount: String(parsed) };
            setOperation(op); localStorage.setItem(storageKey, JSON.stringify(op));
          }
        }
      });
      localStorage.removeItem(storageKey); setOperation(null); setNeedsCheck(false); setConfirmedAmount(ethers.formatUnits(parsed,6));
      setAmount("");
      try { await onDone(); }
      catch { setError("Deposit confirmed. Your balance summary will refresh shortly."); }
    } catch (e: any) {
      setError(e?.shortMessage || e?.message || "Funding could not finish.");
      // Never offer an immediate retry while a submitted transaction's outcome is unknown.
      if (submittedHash) setNeedsCheck(true);
    } finally { setBusy(false); }
  }
  return (
    <Card title={family ? "Add family funds" : "Add funds for your gift"}>
      <details>
        <summary className="cursor-pointer text-sm font-semibold text-brand">Choose amount → authorize → deposit → allocate</summary>
        <div className="mt-3 space-y-3">
          <p className="text-sm text-muted">This is your personal wallet, separate from your Fam-Fi balance. Send only Monad testnet USDC and test MON to this address.</p>
          <div className="flex flex-wrap items-center gap-3">
            <QR value={signer.address} size={110} />
            <div className="min-w-0 flex-1">
              <p className="break-all font-mono text-xs">{signer.address}</p>
              <Button variant="ghost" onClick={async () => {
                try { await navigator.clipboard.writeText(signer.address); setCopied(true); }
                catch { setError("Copy the displayed address manually."); }
              }}>{copied ? "Copied" : "Copy address"}</Button>
              <p className="text-sm">Wallet USDC: {balance === null ? "unavailable" : fmt(balance)}</p>
              <p className="text-xs text-muted">Wallet gas: {nativeBalance === null ? "unavailable" : `${ethers.formatEther(nativeBalance)} test MON`}</p>
            </div>
          </div>
          <p className="text-xs text-dim">Wallet funding needs test MON for network fees. Normal Fam-Fi actions use sponsored gas. Test tokens have no real value.</p>
          <Field label="Add to your spendable Fam-Fi balance"><Input inputMode="decimal" value={amount} disabled={busy || needsCheck} onChange={(e) => setAmount(e.target.value)} placeholder="5.00" /></Field>
          <Button full busy={busy} disabled={!parsed || parsed <= 0n || balance === null || parsed > balance || nativeBalance === null || nativeBalance === 0n || needsCheck} onClick={() => setConfirm(true)}>Review deposit</Button>
          {nativeBalance === 0n && <p className="text-xs text-bad" role="status">Add test MON to this wallet before depositing. Family actions remain gas-sponsored.</p>}
          {stage && <p role="status" className="text-sm text-muted">{labels[stage]}</p>}
          {error && <p role="alert" className="text-sm text-bad">{error}</p>}
          {link && <a className="text-xs text-brand underline" href={link} target="_blank" rel="noreferrer">Check this transaction</a>}
          {needsCheck && <Button variant="ghost" onClick={async () => {
            try {
              if (!operation) return;
              const receipt = await provider.getTransactionReceipt(operation.hash);
              if (!receipt) { setError("Still awaiting confirmation. Keep this transaction; do not submit another deposit."); return; }
              const transaction = await provider.getTransaction(operation.hash);
              if (!transaction || !matchesFundingOperation(operation,transaction,{wallet:signer.address,token:cfg.usdc,contract:cfg.famfi})) {
                setError("Saved transaction does not match this wallet and funding action. No deposit was credited by this recovery check.");
                return;
              }
              if (receipt.status !== 0 && receipt.status !== 1) { setError("Transaction outcome is unknown. Keep this reference and check again; do not submit another deposit."); return; }
              localStorage.removeItem(storageKey); setNeedsCheck(false); setOperation(null);
              if (receipt.status !== 1) { setStage(null); setError("Transaction failed. You can review and try again."); return; }
              if (operation.stage === "approving") { setStage(null); setError("Authorization confirmed. No money moved. Review the deposit to finish funding."); }
              else { setStage("confirmed"); setConfirmedAmount(ethers.formatUnits(operation.amount,6)); setError(null); setAmount(""); await onDone(); }
            } catch { setError("Could not check the transaction yet."); }
          }}>Check confirmation before retrying</Button>}
        </div>
      </details>
      {confirmedAmount && <div className="funding-success" role="status"><h3>${confirmedAmount} added to your balance</h3><p>{family ? "Choose where to put it. Each allocation needs your confirmation." : "You can now review your matching gift. This deposit alone does not reserve a gift."}</p>{family && <div className="allocation-choices">
        <Link href={`/parent?view=family&allocate=allowance&amount=${confirmedAmount}`}>Allowance →</Link>
        <Link href={`/parent?view=missions&allocate=mission&amount=${confirmedAmount}`}>Mission reward →</Link>
        <Link href={`/parent?view=savings&allocate=future&amount=${confirmedAmount}`}>Future savings →</Link>
      </div>}</div>}
      <ConfirmDialog open={confirm} title="Move wallet USDC into Fam-Fi" lines={[
        `Move ${fmt(parsed ?? 0n)} test USDC into your own Fam-Fi balance.`,
        "If needed, first authorize only this amount for the Fam-Fi contract. An authorization alone does not move money.",
        "Your wallet signs the transaction(s), and pays network fees in test MON.",
      ]} confirmLabel="Deposit from my wallet" onConfirm={() => void deposit()} onCancel={() => setConfirm(false)} />
    </Card>
  );
}
