import { ethers } from "ethers";
import { readFileSync } from "fs";

const FAMFI_ABI = JSON.parse(readFileSync(new URL("../../abi/FamFi.json", import.meta.url), "utf8"));
const FORWARDER_ABI = JSON.parse(readFileSync(new URL("../../abi/FamFiForwarder.json", import.meta.url), "utf8"));

export const fid = (s: string) => ethers.encodeBytes32String(s);
export const U = (n: number) => BigInt(Math.round(n * 1e6));

/** The starting rules a parent signs into an invite. Nothing is built into the contract. */
export type Terms = {
  levelLimits: bigint[];
  newPayeeThreshold: bigint;
  firstDayCap: bigint;
  holdSeconds: number;
  strictHolds: boolean;
};

export function makeClient(o: { rpcUrl: string; relayerUrl: string; famfi: string; forwarder: string }) {
  const provider = new ethers.JsonRpcProvider(o.rpcUrl, undefined, { staticNetwork: true });
  const fam = new ethers.Contract(o.famfi, FAMFI_ABI, provider);
  const fwd = new ethers.Contract(o.forwarder, FORWARDER_ABI, provider);

  async function post(path: string, body: unknown) {
    const r = await fetch(o.relayerUrl + path, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
    return { status: r.status, body: (await r.json()) as any };
  }

  /** Sign a forward request as `user` and have the relayer submit it. Throws on failure with the relayer's reason. */
  async function send(user: ethers.Wallet, fn: string, args: unknown[]) {
    const net = await provider.getNetwork();
    const data = fam.interface.encodeFunctionData(fn, args);
    const nonce = await fwd.nonces(user.address);
    const deadline = Math.floor(Date.now() / 1000) + 3600;
    const gas = 700000n;
    const domain = { name: "FamFiForwarder", version: "1", chainId: net.chainId, verifyingContract: o.forwarder };
    const types = {
      ForwardRequest: [
        { name: "from", type: "address" }, { name: "to", type: "address" }, { name: "value", type: "uint256" },
        { name: "gas", type: "uint256" }, { name: "nonce", type: "uint256" }, { name: "deadline", type: "uint48" },
        { name: "data", type: "bytes" },
      ],
    };
    const signature = await user.signTypedData(domain, types, { from: user.address, to: o.famfi, value: 0n, gas, nonce, deadline, data });
    const r = await post("/relay", { request: { from: user.address, to: o.famfi, value: "0", gas: gas.toString(), deadline, data, signature } });
    if (r.status !== 200) throw new Error(`${fn}: ${r.body.error ?? r.status}`);
    await provider.waitForTransaction(r.body.hash);
    return r.body.hash as string;
  }

  async function inviteSignature(parent: ethers.Wallet, familyId: number, inviteId: string, deadline: number, terms: Terms) {
    const net = await provider.getNetwork();
    return parent.signTypedData(
      { name: "FamFi", version: "1", chainId: net.chainId, verifyingContract: o.famfi },
      {
        Invite: [
          { name: "familyId", type: "uint32" }, { name: "inviteId", type: "bytes32" }, { name: "deadline", type: "uint256" },
          { name: "levelLimits", type: "uint128[4]" }, { name: "newPayeeThreshold", type: "uint128" }, { name: "firstDayCap", type: "uint128" },
          { name: "holdSeconds", type: "uint32" }, { name: "strictHolds", type: "bool" },
        ],
      },
      { familyId, inviteId, deadline, ...terms },
    );
  }

  return { provider, fam, fwd, post, send, inviteSignature };
}
