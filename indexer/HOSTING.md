# Envio Cloud hosting

Use the existing `Naveen-807/Fam-Fi` repository and the branch containing these hosting changes. Set Indexer Directory to `indexer` and Config File to `config.yaml`.

The cloud upload includes only the indexer directory. Its `abi/FamFi.json` is a deployment copy of the canonical `../abi/FamFi.json`; keep the two identical after contract changes. Envio is pinned to the locally installed version because Envio Cloud requires an exact version.

Set `ENVIO_FAMFI_ADDRESS=0x9B4753f628b1D4445C9C29EC8608E3ec78D2FbE9` in Envio's environment settings. Chain ID is 10143 and start block is 70640050. No service-wallet keys belong in the indexer. Use the available development plan; do not select a paid upgrade without approval.

Deploy the committed source, wait for historical backfill, and verify current indexed progress and transaction records. Connect the hosted GraphQL endpoint to the relayer's `ENVIO_URL`; family summaries remain behind the authenticated gateway. Configure endpoint access controls offered by the provider rather than assuming the chain data is private.

This hosted pipeline uses HyperIndex, not the local TestIndexer replay service. Verify a real confirmed saving/matching transaction and its Passport/Weekly Brief evidence before reporting the hosted flow as complete.
