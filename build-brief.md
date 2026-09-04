# Zealed Product Requirements

Status: canonical requirements for the target architecture. The repository may contain an earlier single-prize implementation while the multi-tier refactor is in progress. This document defines intended behavior; it is not evidence that a feature is deployed or live.

## 1. Product thesis

Zealed is a curated multi-vault confidential prize-savings protocol on Zama fhEVM. Savers choose an
asset-specific shared vault, keep principal withdrawable at all times, and receive private eligibility
for periodic prizes funded independently from that vault's principal.

The product must preserve two properties together:

1. Savings positions and individual outcomes are confidential.
2. Pool accounting, draw lifecycle, and prize-liquidity policy are independently understandable and verifiable.

## 2. Required product surface

- [ ] Accept an ERC-7984 confidential asset as principal.
- [ ] Discover curated asset-specific vault systems through an onchain registry.
- [ ] Keep every vault's principal, eligibility, draws, and prize accounting isolated.
- [ ] Keep every saver’s principal withdrawable at any time, independent of draw state.
- [ ] Keep user deposits, balances, ticket weights, eligibility, and prize outcomes encrypted.
- [ ] Track draw eligibility from versioned cumulative-balance snapshots.
- [ ] Maintain Fenwick-based encrypted prefix sums without looping over depositors.
- [ ] Hold sponsor-funded mock yield in a separate `PrizePool`; never fund prizes from principal.
- [ ] Allocate available prize liquidity across bounded prize tiers, reserve, and rollover.
- [ ] Store one encrypted `FHE.randEuint64()` result for each bounded prize slot.
- [ ] Let each user check each prize slot for themselves through a pull-based encrypted comparison.
- [ ] Return an encrypted zero on a losing check; never reveal loss through a revert.
- [ ] Support client-side user decryption authorized through the EIP-712 user-decrypt flow.
- [ ] Provide a public aggregate experience and a wallet-scoped private experience.
- [ ] Cover contract changes with unit and integration tests.

## 3. Canonical accounting vocabulary

These terms are not interchangeable and are always scoped to one registered vault system:

- **Principal TVL**: aggregate ERC-7984 principal held for savers by `ConfidentialVault`. It is a liability to depositors and is never prize funding.
- **Available prize liquidity**: sponsor-funded mock yield held by `PrizePool` that has not been reserved, allocated to an unsettled claim, or paid.
- **Reserve**: a public accounting bucket inside `PrizePool` retained as a liquidity backstop. It is prize liquidity, not principal.
- **Tier allocation**: the portion of distributable prize liquidity assigned to a named tier for a specific draw. A tier can contain a bounded number of prize slots.
- **Rollover**: unspent or expired tier liquidity returned to future available prize liquidity according to explicit draw-finalization rules.

The UI and documentation must always label these values precisely. “Pool size” must not ambiguously combine principal and prize funds.

## 4. System boundaries

### `VaultRegistry`

- Curates asset-specific vault systems; it never custodies or transfers assets.
- Binds one ERC-7984 asset to one fully wired `ConfidentialVault`, `TicketEngine`, `PrizePool`, and
  `DrawManager` system.
- Rejects duplicate assets, duplicate components, partial wiring, and cross-vault component mixing.
- Can remove a vault from frontend discovery without affecting direct principal withdrawal.
- Remains curated for this release; permissionless vault listing is not required.

### `ConfidentialVault`

- Custodies ERC-7984 principal.
- Tracks encrypted per-user balances and cumulative-balance observations.
- Accepts encrypted deposit and withdrawal amounts with valid input proofs.
- Makes withdrawal independent from draw creation, settlement, snapshotting, or claims.
- Resolves an oversized encrypted withdrawal to a zero-value confidential transfer rather than a plaintext failure signal.
- Exposes only deliberately public aggregate state.

### `TicketEngine`

- Derives draw eligibility from encrypted balances over time.
- Uses a bounded Fenwick tree for encrypted updates and prefix sums.
- Versions tree state and cumulative-balance checkpoints so a closed draw reads an immutable eligibility snapshot while later deposits and withdrawals continue against a new version.
- Assigns stable user indexes; an index is not reused to reinterpret historical snapshots.
- Never stores a contiguous per-user start offset that forces updates to later users.
- Never loops over all depositors.

The exact checkpoint representation may change during implementation, but historical draw eligibility must be immutable, queryable per user, and compatible with immediate principal withdrawal.

### `PrizePool`

- Custodies sponsor-funded mock yield separately from vault principal.
- Accounts for available prize liquidity, reserve, per-draw tier allocations, claims, and rollover.
- Rejects any accounting path that spends `ConfidentialVault` principal.
- Uses a bounded, configured tier and slot structure. Configuration and aggregate allocation policy are public.
- Finalizes unused allocations deterministically into reserve or rollover.

The first implementation simulates yield through explicit sponsor funding. It must be described as mock yield, not accrued vault yield.

### `DrawManager`

- Opens and closes draws against a specific immutable ticket snapshot.
- Stores tier and slot metadata for each draw.
- Generates and stores one encrypted `FHE.randEuint64()` value per bounded prize slot during a state-changing transaction.
- Maps each stored encrypted random value into the relevant snapshot domain using a specified, bias-reviewed method.
- Lets a caller evaluate only their own encrypted range for a requested draw and prize slot.
- Records replay protection per draw, slot, and account.
- Credits the configured encrypted prize on a win and encrypted zero on a loss.
- Never loops over depositors. A bounded loop over configured prize slots is allowed only where the transaction’s maximum work is explicit and tested; user checks should remain slot-scoped.

