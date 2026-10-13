# How Fam-Fi uses Dynamic

Fam-Fi uses Dynamic's **headless SDK** (`@dynamic-labs-sdk/client`, `/evm`, `/react-hooks`) for all sign-in and signing. The app draws every screen itself; Dynamic provides identity, the wallet, and signatures. Code: `app/src/lib/dynamic-shell.tsx`, `app/src/lib/wallet.tsx`, `app/src/lib/bridge.ts`.

There are no other login paths. Without `NEXT_PUBLIC_DYNAMIC_ENV_ID` the app refuses to sign anyone in.

## What Dynamic does for us

| Step | Dynamic feature | Where |
|---|---|---|
| Sign in with an email code | `useSendEmailOTP`, `useVerifyOTP` | `BridgeReporter.sendCode / verifyCode` |
| A wallet appears for that email (same email, same wallet) | embedded WaaS wallets: `createWaasWalletAccounts`, `getChainsMissingWaasWalletAccounts` | `makeWallet` |
| Next visit is Face ID / fingerprint | passkeys: `useRegisterPasskey`, `useSignInWithPasskey` | `registerPasskey / signInWithPasskey`, `PasskeyPrompt` in `ui.tsx` |
| Put the wallet on Monad testnet | custom network injected via the `networksData` transformer, then `switchActiveNetwork` | `OUR_NETWORK`, `ensureOurNetwork` |
| Every action is a signed request | `createWalletClientForWalletAccount(...).signTypedData` (EIP-712) | `signer.signTypedData` |
| Fund a parent or relative balance from their own embedded wallet | viem wallet client's `sendTransaction`: exact USDC approval followed by `depositFor` | `wallet-funding.ts`, `WalletFunding` |
| Prove access to family summaries once per short session | Dynamic wallet signs a deployment-bound `ReadAuth`; concurrent screens share the grant | `read-session.ts`, `private.ts` |

## Why it matters to the product

Fam-Fi's users are teens, parents, and relatives who may never have held a wallet. Email onboarding hides wallet setup. Normal family actions use a signed EIP-712 request and Fam-Fi's relayer pays gas. Passkeys are optional and require the environment setting to be enabled.

Add family funds is a guided wallet flow (Get test funds remains separate): parents and relatives can receive Monad testnet USDC at their own embedded-wallet address, then authorize and deposit it into their own Fam-Fi balance. This path requires test MON for fees. It does not use the treasury faucet and is not gas-sponsored. Approval alone never appears as a completed deposit; existing sufficient allowance skips approval, failed approvals stop the flow, and unknown submitted transactions persist across reloads and require checking before retrying. Recovery validates the transaction sender, target, calldata and amount. After deposit confirmation, the parent chooses a separately authorized allocation.

Fam-Fi also asks Dynamic to sign `ReadAuth` (domain `FamFiRead`, chain ID and FamFi verifying contract), to prove who is asking for family summaries. It expires after 30 minutes and cannot authorize money movement. Grants stay in memory, are cleared on account changes/logout, and late signatures cannot resurrect an old session. Cancelled authorization pauses automatic prompts until the person explicitly retries. The server obtains the role and family from the contract, never the browser. Blockchain events remain public; this gateway is application access control, not blockchain confidentiality.

## Setup (sandbox environment)

1. Create a sandbox environment at https://console.dynamic.xyz and copy the Environment ID.
2. Enable email sign-in, embedded wallets (automatic creation), passkeys, and the EVM chain.
3. Add your site's origin (e.g. `http://localhost:3000` and the production URL) to allowed origins.
4. Pass the ID: `node scripts/deploy-testnet.mjs --dynamic-env <id>` (writes `app/.env.local` with `NEXT_PUBLIC_DYNAMIC_ENV_ID`).

## Status, honestly

* The form, validation and failure messages are browser-tested without an account: `e2e/dynamic-ui.mjs`.
* **A full real login (email code -> wallet -> signed transaction on Monad testnet) has not been run yet**, the Environment ID is now configured, but mailbox and real-session signing verification still require participation. Update this section with the transaction hash and date once it has.
* Wallet funding and read-session behavior have automated tests. These do not establish Dynamic-service compatibility: complete a real sandbox login, deposit, returning login and money action before claiming a live integration.

## Two-minute sponsor demo

1. Parent signs in through Dynamic and receives an embedded wallet. Show returning access preserving the address.
2. Open wallet funding, show the network/address and move test USDC into Fam-Fi; record approval and deposit proof separately.
3. Parent funds a mission linked to a goal; relative signs a matching commitment from their own account.
4. Parent approves the teen's submitted mission. Show the saving/matching receipt with transaction proof.
5. Explain the short read-only wallet grant and contract-enforced family roles. Attribute gas sponsorship to Fam-Fi, not Dynamic.
