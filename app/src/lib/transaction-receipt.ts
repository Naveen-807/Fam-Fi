/** A broadcast transaction is not a completed payment. Keep uncertain outcomes explicit. */
export async function confirmedReceipt<T extends { status: number | null }>(
  hash: string,
  read: (hash: string) => Promise<T | null>,
  attempts = 300,
  delayMs = 80,
): Promise<T> {
  if (!/^0x[0-9a-f]{64}$/i.test(hash)) throw new Error("The service returned an invalid transaction reference. No confirmation is available.");
  for (let i = 0; i < attempts; i++) {
    let receipt: T | null;
    try { receipt = await read(hash); }
    catch { throw new Error(`Confirmation is unavailable for ${hash}. Check this transaction before repeating the action.`); }
    if (receipt) {
      if (receipt.status === 0) throw new Error("That transaction failed. No family funds were moved.");
      if (receipt.status !== 1) throw new Error(`The transaction outcome is unknown for ${hash}. Check it before repeating the action.`);
      return receipt;
    }
    if (delayMs) await new Promise(resolve => setTimeout(resolve, delayMs));
  }
  throw new Error(`Confirmation is still pending for ${hash}. Check it before repeating the action.`);
}
