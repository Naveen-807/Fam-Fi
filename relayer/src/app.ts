import express from "express";
import cors from "cors";
import { ethers } from "ethers";
import { readFileSync, writeFileSync, existsSync } from "fs";
import { mountPrivate } from "./private.js";
import { capabilitiesReader } from "./capabilities.js";
import { confirmedTeenStore } from "./roster.js";

const abi = (name: string) => JSON.parse(readFileSync(new URL(`../../abi/${name}.json`, import.meta.url), "utf8"));
const FAMFI_ABI = abi("FamFi");
const FORWARDER_ABI = abi("FamFiForwarder");
const ERC20_ABI = [
  "function balanceOf(address) view returns (uint256)",
  "function allowance(address,address) view returns (uint256)",
  "function approve(address,uint256) returns (bool)",
];

export interface RelayerConfig {
  rpcUrl: string;
  relayerKey: string;
  treasuryKey: string;
  famfi: string;
  forwarder: string;
  usdc: string;
  allowedOrigin: string;
  faucetAmount: bigint; // USDC base units (6 decimals)
  faucetCooldownMs: number;
  maxGas: bigint;
  ratePerMinute: number;
  faucetStatePath: string | null;
  /** Envio GraphQL endpoint used by the authenticated /private/query reads. Empty disables them. */
  envioUrl?: string;
  rosterStatePath?: string | null;
  /** Explicit isolated V2 test/release selection. Never inferred from a live address. */
  contractVersion?: "v1" | "v2";
}

/** Functions a user may relay. depositFor is excluded: it pulls USDC from the caller and only the treasury uses it. */
const DENY = new Set(["depositFor"]);

