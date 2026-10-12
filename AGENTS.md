# Fam-Fi: agent handoff

Read this first. It is the full context for continuing the project (Codex, Claude Code, or a human).

## What this is
Fam-Fi is a family-money app on **Monad testnet** (chain id 10143) for the **Monad Metropolis hackathon**, Track 02 (Consumer Products & Payments). A parent funds a teen's allowance; the teen pays friends by Fam-ID inside parent-set limits; unusual payments are held (Scam Shield); relatives match a teen's savings; parents commit funded missions; Envio explains the history. Money is **Circle's testnet USDC** (`0x534b2f3A21130d7a60830c2Df862319e593943A3`), no real value. Unaudited prototype.

**Deadline: Oct 14 03:59 UTC. Internal target: submit by Oct 13 18:00 UTC.** Bounties of interest: Monad Metropolis track, Dynamic ($5k, needs `DYNAMIC.md` evidence), Envio.

Branch: `claude/confident-ritchie-abejoo` (all work is here). Do not open a PR unless asked. Never commit secrets: `.wallets.json`, `.env*`, private keys, seed phrases are git-ignored and must stay that way. Never print keys.

## Repo map
| Path | What |
|---|---|
| `contracts/` | Hardhat. `src/FamFi.sol` (one contract, no admin key, internal USDC ledger, ERC-2771), `src/FamFiForwarder.sol`, `src/mocks/MockUSDC.sol` (tests only), `test/FamFi.t.ts` (40 tests), `scripts/deploy.ts`, `scripts/export-abi.ts` |
| `abi/` | Shared ABIs (`FamFi.json`, `FamFiForwarder.json`, `MockUSDC.json`). **Regenerate after any contract change**: `cd contracts && npx hardhat compile && npx hardhat run scripts/export-abi.ts` |
| `relayer/` | Express. `src/app.ts` (`/relay`, `/faucet`, `/health`), `src/private.ts` (`/private/query`), `scripts/smoke.ts`, `scripts/private-test.ts`, `scripts/missions-flow.ts` |
| `indexer/` | Envio HyperIndex: `config.yaml`, `schema.graphql`, `src/EventHandlers.ts`, `dev-server.ts` (local replay + Hasura-style GraphQL, used when hosted Envio isn't), tests in `test/` |
| `app/` | Next.js 15 + React + Tailwind. Dynamic headless SDK login. `src/lib/{relay,chain,gql,hooks,private,wallet,dynamic-shell,config,format}.ts*`, `src/components/{ui,missions,inbox,passport,brief,futurefund,onboard,qr}.tsx`, pages in `src/app/{parent,teen,gift,join,split}` |
| `scripts/` | `new-wallets`, `wallet-status`, `send-mon`, `deploy-testnet` (supports `--dry-run`), `start-testnet`, `install-all` |
| `e2e/` | Only `dynamic-ui.mjs` (sign-in form renders/fails gracefully). Needs Chromium at `/opt/pw-browsers` |
| `DYNAMIC.md` | How Dynamic is used (bounty evidence). Update with a real tx hash after the first real login |

## Architecture
```
browser (Next.js) ── EIP-712 ForwardRequest ──► relayer ──pays gas──► Forwarder ──► FamFi ──► USDC
      ▲                                                                   │ events
      └── GraphQL ◄── Envio indexer (derived history) ◄───────────────────┘
browser ── signed ReadAuth ──► relayer /private/query ──► Envio (fixed, family-scoped queries)
```
- **The contract is the authority** for every money outcome. Envio only explains history; the app re-reads mission/fund state from the contract before acting.
- All money is integer USDC base units (6 decimals). Use `bigint`; never floats for authoritative amounts (`app/src/lib/format.ts`: `parseAmount`, `fmt`). Indexer `money()` floats are display text only.
- Identity is always `_msgSender()` (ERC-2771). The relayer allowlists every nonpayable FamFi function from the ABI automatically, except `depositFor`.
- Login is **Dynamic only** (email code → embedded wallet; passkeys optional). Sandbox environment id: `ed2b08c8-8878-4860-868c-79adb05b2e87` (public client id, fine to use; verified: email sign-in on, EVM embedded wallets with auto-create on, passkeys off, Monad testnet not in Dynamic's list so the app injects it in `dynamic-shell.tsx`). **A full real login has never been run.**
- Judge Mode / demo wallets / seed data / local-stack were deliberately **removed** (user wanted everything real). Do not reintroduce them in the product UI.

## What is implemented (all tested locally, nothing deployed)
1. Original: Fam-ID registry, parent-signed invites carrying the starting limits, streaming allowance, daily limits by level, Scam Shield holds, freeze, goals + matched gifts, round-up, level-up, splits, money requests, gasless relay, faucet, timeline.
2. **Funded Money Missions** in `FamFi.sol`: `createMission` (reserves reward from parent's `balance`, `missionEscrow`), `submitMission` (teen), `approveMission` (parent, pays once, optional auto-save into linked goal), `rejectMission` (feedback, teen may resubmit before deadline), `cancelMission`, `expireMission` (anyone after deadline). Freeze blocks create/submit but never approve/cancel/expire. Caps: 10 open missions per teen, deadline ≤ 365d, title ≤ 80 bytes, description ≤ 280, feedback ≤ 140.
3. **FutureFund** in `FamFi.sol`: `createFutureFund`, `contributeFutureFund`, `releaseFutureFund` (parent, early), `claimFutureFund` (teen, at/after horizon). `fundEscrow`. **Money is locked in the ledger, NOT invested**; UI says so everywhere. No yields, prices, or returns anywhere. No verified Monad-testnet investment market was found (one search; USDC contract and chain id confirmed live on the RPC), so investing is shown as "not turned on".
4. Ledger invariant (tested after every step): `USDC.balanceOf(FamFi) == Σ balances + streams + open pendings + goal saved/matched + gift escrow + missionEscrow + fundEscrow`.
5. **Envio**: entities `Mission`, `ProgressEvent`, `TeenProgress`, `WeeklyStat`, `FutureFund`, `FundEntry` (+ `Family.tzOffset`). Counted actions: approved mission, goal savings, goal completed, settled teen `Paid` (not memo "goal"). Allowance funded and held payments feed weekly context only. Idempotent via `ProgressEvent` id `txHash-logIndex-kind` and guarded status transitions. Weeks are Monday-start in the family's tz (`weekOf` in `EventHandlers.ts` and `app/src/components/brief.tsx` must stay identical).
6. **Private reads**: `relayer/src/private.ts`. EIP-712 domain `{name:"FamFiRead",version:"1",chainId}`, type `ReadAuth{address reader,uint256 expiry,string scope}`, scope `famfi-private-read`, max 1h expiry (app uses 30 min). Role/family come from `famfi.accounts()`. Parent bundle = family; teen bundle = own records; relatives and strangers get 403. Fixed queries only; client-supplied query/variables are ignored. Needs `ENVIO_URL` in `relayer/.env`.
7. **App**: parent dashboard = Approval Inbox, Missions, teen panels, Weekly Brief, FutureFund; teen dashboard = Missions, Progress Passport, FutureFund (with Money Story). Confirm dialogs for money actions, chain re-check before acting, busy states, proof links via `NEXT_PUBLIC_EXPLORER_TX`.
8. `scripts/deploy-testnet.mjs --dry-run` prints exactly what a deploy would change; a real run backs up `deployments/monadTestnet.json` to `.previous.json`.

## How to run the checks (all currently green)
```bash
# one-time installs. package-lock files are out of sync with package.json in contracts/: use --no-package-lock
(cd contracts && npm install --no-package-lock) ; (cd indexer && npm ci) ; (cd relayer && npm install --no-package-lock)
(cd app && npm install --no-package-lock --legacy-peer-deps) ; (cd e2e && npm install --legacy-peer-deps)

(cd contracts && npx hardhat test)                      # 40 passing
(cd indexer && npx envio codegen && npm test && npm run typecheck)   # 5 passing
(cd relayer && npm run typecheck && npm run test:private)            # 17 checks
(cd relayer && npm run test:flow)       # spawns hardhat node + dev indexer itself; full missions/passport/FutureFund run
(cd contracts && npx hardhat node --port 8545 &) ; (cd relayer && npm run smoke)   # needs a node on :8545; kill it afterwards
(cd app && npm run typecheck && NEXT_PUBLIC_DYNAMIC_ENV_ID=ed2b08c8-8878-4860-868c-79adb05b2e87 npm run build)
(cd app && next start -p 3100) ; (cd e2e && node dynamic-ui.mjs)     # sign-in form browser test
```

## Gotchas learned the hard way
- **Contract size ~29 KB** (> Ethereum's 24 KB, < Monad's 128 KB per MIP-2). `contracts/hardhat.config.ts` sets `allowUnlimitedContractSize` on the local `hardhat` network only. Never deploy to a 24 KB-limit chain.
- Envio `TestIndexer`: cannot reprocess an earlier block range (use a fresh `createTestIndexer()` or `startBlock >` previous end); rejects two simulated items with the same block+logIndex. Tests read `start_block` from `config.yaml` (`START = max(100, start_block)`).
- `dev-server.ts` only serves entities listed in its `ENTITIES` array; add every new entity there. GraphQL `BigInt` values come back as **strings**.
- `provider.waitForTransaction` can stall after `evm_increaseTime`; poll `getTransactionReceipt` instead (see `missions-flow.ts`). Forward-request `deadline` must use **chain** time in tests that time-travel.
- Spawn local hardhat/indexer with `detached: true` and kill the process group; orphaned nodes make later runs flaky. Do not `pkill -f` a pattern contained in your own command line.
- `tsc` must be 5.9.x in `app/` (installed). Ethers v6 throughout.
- Mission titles/feedback and FutureFund names are public on-chain text. No photos or private notes on-chain.

## Decisions already made with the user (do not relitigate)
- Everything real: no demo/Judge Mode, no fake data, no fabricated yields.
- Never deploy automatically; the user runs the deploy. Contract is immutable, so missions/FutureFund need a **new FamFi address**, which resets testnet state (old state stays on-chain at the old address).
- Real Dynamic login only for the UI; no test-only signer. New screens are verified by typecheck/build/tests/flow script plus a manual click-through by the user.
- Auth gateway for private reads (not just client-side filtering). Honest limit: events are public on Monad and Envio's raw endpoint must not be exposed to browsers in production.

## What is left (priority order)
**Needs the user (cannot be done from the sandbox):**
1. Run `node scripts/deploy-testnet.mjs --dry-run --dynamic-env <id>`, fund wallets (MON from faucet.monad.xyz for deployer/relayer/treasury; Circle test USDC to the treasury from faucet.circle.com), then the real deploy. `.wallets.json` lives only on the user's machine.
2. Dynamic console: add `http://localhost:3000` and the production URL to Allowed Origins; optionally enable passkeys.
3. First real login + one signed tx + click through mission, FutureFund, inbox flows; report errors (the riskiest untested part: `dynamic-shell.tsx` signing on the Monad testnet network, including the `ReadAuth` signature).
4. Demo video, submission form, bounty write-ups.

**Agent can do next:**
1. Security review + code review of the new Solidity (`createMission`…`claimFutureFund`) and `relayer/src/private.ts` before deploy. Look for: stuck funds (mission REJECTED after deadline then expire path, SUBMITTED never expiring if the parent vanishes, FutureFund with no recovery if parent loses access), griefing via the 10-mission cap, reentrancy (none: no external calls in mission/fund fns), `_save` interaction on goal-linked approvals.
2. Hosting config: Vercel for `app/`; Dockerfiles + `render.yaml` (or Railway) for `relayer/` and the indexer (`dev-server.ts` or hosted Envio with `ENVIO_FAMFI_ADDRESS`, `npx envio codegen`). Set `ALLOWED_ORIGIN`, `ENVIO_URL`, keep Envio private behind the relayer. Production env templates + a deploy checklist.
3. Submission material: honest write-up of what was built, DYNAMIC.md evidence (add the real tx hash after step 3 above), demo script with exact clicks, README cleanup (remove references to unbuilt features such as QR scanner/finality timer from the old blueprint; `app/src/components/qr.tsx` exists for Fam-ID QR display/scan only).
4. Optional hardening: expose indexer freshness (latest indexed block vs chain head) so the "summary is behind" notes are precise; delete unused queries in `app/src/lib/gql.ts`; hosted-Envio verification.

## Non-negotiables
Preserve existing wallet, payment, allowance, goal, gift, freeze, Scam Shield, Dynamic and relayer behavior. Keep ledger invariant tests green. No admin key, no arbitrary external calls, no unrestricted withdraw. Never claim a feature is done unless its real flow and tests pass; report failures verbatim.
