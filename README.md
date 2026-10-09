# Fam-Fi

**The allowance that grows up with your kid, with gifts that match what they save.**

Fam-Fi is a family money app built on [Monad](https://monad.xyz) testnet for the Monad Metropolis hackathon (Track 02: Consumer Products & Payments). A parent funds a teen's allowance. The teen pays friends by Fam-ID inside daily limits. Unusual payments pause and alert the parent. A relative can lock a gift that is matched as the teen saves. Families see email login and Fam-IDs, never a wallet or an address.

> **Testnet prototype.** The money is Circle's testnet USDC and has no value. The contracts are unaudited. Do not use real money.

## What works today

| Feature | Where it lives | Verified by |
|---|---|---|
| Fam-ID registry, parent-invited teens. The parent chooses every starting limit and signs it into the invite; the contract has no built-in numbers | `contracts/src/FamFi.sol` | 26 Hardhat tests |
| Streaming allowance (accrues by the second, belongs to the teen) | contract | tests |
| Daily limits by level, over-limit holds the parent approves | contract | tests |
| Scam Shield: a large first payment to a new payee, or a large payment in a teen's first 24 hours, is held for a few minutes and the parent is alerted | contract | tests |
| Freeze (spending stops; saving and incoming money still work) | contract | tests, UI run |
| Goals, matched gifts (any ratio), round-up, level-up, spend-from-goal | contract | tests, UI run |
| Splits (a friend pays a share) and money requests | contract | tests, UI run |
| Gasless: users sign, a relayer pays gas | `contracts/src/FamFiForwarder.sol`, `relayer/` | relayer smoke test with zero-gas wallets |
| Plain-language timeline of everything | `indexer/` (Envio) | indexer test replaying a family story |
| Web app: parent, teen, relative, friend screens (Judge Mode only in the local demo) | `app/` | 27-step browser walkthrough + a 15-step nothing-is-pre-made run |

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
* **`scripts/`**: `new-wallets`, `deploy-testnet`, `start-testnet` for real mode; `local-stack` for the throwaway local demo.
* **`app/`**: Next.js app. Real login is Dynamic's headless SDK: an email code creates a wallet for that email (same email, same wallet), then an optional passkey (Face ID / fingerprint) for next time. Judge Mode uses public demo wallets.
* **`e2e/`**: a Playwright walkthrough driving the real UI in four browser contexts.
* **`abi/`**: ABIs shared by all of the above.

## Two ways to run it

**Real mode (your wallets, Circle's real testnet USDC, Monad testnet).** Nothing is mocked or pre-filled: every person is their own wallet, every number a parent sets is the number their teen gets, and the contract has no built-in limits.

```bash
node scripts/install-all.mjs           # installs every part (needs Node 22.15+; a few minutes the first time)
node scripts/new-wallets.mjs           # creates deployer + relayer + treasury; prints their addresses
#  -> fund them: https://faucet.monad.xyz (MON, all three) and https://faucet.circle.com (USDC, Monad Testnet, treasury)
node scripts/wallet-status.mjs         # shows which wallet still needs MON or USDC, and what to do about it
node scripts/send-mon.mjs --from treasury --to relayer --amount 2   # optional: move MON between your own wallets
node scripts/deploy-testnet.mjs --dynamic-env <your Dynamic environment id>   # checks balances, deploys, writes all config
node scripts/start-testnet.mjs         # relayer + indexer + app; open http://localhost:3000
```

**Local demo (no accounts, no keys, a throwaway chain with mock USDC and a ready-made family).** For development and screenshots only:

```bash
node scripts/local-stack.mjs --app     # then open http://localhost:3000 and pick a Judge Mode person
NEXT_PUBLIC_DYNAMIC_ENV_ID=<id> node scripts/local-stack.mjs --app   # same, with real email sign-in on top
```

Judge Mode (ready-made people) only exists when `NEXT_PUBLIC_JUDGE_MODE=1`, which only the local demo sets.

Run the checks:

```bash
(cd contracts && npx hardhat test)                 # 26 contract tests
(cd indexer   && npm test)                         # handler tests via Envio's TestIndexer
(cd e2e && npm install --legacy-peer-deps)
(cd e2e && npm run walkthrough)                    # full UI story against the local demo
(cd e2e && node real-path.mjs)                     # the nothing-is-pre-made path against real mode
```

## Deploy to Monad testnet (10143)

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

For the hosted Envio indexer instead of the bundled one, set `ENVIO_FAMFI_ADDRESS`, run `npx envio codegen` in `indexer/` and deploy; point `NEXT_PUBLIC_ENVIO_URL` (and `NEXT_PUBLIC_ENVIO_WS`) at it. The bundled `dev-server.ts` replays real chain events through the same handlers and is enough for a single-machine demo.

## Honest status: what is and is not verified

Verified here, on a local chain: everything in the table above.

**Not yet verified on Monad testnet**, so treat as open until tested:
* Dynamic email + passkey sign-in and signing typed data (`app/src/lib/dynamic-shell.tsx`). It uses Dynamic's recommended headless SDK (`@dynamic-labs-sdk/*`), is written from Dynamic's docs, type-checks against the installed package, and a browser test (`e2e/dynamic-ui.mjs`) proves the form renders, validates and fails in plain words. A real login has not been run because it needs a real environment ID.
* Envio hosted deployment and live GraphQL subscriptions (the handlers and queries are tested through Envio's test indexer and the dev server; the hosted service and the WebSocket path are not).
* Circle's testnet USDC faucet limits for the treasury.
* Judge Mode (local demo only) uses public, valueless demo keys derived from names, not Dynamic accounts.

Other limits: the contract has no admin key, so a bug cannot be patched after deployment. USDC itself can be frozen by Circle. A lost parent login has no recovery. One parent per family. Not legal or financial advice: stablecoin and minor-account rules differ by country and a real launch would need review.

## AI-use disclosure

This project was built with substantial help from Claude (Anthropic) through Claude Code: design discussion, the contracts, relayer, indexer, app and tests were written by the AI agent under the direction of the team, and reviewed by running the test suites above.

## License

MIT. See `LICENSE`.
