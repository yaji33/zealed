# Protocol operations

The draw lifecycle is permissionless, scoped to one registered vault system, and does not inspect
depositor ciphertexts.

1. A sponsor grants `PrizePool` ERC-7984 operator permission and calls `contribute`.
2. `prepareLiquidity` exposes only the pool's aggregate confidential balance for public decryption; `finalizeLiquidity` verifies the KMS proof.
3. After `MIN_DRAW_INTERVAL`, anyone calls `DrawManager.closeDraw`. This seals the end version and prepares the aggregate balance-time score.
4. A keeper public-decrypts that aggregate score and calls `awardDraw`. The pool allocates funded liquidity and the manager generates one encrypted random value for every bounded slot.
5. Users call `checkPrize` per slot, decrypt their own pending result, and call `claim`.
6. After the claim deadline, anyone calls `prepareReconciliation`, public-decrypts only the pool aggregate balance, and calls `finalizeReconciliation`.

`packages/contracts/scripts/keeper-sepolia.ts` automates these transitions. It resolves the canonical
registry deployment, discovers up to 32 active curated systems, and advances each independently.
`VAULT_REGISTRY_ADDRESS` can override the canonical registry for another environment. A failure in one
vault is logged without blocking later vaults in the same polling cycle. Set `KEEPER_ONCE=1` to run a
single tick and exit, which is the smoke path for post-claim reconciliation.

Sponsor funding is a separate explicit operation: `prizes:fund:sepolia` mints and wraps each selected
mock asset, grants its pool operator permission, contributes `PRIZE_FUNDING_UNITS`, and synchronizes
the aggregate. The keeper refuses to award an empty pool. It never combines liquidity, draw IDs, or
proofs between vaults and never decrypts a user balance, range, outcome, or prize.

If a closed draw's verified aggregate score is zero, `cancelEmptyDraw` safely releases the lifecycle for a later period. Deposits and withdrawals remain available in every phase.
