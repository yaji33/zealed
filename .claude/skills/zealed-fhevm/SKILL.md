---
name: zealed-fhevm
description: Build, test, deploy, or review Zealed contracts using encrypted types, ACLs, ERC-7984 principal, versioned Fenwick snapshots, isolated prize liquidity, encrypted random slots, pull-based checks, and client user decryption. Load for any work under packages/contracts/.
---

# Zealed fhEVM Skill

This is the current project-specific contract guide. Read `build-brief.md` first; it is canonical. Read `docs/architecture.md` for the target design and `CLAUDE.md` for repository constraints.

The multi-tier architecture is in progress. Do not describe a target component, feature, or address as implemented without verifying source, tests, and deployment records.

## 0. Verify version currency

fhEVM APIs evolve. Before writing code:

1. inspect the installed `@fhevm/solidity`, Hardhat plugin, OpenZeppelin confidential-contract, and relayer SDK versions;
2. open the matching official Zama documentation;
3. confirm function names, config contracts, ACL behavior, decryption proof flow, and test helpers;
4. prefer installed type declarations and official examples over historical snippets.

Primary sources:

- [Solidity guides](https://docs.zama.org/protocol/solidity-guides)
- [Encrypted types](https://docs.zama.org/protocol/solidity-guides/smart-contract/types)
- [Random encrypted numbers](https://docs.zama.org/protocol/solidity-guides/smart-contract/operations/random)
- [ACL examples](https://docs.zama.org/protocol/solidity-guides/smart-contract/acl/acl_examples)
- [User decryption example](https://docs.zama.org/protocol/examples/basic/decryption/fhe-user-decrypt-single-value)
- [Relayer SDK guides](https://docs.zama.org/protocol/relayer-sdk-guides)

## 1. Encrypted types and inputs

- Use `euint64` for principal amounts, cumulative balances, weights, range boundaries, random slots, and prizes when the documented range analysis fits.
- Widen only with an explicit overflow analysis.
- Encrypted arithmetic is not ordinary checked Solidity arithmetic. Test upper bounds and wraparound assumptions.
- Convert external encrypted inputs with the installed library’s verified-input API before use.
- Never store `externalEuintXX`.
- Bind encrypted input creation and proof verification to the intended contract, caller, and transaction.
- Never reuse an input proof.
- Validate sender authorization when accepting a ciphertext handle supplied by a caller.

## 2. ACL discipline

Ciphertext handles do not automatically inherit permissions.

- Grant the current contract persistent access to ciphertexts it stores or later computes on.
- Grant a user persistent access only to values that user is authorized to decrypt.
- For user decryption, official Zama guidance requires the appropriate persistent permission for both the contract and user.
- Use transient permission for a same-transaction cross-contract handoff when long-lived access is unnecessary.
- Reapply ACL decisions to every new result of an FHE operation.
- Do not make user values or slot randomness publicly decryptable.
- Make an aggregate publicly decryptable only when the product specification identifies it as public.

ACLs are part of the security model and require negative tests.

## 3. Principal and encrypted failure

Each registered `ConfidentialVault` holds principal for one immutable ERC-7984 asset.

- Principal is withdrawable during every draw lifecycle state.
- Snapshot sealing may freeze eligibility history, never funds.
- `PrizePool` and `DrawManager` must not receive a path to debit vault principal.
- `VaultRegistry` must remain non-custodial and reject reused assets/components or cross-wired systems.
- Scope every balance, snapshot, draw, random slot, and prize-liquidity invariant to one vault ID.
- If requested withdrawal exceeds an encrypted balance, select encrypted zero as the transfer amount and keep the encrypted liability unchanged.
- Do not use a revert, event variant, gas-dependent branch, or log to disclose an encrypted comparison.

General rule: when failure depends on encrypted state, prefer an encrypted zero-value no-op unless the canonical requirements explicitly define another privacy-preserving result.

## 4. Versioned cumulative-balance snapshots

The target `TicketEngine` uses encrypted cumulative-balance checkpoints and a versioned Fenwick tree.

### Required properties

- Stable, non-reused user indexes.
- O(log n) encrypted weight updates.
- O(log n) encrypted prefix queries for one user.
- Explicit maximum tree depth.
- Immutable draw snapshots.
- A new active version for balance changes after draw close.
- No all-user copy during snapshot creation.
- No stored contiguous start offset that shifts later users.
- No depositor enumeration.

### Draw-close behavior

A closed draw binds to a snapshot version and time interval. The implementation derives each user’s eligible weight from encrypted cumulative balances for that interval. Subsequent deposits and withdrawals update the new active version without changing the sealed draw.

Versioning can use checkpointed nodes, persistent-tree roots, structural sharing, or another bounded mechanism. Before coding, document:

- how a node resolves at a historical version;
- how the user’s cumulative value is finalized at the close timestamp;
- how zero-weight users behave;
- how old versions are retained or pruned without invalidating claims;
- why draw close does not perform O(n) work.

## 5. PrizePool accounting

`PrizePool` holds sponsor-funded mock yield, never principal.

Keep these buckets distinct:

- available prize liquidity;
- reserve;
- active tier allocations;
- claim obligations;
- paid prizes;
- rollover in transition, if represented separately.

The accounting must conserve assets. A useful invariant is:

```text
sponsor-funded assets held or paid
= available + reserve + active allocations + obligations + paid
```

Adapt the identity to the concrete state model without double counting.

Tier count and total prize-slot count are bounded. Tier policy and aggregate allocation values can be public. A user’s matched slot and prize amount remain encrypted.

PoolTogether’s official design is prior art for principal/prize separation, time-weighted eligibility, prize tiers, reserve, and recycled liquidity:

- [PoolTogether V5 design](https://dev.pooltogether.com/protocol/design/)
- [Prize Pool reference](https://dev.pooltogether.com/protocol/reference/prize-pool/)

Zealed does not inherit PoolTogether’s exact formulas or automation. Implement only the bounded policy in the canonical brief.

## 6. Encrypted random prize slots

Each configured slot receives a stored encrypted random value:

```solidity
euint64 randomValue = FHE.randEuint64();
```

Confirm exact syntax against the installed package.

Zama states that encrypted random generation:

- is cryptographically secure;
- remains encrypted;
- updates PRNG state on-chain;
- must execute in a transaction rather than `eth_call`.

For every slot:

- generate once;
- bind to one draw, tier, and slot identifier;
- grant only contract computation permissions;
- prevent replacement or regeneration;
- map to the sealed ticket domain using a documented, bias-reviewed algorithm;
- handle an empty ticket domain safely;
- test boundaries and replay behavior.

Do not publicly decrypt slot randomness. Do not accept caller-provided randomness.

## 7. Pull-based slot checks

`checkIfWon(drawId, tierId, slotId)` is conceptually scoped to one caller and one slot.

1. Resolve the sealed snapshot.
2. Compute the caller’s encrypted prefix start and encrypted weight.
3. Compute the encrypted half-open end.
4. Compare the stored encrypted slot random value with `[start, end)`.
5. Select the configured encrypted prize on success and encrypted zero otherwise.
6. Store the caller’s ACL-gated result.
7. Mark `(draw, slot, caller)` as checked.

Never loop over depositors. The expected cost is O(log n) for the caller’s prefix query plus constant slot work. A small loop over configured slots is acceptable only when explicitly bounded and covered by a cost test; prefer slot-scoped user calls.

Loss must not revert or emit a different public signal.

## 8. User decryption

User balances, eligibility, outcomes, and prizes are decrypted off-chain by the authorized wallet.

The client:

1. reads the ciphertext handle;
2. creates user-decrypt key material;
3. signs the EIP-712 authorization for the contract;
4. sends the request through the relayer;
5. decrypts locally.

There is no server, owner, keeper, or administrator decrypt path. Tests may use local mock helpers for assertions, but committed logs must not print plaintext user values.

## 9. Events and public aggregates

Allowed public data includes identifiers, draw lifecycle, snapshot version, tier definitions, bounded slot counts, and aggregate prize accounting.

Principal TVL may be public only through an intentional aggregate-decryption design.

Never emit or log:

- user deposit or withdrawal amounts;
- user balance, cumulative balance, weight, or range;
- slot randomness;
- user outcome or prize amount.

An event can state that an action occurred without its sensitive amount.

## 10. Testing checklist

Use the installed fhEVM Hardhat test environment and verify:

- ERC-7984 operator and encrypted-input flows;
- withdrawal in every draw state;
- encrypted zero behavior for overdraw and loss;
- cross-user ACL isolation;
- snapshot immutability;
- active-version updates after close;
- stable user indexes;
- no linear depositor scaling;
- one-time encrypted randomness per slot;
- empty domain and half-open range boundaries;
- tier and slot limits;
- prize accounting conservation;
- reserve and rollover transitions;
- inability to spend principal as prizes;
- client-equivalent EIP-712 user-decrypt permissions.

Gas and HCU assertions should defend bounded architecture properties, not assume mock execution matches a live network exactly.

## 11. Deployment guidance

- Use the config contract appropriate for the installed Zama package and target network.
- Do not hardcode infrastructure addresses already provided by official config.
- Deploy only after contract and integration tests pass.
- Record addresses only for the matching architecture revision.
- Update documentation only after deployment verification.
- Never carry historical addresses forward as if they represent the refactored system.
