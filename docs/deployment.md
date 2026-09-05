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
- `cweth`: asset `0x46208622DA27d91db4f0393733C8BA082ed83158`, vault
  `0x457E74F37B2455D25255c391FD2FAd85E42d0042`, ticket engine
  `0x37e9deBc1653Ccb3fEd669619395Be3438aa402C`, prize pool
  `0xEAF9c345Bc169Acaab22E782678cd52A8C614cE3`, draw manager
  `0x96731812c5EF7cb230A49a5cc40083B9d9Dd3e65`. Confidential decimals 6,
  underlying 18, rate `1e12`. Prize funding `100000000` (100 confidential tokens).
- `czama`: asset `0xf2D628d2598aF4eAF94CB76a437Ff86CA78FfbFB`, vault
  `0x091F638b6Fa360deE2439C613b749f3080A939a2`, ticket engine
  `0xbD4E9c470d90fEf5e0589E4a48679EA46D9A4709`, prize pool
  `0xDE06A91BF9269c45251F074C0b37d117d7Aeda98`, draw manager
  `0x500B6D261dF8E4ad4B685Ee01AeA73E4C99254A8`. Confidential decimals 6,
  underlying 18, rate `1e12`. Prize funding `100000000` (100 confidential tokens).
- `cxaut`: asset `0xe4FcF848739845BC81Dee1d5352cf3844F0a60C7`, vault
  `0x7f04F785B536f47B286a9a9feaa0bB0021F6bCfC`, ticket engine
  `0x91d6F8E386395Aef6B277e8E5DCF3909a6932244`, prize pool
  `0x8Abb3EB221213B86E9DA4090da7ade72d84cCC03`, draw manager
  `0xcD68d4b21c41013C52f4fA5D68FB050cF228e53B`. Confidential and underlying
  decimals 6, rate `1`. Prize funding `100000000` (100 tokens).
- `cbron`: asset `0xaa5612FA27c927a0c7961f5AEFEE5ba3A0F9C891`, vault
  `0x79fb4De3397c6b3e861db2622195230EB40db157`, ticket engine
  `0x434Bb895d26c876aA14b7C1172D429eFAb3b0de6`, prize pool
  `0xBf3C9292B9b139E272180420F230316885088bBA`, draw manager
  `0xBA82fFF51Cc1AC6bEe1DD9EEcf7B87Db0A08AD72`. Confidential decimals 6,
  underlying 18, rate `1e12`. Prize funding pending additional deployer Sepolia ETH.

Set `VAULT_REGISTRY_ADDRESS` for operational scripts. Set `VAULT_ID` to target one entry, or leave it
unset for operations that explicitly support all active entries. Always set `VAULT_ID` when funding so
an 18-decimal unit size is never applied to six-decimal vaults. Initial sponsor funding is performed
with:

```bash
VAULT_ID=cweth pnpm --filter @zealed/contracts prizes:fund:sepolia
```

`PRIZE_FUNDING_UNITS` is confidential `euint64` units. Official Sepolia mocks report 6 confidential
decimals, so the default `100000000` is 100 tokens for every live vault. Do not pass
`100 * 10^18` for `cWETH`/`cZAMA`: their underlyings are 18 decimals at rate `1e12`, and that size
exceeds the official 1M-token mint limit. Funding mints the official public mock underlying, wraps
it into the matching ERC-7984 asset, contributes it to that vault's `PrizePool`, and synchronizes
public aggregate prize liquidity. The faucet and deposit defaults are `100` on six-decimal
underlyings and `0.01` when the underlying has more than 6 decimals.

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
interval for the complete prize path. Set `VAULT_ID` to a registered id such as `cusdc`, `cusdt`, `cweth`, `czama`, `cxaut`, or `cbron`; both scripts resolve the
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

## Additional official wrappers

On 2026-09-05 the curated owner registered isolated `cweth`, `czama`, `cxaut`, and `cbron` bundles
on the live registry. The first three `PrizePool`s were funded with `100000000` confidential units.
`cbron` registration is live; sponsor funding is pending additional deployer Sepolia ETH. `ctGBPMock`
remains catalogued in `apps/web/src/lib/wrapperMeta.ts` only. Registering another vault is a curated
owner action, not permissionless listing. Skip restricted `ctGBP`.

From [Zama Sepolia addresses](https://docs.zama.org/protocol/protocol-apps/addresses/testnet/sepolia):

- `cWETHMock` `0x46208622DA27d91db4f0393733C8BA082ed83158` — live `VAULT_ID=cweth`
- `cZAMAMock` `0xf2D628d2598aF4eAF94CB76a437Ff86CA78FfbFB` — live `VAULT_ID=czama`
- `cXAUtMock` `0xe4FcF848739845BC81Dee1d5352cf3844F0a60C7` — live `VAULT_ID=cxaut`
- `cBRONMock` `0xaa5612FA27c927a0c7961f5AEFEE5ba3A0F9C891` — live `VAULT_ID=cbron`
- `ctGBPMock` `0xfCE5c7069c5525eF6c8C2b2E35A745bA20a2F7CC` — catalog only, `VAULT_ID=ctgbp`

Each add deploys a fresh `ConfidentialVault`, `TicketEngine`, `PrizePool`, and `DrawManager`. Do not
reuse assets or components across vault IDs. After register, fund only that vault:

```bash
VAULT_ID=cweth pnpm --filter @zealed/contracts prizes:fund:sepolia
VAULT_ID=czama pnpm --filter @zealed/contracts prizes:fund:sepolia
VAULT_ID=cxaut pnpm --filter @zealed/contracts prizes:fund:sepolia
VAULT_ID=cbron pnpm --filter @zealed/contracts prizes:fund:sepolia
```

Keeper coverage includes every active registry entry. The web directory reads the live registry and
shows a new row without a frontend redeploy, aside from optional metadata already listed above.

## Architecture enforcement

- **Curated multi-vault.** Every vault system remains internally immutable: `ConfidentialVault.asset`
  is immutable, `TicketEngine.setVault` is one-time, and `DrawManager` validates its vault and asset.
  `VaultRegistry` then rejects duplicate assets/components, partial wiring, and cross-vault bundles.
  Registry deactivation never blocks direct principal withdrawal.
- **Multi-tier prizes are enforced.** `PrizePool.TIER_COUNT = 3` and `MAX_SLOTS_PER_TIER = 4`. Constructor requires nonzero shares/slots for every tier and a nonzero reserve. Deployed config is Grand/Standard/Community with 1/2/4 slots.

## Legacy withdrawal

`packages/contracts/deployments/sepolia-legacy.json` preserves the previous deployment. The old vault remains the only path for withdrawing principal held there; upgrading the web app does not migrate or seize that balance. Users should connect the same wallet to the legacy vault interface or call its encrypted withdrawal function before treating the legacy position as closed.