## 5. Snapshot and draw lifecycle

All lifecycle steps are scoped by `vaultId`; state from one vault must never satisfy or fund another.

1. Deposits and withdrawals update the selected vault's current encrypted cumulative-balance state.
2. At draw close, the current version is sealed as the draw’s eligibility snapshot.
3. A new active version accepts subsequent balance changes immediately; withdrawals remain available throughout.
4. `PrizePool` snapshots that draw’s public tier allocations from sponsor-funded available prize liquidity.
5. `DrawManager` creates the bounded prize slots and stores encrypted randomness for each slot.
6. A user calls the pull-based check for a specific draw and slot.
7. The check reconstructs only that user’s encrypted range from the sealed snapshot and compares it with the slot’s encrypted random value.
8. The user decrypts their own result and prize through the client-side EIP-712 flow.
9. Claimed liquidity leaves the relevant tier allocation. Unused liquidity follows the documented reserve or rollover rule at finalization.

No step scans the depositor set.

## 6. Confidentiality boundary

Encrypted by default:

- user principal balances and transaction amounts;
- cumulative-balance observations and ticket weights;
- per-user range boundaries and eligibility;
- per-slot random values;
- per-user win/loss results;
- per-user prize amounts and confidential transfers.

Public by design:

- contract addresses after a verified deployment is recorded;
- draw identifiers, timestamps, lifecycle state, snapshot version, tier definitions, and bounded slot counts;
- principal TVL only when deliberately made publicly decryptable as an aggregate;
- sponsor contributions and aggregate prize accounting: available prize liquidity, reserve, tier allocations, paid totals, and rollover;
- non-amount action events.

No event, application log, test log, or console output may contain a plaintext user amount. Aggregate values must never be presented as if they identify an individual.

## 7. Decryption and ACL requirements

- User values are decrypted off-chain by the authorized user through the Zama user-decrypt flow and an EIP-712 signature.
- There is no server, keeper, owner, or administrator path to decrypt another user’s balance, eligibility, random slot, result, or prize.
- Ciphertexts needed by a user and contract receive the required persistent ACL grants.
- Cross-contract encrypted values use the narrowest valid transient or persistent grants.
- Every newly produced ciphertext receives fresh ACL treatment before storage or use by another principal.

## 8. Frontend requirements

The public experience must distinguish:

- the selected vault and principal asset;
- principal TVL;
- available prize liquidity;
- reserve;
- allocations by tier;
- rollover;
- draw and snapshot status.

The private experience must support:

- wallet connection and network state;
- curated vault discovery and selection;
- ERC-7984 operator approval;
- encrypted deposit and immediate withdrawal;
- client-side decryption of the connected user’s position;
- draw- and slot-scoped private checks;
- client-side decryption of outcomes and prizes;
- confidential prize claims.

The interface must label target or unavailable functionality honestly. It must not display contract addresses as current until they correspond to the implemented architecture and a verified deployment record.

## 9. Ship-if-time

- User-controlled disclosure of a win tier without exposing the prize amount.
- Additional aggregate accounting visualizations that preserve the privacy boundary.
- Permissionless automation for routine draw transitions, provided it cannot inspect user ciphertexts or block withdrawal.

These items do not override the required surface in Section 2.

## 10. Explicitly out of scope

- group, family, or organization sub-pools;
- permissionless vault creation or listing;
- multiple strategies for the same principal asset;
- progressive or anti-whale weighting;
- compliance or auditor decryption;
- server-side decryption;
- unbounded on-chain winner enumeration;
- real yield-source integration before the sponsor-funded mock-yield accounting is complete and tested.

## 11. Definition of done

A feature is done only when:

1. it maps to Section 2 or Section 9;
2. its tests cover confidentiality, accounting boundaries, and relevant bounded-work properties;
3. principal withdrawal remains independent and available;
4. no depositor loop or plaintext user amount has been introduced;
5. documentation marks implementation and deployment status accurately.
6. multi-vault features prove that component wiring, balances, draws, and accounting cannot cross vault IDs.

## 12. Primary references

- [Zama encrypted random numbers](https://docs.zama.org/protocol/solidity-guides/smart-contract/operations/random)
- [Zama ACL examples](https://docs.zama.org/protocol/solidity-guides/smart-contract/acl/acl_examples)
- [Zama user decryption example](https://docs.zama.org/protocol/examples/basic/decryption/fhe-user-decrypt-single-value)
- [Zama encrypted types](https://docs.zama.org/protocol/solidity-guides/smart-contract/types)
- [PoolTogether V5 protocol design](https://dev.pooltogether.com/protocol/design/)
- [PoolTogether Prize Pool reference](https://dev.pooltogether.com/protocol/reference/prize-pool/)

PoolTogether is architectural prior art for separating principal from prize liquidity, time-weighted eligibility, tiers, reserve, and recycled liquidity. Zealed’s encrypted slot checks and sponsor-funded mock-yield model are project-specific adaptations, not claims of protocol equivalence.
