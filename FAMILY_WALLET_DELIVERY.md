# Connected family wallet — 13 October 2026

Implemented on the current Monad deployment: connected parent/teen avatars, per-teen selection, scoped commitments, continuously accruing allowance labels, guided exact-approval funding with reload recovery, allocation links, illustrated goals with personal/matching arcs, confirmed-action light, compact reviews, receipt Details, four source-backed Passport milestones and private family activity. No Fireblocks Flow, investing or score.

Funding recovery stores only chain/contract/wallet-scoped public transaction metadata. It verifies sender, token/contract, decoded action and exact amount before declaring a recovered deposit confirmed. Approval alone never credits funds. Allocation is a separate signed action.

Commitment reads pin a block and scan all mission/fund records up to 500 each. Paid/released commitments and other families are excluded. Allowance subtracts accrued money already belonging to teens. Incomplete roster coverage makes allowance unavailable rather than zero. Indexer outage/scan limits show partial/unavailable states.

Achievement schema requires codegen and replay from the active deployment's start block (70640050). The dev indexer is still in-memory and not a hosted/durable HyperIndex deployment. Public goal/share links and onchain events remain public; family dashboard aggregates are behind ReadAuth.

V2 is separate: contracts/src/v2/FamFiV2.sol, abi/FamFiV2.json and indexer/config.v2.yaml. It is not deployed. Existing active ABI/address/configuration and funds remain intact. See CONTRACT_V2.md.

Verification: 43 Solidity tests (40 V1 + 3 isolated V2), 81 local integration checks, 25 gateway checks, 15 live-read/roster/commitment regressions, 22 app unit checks, 8 Envio tests and 1 isolated V2 handler test. Production build and typechecks pass. Populated static visual fixtures have no horizontal overflow at 390/768/1024/1440 in light/dark themes; receipt disclosure works. These fixtures do not prove authenticated account behavior.

Live read verification: returning parent and teen sessions render their linked family, spendable balances, isolated mission commitments, a submitted mission and a proposed goal. Private family activity loads after deployment-start replay; the indexer caught up with the chain. Weekly activity follows selected-teen filtering and hides totals while history is incomplete.

Teen signing recovery: the initial session failed ReadAuth even after automatic refresh. After the user signed out and back into the same account, a real read-only signature succeeded and private mission/goal history rendered, including after reload. This verifies reauthentication recovery; it does not establish automatic refresh recovery or spending signatures. Missing authorization now shows unavailable mission history rather than a false empty state. The home mission feature includes a submitted mission when no actionable mission exists. Five read-session and three wallet-auth regression checks pass, along with the production build.

Outstanding live acceptance: wallet address continuity comparison, transaction signatures, wallet-funded deposit and relative matching journey. No real user approvals or testnet fund transfers were performed in this redesign pass. Public hosting and V2 activation are separate release tasks.
