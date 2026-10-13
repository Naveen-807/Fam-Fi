/** Retry authorization failures before any transaction is submitted. */
export function isWalletAuthorizationError(error: unknown): boolean {
  const e = error as any;
  return [401, 403].includes(e?.response?.status ?? e?.status) ||
    /\b(forbidden|unauthorized)\b|session.*expired/i.test(e?.message ?? String(error));
}

export async function withWalletAuthRefresh<T>(
  sign: () => Promise<T>, refresh: () => Promise<unknown>,
): Promise<T> {
  try { return await sign(); }
  catch (error) {
    if (!isWalletAuthorizationError(error)) throw error;
    try {
      await refresh();
      return await sign();
    } catch (retryError) {
      if (!isWalletAuthorizationError(retryError)) throw retryError;
      throw new Error("Your wallet signing access needs to be renewed. Sign out, then sign in again with the same email. Your invite stays open. If this repeats, the Dynamic wallet permissions need checking.");
    }
  }
}
