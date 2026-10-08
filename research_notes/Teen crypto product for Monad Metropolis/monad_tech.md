# Monad Technical Capabilities and Developer Stack (as of Oct 2026) for a Family/Teen Payments App

Method note: Facts are from docs.monad.xyz, vendor docs, and live JSON-RPC probes I ran against `rpc.monad.xyz` and `testnet-rpc.monad.xyz` on 2026-10-08 (marked "live probe"). Marketing claims are flagged as such.

IMPORTANT UPDATE: Monad's block time dropped from 400ms to **300ms** and finality from 800ms to **600ms** on **July 23, 2026**. Many 2025-era sources and pitch decks still say "400ms / 800ms"; those numbers are out of date.

## 1. Mainnet (143) and testnet (10143): timing, finality, gas pricing, cost, RPCs, explorers, faucets, reserve balance

### Takeaway
Mainnet chain 143 now has 300ms blocks, speculative finality at 300ms (Voted), deterministic finality at 600ms (Finalized), and "Verified" (state root) 3 blocks after that. Gas is EIP-1559-style with a 100 MON-gwei minimum base fee. **You are charged for the gas limit, not gas used.** A USDC transfer costs about 0.0085 MON (fractions of a US cent). Every EOA has a 10 MON "reserve balance" rule, and it matters for EIP-7702 accounts.

