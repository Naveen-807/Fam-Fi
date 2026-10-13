# Fam-Fi: depth that serves the product

Focus: Monad Consumer Products & Payments, Dynamic, Envio. Privy excluded; Nansen deferred. No win probability is measurable from this implementation.

The product promise: parents fund commitments, teens earn and save, relatives match their effort, and everyone can understand the confirmed outcome. Investing, credit scores and Fireblocks Flow are excluded. FutureFund is locked savings.

## Implemented in this pass

| Product experience | Sponsor responsibility | Reviewable evidence |
| --- | --- | --- |
| Parent/relative funds their own ledger from their embedded wallet | Dynamic wallet transaction signing, exact approval and deposit | WalletFunding, wallet-funding.ts and tests |
| One bounded read grant for family summary screens | Dynamic wallet typed-data signing | read-session.ts, logout invalidation and concurrent-session tests |
| Interrupted wallet creation can be retried | Dynamic embedded-wallet creation | retryWalletSetup in dynamic-shell.tsx and sign-in UI |
| One receipt explains mission reward → saving → matching | Envio event correlation and derived entities | SavingReceipt, SavingContribution, MatchRelease, savings story |
| Weekly summaries distinguish family help from personal effort | Envio temporal aggregation | matchedTotal in WeeklyStat and TeenProgress |

## Main-track evidence to collect

- First five minutes: parent onboarding, a teen invitation, a relative goal link. Watch actual users do this and record where they hesitate.
- Emotional demo: a mission reward saved into a goal unlocks matching; show the result on parent and teen screens.
- Control: teen cannot approve their own mission or access another family's summary. A held payment has a clear parent decision path.
- Reliability: cancellations, network errors, unknown submitted transactions and delayed indexed summaries have clear recovery paths.
- Founder insight/traction: report actual testers and observed improvements; do not invent adoption or satisfaction numbers.

## Required gates before a winning-quality submission claim

1. Real Dynamic environment/origins, mailbox login, wallet address continuity, signing and funding. The user-supplied public environment ID is configured locally; live account verification remains outstanding.
   Desktop services use the verified current Monad testnet deployment. The new family wallet screens still need real two-account Dynamic acceptance.
2. Real deployed HyperIndex and a backfill for new schema entities; no production claim for the dev harness.
3. Verify that deployed Solidity matches the source version. The current source's submitted missions have no timeout; review/backport bounded-expiry hardening before relying on them for long-lived funded commitments. Active contract behavior is unchanged. Goal-decline and submitted-mission expiry are staged in isolated V2 source/tests; see CONTRACT_V2.md.
4. Main-track live app access and sponsor-specific transaction evidence, plus the short demos requested by the bounty descriptions.
5. Complete local visual/family acceptance. Investing is explicitly out of scope.

## What to explore only after those gates

Retain separate individual signer addresses and the current family permissions. Fireblocks Flow and agent-wallet additions are excluded from this release.

References: https://www.dynamic.xyz/docs/llms.txt (current SDK navigation), https://docs.envio.dev/docs/HyperIndex/overview, https://docs.envio.dev/docs/HyperIndex/testing. See DYNAMIC.md and ENVIO.md for sponsor evidence and limitations.
