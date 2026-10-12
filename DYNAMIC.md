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

## Why it matters to the product

Fam-Fi's users are teens, parents, and relatives who have never held a wallet. Email + passkey means nobody sees a seed phrase or needs gas. The signed EIP-712 request goes to our relayer, which pays gas, so the flow is: email code -> wallet -> tap -> done.

## Setup (sandbox environment)

1. Create a sandbox environment at https://console.dynamic.xyz and copy the Environment ID.
2. Enable email sign-in, embedded wallets (automatic creation), passkeys, and the EVM chain.
3. Add your site's origin (e.g. `http://localhost:3000` and the production URL) to allowed origins.
4. Pass the ID: `node scripts/deploy-testnet.mjs --dynamic-env <id>` (writes `app/.env.local` with `NEXT_PUBLIC_DYNAMIC_ENV_ID`).

## Status, honestly

* The form, validation and failure messages are browser-tested without an account: `e2e/dynamic-ui.mjs`.
* **A full real login (email code -> wallet -> signed transaction on Monad testnet) has not been run yet**, because it needs a real Environment ID and a mailbox. Update this section with the transaction hash and date once it has.
