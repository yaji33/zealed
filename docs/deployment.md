# Deployment and migration

## Live curated Sepolia deployment

The verified registry is `0x1163FfD290CB470cC5eCCb267b20697C377b7C6a`.
Its canonical record is `packages/contracts/deployments/sepolia-multivault.json`.

- `cusdc`: asset `0x7c5BF43B851c1dff1a4feE8dB225b87f2C223639`, vault
  `0xAe632380554140dced81D1bDC43e8eDdC4c6E143`, ticket engine
  `0xe943DCd1a1DA24d408576827E7b09AfDE572677e`, prize pool
  `0x1c8b1B0aC48D891848aF0fb17D4Be5645DFb8E24`, draw manager
  `0xE3B5426CE75067D56C7B30745EBB7dEF187F2Bdb`.
- `cusdt`: asset `0x4E7B06D78965594eB5EF5414c357ca21E1554491`, vault
  `0x81679Dfd6Dd3FB9D26b749CFD07322B5f6D0900f`, ticket engine
  `0x2800f372eFB8c6604D792f191d264393dB8cEeA8`, prize pool
  `0x55A1F261e93Bf8B094058855A6dCDAD8F172a652`, draw manager
  `0x4Bb10A81778469744c16042f89e8911bAAB860A4`.

Set `VAULT_REGISTRY_ADDRESS` for operational scripts. Set `VAULT_ID` to target one entry, or leave it
unset for operations that explicitly support all active entries. Initial sponsor funding is performed
with:

```bash
pnpm --filter @zealed/contracts prizes:fund:sepolia
```

`PRIZE_FUNDING_UNITS` defaults to 100 tokens at six decimals. Funding mints the official public mock
underlying, wraps it into the matching ERC-7984 asset, contributes it to that vault's `PrizePool`, and
synchronizes public aggregate prize liquidity.

## Sepolia deployment

Configure Hardhat variables for the deployer mnemonic and Etherscan API key, plus `SEPOLIA_RPC_URL` when not using the configured provider. Then run:

```bash
pnpm --filter @zealed/contracts compile
pnpm --filter @zealed/contracts test
pnpm --filter @zealed/contracts deploy:sepolia
```

The deployment order is vault, ticket engine, prize pool, then draw manager. The script wires the one-time dependencies, renounces deployment ownership, and writes `packages/contracts/deployments/sepolia.json`.

If DrawManager fails for insufficient ETH after the first three contracts land, fund the deployer and resume:

```bash
pnpm --filter @zealed/contracts deploy:sepolia:resume
```

Partial addresses from 2026-09-04 are recorded in `packages/contracts/deployments/sepolia-partial.json`. Do not publish those as live app addresses until DrawManager is deployed, wired, verified, and smoke-tested.

Verify all four contracts against the exact compiler settings in `hardhat.config.ts`, then copy the deployment addresses into the web environment. Set `NEXT_PUBLIC_PRIZE_POOL_ADDRESS` together with the vault, ticket engine, draw manager, and ERC-7984 asset addresses.

Run `smoke-sepolia.ts` for encrypted deposit/withdraw and `smoke-draw-sepolia.ts` after the minimum draw
interval for the complete prize path. Set `VAULT_ID` to `cusdc` or `cusdt`; both scripts resolve the
selected bundle through the registry. They assert decrypted values internally and do not log user
amounts.

On 2026-09-04, `smoke:sepolia` and `smoke:draw:sepolia` completed for both registry entries: encrypted
deposit/withdraw, then close → award → private `checkPrize` → claim. After each claim window,
`KEEPER_ONCE=1` prepared and finalized reconciliation:

- `cusdc` prepare `0xe77ed47008123a41a362feb01537224ecbcd7c0520ad800f1140efc56f88217e`, finalize
  `0x9948590ddf85a0372af1760ff7cf45383bfc2851ebb434ccbb48e760d2120b93`
- `cusdt` prepare `0xc948fe3b067a7cf5c06d150fc40a4ae2a1cd84363d9d13d70d15bb5bd0806782`, finalize
  `0x336af7188924e9fcf2559db450c99c3725a686860be80930cb4d8fba70094ddb`

## Curated multi-vault deployment

For a new production registry and its first asset-specific vault system:

```bash
pnpm --filter @zealed/contracts deploy:multivault:sepolia
```

Set `ASSET_ADDRESS` and optionally `VAULT_ID` before running. The script deploys `VaultRegistry`, a
complete vault bundle, validates and registers that bundle, renounces mutable ownership on the three
one-time-wired components, and records `sepolia-multivault.json`. Keep registry ownership in an
operationally controlled account so reviewed assets can be added.

To add another asset, set `VAULT_REGISTRY_ADDRESS`, `ASSET_ADDRESS`, and `VAULT_ID`, then run:

```bash
pnpm --filter @zealed/contracts vault:add:sepolia
```

After verification and smoke testing, set `NEXT_PUBLIC_VAULT_REGISTRY_ADDRESS` in the web deployment.
The legacy individual addresses remain a fallback and withdrawal path, not a second registry entry.

## Architecture enforcement

- **Curated multi-vault.** Every vault system remains internally immutable: `ConfidentialVault.asset`
  is immutable, `TicketEngine.setVault` is one-time, and `DrawManager` validates its vault and asset.
  `VaultRegistry` then rejects duplicate assets/components, partial wiring, and cross-vault bundles.
  Registry deactivation never blocks direct principal withdrawal.
- **Multi-tier prizes are enforced.** `PrizePool.TIER_COUNT = 3` and `MAX_SLOTS_PER_TIER = 4`. Constructor requires nonzero shares/slots for every tier and a nonzero reserve. Deployed config is Grand/Standard/Community with 1/2/4 slots.

## Legacy withdrawal

`packages/contracts/deployments/sepolia-legacy.json` preserves the previous deployment. The old vault remains the only path for withdrawing principal held there; upgrading the web app does not migrate or seize that balance. Users should connect the same wallet to the legacy vault interface or call its encrypted withdrawal function before treating the legacy position as closed.
