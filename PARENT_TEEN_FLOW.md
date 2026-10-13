# Parent–teen flow audit — 13 October 2026

## Deployment update — 13 October 2026

The user authorized and completed a new Monad testnet deployment after this audit.
The active contract is now `0x9B4753f628b1D4445C9C29EC8608E3ec78D2FbE9`, with forwarder `0xbA73C0EA819e6aB3C65Dc5b867205Bf873dBcF5b`, starting at block **70640050**.
Both deployed runtime bytecodes match their compiled source, constructor parameters and successful receipts are verified, and missions/FutureFund getters respond.
All local service configurations now target this address. Deployment details and transaction hashes are in `deployments/monadTestnet.json`; earlier deployment metadata is in `deployments/monadTestnet.previous.json` and ignored configuration backups are under `.local/deploy-backups/2026-10-13T08-55-51-951Z`.

The older-deployment observations below describe the audit before this switch. Existing families, balances, Michael's goal and Mathesh's family remain on the old contract. The deployment began with a fresh ledger and requires new family invites. Since then, the user funded the treasury and an explicit 60-USDC approval was confirmed. The 13 October later check showed 50 USDC remaining. Historical audit statements below do not describe current funding.

## Expected journey

| Flow | Parent side | Teen side | End state |
| --- | --- | --- | --- |
| Family linking | Sign in, register a Fam-ID, create a family, sign an invite with rules | Sign in with a separate email, verify the invite, choose a Fam-ID, join | Contract links the teen to that parent; roster shows the confirmed join |
| Allowance | Reserve a budget and choose its rate | Watch accrued allowance and spendable balance | Accrual belongs to the teen and cannot exceed the budget |
| Rules | Change limits, anomaly thresholds, strict holds; freeze/unfreeze | See current limits and frozen state | Contract enforces the parent's choices |
| Money request | See requests actually addressed to this wallet; pay once | Ask the linked parent by default, see pending requests | Exact amount moves from parent to teen; both pending lists clear |
| Held payment | Approve or reject the teen's held payment | See held amount; cancel, or release an eligible anomaly after its timer | Approval pays recipient; rejection/cancellation refunds the teen; no duplicate settlement |
| Savings goal | Review proposal; optionally open it for matching gifts | Propose, save after approval, complete, spend once | Correct parent approves; savings and gifts remain separate; overdue goals can be closed for recovery |
| Funded mission | Reserve reward, review submission, approve or send back; cancel/expire eligible missions | See reserved reward, submit or resubmit, receive approved reward | Reward pays once, optionally into an active goal; cancellation/expiry refunds parent |
| FutureFund | Create target/date, contribute, optionally release early | View custody/history, claim after horizon | Locked funds move to teen exactly once; this is not an investment |
| History | Family activity and weekly summaries | Own activity and Progress Passport | Envio derives confirmed receipts, matching, and aggregates; missing history is explicitly marked |

## Fixes made

- Goals, requests, and held payments use block-pinned contract reads while Envio catches up. These reads remain behind the signed, deployment-bound gateway. Role, family, and recipients come from the contract.
- Paid/resolved requests disappear from both pending lists; stale indexed status cannot reopen an approval. Indexed notes are preserved when available.
- New, successfully mined `TeenAdded` receipts supply roster discovery hints. They persist locally across relayer restarts. Every candidate's role, family, level, and freeze state is verified on-chain before showing it to a parent. Existing goals and request participants also supply discovery hints; they are not treated as proof of membership.
- Teen pages show the linked parent and default money requests to that parent. A different signed-in parent does not receive the teen's goal.
- Dashboard state resets on account switching. GraphQL data is keyed to its query/account, and old responses cannot populate the new account's view.
- Network/account lookup failure no longer looks like a new account or an available Fam-ID. Availability retries; cancelled family read authorization has a visible retry action.
- Same-card duplicate submissions are blocked. FutureFund creation waits for the exact emitted fund ID and preserves form entries if creation fails.
- Overdue goals can be closed with confirmation to return savings. Frozen teens cannot use the anomaly-release button, but can still cancel a held payment.
- Indexer backfill fetches bounded ranges concurrently, replays in order, advances only after success, exposes freshness, and does not block queries behind replay. The dev indexer remains an in-memory TestIndexer service, not Envio Cloud.
- Missing deployed functions are detected. Missions and FutureFund actions stay unavailable on the legacy deployment instead of failing after a click.
- An indexer outage returns explicitly incomplete history alongside verified approvals when chain reads succeed. If neither source can answer, the gateway returns an error.

## Validation

- 75 isolated integration checks passed: real Solidity contracts, signed forward requests, relayer, Envio handlers, and authenticated reads on a temporary localhost chain.
- 40 Solidity tests passed, including randomized custody reconciliation.
- 23 authenticated gateway checks passed, including forged scopes, other families, expired authorization, and indexer outage recovery.
- 12 live-read/roster/capability regression tests passed.
- 7 Envio handler tests and 15 app invite/session/funding/theme tests passed.
- Next production build and app/relayer/indexer type checks passed.

The integration runner is `relayer/scripts/missions-flow.ts`. It uses temporary local accounts and MockUSDC, cleans up its chain/indexer, and disables persistent roster storage. It does not prove a full two-user Dynamic browser journey or Envio Cloud operation.

## Current Monad deployment

The app currently uses Monad testnet 10143, contract `0x258E99513dDb822a6CA9b55F06B9be664C781533`.

- Michael belongs to family 3, whose parent is `@mathesh`. `@father` belongs to family 2.
- Michael's goal #1 is a proposed $20 goal. Its live contract state is verified; its name depends on event history arriving.
- The legacy contract supports core family, allowance, request, payment, hold, and goal functions. `missionCount` and `fundCount` calls revert: missions and FutureFund require a current contract deployment.
- The relayer has gas. The test-token treasury balance was **0 USDC** at the live check, so its faucet cannot fund accounts. Users can fund their own parent wallet through the existing exact-approval deposit flow; the treasury needs test tokens for faucet use.
- Historical backfill is still far behind. A parent with older teens that have no indexed records, discovered goals/requests, or locally recorded join receipts may still have an incomplete roster until backfill reaches them.
- Live fallback scans are deliberately bounded at 500 records per category; larger deployments require a healthy production indexer rather than an unbounded RPC scan.

No Monad funds were moved, parent approvals performed, contracts redeployed, accounts relinked, or new GitHub push made during this audit. Contract replacement changes the state boundary; existing families and balances are not silently migrated.

## Remaining live acceptance steps

1. Deploy the current contract version and point all three services at its verified addresses/start block, if missions and FutureFund must be enabled. Review the source's submitted-mission timeout behavior before deployment: submitted rewards stay reserved until the parent decides.
2. Fund the test-token treasury, or use a parent's own wallet deposit, to exercise funded flows.
3. Use separate real parent/teen Dynamic sessions to complete the wallet authorization/signing and money-moving UI checks. Tests above do not substitute for those real-session clicks.
4. Run a durable Envio indexer with completed backfill for the full activity, matching receipt, and weekly-summary experience.
