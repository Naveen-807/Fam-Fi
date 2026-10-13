# Relayer hosting

Deploy this repository as one continuously running Railway service. Keep the build context at the repository root and set the Railway config path to `relayer/railway.toml`; the Dockerfile includes shared ABIs without copying local secrets.

Use one replica with a persistent volume mounted at `/data`. Do not simultaneously use the same relayer wallet in the local server and hosted service; independent processes can conflict over transaction nonces.

Set these as server-only environment variables:

- `RPC_URL`, `FAMFI_ADDRESS`, `FORWARDER_ADDRESS`, `USDC_ADDRESS`: the existing Monad testnet deployment.
- `RELAYER_KEY`, `TREASURY_KEY`: service-wallet keys. Never use `NEXT_PUBLIC_` for keys.
- `ALLOWED_ORIGIN=https://fam-fi.vercel.app`: add specific additional frontend origins only when needed.
- `ENVIO_URL`: the hosted indexer's GraphQL endpoint.
- `FAUCET_STATE_PATH=/data/faucet-state.json` and `ROSTER_STATE_PATH=/data/confirmed-teens.json`.
- `PREPARE_TREASURY_ALLOWANCE=false`: use the existing bounded token allowance; hosting does not grant another approval.
- `FAUCET_AMOUNT`, `FAUCET_COOLDOWN_HOURS`, `MAX_GAS`, and `RATE_PER_MINUTE`: bounded testnet service settings.

Railway supplies `PORT`. Generate the public HTTPS domain and verify `/health` and `/capabilities`. Configure a durable Envio indexer against the same contract and deployment start block before claiming complete Passport/history operation.

Set Vercel's `NEXT_PUBLIC_RELAYER_URL` to that HTTPS domain for the required environments, then rebuild the frontend. Configure Dynamic allowed origins. Verify two-account signed transactions and private reads before declaring the hosted demo complete.

The current in-memory rate limiter and wallet nonce manager require a single service process. Persistent faucet state preserves cooldowns across restarts; this remains a testnet service, not a production financial backend.
