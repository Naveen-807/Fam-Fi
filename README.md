# Fam-Fi

**The allowance that grows up with your kid, with gifts that match what they save.**

Fam-Fi is a family money app built on [Monad](https://monad.xyz) testnet for the Monad Metropolis hackathon (Track 02: Consumer Products & Payments). A parent funds a teen's allowance. The teen pays friends by Fam-ID inside daily limits. Unusual payments pause and alert the parent. A relative can lock a gift that is matched as the teen saves. Families see email login and Fam-IDs, never a wallet or an address.

> **Testnet prototype.** The money is Circle's testnet USDC and has no value. The contracts are unaudited. Do not use real money.

## What works today

| Feature | Where it lives | Verified by |
|---|---|---|
| Fam-ID registry, parent-invited teens. The parent chooses every starting limit and signs it into the invite; the contract has no built-in numbers | `contracts/src/FamFi.sol` | 40 Hardhat tests |
| Streaming allowance (accrues by the second, belongs to the teen) | contract | tests |
| Daily limits by level, over-limit holds the parent approves | contract | tests |
| Scam Shield: a large first payment to a new payee, or a large payment in a teen's first 24 hours, is held for a few minutes and the parent is alerted | contract | tests |
| Freeze (spending stops; saving and incoming money still work) | contract | tests, UI run |
| Goals, matched gifts (any ratio), round-up, level-up, spend-from-goal | contract | tests, UI run |
| Splits (a friend pays a share) and money requests | contract | tests, UI run |
| Gasless: users sign, a relayer pays gas | `contracts/src/FamFiForwarder.sol`, `relayer/` | relayer smoke test with zero-gas wallets |
| **Funded money missions**: a parent commits a fixed reward up front (taken from their spendable balance); the teen submits; the parent approves, sends back with feedback (teen can resubmit before the deadline), or cancels; unsubmitted missions expire and refund. Paid exactly once. Optional link to a savings goal | `contracts/src/FamFi.sol` (`createMission` … `expireMission`) | 14 new contract tests (authorization, every transition, replay, reserved funds, bounds, freeze, goal routing, gasless identity, fuzz + ledger invariant) and `relayer/scripts/missions-flow.ts` |
| **Approval inbox**: submitted missions, held payments, proposed goals and money requests in one list, each saying what happened, why, who can act and what each button does. Only actions the contract has are shown | `app/src/components/inbox.tsx` | typecheck + build; real-stack flow for the contract paths |
| **Progress Passport** (teen) and **Weekly Brief** (parent) from Envio: completed missions, confirmed rewards, savings, goals reached, payments that settled inside the rules, allowance funded, held payments. Counts and base-unit sums of confirmed actions only; rejected, held, cancelled, expired and replayed events never count; no score. Weeks are Monday to Sunday in the family's time zone | `indexer/` (`Mission`, `ProgressEvent`, `TeenProgress`, `WeeklyStat`), `app/src/components/{passport,brief}.tsx` | 4 new indexer tests (lifecycle, replay, week boundary at a non-zero time zone, FutureFund) |
| **FutureFund**: a parent opens a long-term pot for a teen, adds money from their balance, and the teen sees a source-linked "money story". **The money is tracked and locked inside Fam-Fi; it is not invested** and the app says so everywhere. The teen claims it on the intended date (the parent may release it earlier). No clawback, no cash-out | contract (`createFutureFund` …), `app/src/components/futurefund.tsx` | contract tests + real-stack flow |
| Authenticated private reads: Passport, Brief, Inbox and FutureFund data are served by the relayer's `/private/query`, after an EIP-712 sign-in; role and family come from the contract, queries are fixed | `relayer/src/private.ts` | 17 gateway checks (`npm run test:private`) |
| Plain-language timeline of everything | `indexer/` (Envio) | indexer test replaying a family story |
| Web app: parent, teen, relative, friend screens | `app/` | sign-in form browser test |

**What "held" means, honestly:** Scam Shield is a delay and an alert, not a guarantee. A parent who does nothing lets the teen release the payment after the hold, unless "strict holds" is turned on. A patient scammer who first receives a small payment becomes a known payee. There is no withdrawal function in this build, so money can only move between Fam-IDs.

## Architecture

```
 browser (Next.js PWA) ── signs an EIP-712 request ──► relayer ──pays gas──► Forwarder ──► FamFi contract ──► USDC
        ▲                                                                          │ events
        └──── live GraphQL ◄──── Envio indexer (plain-language timeline) ◄─────────┘
```

* **`contracts/`**: one `FamFi` contract with no admin key, holding an internal USDC ledger, plus a permissionless ERC-2771 forwarder. Hardhat project.
* **`relayer/`**: `POST /relay` verifies and simulates a signed request, returns a readable reason if it would fail, then submits it. `POST /faucet` credits a Fam-ID from a treasury wallet. `GET /health`.
* **`indexer/`**: Envio HyperIndex config, schema and handlers. `dev-server.ts` replays real chain events through the same handlers and serves the same Hasura-style GraphQL, without Docker.
* **`scripts/`**: `new-wallets`, `deploy-testnet`, `start-testnet`.
* **`app/`**: Next.js app. Real login is Dynamic's headless SDK: an email code creates a wallet for that email (same email, same wallet), then an optional passkey (Face ID / fingerprint) for next time.
* **`e2e/`**: Playwright browser tests of the real UI.
* **`abi/`**: ABIs shared by all of the above.

## Run it

**Your wallets, Circle's real testnet USDC, Monad testnet.** Nothing is mocked or pre-filled: every person is their own wallet, every number a parent sets is the number their teen gets, and the contract has no built-in limits.

```bash
node scripts/install-all.mjs           # installs every part (needs Node 22.15+; a few minutes the first time)
node scripts/new-wallets.mjs           # creates deployer + relayer + treasury; prints their addresses
#  -> fund them: https://faucet.monad.xyz (MON, all three) and https://faucet.circle.com (USDC, Monad Testnet, treasury)
node scripts/wallet-status.mjs         # shows which wallet still needs MON or USDC, and what to do about it
node scripts/send-mon.mjs --from treasury --to relayer --amount 2   # optional: move MON between your own wallets
node scripts/deploy-testnet.mjs --dynamic-env <your Dynamic environment id>   # checks balances, deploys, writes all config
node scripts/start-testnet.mjs         # relayer + indexer + app; open http://localhost:3000
```

Run the checks:

```bash
(cd contracts && npx hardhat test)                 # 40 contract tests
(cd relayer && npm run test:private)               # 17 checks on the authenticated read gateway
(cd relayer && npm run test:flow)                  # starts a local chain + the real dev indexer; missions, Passport, FutureFund end to end
(cd relayer && npm run smoke)                      # needs `npx hardhat node` running in contracts/
(cd app && npm run typecheck && npm run build)
(cd indexer   && npm test)                         # handler tests via Envio's TestIndexer
(cd e2e && npm install --legacy-peer-deps)
(cd e2e && node dynamic-ui.mjs)                  # real sign-in form renders and fails gracefully
```

## Missions, Passport, Brief and FutureFund: how they fit together

* **Contract is the authority.** Rewards and FutureFund contributions move through the same internal ledger as everything else; `missionEscrow` and `fundEscrow` are part of the "contract USDC = ledger" invariant that the tests check after every step. The app re-reads a mission's or fund's state from the contract right before acting, so a stale screen cannot approve the wrong thing.
* **Envio explains, it never decides.** The indexer derives history and weekly totals from events. Totals only change when a confirmed event arrives, and each counted action is stored once under its `txHash-logIndex` so a redelivered event cannot count twice.
* **Private reads.** Envio's endpoint is public, so the app does not query it for family data. It signs a 30-minute `ReadAuth` message; the relayer verifies it, takes the caller's role and family from the contract, and runs fixed queries (a parent gets their family; a teen only their own records; a relative gets nothing about a child). Set `ENVIO_URL` in `relayer/.env` (the deploy script does). **Limits, honestly:** every Fam-Fi event is still public on Monad, so this protects the app's summaries, not the chain; and the Envio endpoint itself should not be exposed to browsers in a real deployment. Mission titles, descriptions, feedback and FutureFund names are written to the chain as public text, so the app asks families to keep them non-private. There are no photos or private notes on-chain.
* **FutureFund is not an investment.** The contract holds the money; nothing is lent, staked or invested, and the app shows no yield, price or return. I looked for a verifiable Monad-testnet market that takes Circle's testnet USDC and found none (one search, plus confirming the USDC contract and chain id 10143 are live on the RPC), so investing is shown as "not turned on". If one is verified later it would need its own review: deposit and withdraw functions, how shares are read, fees and losses.
* **Contract size.** `FamFi` is now about 29 KB, over Ethereum's 24 KB cap but inside Monad's 128 KB limit ([MIP-2](https://mips.monad.xyz/MIPs/MIP-2)). The local Hardhat network has `allowUnlimitedContractSize` turned on for that reason; do not deploy this contract to an Ethereum-sized chain.

## Deploy to Monad testnet (10143)

**This version needs a new FamFi address.** The contract is immutable, so missions and FutureFund exist only in a fresh deployment, and everyone starts over (old families stay on-chain at the old address). Preview exactly what would change without sending anything:

```bash
node scripts/deploy-testnet.mjs --dry-run --dynamic-env <your Dynamic environment id>
```


Use the three scripts above. They do the following for you:
1. `new-wallets.mjs` saves three throwaway keys to `.wallets.json` (git-ignored) and prints only addresses.
2. `deploy-testnet.mjs` refuses to continue until each wallet has MON and the treasury has USDC (it tells you exactly which), deploys with Circle's USDC address (`0x534b…43A3`), writes `relayer/.env`, `app/.env.local`, `indexer/.env`, and sets the indexer's start block.
3. `start-testnet.mjs` starts the relayer, indexer and app together.

Test USDC: https://faucet.circle.com (choose USDC, then Monad Testnet; no account; 20 USDC per request, one request per address every 2 hours at the time of writing).

Dynamic (real email sign-in): create a **sandbox** environment at https://console.dynamic.xyz, then
```sh
npm install -g @dynamic-labs/dynamic-console-cli
dyn auth login
dyn status                       # confirm the sandbox environment
dyn settings set sdk.embeddedWallets.automaticEmbeddedWalletCreation true
dyn settings list | grep -iE "email|passkey|chain|network|origin|cors"   # find the keys for the rest
```
Also enable **email sign-in**, **embedded wallets**, **passkeys**, the **EVM** chain, and add your site's address to the **allowed origins**. Pass the Environment ID to `deploy-testnet.mjs --dynamic-env`.

For the hosted Envio indexer instead of the bundled one, set `ENVIO_FAMFI_ADDRESS`, run `npx envio codegen` in `indexer/` and deploy; point `NEXT_PUBLIC_ENVIO_URL` (and `NEXT_PUBLIC_ENVIO_WS`) at it. The bundled `dev-server.ts` replays real chain events through the same handlers and is enough for a single machine.

## Honest status: what is and is not verified

Verified here, on a local chain: everything in the table above.

**Not yet done for the missions release:**
* No new deployment has been made. The Monad testnet contract from before is the old version (no missions, no FutureFund) until you run the deploy script.
* No browser walkthrough of the new screens exists, because real Dynamic email login can't be automated here. The new screens are covered by typecheck, a production build, the contract/indexer/gateway tests, and a script that drives the real relayer + indexer on a local chain. Please click through them once with your Dynamic sandbox account.
* The weekly boundaries and "indexer is behind" notes are only exercised against the local dev indexer; the hosted Envio deployment is still unverified.

**Not yet verified on Monad testnet**, so treat as open until tested:
* Dynamic email + passkey sign-in and signing typed data (`app/src/lib/dynamic-shell.tsx`). It uses Dynamic's recommended headless SDK (`@dynamic-labs-sdk/*`), is written from Dynamic's docs, type-checks against the installed package, and a browser test (`e2e/dynamic-ui.mjs`) proves the form renders, validates and fails in plain words. A real login has not been run because it needs a real environment ID.
* Envio hosted deployment and live GraphQL subscriptions (the handlers and queries are tested through Envio's test indexer and the dev server; the hosted service and the WebSocket path are not).
* Circle's testnet USDC faucet limits for the treasury.

Other limits: the contract has no admin key, so a bug cannot be patched after deployment. USDC itself can be frozen by Circle. A lost parent login has no recovery. One parent per family. Not legal or financial advice: stablecoin and minor-account rules differ by country and a real launch would need review.

## AI-use disclosure

This project was built with substantial help from Claude (Anthropic) through Claude Code: design discussion, the contracts, relayer, indexer, app and tests were written by the AI agent under the direction of the team, and reviewed by running the test suites above.

## License

MIT. See `LICENSE`.
