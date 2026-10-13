# Dynamic / Envio depth validation — 2026-10-13

Deployment update: on the user's authorization, the tested contracts were deployed to Monad testnet 10143 at FamFi `0x9B4753f628b1D4445C9C29EC8608E3ec78D2FbE9` and forwarder `0xbA73C0EA819e6aB3C65Dc5b867205Bf873dBcF5b`, block 70640050. Both runtime bytecodes match the compiled source. App, relayer, and local indexer configurations now target that deployment. Missions and FutureFund are supported; the faucet treasury has since been funded and approved with a bounded allowance. The initial zero balance is superseded by the later live check (50 USDC remaining). This supersedes the earlier local-chain/deployment configuration observations below. The later parent/teen audit is in `PARENT_TEEN_FLOW.md`.

Checked in the local checkout. Historical results below are supplemented by `FAMILY_WALLET_DELIVERY.md`.

| Check | Result |
| --- | --- |
| Next production build, with the user's public Dynamic environment ID configured | Passed |
| App, relayer and indexer TypeScript checks | Passed |
| Solidity compilation and contract tests | 40 passed; existing contract behavior unchanged |
| Wallet funding and read-session regression tests | 9 passed |
| Envio handler tests | 7 passed |
| Authenticated gateway checks | 20 passed |
| Local contract → relayer → Envio handler → authenticated query integration | 40 checks passed |
| Browser sign-in screen with configured Dynamic ID | Renders; no completed mailbox login yet |

The end-to-end check includes an exact approved wallet deposit, a funded mission approved into a savings goal, a matching contribution released in the same transaction, a named-contributor saving receipt, and ledger reconciliation. It uses a temporary local Envio configuration and cleans up its localhost chain/indexer processes.

These results do not prove a real Dynamic service signature, passkey behavior, or Envio Cloud deployment. The local chain uses MockUSDC and an ethers signer through the same funding adapter. The app's `.env.local` is ignored by Git and now targets the verified Monad testnet deployment with the supplied Dynamic ID. The old local-chain observation is historical. No contract deployment, mainnet transaction, PR, or new GitHub push was made in this pass.

The local development indexer uses TestIndexer, not a production HyperIndex service. Schema backfill is required for old history to populate the new receipt and matching fields. Also review the existing submitted-mission timeout limitation before deploying long-lived commitments; see BOUNTY_DEPTH.md.

Repeat checks:

```sh
cd app
npm run typecheck -- --incremental false
npm run build
node --import ../indexer/node_modules/tsx/dist/loader.mjs --test src/lib/read-session.test.ts src/lib/wallet-funding.test.ts
```

```sh
cd indexer
npm run codegen
node --import tsx --test test/indexer.test.ts test/missions.test.ts
npm run typecheck
```

```sh
cd relayer
npm run typecheck
node --import tsx scripts/private-test.ts
node --import tsx scripts/missions-flow.ts
```

The two HTTP checks need permission to listen on localhost. The integration test defaults to ports 18545 and 18081; ensure these are unused. `FAMFI_TEST_RPC_PORT` and `FAMFI_TEST_INDEXER_PORT` override them.
