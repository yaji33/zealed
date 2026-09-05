# Protocol operations

The draw lifecycle is permissionless, scoped to one registered vault system, and does not inspect
depositor ciphertexts.

1. A sponsor grants `PrizePool` ERC-7984 operator permission and calls `contribute`.
2. `prepareLiquidity` exposes only the pool's aggregate confidential balance for public decryption; `finalizeLiquidity` verifies the KMS proof.
3. After `MIN_DRAW_INTERVAL`, anyone calls `DrawManager.closeDraw`. This seals the end version and prepares the aggregate balance-time score.
4. A keeper public-decrypts that aggregate score and calls `awardDraw`. The pool allocates funded liquidity and the manager generates one encrypted random value for every bounded slot.
5. Users call `checkPrize` per slot, decrypt their own pending result, and call `claim`.
6. After the claim deadline, anyone calls `prepareReconciliation`, public-decrypts only the pool aggregate balance, and calls `finalizeReconciliation`.

## Keeper one-pager

`packages/contracts/scripts/keeper-sepolia.ts` automates these transitions. It resolves the canonical
registry deployment, discovers up to 32 active curated systems, and advances each independently.
`VAULT_REGISTRY_ADDRESS` can override the canonical registry for another environment. A failure in one
vault is logged without blocking later vaults in the same polling cycle. Set `KEEPER_ONCE=1` to run a
single tick and exit, which is the smoke path for post-claim reconciliation.

Live demo cadence (Sepolia): `MIN_DRAW_INTERVAL = 20 minutes` and `CLAIM_WINDOW = 20 minutes`. That is
a **demo** clock so judges can finish a cycle in one sitting. It is not a mainnet parameter.

```bash
pnpm keeper
```

The keeper wallet must hold Sepolia ETH. Award and reconcile each do FHE work; plan several ETH if
the process runs for days across every active vault. Keep the process up for the judging window so
close → award → reconcile do not stall after a deposit.

The keeper refuses to award an empty pool. It never combines liquidity, draw IDs, or proofs between
vaults and never decrypts a user balance, range, outcome, or prize.

If a closed draw's verified aggregate score is zero, `cancelEmptyDraw` safely releases the lifecycle for a later period. Deposits and withdrawals remain available in every phase.

## Sponsor funding and ActiveDraw

Sponsor funding is a separate explicit operation: `prizes:fund:sepolia` mints and wraps each selected
mock asset, grants its pool operator permission, contributes `PRIZE_FUNDING_UNITS`, and synchronizes
the aggregate.

`PrizePool.prepareLiquidity` reverts with `ActiveDraw` while a draw is open. Fund only when
`activeDrawId == 0` (after the keeper logs finalized rollover, before the next `closeDraw`). Always
set `VAULT_ID` so an 18-decimal unit size is never applied to a six-decimal vault. Official mocks use
6 confidential decimals; `PRIZE_FUNDING_UNITS=100000000` is 100 tokens.

```bash
VAULT_ID=cusdc PRIZE_FUNDING_UNITS=100000000 pnpm --filter @zealed/contracts prizes:fund:sepolia
```

PowerShell:

```powershell
$env:VAULT_ID="cusdc"
$env:PRIZE_FUNDING_UNITS="100000000"
pnpm --filter @zealed/contracts prizes:fund:sepolia
```

Pre-fund cUSDC and cUSDT (and any other vault judges will open) before the judging window so award
does not run against zero available prize liquidity.

## Judging-window checklist

1. Hosted web URL is public and pointed at registry `0x1163FfD290CB470cC5eCCb267b20697C377b7C6a`.
2. `pnpm keeper` is running on a funded deployer.
3. Prize pools for the demo vaults show nonzero available prize liquidity when no draw is active.
4. A cold wallet can complete faucet → wrap → `setOperator` → deposit → wait ≤ 20 minutes → check → decrypt → claim → withdraw.
