# Fam-Fi

**The allowance that grows up with your kid, with gifts that match what they save.**

Fam-Fi is a family money app built on [Monad](https://monad.xyz) testnet for the Monad Metropolis hackathon (Track 02: Consumer Products & Payments). A parent funds a teen's allowance. The teen pays friends by Fam-ID inside daily limits. Unusual payments pause and alert the parent. A relative can lock a gift that is matched as the teen saves. Families see email login and Fam-IDs, never a wallet or an address.

> **Testnet prototype.** The money is Circle's testnet USDC and has no value. The contracts are unaudited. Do not use real money.

## What works today

| Feature | Where it lives | Verified by |
|---|---|---|
| Fam-ID registry, parent-invited teens | `contracts/src/FamFi.sol` | 24 Hardhat tests |
| Streaming allowance (accrues by the second, belongs to the teen) | contract | tests |
| Daily limits by level, over-limit holds the parent approves | contract | tests |
| Scam Shield: a large first payment to a new payee, or a large payment in a teen's first 24 hours, is held for a few minutes and the parent is alerted | contract | tests |
| Freeze (spending stops; saving and incoming money still work) | contract | tests, UI run |
| Goals, matched gifts (any ratio), round-up, level-up, spend-from-goal | contract | tests, UI run |
| Splits (a friend pays a share) and money requests | contract | tests, UI run |
| Gasless: users sign, a relayer pays gas | `contracts/src/FamFiForwarder.sol`, `relayer/` | relayer smoke test with zero-gas wallets |
| Plain-language timeline of everything | `indexer/` (Envio) | indexer test replaying a family story |
| Web app: parent, teen, relative, friend screens + Judge Mode | `app/` | 23-step browser walkthrough |

**What "held" means, honestly:** Scam Shield is a delay and an alert, not a guarantee. A parent who does nothing lets the teen release the payment after the hold, unless "strict holds" is turned on. A patient scammer who first receives a small payment becomes a known payee. There is no withdrawal function in this build, so money can only move between Fam-IDs.

## Architecture

```
 browser (Next.js PWA) ── signs an EIP-712 request ──► relayer ──pays gas──► Forwarder ──► FamFi contract ──► USDC
        ▲                                                                          │ events
        └──── live GraphQL ◄──── Envio indexer (plain-language timeline) ◄─────────┘
```

* **`contracts/`**: one `FamFi` contract with no admin key, holding an internal USDC ledger, plus a permissionless ERC-2771 forwarder. Hardhat project.
* **`relayer/`**: `POST /relay` verifies and simulates a signed request, returns a readable reason if it would fail, then submits it. `POST /faucet` credits a Fam-ID from a treasury wallet. `GET /health`.
* **`indexer/`**: Envio HyperIndex config, schema and handlers. `dev-server.ts` replays real chain events through the same handlers and serves the same Hasura-style GraphQL, for local demos without Docker.
* **`app/`**: Next.js app. Real login is Dynamic (email code, then a passkey). Judge Mode uses public demo wallets.
* **`e2e/`**: a Playwright walkthrough driving the real UI in four browser contexts.
* **`abi/`**: ABIs shared by all of the above.

## Run everything locally (no accounts, no keys)

```bash
(cd contracts && npm install --legacy-peer-deps)
(cd relayer   && npm install --legacy-peer-deps)
(cd indexer   && npm install --legacy-peer-deps)
(cd app       && npm install --legacy-peer-deps)

node scripts/local-stack.mjs --app     # chain, contracts, relayer, indexer, demo family, web app
# open http://localhost:3000 and pick a Judge Mode person
```

Run the checks:

```bash
(cd contracts && npx hardhat test)                 # contract tests
(cd indexer   && npm test)                         # handler tests via Envio's TestIndexer
(cd e2e && npm install --legacy-peer-deps && npm run walkthrough)   # full UI run (needs the stack above running)
```

## Deploy to Monad testnet (10143)

1. Get test MON for a **deployer**, a **relayer** and a **treasury** wallet from https://faucet.monad.xyz. Collect test USDC into the treasury from Circle's faucet (the public faucet is rate limited per address, so collect over a few days; check Circle's current limits).
2. `cd contracts && cp .env.example .env`, set `DEPLOYER_KEY`, then `npm run deploy:monad`. Addresses are written to `deployments/monad-testnet.json`.
3. Run the relayer (`relayer/.env.example` lists every variable). It needs MON for gas. It approves the treasury's USDC to FamFi on start.
4. Deploy the indexer to Envio: set `ENVIO_FAMFI_ADDRESS`, set `start_block` in `indexer/config.yaml` to the deploy block, `npx envio codegen`, then deploy. Point `NEXT_PUBLIC_ENVIO_URL` (and `NEXT_PUBLIC_ENVIO_WS` for live subscriptions) at it.
5. Create a Dynamic environment, enable email and passkey sign-in and Monad testnet, and set `NEXT_PUBLIC_DYNAMIC_ENV_ID`. Deploy `app/` (see `app/.env.example`).
6. Seed the Judge Mode family: `cd relayer && RELAYER_URL=... FAMFI_ADDRESS=... FORWARDER_ADDRESS=... RPC_URL=... npx tsx scripts/seed-demo.ts`.

## Honest status: what is and is not verified

Verified here, on a local chain: everything in the table above.

**Not yet verified on Monad testnet**, so treat as open until tested:
* Dynamic email + passkey sign-in and signing typed data on Monad testnet (the code path exists in `app/src/lib/dynamic-shell.tsx` but has not run against a real Dynamic environment).
* Envio hosted deployment and live GraphQL subscriptions (the handlers and queries are tested through Envio's test indexer and the dev server; the hosted service and the WebSocket path are not).
* Circle's testnet USDC faucet limits for the treasury.
* Judge Mode uses public, valueless demo keys derived from names, not Dynamic accounts.

Other limits: the contract has no admin key, so a bug cannot be patched after deployment. USDC itself can be frozen by Circle. A lost parent login has no recovery. One parent per family. Not legal or financial advice: stablecoin and minor-account rules differ by country and a real launch would need review.

## AI-use disclosure

This project was built with substantial help from Claude (Anthropic) through Claude Code: design discussion, the contracts, relayer, indexer, app and tests were written by the AI agent under the direction of the team, and reviewed by running the test suites above.

## License

MIT. See `LICENSE`.
