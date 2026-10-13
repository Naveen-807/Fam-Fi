#!/usr/bin/env node
// Read-only bytecode, network and constructor-argument verification of the recorded deployment.
import { createRequire } from "node:module";
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const { ethers } = createRequire(path.join(root, "relayer/package.json"))("ethers");
const recordPath = path.join(root, "deployments/monadTestnet.json");
const dep = JSON.parse(readFileSync(recordPath, "utf8"));
const provider = new ethers.JsonRpcProvider(process.env.MONAD_RPC_URL || "https://testnet-rpc.monad.xyz");
if (Number((await provider.getNetwork()).chainId) !== dep.chainId) throw new Error("Wrong deployment network");
const sourceHashes = {};
for (const [name, address] of [["FamFi", dep.famFi], ["FamFiForwarder", dep.forwarder]]) {
  const source = `src/${name}.sol`;
  const debugPath = path.join(root, `contracts/artifacts/${source}/${name}.dbg.json`);
  const debug = JSON.parse(readFileSync(debugPath, "utf8"));
  const build = JSON.parse(readFileSync(path.resolve(path.dirname(debugPath), debug.buildInfo), "utf8"));
  if (build.input.sources[source].content !== readFileSync(path.join(root, "contracts", source), "utf8")) throw new Error(`${name}: source differs from compiled build`);
  const compiled = build.output.contracts[source][name].evm.deployedBytecode;
  const code = await provider.getCode(address);
  const mask = (hex) => {
    let value = hex.replace(/^0x/, "").toLowerCase();
    for (const refs of Object.values(compiled.immutableReferences)) for (const { start, length } of refs) value = value.slice(0, start * 2) + "0".repeat(length * 2) + value.slice((start + length) * 2);
    return value;
  };
  if (code === "0x" || mask(code) !== mask(compiled.object)) throw new Error(`${name}: runtime bytecode mismatch`);
  sourceHashes[name] = ethers.keccak256(ethers.toUtf8Bytes(build.input.sources[source].content));
  console.log(`${name}: deployed runtime matches compiled source at ${address}`);
}
const abi = JSON.parse(readFileSync(path.join(root, "abi/FamFi.json"), "utf8"));
const fam = new ethers.Contract(dep.famFi, abi, provider);
if (await fam.token() !== ethers.getAddress(dep.usdc) || !await fam.isTrustedForwarder(dep.forwarder)) throw new Error("Deployment constructor arguments mismatch");
const [missions, funds, families, goals] = await Promise.all([fam.missionCount(), fam.fundCount(), fam.familyCount(), fam.goalCount()]);
for (const hash of Object.values(dep.transactions)) {
  const receipt = await provider.getTransactionReceipt(hash);
  if (!receipt || receipt.status !== 1) throw new Error("Deployment transaction not confirmed");
}
dep.verification = { bytecodeVerified: true, sourceHashes, checkedAt: new Date().toISOString() };
writeFileSync(recordPath, JSON.stringify(dep, null, 2) + "\n");
console.log(`Verified chain ${dep.chainId}, token, forwarder, successful receipts, missions (${missions}), FutureFund (${funds}), families (${families}), goals (${goals}).`);
