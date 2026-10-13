import type { Signer } from "./signer";

export const READ_SCOPE = "famfi-private-read";
export const READ_TYPES = {
  ReadAuth: [
    { name: "reader", type: "address" },
    { name: "expiry", type: "uint256" },
    { name: "scope", type: "string" },
  ],
};
export type ReadAuth = { reader: string; expiry: number; signature: string };
type Context = { chainId: number; famfi: string; relayerUrl: string };
export class ReadAuthorizationError extends Error {
  constructor(cause?: unknown) {
    const message = cause instanceof Error ? cause.message : "";
    const forbidden = /forbidden|unauthorized|401|403|signing access needs to be renewed/i.test(message);
    super(forbidden
      ? "Dynamic denied this wallet's read-only signature. Sign out and sign back into the same teen account, then retry family access. This cannot move money."
      : "Family summaries need your wallet authorization. Tap Retry to authorize read-only access for 30 minutes. This cannot move money.");
  }
}

/** One bounded read grant shared by concurrent screens. Never stored on disk; never authorizes spending. */
export class ReadSessions {
  private grants = new Map<string, ReadAuth>();
  private pending = new Map<string, Promise<ReadAuth>>();
  private generation = 0;

  private key(signer: Signer, context: Context) {
    return `${context.chainId}:${context.famfi.toLowerCase()}:${context.relayerUrl}:${signer.address.toLowerCase()}`;
  }

  clear() {
    this.generation++;
    this.grants.clear();
    this.pending.clear();
  }

  invalidate(signer: Signer, context: Context) {
    this.grants.delete(this.key(signer, context));
  }

  authorize(signer: Signer, context: Context, now = Math.floor(Date.now() / 1000)): Promise<ReadAuth> {
    const key = this.key(signer, context);
    const cached = this.grants.get(key);
    if (cached && cached.expiry - now > 120) return Promise.resolve(cached);
    const existing = this.pending.get(key);
    if (existing) return existing;
    const generation = this.generation;
    const expiry = now + 1800;
    // Defer invocation so synchronous errors and the pending entry follow the same lifecycle.
    const request = Promise.resolve().then(async () => {
      const signature = await signer.signTypedData(
        { name: "FamFiRead", version: "1", chainId: context.chainId, verifyingContract: context.famfi },
        READ_TYPES, { reader: signer.address, expiry: BigInt(expiry), scope: READ_SCOPE }, "ReadAuth",
      ).catch((cause) => { throw new ReadAuthorizationError(cause); });
      if (generation !== this.generation) throw new Error("Your account changed. Please try again.");
      const grant = { reader: signer.address, expiry, signature };
      this.grants.set(key, grant);
      return grant;
    }).finally(() => {
      if (this.pending.get(key) === request) this.pending.delete(key);
    });
    this.pending.set(key, request);
    return request;
  }
}

export const readSessions = new ReadSessions();
