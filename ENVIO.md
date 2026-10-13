# How Fam-Fi uses Envio

Envio reconstructs a family money action from multiple onchain events and powers the savings story, Progress Passport and weekly brief. The contract enforces and settles money; the indexer explains confirmed history.

## Core feature: how a goal grew

A parent approves a funded mission with a linked goal. The contract emits matching releases, a saving event, optionally goal completion, and then mission approval. Envio connects these by transaction hash, goal and teen — not approximate timestamps.

- `SavingReceipt`: one transaction/goal outcome, own contribution, incremental matching, goal balance at the time, mission attribution, source block and transaction.
- `SavingContribution`: one row per source saving log, protecting receipt aggregation from duplicate delivery.
- `MatchRelease`: one source-linked release per gift with its contributor and receipt ID.
- `Achievement`: earliest qualifying event per teen and milestone, with source block/log ordering and idempotent evidence. Backfilled from deployment start; recent pages never fabricate a first achievement.
- `TeenProgress` and `WeeklyStat`: family matching totals remain separate from personal savings and mission earnings. Weeks use the family's Monday boundary.

The frontend shows `5 saved + 5 matched = 10 added`, lists contributors when their records are in the recent-history window, and links to the transaction. Matching is a contribution, never yield. Historical receipt snapshots are not presented as current spendable balances.

## Execution and access

Source: `indexer/config.yaml`, `indexer/schema.graphql`, `indexer/src/EventHandlers.ts`. UI: `app/src/components/saving-story.tsx`, `passport.tsx`, `brief.tsx`. Queries: `relayer/src/private.ts` and `app/src/lib/private.ts`.

The new receipts use fixed, signed queries: parents receive their family records; teens receive their own; relatives cannot access this gateway. No browser-supplied family ID or GraphQL query can change that scope. Family dashboard timeline, goals, requests, holds, achievements and gift summaries now use the signed gateway. Public gift/split links and the Fam-ID directory still use the browser GraphQL endpoint; do not describe all chain data as private. All underlying onchain events are public.

## Deployment gate

`dev-server.ts` uses Envio's TestIndexer with RPC logs. It is a local development harness, not a production HyperIndex deployment or a verified Envio Cloud integration.

Before submission:

1. Use the actual FamFi deployment address and deployment block in `config.yaml`; verify that it contains the mission-capable contract version if demonstrating missions. The recorded older deployment alone does not establish that.
2. Run `npm run codegen` in `indexer/`.
3. Deploy this HyperIndex project through Envio Cloud or the official self-hosted setup. Cloud does not require a custom HyperSync token; local/self-hosted HyperSync access requires one. Follow https://docs.envio.dev/docs/HyperIndex/overview and the linked hosting guides.
4. New entity fields need historical backfill: rebuild the derived dataset from the deployment block using the hosting provider's supported procedure. Merely restarting an already-caught-up pipeline will not populate past receipts.
5. Set the relayer's `ENVIO_URL` to the deployed GraphQL endpoint, restart the relayer with the matching FamFi address, and deploy the frontend. Client/server must both use the deployment-bound read domain.
6. Perform a real saving/matching transaction and show the hosted pipeline updating the UI. Capture address, transaction hash, indexer deployment and query evidence.

Do not claim reorg correctness based only on duplicate-log tests. Production uses HyperIndex's rollback handling; the real deployment needs verification. The local RPC harness does not implement equivalent reorg recovery.

## Verification

From `indexer/`: `npm run codegen`, `node --import tsx --test test/indexer.test.ts test/missions.test.ts`, `npm run typecheck`.

From `relayer/`: `node --import tsx scripts/private-test.ts`, `node --import tsx scripts/missions-flow.ts`. The integration test uses isolated localhost ports and a temporary local-chain config without changing the Monad deployment configuration. It proves local contract/relayer/handler integration, not live Dynamic or Envio Cloud operation.

## Two-minute sponsor demo

Show a funded mission and a relative's matching gift. Approve the mission; reveal the combined receipt, contributor and transaction proof. Show weekly matching separated from personal saving. Explain the three related receipt entities and source-log deduplication, then show the actual deployed indexer and public source files.
