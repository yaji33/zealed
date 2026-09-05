# @zealed/contracts

Hardhat and fhEVM contracts for Zealed.

Status: the curated multi-vault, multi-tier contracts are deployed and verified on Sepolia. The live registry contains
isolated cUSDC, cUSDT, cWETH, cZAMA, cXAUt, and cBRON systems; see `../../docs/deployment.md`.

## Target contract boundaries

- `VaultRegistry`: curated discovery and strict validation of asset-specific contract bundles; no custody.
- `ConfidentialVault`: ERC-7984 principal custody, encrypted user accounting, and immediate withdrawal.
- `TicketEngine`: encrypted cumulative-balance checkpoints and versioned Fenwick snapshots.
- `PrizePool`: separate custody and accounting for sponsor-funded mock yield, reserve, tier allocations, claims, and
  rollover.
- `DrawManager`: bounded prize slots, stored encrypted randomness, and pull-based per-user checks.

Prize assets must come from explicit sponsor funding into `PrizePool`. Vault principal must never be transferred to fund
a draw.

One registry entry contains exactly one asset, vault, ticket engine, prize pool, and draw manager. Registration rejects
duplicate assets/components and incomplete or cross-wired bundles. Deploy another complete bundle to add an asset; never
share ticket or prize state across vaults.

## Commands

```bash
pnpm --filter @zealed/contracts compile
pnpm --filter @zealed/contracts test
pnpm --filter @zealed/contracts deploy:multivault:sepolia
pnpm --filter @zealed/contracts prizes:fund:sepolia
```

After the initial registry deployment, add a curated asset with `VAULT_REGISTRY_ADDRESS`, `ASSET_ADDRESS`, and a
bytes32-compatible `VAULT_ID`:

```bash
pnpm --filter @zealed/contracts vault:add:sepolia
```

Set `VAULT_ID` to run `smoke:sepolia` or `smoke:draw:sepolia` against one registered vault. The keeper enumerates a
bounded set of active registry entries. `KEEPER_ONCE=1 pnpm --filter @zealed/contracts keeper:sepolia` runs a single
lifecycle tick.

## Contract invariants

- Principal withdrawal is available regardless of draw or snapshot state.
- Draw eligibility reads a sealed snapshot; later balance changes update a new active version.
- Fenwick operations are bounded and no function enumerates depositors.
- Every prize slot stores its own encrypted `FHE.randEuint64()` value.
- A check is scoped to one account and one slot.
- A losing check and an oversized withdrawal resolve to encrypted zero-value behavior, not a plaintext outcome signal.
- User amounts never appear in events or logs.
- Decryption of user state occurs in the client through EIP-712-authorized user decryption.

## ERC-7984 integration

Before a deposit, the user grants the vault operator permission on the confidential asset. Encrypted inputs must be
created for the receiving contract and accompanied by the matching proof. Do not reuse proofs.

## fhEVM implementation rules

- Validate sender authorization for ciphertext handles.
- Convert external encrypted inputs before storage.
- Treat every FHE operation as producing a new handle that needs correct ACL grants.
- Grant both the contract and authorized user persistent access when client decryption is required.
- Use transient grants for narrow same-transaction cross-contract handoffs.
- Never branch in Solidity on `ebool`; use encrypted selection.
- Generate encrypted randomness only in state-changing transactions.

## Required tests for the target refactor

- principal can be withdrawn during every draw lifecycle state;
- prize funding and payout cannot reduce principal TVL;
- snapshot history is immutable while a new version accepts updates;
- Fenwick update and per-user check cost do not scale linearly with depositor count;
- tier and slot bounds are enforced;
- random slot values cannot be regenerated or replaced;
- range boundaries are correct;
- losing checks store encrypted zero without reverting;
- reserve, allocation, claim, and rollover accounting conserve prize assets;
- ACL and user-decrypt permissions isolate users.
- registry wiring and encrypted state remain isolated across at least two vault systems.

## References

- [Zama Solidity guides](https://docs.zama.org/protocol/solidity-guides)
- [Zama encrypted random numbers](https://docs.zama.org/protocol/solidity-guides/smart-contract/operations/random)
- [Zama ACL examples](https://docs.zama.org/protocol/solidity-guides/smart-contract/acl/acl_examples)
- [Zama user decryption example](https://docs.zama.org/protocol/examples/basic/decryption/fhe-user-decrypt-single-value)
- [PoolTogether V5 design](https://dev.pooltogether.com/protocol/design/)
