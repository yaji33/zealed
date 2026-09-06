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

`allocateDraw` spends **all** synchronized available prize liquidity on the next award. Live tier
shares are immutable (5000 / 3000 / 1500 + 500 reserve). A 10,000-token contribution becomes one
Grand of about 5,000, not two weeks of prizes.

The keeper therefore drips a **per-draw budget** whenever `activeDrawId == 0` and the pot is below
that budget. Defaults (6 confidential decimals): 20 tokens for the mock stables and ZAMA / XAUt /
BRON, and 0.02 for cWETH. Override with `PRIZE_DRAW_BUDGET_UNITS` only — a leftover
`PRIZE_FUNDING_UNITS` lump must not refill every draw.

`prizes:fund:sepolia` is the manual path. It refuses to mint while a draw is open
(`prepareLiquidity` reverts `ActiveDraw`) and refuses lumps above 100 tokens unless
`FORCE_PRIZE_LUMP=1`. Fund only when `activeDrawId == 0` (after the keeper logs finalized rollover,
before the next `closeDraw`). Always set `VAULT_ID`. Official mocks use 6 confidential decimals;
`PRIZE_FUNDING_UNITS=20000000` is 20 tokens.

```bash
VAULT_ID=cusdc PRIZE_FUNDING_UNITS=20000000 pnpm --filter @zealed/contracts prizes:fund:sepolia
```

PowerShell:

```powershell
$env:VAULT_ID="cusdc"
$env:PRIZE_FUNDING_UNITS="20000000"
pnpm --filter @zealed/contracts prizes:fund:sepolia
```

A 20-minute close interval plus a 20-minute claim window is about 504 draws in 14 days. At 20 tokens
per draw that is about 10,080 tokens if every award is fully claimed. Keep `pnpm keeper` running so
the drip can refill after each rollover.

Contribute can succeed while a draw is active; only `prepareLiquidity` / `finalizeLiquidity` revert.
Those tokens sit in the pool and become the next award after reconciliation. Do not re-run a 10,000
token fund during Claiming.

## Judging-window checklist

1. Hosted web URL is public and pointed at registry `0x1163FfD290CB470cC5eCCb267b20697C377b7C6a`.
2. `pnpm keeper` is running on a funded deployer.
3. Prize pools for the demo vaults show nonzero available prize liquidity when no draw is active.
4. A cold wallet can complete faucet → wrap → `setOperator` → deposit → wait ≤ 20 minutes → check → decrypt → claim → withdraw.