export function createApp(cfg: RelayerConfig) {
  const provider = new ethers.JsonRpcProvider(cfg.rpcUrl, undefined, { staticNetwork: true });
  const relayer = new ethers.NonceManager(new ethers.Wallet(cfg.relayerKey, provider));
  const treasury = new ethers.NonceManager(new ethers.Wallet(cfg.treasuryKey, provider));
  const selectedAbi = cfg.contractVersion === "v2" ? abi("FamFiV2") : FAMFI_ABI;
  const famfiIface = new ethers.Interface(selectedAbi);
  const forwarderRead = new ethers.Contract(cfg.forwarder, FORWARDER_ABI, provider);
  const forwarderRelay = new ethers.Contract(cfg.forwarder, FORWARDER_ABI, relayer);
  const famfiRead = new ethers.Contract(cfg.famfi, selectedAbi, provider);
  const roster = confirmedTeenStore(famfiRead, cfg.rosterStatePath === undefined ? ".local/confirmed-teens.json" : cfg.rosterStatePath);
  const famfiTreasury = new ethers.Contract(cfg.famfi, selectedAbi, treasury);
  const usdc = new ethers.Contract(cfg.usdc, ERC20_ABI, provider);

  const allowedSelectors = new Set<string>();
  famfiIface.forEachFunction((fn) => {
    if (fn.stateMutability === "nonpayable" && !DENY.has(fn.name)) allowedSelectors.add(fn.selector);
  });

  // ── tiny in-memory rate limiter, per signer ──
  const hits = new Map<string, number[]>();
  const limited = (key: string) => {
    const now = Date.now();
    const arr = (hits.get(key) ?? []).filter((t) => now - t < 60_000);
    if (arr.length >= cfg.ratePerMinute) return true;
    arr.push(now);
    hits.set(key, arr);
    return false;
  };

  // ── faucet cooldowns, persisted so a restart does not reset them ──
  const faucetSeen: Record<string, number> = Object.assign(Object.create(null), (() => {
    try {
      return cfg.faucetStatePath && existsSync(cfg.faucetStatePath) ? JSON.parse(readFileSync(cfg.faucetStatePath, "utf8")) : {};
    } catch {
      return {}; // unreadable state file: start clean rather than crash
    }
  })());
  const saveFaucet = () => cfg.faucetStatePath && writeFileSync(cfg.faucetStatePath, JSON.stringify(faucetSeen));

  const revertReason = (e: any): string => {
    const data: string | undefined = e?.data ?? e?.info?.error?.data;
    if (typeof data === "string" && data.startsWith("0x08c379a0")) {
      try {
        return ethers.AbiCoder.defaultAbiCoder().decode(["string"], "0x" + data.slice(10))[0];
      } catch {
        /* fall through */
      }
    }
    return e?.reason || e?.shortMessage || "request would fail";
  };

  const app = express();
  app.use(cors({ origin: cfg.allowedOrigin === "*" ? true : cfg.allowedOrigin.split(",") }));
  app.use(express.json({ limit: "32kb" }));
  const capabilities = capabilitiesReader(famfiRead);
  app.get("/capabilities", async (_req, res) => {
    res.json({ contract: cfg.famfi, ...await capabilities() });
  });

  app.get("/health", async (_req, res) => {
    try {
      const [block, relayerMon, treasuryMon, treasuryUsdc, chain] = await Promise.all([
        provider.getBlockNumber(),
        provider.getBalance(await relayer.getAddress()),
        provider.getBalance(await treasury.getAddress()),
        usdc.balanceOf(await treasury.getAddress()),
        provider.getNetwork(),
      ]);
      res.json({
        ok: true,
        chainId: Number(chain.chainId),
        block,
        famfi: cfg.famfi,
        forwarder: cfg.forwarder,
        relayer: { address: await relayer.getAddress(), mon: ethers.formatEther(relayerMon) },
        treasury: { address: await treasury.getAddress(), mon: ethers.formatEther(treasuryMon), usdc: ethers.formatUnits(treasuryUsdc, 6) },
      });
    } catch (e: any) {
      res.status(503).json({ ok: false, error: e?.shortMessage || String(e) });
    }
  });

  // A user-signed ERC-2771 forward request goes in; a submitted transaction hash comes out.
  app.post("/relay", async (req, res) => {
    try {
      const r = req.body?.request;
      if (!r || !ethers.isAddress(r.from) || !ethers.isAddress(r.to)) return res.status(400).json({ error: "bad request shape" });
      if (typeof r.data !== "string" || !ethers.isHexString(r.data) || typeof r.signature !== "string" || !ethers.isHexString(r.signature))
        return res.status(400).json({ error: "bad data or signature" });
      if (r.to.toLowerCase() !== cfg.famfi.toLowerCase()) return res.status(400).json({ error: "target not allowed" });
      if (BigInt(r.value ?? 0) !== 0n) return res.status(400).json({ error: "value must be 0" });
      const gas = BigInt(r.gas);
      if (gas <= 0n || gas > cfg.maxGas) return res.status(400).json({ error: "gas out of range" });
      const deadline = Number(r.deadline);
      if (!Number.isFinite(deadline) || deadline < Math.floor(Date.now() / 1000)) return res.status(400).json({ error: "request expired" });
      if (!allowedSelectors.has(r.data.slice(0, 10))) return res.status(400).json({ error: "function not allowed" });
      if (limited(r.from.toLowerCase())) return res.status(429).json({ error: "slow down" });

      const request = { from: r.from, to: r.to, value: 0n, gas, deadline, data: r.data, signature: r.signature };

      if (!(await forwarderRead.verify(request))) return res.status(400).json({ error: "bad signature, nonce or deadline" });

      // Simulate exactly what the forwarder will do (msg.sender = forwarder, signer appended) so we can
      // return a readable reason instead of burning gas on a transaction that will revert.
      try {
        await provider.call({ from: cfg.forwarder, to: cfg.famfi, data: ethers.concat([r.data, r.from]), gasLimit: gas });
      } catch (e: any) {
        return res.status(422).json({ error: revertReason(e) });
      }

      // Monad charges the gas LIMIT, not the gas used, so size the limit from an estimate instead of padding it.
      const est: bigint = await forwarderRelay.execute.estimateGas(request);
      const tx = await forwarderRelay.execute(request, { gasLimit: (est * 115n) / 100n });
      void tx.wait().then((receipt: ethers.TransactionReceipt | null) => { if (receipt) roster.record(receipt); }).catch(() => { /* Failed transactions never add a teen. */ });
      res.json({ hash: tx.hash, submittedAt: Date.now() });
    } catch (e: any) {
      res.status(500).json({ error: e?.shortMessage || e?.message || "relay failed" });
    }
  });

  // "Add money": the treasury credits a Fam-ID's ledger balance. Capped and rate limited per Fam-ID.
  app.post("/faucet", async (req, res) => {
    try {
      const famId = String(req.body?.famId ?? "");
      if (!/^[a-z0-9_]{3,20}$/.test(famId)) return res.status(400).json({ error: "bad fam-id" });
      const to: string = await famfiRead.famIdToAddr(ethers.encodeBytes32String(famId));
      if (to === ethers.ZeroAddress) return res.status(404).json({ error: "unknown fam-id" });
      const last = faucetSeen[famId] ?? 0;
      if (Date.now() - last < cfg.faucetCooldownMs) {
        const waitMin = Math.ceil((cfg.faucetCooldownMs - (Date.now() - last)) / 60000);
        return res.status(429).json({ error: `already topped up; try again in ${waitMin} min` });
      }
      // Reserve before any further await: simultaneous requests must see the reservation.
      const reservedAt = Date.now();
      faucetSeen[famId] = reservedAt;
      try {
        // Persist the reservation before broadcasting; a disk failure must not allow a second deposit.
        saveFaucet();
        const bal: bigint = await usdc.balanceOf(await treasury.getAddress());
        if (bal < cfg.faucetAmount) { delete faucetSeen[famId]; saveFaucet(); return res.status(503).json({ error: "treasury is empty" }); }
        const tx = await famfiTreasury.depositFor(to, cfg.faucetAmount);
        // Only a confirmed revert clears cooldown. RPC failure is an unknown outcome, not permission to pay twice.
        void provider.waitForTransaction(tx.hash).then(receipt => {
          if (receipt?.status === 0 && faucetSeen[famId] === reservedAt) { delete faucetSeen[famId]; saveFaucet(); }
        }).catch(() => {});
        res.json({ hash: tx.hash, amount: ethers.formatUnits(cfg.faucetAmount, 6) });
      } catch (e) {
        delete faucetSeen[famId];
        try { saveFaucet(); } catch { /* Failure stays visible; a new request must persist before broadcasting. */ }
        throw e;
      }
    } catch (e: any) {
      res.status(500).json({ error: e?.shortMessage || e?.message || "faucet failed" });
    }
  });

  mountPrivate({
    app,
    famfiRead,
    chainId: async () => (await provider.getNetwork()).chainId,
    envioUrl: cfg.envioUrl ?? "",
    limited,
    knownTeens: roster.addresses,
  });

  /** One-time setup: let FamFi pull the treasury's USDC. */
  async function ensureTreasuryAllowance() {
    const owner = await treasury.getAddress();
    const current: bigint = await usdc.allowance(owner, cfg.famfi);
    const funded: bigint = await usdc.balanceOf(owner);
    if (current !== funded) {
      const tx = await new ethers.Contract(cfg.usdc, ERC20_ABI, treasury).approve(cfg.famfi, funded);
      await tx.wait();
    }
  }

  return { app, ensureTreasuryAllowance, provider };
}