### Cited Findings
**Timing and finality**
- Block time is 300ms. A block is speculatively final after 1 block (300ms, the "Voted" stage, "Rare reverts are possible"). It is Finalized after 2 blocks (600ms) and cannot be reorged after that. "Verified" (state-root finality) comes 3 blocks after Finalized. Off-chain financial systems (exchanges, bridges, stablecoin/RWA issuers) should wait for Verified — [Monad deployment summary](https://docs.monad.xyz/developer-essentials/summary)
- The 300ms block / 600ms finality change took effect July 23, 2026, 10:30am ET, down from 400ms / 800ms. The blog also says "Monad delivers 10,000 TPS" (a marketing figure) — [Monad blog: 300ms block times](https://monad.xyz/blog/300ms-block-times)
- MonadBFT config: min block time 300ms, finality 2 slots (600ms), speculative finality 1 slot (300ms). Speculative finality "can only revert in rare circumstances requiring equivocation by the original leader" — [MonadBFT docs](https://docs.monad.xyz/monad-arch/consensus/monad-bft)
- RPC block tags: `latest` = Proposed (speculative execution, no vote yet). `safe` = Voted. `finalized` = Finalized. `pending` = `latest`. Data from non-finalized blocks can change between identical requests — [RPC differences](https://docs.monad.xyz/reference/rpc-differences)
- MONAD_NINE (v0.13.0, mainnet Mar 19, 2026) brought MIP-3 (linear memory cost), MIP-4 (reserve-balance introspection precompile), and MIP-5 (Osaka features such as CLZ). It also made `latest` return the latest *proposed* block. A later hard fork, MONAD_TEN, was scheduled for 2026-09-02 (page-encoded storage) — [search summary of Monad changelog / QuickNode status](https://docs.monad.xyz/developer-essentials/changelog/mainnet.md), [QuickNode status](https://status.quicknode.com/incidents/91dc7zlzyv56). Note: the network-info pages currently show "v0.15.2 / MONAD_NINE" as the revision, so I could not confirm whether MONAD_TEN has activated — [Network info](https://docs.monad.xyz/developer-essentials/network-information)

**Gas model**
- "Gas is charged on the gas limit, not gas used." Sender deduction = `value + gas_price × gas_limit`. This is a DoS mitigation for asynchronous execution — [summary](https://docs.monad.xyz/developer-essentials/summary), [differences](https://docs.monad.xyz/developer-essentials/differences)
- Per-tx gas limit is 30M. Block gas limit is 150M with an 80% target (120M). Throughput is 500M gas/sec. Minimum base fee is 100 MON-gwei. The fee is EIP-1559 compatible, and the base-fee controller "stays elevated for less time" than Ethereum's — [summary](https://docs.monad.xyz/developer-essentials/summary). (An older docs/search snippet said 200M block gas limit and 50 gwei fixed testnet base fee. Both are outdated; the live probe below confirms 150M and 100 gwei.)
- `eth_maxPriorityFeePerGas` returns a hard-coded 2 gwei (described as temporary) — [RPC differences](https://docs.monad.xyz/reference/rpc-differences)
- Category Labs guidance: large gas-limit safety buffers "significantly overcharge users". Use `eth_estimateGas` plus a modest buffer — [Category Labs: setting your gas limit on Monad](https://www.category.xyz/blogs/setting-your-gas-limit-on-monad)
- Live probe (2026-10-08), mainnet block 111,634,947:
  - baseFeePerGas = 100 gwei; `eth_gasPrice` = 0x17bfac7c00 = 102 gwei; block gasLimit = 150,000,000.
  - That block held 36 txs and used 21.4M gas (~14% full).
  - In the ~90 blocks before the probe there were 107 USDC Transfer events.
  - Testnet showed the same base fee and gas limit.

**Typical transaction cost (live probe plus my arithmetic)**
- `eth_estimateGas` for a USDC `transfer` to a fresh recipient = 83,207 gas. A native MON transfer = 21,000 gas.
- At 102 gwei, a USDC transfer is about 0.0085 MON and a MON transfer about 0.0021 MON. MON's price in Oct 2026 is uncertain: aggregators cluster around $0.02–0.03 but I could not date them — [KuCoin](https://www.kucoin.com/hi-au/price/MON), [StealthEx](https://stealthex.io/blog/monad-price-prediction-will-mon-coin-reach-1-soon/).
- At that price, a USDC transfer is roughly $0.0002–0.0003 (≈ 4,000–5,000 sponsored USDC transfers per US$1). Re-check the price before quoting.
- Smart-account / 4337 UserOps cost several times more gas (validation plus EntryPoint overhead). P256 verification adds ~6,900 gas (see section 2).

**Opcode repricing that affects cost**
- Cold account access costs 10,100 (Ethereum: 2,600).
- Cold storage costs 8,100 per 128-slot *page* (Ethereum: 2,100 per slot). Other slots on the same page are then warm.
- SSTORE costs 2,800 for the first write to a page plus 17,000 per net-new slot.
- Memory expansion is linear (w/2), capped at 8MB per tx.
- Sources: [summary](https://docs.monad.xyz/developer-essentials/summary), [differences](https://docs.monad.xyz/developer-essentials/differences)

**RPCs, explorers, faucet**
- Mainnet 143 (MON). Explorers: MonadVision (monadvision.com), Monadscan (monadscan.com), gmonads.com (network viz), Phalcon and Tenderly (traces), Jiffyscan (UserOps) — [Network info](https://docs.monad.xyz/developer-essentials/network-information)
- Mainnet public RPCs (all have `wss://`):

  | URL | Provider | Rate limit | Notes |
  |---|---|---|---|
  | `https://rpc.monad.xyz` | QuickNode | 25 rps, batch 100 | |
  | `https://rpc1.monad.xyz` | Alchemy | 15 rps | no debug/trace |
  | `https://rpc2.monad.xyz` | Goldsky | 300/10s, batch 10 | historical state |
  | `https://rpc3.monad.xyz` | Ankr | 300/10s | no debug |
  | `https://rpc-mainnet.monadinfra.com` | Monad Foundation | 20 rps, batch 1 | historical state |

  Source: [Network info](https://docs.monad.xyz/developer-essentials/network-information)
- Testnet 10143 was "reset from genesis on 2025-12-16".
  - RPCs: `https://testnet-rpc.monad.xyz` (QuickNode, 50 rps, archive), `https://rpc.ankr.com/monad_testnet`, `https://rpc-testnet.monadinfra.com` (archive).
  - Explorers: testnet.monadvision.com, testnet.monadscan.com.
  - Faucet: **https://faucet.monad.xyz**. App hub: testnet.monad.xyz.
  - Source: [Testnets](https://docs.monad.xyz/developer-essentials/testnets)

**Canonical contracts (mainnet)**

| Contract | Address |
|---|---|
| WMON | 0x3bd359C1119dA7Da1D913D1C4D2B7c461115433A |
| Multicall3 | 0xcA11bde05977b3631167028862bE2a173976CA11 |
| EntryPoint v0.6 | 0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789 |
| EntryPoint v0.7 | 0x0000000071727De22E5E9d8BAf0edAc6f37da032 |
| EntryPoint v0.8 | 0x4337084d9e255fF0702461CF8895cE9E3b5Ff108 |
| EntryPoint v0.9 | 0x433709009B8330FDa32311DF1C2AFA402eD8D009 |
| Safe | 0x69f4D1788e39c87893C980c06EdF4b7f686e2938 |
| SafeL2 | 0xfb1bffC9d739B8D520DaF37dF666da4C687191EA |
| Permit2 | 0x000000000022d473030f116ddee9f6b43ac78ba3 |
| CreateX | 0xba5Ed099633D3B313e4D5F7bdc1305d3c28ba5Ed |

- Also deployed: Simple7702Account, ERC-6492, and x402 contracts — [Network info](https://docs.monad.xyz/developer-essentials/network-information)
- Testnet differences:
  - WMON: 0xFb8bf4c1CC7a94c73D209a149eA2AbEa852BC541. EntryPoints v0.6–v0.9 are at the same addresses as mainnet.
  - Safe v1.4.1: 0x41675C099F32341bf84BFc5382aF534df5C7461a. SafeProxyFactory: 0x4e1DCf7AD4e460CfD30791CCC4F9c8a4f820ec67.
  - x402 ExactPermit2Proxy: 0x402085c248EeA27D92E8b30b2C58ed07f9E20001.
  - Source: [Testnets](https://docs.monad.xyz/developer-essentials/testnets)

**Reserve balance (critical for 7702 and sponsorship design)**
- Every EOA has `user_reserve_balance` = **10 MON**, a system-wide constant. The doc says a future version could let users customize it via a stateful precompile — [Reserve balance](https://docs.monad.xyz/developer-essentials/reserve-balance)
- Execution rule:
  - A non-sender, such as a delegated EOA called by someone else, may not end below `min(balance at tx start, 10 MON)`.
  - The sender may end lower only by the tx's gas spend.
  - Consensus checks an inflight gas budget of `min(10 MON, lagged balance)` over the last k=3 blocks — [Reserve balance](https://docs.monad.xyz/developer-essentials/reserve-balance)
- EIP-7702-delegated accounts: only txs that *decrement* MON **and** leave it below 10 MON revert. Delegated accounts cannot use the "emptying transaction" exception — [Reserve balance](https://docs.monad.xyz/developer-essentials/reserve-balance)
- Sponsorship: "A sponsor paying gas for a delegated EOA that starts at zero MON generally works." It is blocked only if an outgoing MON transfer would leave the EOA below 10 MON. An undelegated zero-MON EOA cannot pay its own gas — [Reserve balance](https://docs.monad.xyz/developer-essentials/reserve-balance)
- A reserve dip can be detected via precompile `0x1001` `dippedIntoReserve()`. It must be called with CALL, not STATICCALL — [Reserve balance](https://docs.monad.xyz/developer-essentials/reserve-balance)
- A tx that would dip into the reserve is *included and reverted*: it pays gas but has no other effect. Block builders may filter it — [Reserve balance](https://docs.monad.xyz/developer-essentials/reserve-balance)

### Inferences
- For a stablecoin-only teen wallet (balances in USDC, zero MON, gas sponsored), the reserve rule mostly doesn't bite, because ERC-20 transfers don't decrement MON. The one thing to avoid is designing flows where a teen's delegated EOA sends *native MON* out of a balance under 10 MON.
- Gas-limit charging means the paymaster pays for whatever gas limit the bundler or SDK sets. Sponsorship budgets must be modeled on gas limit, and 4337 `callGasLimit`/`verificationGasLimit` padding directly costs the sponsor. Tight estimation is a real cost lever.
- Block utilization was about 14% at probe time, so there is lots of headroom. Fees sit at the 100-gwei floor, which makes per-payment onchain policy checks economically trivial today.

### Gaps
- No official "typical tx cost in USD" is published, and MON's Oct-2026 price could not be confirmed. Costs above are my calculation.
- Whether MONAD_TEN activated on 2026-09-02 could not be confirmed (the docs page still shows MONAD_NINE).

## 2. EIP-7702, P256 precompile, ERC-4337 bundlers/paymasters, smart accounts, session keys

### Takeaway
All the passkey and account-abstraction primitives are live on mainnet:
- **EIP-7702 (tx type 4)** is supported.
- **P256 (secp256r1) verification precompile** is at `0x0100` under **EIP-7951**, the L1 successor of RIP-7212 with the same address and interface. I verified it live on mainnet and testnet: it returns `1` for a valid signature and costs about 6.9k gas.
- **EntryPoints v0.6–v0.9** are deployed.
- **Alchemy, Pimlico, thirdweb, ZeroDev, Biconomy, and Sequence** list mainnet support.

### Cited Findings
- "P256 signature verification at 0x0100 (EIP-7951)" enables onchain WebAuthn/passkey verification. EIP-7702 is supported (tx type 4). Tx types 0/1/2/4 are supported; type 3 (blobs) is not. Ethereum precompiles 0x01–0x11 (Fusaka set) are supported — [summary](https://docs.monad.xyz/developer-essentials/summary), [differences](https://docs.monad.xyz/developer-essentials/differences)
- Live probe (2026-10-08): I generated a fresh secp256r1 key, signed sha256("famfi"), and `eth_call`ed `0x…0100` with `hash‖r‖s‖x‖y` (160 bytes).
  - Mainnet and testnet both returned `0x…01` (valid).
  - `eth_estimateGas` = 30,811 total. That is ≈ 21,000 intrinsic + calldata + ~6,900 precompile, consistent with EIP-7951 pricing.
- 7702 constraints on Monad:
  - A delegated EOA cannot drop below 10 MON while delegated.
  - CREATE/CREATE2 are banned when a delegated EOA is executing as a contract.
  - Source: [differences](https://docs.monad.xyz/developer-essentials/differences)
- AA provider table (Monad docs):

  | Provider | Mainnet | Testnet | Services |
  |---|---|---|---|
  | Alchemy | ✅ | ✅ | Gas Manager/paymaster + Bundler; EIP-7702 support stated |
  | Biconomy | ✅ | ✅ | Orchestration |
  | Pimlico | ✅ | ✅ | Paymaster + Bundler |
  | Sequence | ✅ | ✅ | Relayer, sponsorship, fee abstraction |
  | thirdweb | ✅ | ✅ | Paymaster + Bundler, "sponsorship policies" |
  | ZeroDev | ✅ | ✅ | Bundlers/paymasters meta-infra |
  | FastLane | ❓ | ✅ | Paymaster + Bundler; Monad-native |
  | Gelato | — | ✅ | Testnet only |
  | Openfort | — | ✅ | Testnet only |

  Source: [Monad AA providers](https://docs.monad.xyz/tooling-and-infra/wallet-infra/account-abstraction)
- Smart account implementations listed by Monad docs:
  - **Biconomy Nexus**: with passkeys, embedded wallets, or via 7702. "Session keys are available for all the above methods."
  - **MetaMask Smart Accounts Kit**: 4337 and 7702, WebAuthn, multisig, ERC-7710 delegations.
  - **Pimlico permissionless.js**: SDK across account types.
  - **ZeroDev**: smart accounts plus session keys with "ECDSA, Passkey, Multisig" signers, "policies, and actions".
  - Source: [Monad smart accounts](https://docs.monad.xyz/tooling-and-infra/wallet-infra/smart-accounts)
- Safe and SafeL2 are canonical deployments on mainnet (addresses in section 1). Simple7702Account is also deployed — [Network info](https://docs.monad.xyz/developer-essentials/network-information)

### Inferences
- ZeroDev's Kernel is ERC-7579-based and Biconomy Nexus is ERC-7579, so 7579 modules (session keys, spending-limit/permission policies, passkey validators) should be usable. Monad docs don't use the term "ERC-7579", so treat this as inference from vendor architecture.
- Because the P256 precompile is native, a passkey-validated smart account (WebAuthn validator) costs ~7k gas per signature check instead of ~200k–350k for a Solidity P256 verifier. A per-payment onchain parent co-sign via passkey becomes cheap.
- The MetaMask Smart Accounts Kit with ERC-7710 delegations fits "parent delegates scoped spending authority to teen" well.

### Gaps
- I did not independently confirm Pimlico's or ZeroDev's own supported-chain pages list chain 143. Monad's docs mark them ✅ for mainnet. Pimlico's chain slug for Monad was not verified.
- There is no first-party doc confirming specific ERC-7579 modules (e.g., Rhinestone, Smart Sessions) deployed on Monad.

## 3. Stablecoins on Monad: USDC, testnet USDC, AUSD, USDT0, CCTP/faucet

### Takeaway
**Both USDC addresses are confirmed by Circle's own docs.** AUSD and USDT0 addresses come from Monad's official token-list repo. A wide range of other stables exist (USD1, USDe, frxUSD, MetaMask USD, Mento USDm, and euro stables).

### Cited Findings
- **USDC mainnet: `0x754704Bc059F8C67012fEd69BC8A327a5aafb603`** (confirmed). **USDC testnet: `0x534b2f3A21130d7a60830c2Df862319e593943A3`** (confirmed) — [Circle USDC contract addresses](https://developers.circle.com/stablecoins/usdc-contract-addresses). Both also appear in Monad's token lists — [monad-crypto/token-list](https://github.com/monad-crypto/token-list/blob/main/tokenlist-testnet.json)
- Monad mainnet token list (chain 143) — [token-list mainnet](https://github.com/monad-crypto/token-list/blob/main/tokenlist-mainnet.json):

  | Token | Address |
  |---|---|
  | AUSD (Agora) | 0x00000000eFE302BEAA2b3e6e1b18d08D69a9012a (AUSD's standard vanity address) |
  | USDT0 | 0xe7cd86e13AC4309349F30B3435a9d337750fC82D |
  | USD1 (World Liberty) | 0x111111d2bf19e43C34263401e0CAd979eD1cdb61 |
  | USDe | 0x5d3a1Ff2b6BAb83b63cd9AD0787074081a52ef34 |
  | frxUSD | 0x58E3ee6accd124642dDB5d3f91928816Be8D8ed3 |
  | mUSD (MetaMask USD) | 0xacA92E438df0B2401fF60dA7E4337B687a2435DA |
  | USDm (Mento) | 0xBC69212B8E4d445b2307C9D32dD68E2A4Df00115 |
  | EURm (Mento) | 0x4D502d735B4C574B487Ed641ae87cEaE884731C7 |

  Yield variants on AUSD: sAUSD 0xD793c04B87386A6bb84ee61D98e0065FdE7fdA5E and earnAUSD 0x103222f020e98Bba0AD9809A011FDF8e6F067496.
- The testnet token list contains only USDC among stablecoins (live parse of tokenlist-testnet.json) — [token-list testnet](https://github.com/monad-crypto/token-list/blob/main/tokenlist-testnet.json)
- Live activity: 107 USDC Transfer events in ~90 mainnet blocks (~27s) at probe time. This shows real but modest USDC flow (live probe).
- Chainlink CCIP expanded to Monad mainnet (Nov 24, 2025 changelog) — [Chainlink changelog](https://dev.chain.link/changelog/ccip-on-nexon-mainnet-and-monad-mainnet)

### Inferences
- USDC is Circle-native on Monad (Circle lists the address), not a bridged wrapper. That is the right default unit of account for a family app.
- AUSD is Monad-ecosystem-favoured, and its yield wrappers (sAUSD/earnAUSD) could back a "savings jar" mechanic. Confirm the issuer and regulatory posture before building on it.

### Gaps
- **Circle CCTP V2 domain for Monad**: not verified in this pass; check developers.circle.com/cctp supported domains.
- **Circle testnet faucet support for Monad**: not verified (faucet.circle.com).
- **Agora's own docs for AUSD on Monad**: not fetched. The address comes from Monad's token list only.

## 4. Wallet SDKs: Dynamic, Privy, Mera; indexing (Envio, Alchemy, QuickNode); Chainlink CRE

### Takeaway
- Dynamic, Privy, thirdweb, Turnkey, Alchemy, Crossmint, Sequence, MetaMask Embedded Wallet, Openfort, and **Mera** all list Monad mainnet and testnet in Monad's docs.
- **Mera** is Category Labs' (Monad core dev) open TypeScript library that derives plain EOAs from a passkey's WebAuthn PRF output. There is no bundler and no MPC. Caveat: plain EOA plus a PRF-capable passkey provider is required.
- Dynamic's *native* gas sponsorship is 7702-based and limited to V3 MPC wallets, and **Monad is not confirmed** on its sponsorship chain list.
- Envio HyperSync supports Monad mainnet.
- **Chainlink CRE now lists Monad mainnet and testnet.**

### Cited Findings
**Embedded wallets**
- Monad's embedded-wallet table lists these on both mainnet and testnet:
  - With passkeys: Dynamic, Privy, thirdweb, Turnkey, Alchemy (smart accounts plus Gas Manager), Crossmint (smart accounts), Sequence (smart accounts), MetaMask Embedded Wallet, Openfort, Mera.
  - Others: Para, Reown, Cubist (passkeys for MFA only), Coinbase CDP, Fordefi, Portal.
  - Testnet perks: "Privy is subsidizing all Monad Testnet usage!"; Turnkey and Para are free on testnet.
  - Dynamic's row notes "TEE; TSS-MPC" key management.
  - Sources: [Monad embedded wallets](https://docs.monad.xyz/tooling-and-infra/wallet-infra/embedded-wallets), [search summary](https://docs.monad.xyz/tooling-and-infra/wallet-infra/embedded-wallets.md)

**Dynamic gas sponsorship**
- "available exclusively for V3 MPC embedded wallets", and "Contact us to turn it on".
- The first sponsored tx triggers a one-time EIP-7702 delegation to a Dynamic relayer contract. The user signs an EIP-712 intent (`validForSeconds` default 600).
- Supported chains are on a separate page. Visible mainnet entries: Ethereum, Base, Optimism, Arbitrum, BNB. Monad was not seen.
- Sources: [Dynamic EVM gas sponsorship](https://www.dynamic.xyz/docs/react/smart-wallets/evm-gas-sponsorship), [Dynamic JS sponsored tx](https://www.dynamic.xyz/docs/javascript/reference/evm/send-sponsored-transaction)
- Dynamic also has a first-class ZeroDev integration (4337 smart wallets). Monad listings for Dynamic+ZeroDev that I found reference testnet — [Dynamic v3 ZeroDev](https://v3.docs.dynamic.xyz/smart-wallets/smart-wallet-providers/zerodev), [Monad AA wallet providers](https://docs.monad.xyz/tooling-and-infra/account-abstraction/wallet-providers)

**Mera (Category Labs)**
- Derives EVM accounts from passkey PRF output. "Ordinary EOAs, so there is nothing to deploy, and no bundler or MPC service to run."
- API: `createPasskeyWithPrfOutput` (onboarding; store the credential ID) and `getPasskeyPrfOutput` (sign-in). Default PRF salt is sha256("mera.prf.salt.v1"). It uses a standard BIP-44 path, so the exported mnemonic imports into MetaMask or Rabby. v0.2.0 added React Native.
- Requirements: HTTPS, and a PRF-capable provider (iCloud Keychain, 1Password, Google Password Manager). Desktop Chrome passkeys not saved to Google Password Manager throw `PRF_UNAVAILABLE`.
- Losing passkey access means losing the accounts.
- Sources: [Monad docs: Mera](https://docs.monad.xyz/guides/mera), [Mera getting started](https://mera.category.xyz/getting-started/), [Category Labs blog, Aug 5 2026](https://www.category.xyz/blogs/mera-crypto-onboarding-with-only-a-passkey-on-any-network), [Mera React Native](https://mera.category.xyz/recipes/use-mera-with-react-native/)

**Indexing and RPC providers**
- Envio HyperSync (live search snippet of Envio's supported-networks docs):
  - Mainnet: `https://monad.hypersync.xyz` (= `https://143.hypersync.xyz`). HyperRPC: `https://monad.rpc.hypersync.xyz`.
  - Testnet: `https://monad-testnet.hypersync.xyz` (= `10143.hypersync.xyz`).
  - Envio announced full Monad mainnet indexing in Nov 2025.
  - Sources: [Envio HyperSync supported networks](https://docs.envio.dev/docs/HyperSync/hypersync-supported-networks), [Envio Monad testnet](https://docs.envio.dev/docs/HyperIndex/monad-testnet), [Envio Monad guide](https://docs.envio.dev/blog/how-to-index-monad-data-using-envio)
- Alchemy and QuickNode run Monad's own public mainnet RPCs (rpc1 and rpc), so both support chain 143 — [Network info](https://docs.monad.xyz/developer-essentials/network-information)
- `eth_getLogs` range limits are low because blocks are fast: QuickNode / Monad Foundation 100 blocks; Ankr and Alchemy 1,000 blocks (Alchemy also 10k logs). Using an indexer (Envio/Goldsky) is effectively required for history — [RPC differences](https://docs.monad.xyz/reference/rpc-differences)

**Chainlink**
- **CRE supports Monad**:
  - Mainnet "Monad | CLI v1.29.0+ | Go SDK v1.17.0+ | TS SDK v1.18.0+".
  - Testnet "Monad Testnet | v1.30.0+ | v1.19.0+ | v1.19.0+".
  - Source: [Chainlink CRE supported networks](https://docs.chain.link/cre/supported-networks-ts.md)
- CCIP is live on Monad mainnet — [Chainlink changelog](https://dev.chain.link/changelog/ccip-on-nexon-mainnet-and-monad-mainnet)

### Inferences
- **Recommended stack for passkey + policy + sponsorship on Monad today:**
  - Either (a) Alchemy Account Kit (passkeys + smart accounts + Gas Manager, all mainnet), or (b) ZeroDev Kernel / Biconomy Nexus with a passkey validator using the 0x0100 precompile + Pimlico or Alchemy paymaster.
  - Dynamic is usable for auth and embedded wallets, but its *native* sponsorship on Monad should be confirmed with Dynamic before relying on it. Fallback: Dynamic + ZeroDev, or Dynamic signer + Pimlico.
- Mera gives the most "Monad-native" passkey story. It is a plain EOA, so spending policies require pairing it with 7702 delegation to a policy contract (remember the reserve-balance constraints) or using it as the signer of a smart account.
- Mera's PRF-derived key exists in JS memory at signing time. This is a different security model from a WebAuthn-signed smart account, whose key never leaves the secure enclave. For a teen app, the WebAuthn + P256-precompile smart account is the stronger custody model. Mera is the lighter-weight onboarding model.
- CRE could run off-chain logic (e.g., allowance schedules, fiat-rate checks, notifications) that writes onchain.

### Gaps
- Dynamic's sponsorship supported-chains table was not retrieved, so Monad is unconfirmed.
- Privy's own docs on Monad smart-wallet / sponsorship were not fetched (Monad docs only confirm embedded wallets and the testnet subsidy).
- Envio's claimed setup time (e.g., "minutes") was not verified.

## 5. Dev gotchas, and which product mechanics genuinely depend on Monad (vs. L2s / Solana)

### Takeaway
Monad's distinctive properties for a family-payments app:
- **600ms deterministic L1 finality** with no sequencer trust and no 7-day/L1 settlement dependency;
- **native P256** for passkeys;
- **very cheap execution with large headroom** (500M gas/s, blocks ~14% full);
- **128KB contracts** for rich onchain policy engines.

Honest comparison:
- Base's 200ms Flashblocks and Arbitrum's 250ms blocks give comparable *perceived* UX latency via sequencer pre-confirmation.
- Solana's ~400ms slots are comparable in latency but not EVM.
- The real differentiators are trust model (finality without a centralized sequencer) and headroom, not raw speed alone.

### Cited Findings
**Gotchas (Monad docs)**
- **Gas-limit charging.** See section 1.
- **TIMESTAMP has second granularity, so 3–4 consecutive blocks often share a timestamp.** Per-second logic is fine, but sub-second streaming can't use `block.timestamp` deltas; use `block.number` × 300ms. Block-time changes (400→300ms) would break block-number-based clocks — [summary](https://docs.monad.xyz/developer-essentials/summary)
- **No global mempool.** RPCs forward to upcoming leaders. `eth_getTransactionByHash` returns `null` for not-yet-included txs. Nonce and balance checks are deferred, so RPCs may accept txs with nonce gaps or insufficient balance — [RPC differences](https://docs.monad.xyz/reference/rpc-differences)
- **Receipts at Proposed.** Receipts are available once a block is Proposed; wait for Finalized to avoid reorg handling. WebSocket `newHeads`/`logs` fire at Proposed. `monadNewHeads`/`monadLogs` add `commitState` updates. A block may jump Proposed→Finalized. No explicit abandonment event. `newPendingTransactions` and `syncing` are unsupported — [RPC differences](https://docs.monad.xyz/reference/rpc-differences), [summary](https://docs.monad.xyz/developer-essentials/summary)
- **`eth_sendRawTransactionSync`.** Not documented separately by Monad. Live probe: the method exists on both mainnet and testnet RPCs; a malformed tx returned a decode error, not "method not found". Treat it as available but verify semantics, since it presumably returns a receipt at Proposed.
- **Contract and memory limits.** Max contract size 128KB (Ethereum 24.5KB); init code 256KB. Memory capped at 8MB per tx — [summary](https://docs.monad.xyz/developer-essentials/summary)
- **Historical state.** Full nodes don't serve arbitrary historical state; use rpc-mainnet.monadinfra.com or Goldsky rpc2 — [summary](https://docs.monad.xyz/developer-essentials/summary)
- **`eth_estimateGas` pools.** Routed to low-gas (≤8.1M) or high-gas pools; provider caps 30M–1B — [RPC differences](https://docs.monad.xyz/reference/rpc-differences)
- **Tooling versions.** Use Foundry ≥ v1.8.0 and viem ≥ 2.40.0 — [summary](https://docs.monad.xyz/developer-essentials/summary)
- **Storage-page pricing.** Packing per-user policy state in consecutive slots (same 128-slot page) is cheaper — [differences](https://docs.monad.xyz/developer-essentials/differences)

**Comparators**

| Chain | Block / latency | Finality | Notes |
|---|---|---|---|
| Monad | 300ms blocks | Speculative ~300ms; deterministic 600ms (L1, BFT) | |
| Base | 2s blocks; 200ms Flashblocks | Flashblocks are a sequencer pre-confirmation, not finality; reorg rate < 0.1% | [Base Flashblocks docs](https://docs.base.org/base-chain/flashblocks/apps.md) |
| Arbitrum One | 250ms blocks | Sequencer soft-confirmation <1s (3rd-party figure); L1 finality ~13 min | Arbitrum proposed "Operation SlowMo" to raise blocks to 2s; adoption unconfirmed — [Arbitrum research](https://research.arbitrum.io/t/the-power-of-faster-blocks/9609), [Arbitrum blog: SlowMo](https://blog.arbitrum.io/operation-slowmo-slowing-down-block-times-on-arbitrum-one-and-arbitrum-chains) |
| Polygon PoS | ~2s blocks | Deterministic 2–5s after Heimdall v2 (July 2025) | Has had finality-lag incidents (10–15 min) — [Polygon finality docs](https://docs.polygon.technology/pos/concepts/finality/finality), [The Block incident](https://www.theblock.co/post/370163/polygon-pos-chain-faces-delay-in-reaching-consensus-finality) |
| Solana | ~400ms slots / pre-confirmation | ~12.8s TowerBFT | Alpenglow targets ~150ms finality, not yet on mainnet (Foundation says Q3 2026; others say late 2026) — [Solana Alpenglow](https://solana.com/upgrades/alpenglow), [Chainstack](https://docs.chainstack.com/docs/solana-alpenglow-consensus) |
| Ethereum L1 | 12s slots | ~12.8 min finality | General knowledge; not re-sourced this pass |

### Inferences — product mechanics that specifically lean on Monad's properties (honest assessment)
1. **Real-time parent co-sign at a checkout (approval-required purchase).**
   - Flow: teen initiates; parent gets a push and approves with a passkey (onchain P256 verify ~7k gas); the merchant sees *final* settlement ~600ms after inclusion.
   - Monad-specific parts: final (not pre-confirmed) settlement in under 1s with no sequencer trust, and cheap native P256.
   - On Base, Flashblocks give ~200ms *perceived* inclusion, which is UX-equivalent. However, the RIP-7212 precompile is also on Base/Arbitrum/Polygon, so P256 alone is **not** a Monad differentiator. The differentiator is L1 finality for a merchant-facing settlement guarantee.
2. **Onchain policy check on every payment** (per-merchant-category limits, daily caps, time-of-day locks, velocity rules, savings-split).
   - Monad helps through cheap execution, 128KB contracts that allow a rich single-contract policy engine (no proxy/diamond splitting), and storage-page pricing for packed per-teen state.
   - On L2s this is also feasible and cheap. Monad's advantage is mainly the 128KB size limit and fee headroom under load. Note that the gas-limit charging partly offsets this.
3. **Per-second streaming allowances** (allowance accrues every second, claimable anytime).
   - Mechanically, streaming is computed lazily (Sablier-style), so it doesn't need fast blocks. Fast finality only makes *claims and spends* feel instant.
   - Caveat: 1-second timestamp granularity. Be honest that this is **not** Monad-dependent.
4. **Many micro-transactions / round-ups / chore micro-rewards** (tens of thousands of sponsored txs/day).
   - At ~0.0085 MON per USDC transfer, roughly $0.0002–0.0003 at the uncertain MON price, sponsoring 10k tx/day costs ≈ 85 MON/day (≈ $2–3/day at that price). Recompute with the live price.
   - Base and Arbitrum are also sub-cent, so cost alone is comparable. Monad's edge is fee stability from headroom (blocks ~14% full; 500M gas/s), which matters for a sponsor's predictable budget.
5. **Real-time multi-party settlement** (split a bill among siblings/friends; group "pot" that pays out when all contribute).
   - This benefits from many interdependent txs settling with *deterministic finality* within a single user-facing moment (each step final in 600ms).
   - On optimistic L2s, intermediate states are only sequencer-confirmed. This is the strongest "needs Monad's properties" argument, alongside #1.
6. **Instant, final refunds and reversals within a parent-controlled window**, e.g., parent can claw back within N blocks. N blocks at 300ms gives precise, short windows. Use block numbers, not timestamps.
7. **Where L2s are genuinely comparable (say so in a pitch):**
   - Perceived latency: Base 200ms Flashblocks ≈ Monad 300ms.
   - Fees: all sub-cent.
   - Passkey precompile: RIP-7212 on major L2s.
   - AA tooling: more mature on Base.
   - Base also has deeper USDC liquidity and Coinbase on/off-ramps, a real distribution advantage.
   - Monad's defensible claims are: (a) deterministic L1 finality in 600ms without a centralized sequencer or L1 challenge window, (b) large execution headroom and the 128KB contract limit for onchain policy engines, and (c) native ecosystem support (Monad-native Mera passkey wallets, FastLane, Envio, CRE).
8. **Design implications from the gotchas:**
   - Model sponsorship cost on gas *limit*.
   - Keep teen accounts stablecoin-only so the 10 MON reserve rule for 7702-delegated EOAs never blocks a flow.
   - Use `safe`/Voted (300ms) for UX and `finalized` (600ms) for merchant release; use Verified for off-ramp/fiat.
   - Use an indexer (Envio HyperSync) because of the 100–1,000 block `eth_getLogs` limits.

### Gaps
- No primary-source benchmark compares end-to-end "tap-to-final" latency on Monad vs. Base Flashblocks for a 4337 UserOp, since bundler latency dominates. Measure in the prototype.
- RIP-7212 availability on each specific L2 (Base, Arbitrum, Polygon) was not re-verified in this pass (general knowledge says yes).
- Arbitrum "SlowMo" adoption status is unconfirmed.
