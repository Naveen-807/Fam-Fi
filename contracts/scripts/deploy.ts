import { ethers, network } from "hardhat";
import * as fs from "fs";
import * as path from "path";

// Circle's testnet USDC on Monad (chain 10143), 6 decimals.
const MONAD_TESTNET_USDC = "0x534b2f3A21130d7a60830c2Df862319e593943A3";

async function main() {
  const [deployer] = await ethers.getSigners();
  if (!deployer) throw new Error("Set DEPLOYER_KEY in contracts/.env (a funded Monad testnet account)");
  const usdc = process.env.USDC_ADDRESS || MONAD_TESTNET_USDC;
  console.log(`Deploying from ${deployer.address} on ${network.name} with USDC ${usdc}`);

  const fwd = await (await ethers.getContractFactory("FamFiForwarder")).deploy();
  await fwd.waitForDeployment();
  const fwdReceipt = await fwd.deploymentTransaction()!.wait();
  const fam = await (await ethers.getContractFactory("FamFi")).deploy(usdc, await fwd.getAddress());
  await fam.waitForDeployment();
  const famReceipt = await fam.deploymentTransaction()!.wait();
  if (!famReceipt || famReceipt.status !== 1 || !fwdReceipt || fwdReceipt.status !== 1) throw new Error("Deployment receipt failed");
  if (await fam.token() !== ethers.getAddress(usdc)) throw new Error("Wrong token on deployed contract");
  if (!(await fam.isTrustedForwarder(await fwd.getAddress()))) throw new Error("Wrong trusted forwarder");
  await Promise.all([fam.missionCount(), fam.fundCount(), fam.goalCount(), fam.familyCount()]);

  const out = {
    network: network.name,
    chainId: Number((await ethers.provider.getNetwork()).chainId),
    usdc,
    forwarder: await fwd.getAddress(),
    famFi: await fam.getAddress(),
    deployBlock: famReceipt.blockNumber,
    transactions: { famFi: famReceipt.hash, forwarder: fwdReceipt.hash },
    runtimeCodeHashes: {
      famFi: ethers.keccak256(await ethers.provider.getCode(await fam.getAddress())),
      forwarder: ethers.keccak256(await ethers.provider.getCode(await fwd.getAddress())),
    },
    deployer: deployer.address,
    deployedAt: new Date().toISOString(),
  };
  const dir = path.join(__dirname, "..", "..", "deployments");
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, `${network.name}.json`), JSON.stringify(out, null, 2) + "\n");
  console.log(out);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
