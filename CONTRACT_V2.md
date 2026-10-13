# Staged Fam-Fi V2

V2 is source and isolated-test ready only. It is not deployed and the funded Monad ledger remains on V1. Active ABIs, addresses, invites and indexer configuration are unchanged.

V2 appends DECLINED (5) to goal status, adds parent-only declineGoal and GoalDeclined, and permits permissionless submitted-mission expiry seven days after max(submittedAt, deadline). At the review deadline, approval and rejection stop. Expiry refunds exactly once. Both capability getters return true; V1 reports unsupported.

Run `npx hardhat test test/FamFiV2.t.ts` in contracts. Versioned ABI: abi/FamFiV2.json. Versioned Envio configuration: indexer/config.v2.yaml, with handlers in indexer/v2. An isolated relayer must explicitly use contractVersion: v2. Never generate/export V2 over abi/FamFi.json.

Before activation: inventory V1 families, ledger balances, streams, holds, goals, gifts, missions and funds; retain the old app configuration and access. V1 has no withdrawal/migration function. Do not pretend its balances can be moved automatically. Agree a new-registration testnet transition separately, deploy and verify bytecode, set the actual V2 start block, backfill with V2 config and rerun both-user acceptance. V1 invites must never be accepted on V2.
