# Zealed

Zealed is a curated multi-vault confidential prize-savings protocol on Zama fhEVM. Savers choose an
ERC-7984 asset vault, hold private positions, withdraw principal at any time, and privately check
eligibility for prizes funded separately from that vault's principal.

The curated multi-vault, multi-tier architecture is deployed and verified on Sepolia. The live registry
contains independent cUSDC, cUSDT, cWETH, cZAMA, cXAUt, and cBRON systems; the web app opens on a vaults directory and
loads each isolated bundle from the registry. Deployment records and operating commands are
documented in `docs/deployment.md`.

## Target architecture

- **VaultRegistry** discovers curated, fully wired asset-specific vault systems without holding funds.
- **ConfidentialVault** holds ERC-7984 principal and keeps withdrawal independent from draws.
- **TicketEngine** records encrypted cumulative balances in versioned Fenwick snapshots.
- **PrizePool** isolates sponsor-funded mock yield and accounts for available liquidity, reserve, tier allocations, claims, and rollover.
- **DrawManager** stores encrypted `FHE.randEuint64()` values for a bounded set of prize slots.
- **Users** check one draw slot at a time. The contract compares only that user’s encrypted range and returns an encrypted prize or encrypted zero.
- **The web client** encrypts inputs and performs EIP-712-authorized user decryption locally.

Winner checks never loop over depositors.

Each registry entry binds one asset, vault, ticket engine, prize pool, and draw manager. Assets and
components cannot be reused across entries, preventing cross-vault custody or accounting mistakes.

## Accounting at a glance

- **Principal TVL** belongs to savers and remains withdrawable.
- **Available prize liquidity** is uncommitted sponsor-funded mock yield.
- **Reserve** is prize liquidity held back as a backstop.
- **Tier allocations** are draw-specific prize budgets.
- **Rollover** returns unused tier liquidity to future draws.

These figures must remain separate in contract accounting and UI labels. Prize funding must never reduce principal TVL.

## Privacy boundary

Encrypted:

- user deposit and withdrawal amounts;
- user balances, cumulative balances, ticket weights, and ranges;
- per-slot random values;
- individual outcomes and prize amounts;
- confidential asset transfers.

Public:

- draw timing and lifecycle;
- snapshot versions;
- tier definitions and bounded slot counts;
- aggregate sponsor funding, prize liquidity, reserve, allocations, rollover, and paid totals;
- principal TVL only when intentionally published as an aggregate.

Plaintext user amounts are prohibited in events, application logs, test logs, and console output.

## Repository

```text
apps/web/                  Next.js client
packages/contracts/        Hardhat and fhEVM contracts
docs/architecture.md       Target system design
docs/economics.md          Prize liquidity and rollover accounting
docs/privacy.md            Confidentiality and observable leakage
docs/operations.md         Permissionless draw lifecycle
docs/deployment.md         Sepolia deployment and legacy withdrawal
build-brief.md             Canonical product requirements
CLAUDE.md                  Repository-wide engineering constraints
.cursor/rules/             Scoped Cursor rules
.claude/skills/            Project-specific fhEVM guidance
```

## Local development

Requirements: Node.js, pnpm, and the environment values described by each package.

```bash
pnpm install
pnpm --filter @zealed/contracts test
pnpm --filter @zealed/web dev
```

See `packages/contracts/README.md` and `apps/web/README.md` for package-specific guidance.

## Using the app

The public client opens on `/dashboard`, a vaults directory of curated ERC-7984 systems. Each row
shows **Principal TVL** and **Available prize liquidity** as separate public aggregates. Individual
balances stay encrypted and are never decrypted in the directory.

- `/dashboard` — vaults directory
- `/dashboard/{slug}` — selected vault workspace (deposit, withdraw, decrypt, prize checks)
- `/dashboard/faucet` — mint the selected wrapper's public mock and wrap it to ERC-7984

Prize funding is sponsor-funded mock yield in `PrizePool`, not accrued vault yield. Adding another
official Zama Sepolia mock uses `vault:add:sepolia` with a new isolated bundle; see
`docs/deployment.md`.

## Status discipline

- Target behavior belongs in the brief and architecture document.
- Implemented behavior must be supported by source and tests.
- Deployed behavior must also have a matching verified deployment record.
- Historical addresses are not canonical and are intentionally omitted here.

## Primary references

- [Zama Solidity guides](https://docs.zama.org/protocol/solidity-guides)
- [Zama encrypted randomness](https://docs.zama.org/protocol/solidity-guides/smart-contract/operations/random)
- [Zama ACL examples](https://docs.zama.org/protocol/solidity-guides/smart-contract/acl/acl_examples)
- [Zama user decryption example](https://docs.zama.org/protocol/examples/basic/decryption/fhe-user-decrypt-single-value)
- [PoolTogether V5 protocol design](https://dev.pooltogether.com/protocol/design/)
- [PoolTogether Prize Pool reference](https://dev.pooltogether.com/protocol/reference/prize-pool/)
