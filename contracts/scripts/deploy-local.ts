import { ethers } from "hardhat";
import * as fs from "fs";
import * as path from "path";

// Deploys the whole stack (mock USDC + forwarder + FamFi) to a local `hardhat node`
// and writes the addresses to /.local/stack.json for the other services.
async function main() {
  const [deployer, treasury] = await ethers.getSigners();
  const usdc = await (await ethers.getContractFactory("MockUSDC")).deploy();
  const fwd = await (await ethers.getContractFactory("FamFiForwarder")).deploy();
  const fam = await (await ethers.getContractFactory("FamFi")).deploy(await usdc.getAddress(), await fwd.getAddress());
  await usdc.mint(treasury.address, 1_000_000n * 10n ** 6n);

  const out = {
    rpcUrl: "http://127.0.0.1:8545",
    chainId: Number((await ethers.provider.getNetwork()).chainId),
    usdc: await usdc.getAddress(),
    forwarder: await fwd.getAddress(),
    famFi: await fam.getAddress(),
    deployBlock: await ethers.provider.getBlockNumber(),
    // hardhat's public dev keys #0 and #1: local node only, never a real network
    relayerKey: "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80",
    treasuryKey: "0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d",
  };
  const dir = path.join(__dirname, "..", "..", ".local");
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, "stack.json"), JSON.stringify(out, null, 2) + "\n");
  console.log("local stack deployed:", out.famFi);
}
main().catch((e) => { console.error(e); process.exit(1); });
