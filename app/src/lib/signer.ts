/** Public wallet capability boundary. Contains no browser or RPC dependencies. */
export type Signer = {
  address: string;
  kind: "dynamic";
  signTypedData: (domain: any, types: any, message: any, primaryType: string) => Promise<string>;
  /** Direct wallet transactions for funding only; regular family actions stay gas-sponsored. */
  sendTransaction?: (request: { to: string; data: string; value: bigint }) => Promise<string>;
};
