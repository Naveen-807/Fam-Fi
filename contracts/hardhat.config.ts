import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";
import * as dotenv from "dotenv";
dotenv.config();

const accounts = process.env.DEPLOYER_KEY ? [process.env.DEPLOYER_KEY] : [];

const config: HardhatUserConfig = {
  solidity: {
    version: "0.8.28",
    settings: { optimizer: { enabled: true, runs: 200 }, evmVersion: "cancun", viaIR: true },
  },
  paths: { sources: "./src", tests: "./test", cache: "./cache", artifacts: "./artifacts" },
  networks: {
    // Local dev chain only. With HARDHAT_INTERVAL set it mines every N ms, like a real chain, so on-chain clocks keep moving.
    hardhat: process.env.HARDHAT_INTERVAL ? { mining: { auto: true, interval: Number(process.env.HARDHAT_INTERVAL) } } : {},
    monadTestnet: {
      url: process.env.MONAD_RPC_URL || "https://testnet-rpc.monad.xyz",
      chainId: Number(process.env.MONAD_CHAIN_ID || 10143),
      accounts,
    },
  },
};
export default config;
