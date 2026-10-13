import { ethers } from "ethers";
import { cfg } from "./config";
import { fam, fwd, provider, friendlyError } from "./chain";
import type { Terms } from "./terms";

export type Signer = {
  address: string;
  kind: "dynamic";
  signTypedData: (domain: any, types: any, message: any, primaryType: string) => Promise<string>;
};

export type TxResult = {
  hash: string;
  blockNumber: number;
  /** milliseconds from the tap to the transaction being included in a block */
  includedMs: number;
  /** milliseconds from the tap until the block is finalized (undefined if the node does not report it) */
  finalMs?: number;
  /** FamFi events emitted by this transaction, decoded (e.g. PaymentHeld, SplitCreated, GoalProposed) */
  events: { name: string; args: Record<string, any> }[];
  /** set when the contract put the payment on hold instead of settling it */
  held?: { id: bigint; kind: number; releaseAt: number };
};

const FORWARD_TYPES = {
  ForwardRequest: [
    { name: "from", type: "address" },
    { name: "to", type: "address" },
    { name: "value", type: "uint256" },
    { name: "gas", type: "uint256" },
    { name: "nonce", type: "uint256" },
    { name: "deadline", type: "uint48" },
    { name: "data", type: "bytes" },
  ],
};

/**
 * Sign a call to the FamFi contract and have the relayer submit it. The user never holds gas.
 * Resolves with measured timings (the "Paid in 0.8s" ticker uses these, not guesses).
 */
export async function relay(signer: Signer, fn: string, args: unknown[]): Promise<TxResult> {
  const t0 = performance.now();
  const data = fam.interface.encodeFunctionData(fn, args);

  // Simulate exactly as the forwarder will (msg.sender = forwarder, signer appended) to get a readable error and a gas figure.
  let est: bigint;
  try {
    est = await provider.estimateGas({ from: cfg.forwarder, to: cfg.famfi, data: ethers.concat([data, signer.address]) });
  } catch (e) {
    throw new Error(friendlyError(e));
  }
  const gas = (est * 13n) / 10n + 30_000n; // Monad charges the gas limit, so keep the buffer modest

  const nonce: bigint = await fwd.nonces(signer.address);
  const deadline = Math.floor(Date.now() / 1000) + 3600;
  const chainId = BigInt(cfg.chainId);
  const domain = { name: "FamFiForwarder", version: "1", chainId, verifyingContract: cfg.forwarder };
  const message = { from: signer.address, to: cfg.famfi, value: 0n, gas, nonce, deadline, data };
  const signature = await signer.signTypedData(domain, FORWARD_TYPES, message, "ForwardRequest");

  const res = await fetch(cfg.relayerUrl + "/relay", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ request: { from: signer.address, to: cfg.famfi, value: "0", gas: gas.toString(), deadline, data, signature } }),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(friendlyError({ message: body.error || `relay failed (${res.status})` }));

  const hash: string = body.hash;
  let receipt = null as ethers.TransactionReceipt | null;
  for (let i = 0; i < 400 && !receipt; i++) {
    receipt = await provider.getTransactionReceipt(hash);
    if (!receipt) await new Promise((r) => setTimeout(r, 60));
  }
  if (!receipt) throw new Error("The network is slow right now. Check the timeline in a moment.");
  if (receipt.status === 0) throw new Error("That didn't go through. Nothing was spent.");
  const includedMs = performance.now() - t0;

  const events: TxResult["events"] = [];
  for (const log of receipt.logs) {
    if (log.address.toLowerCase() !== cfg.famfi.toLowerCase()) continue;
    try {
      const parsed = fam.interface.parseLog(log);
      if (!parsed) continue;
      const args: Record<string, any> = {};
      parsed.fragment.inputs.forEach((inp, i) => (args[inp.name] = parsed.args[i]));
      events.push({ name: parsed.name, args });
    } catch {
      /* not one of ours */
    }
  }
  const heldEv = events.find((e) => e.name === "PaymentHeld");
  const held = heldEv ? { id: heldEv.args.id as bigint, kind: Number(heldEv.args.kind), releaseAt: Number(heldEv.args.releaseAt) } : undefined;

  let finalMs: number | undefined;
  try {
    for (let i = 0; i < 60; i++) {
      const b = await provider.send("eth_getBlockByNumber", ["finalized", false]);
      if (b && parseInt(b.number, 16) >= receipt.blockNumber) {
        finalMs = performance.now() - t0;
        break;
      }
      await new Promise((r) => setTimeout(r, 80));
    }
  } catch {
    /* node does not expose the finalized tag; skip */
  }
  return { hash, blockNumber: receipt.blockNumber, includedMs, finalMs, events, held };
}

export async function faucet(famId: string): Promise<{ hash: string; amount: string }> {
  const res = await fetch(cfg.relayerUrl + "/faucet", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ famId }),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error || "Couldn't add money right now.");
  for (let i = 0; i < 300; i++) {
    if (await provider.getTransactionReceipt(body.hash)) break;
    await new Promise((r) => setTimeout(r, 80));
  }
  return body;
}

/** The parent's EIP-712 invite, with the starting rules signed in so a teen cannot change them.
 *  Whoever opens the link first with a valid signature becomes the teen. */
export async function signInvite(signer: Signer, familyId: number, terms: Terms) {
  const inviteId = ethers.hexlify(ethers.randomBytes(32));
  const deadline = Math.floor(Date.now() / 1000) + 7 * 86400;
  const domain = { name: "FamFi", version: "1", chainId: BigInt(cfg.chainId), verifyingContract: cfg.famfi };
  const types = {
    Invite: [
      { name: "familyId", type: "uint32" },
      { name: "inviteId", type: "bytes32" },
      { name: "deadline", type: "uint256" },
      { name: "levelLimits", type: "uint128[4]" },
      { name: "newPayeeThreshold", type: "uint128" },
      { name: "firstDayCap", type: "uint128" },
      { name: "holdSeconds", type: "uint32" },
      { name: "strictHolds", type: "bool" },
    ],
  };
  const sig = await signer.signTypedData(
    domain,
    types,
    { familyId, inviteId, deadline: BigInt(deadline), ...terms },
    "Invite",
  );
  return { familyId, inviteId, deadline, terms, sig };
}

export const explorerTx = (hash: string) => (cfg.explorerTx ? cfg.explorerTx + hash : "");
