# CLAUDE.md

Repository steering for Zealed. `build-brief.md` is the canonical product specification; `docs/architecture.md` defines the target system design. Do not infer that target features or addresses are implemented until source, tests, and deployment records establish that status.

## Before implementation

1. Read `build-brief.md`, especially Section 10.
2. Map the task to Section 2 or Section 9.
3. For contract work, load `.claude/skills/zealed-fhevm/SKILL.md` and verify APIs against current official Zama documentation.
4. Preserve the accounting and privacy boundaries below.

## Non-negotiable product constraints

1. ERC-7984 principal is withdrawable at all times. Draws, snapshots, claims, and maintenance cannot block withdrawal.
2. Principal and prizes are separate within every registered vault system. Its `ConfidentialVault`
   holds saver principal; its `PrizePool` holds sponsor-funded mock yield.
3. Never transfer, reserve, allocate, or pay vault principal as a prize.
4. Winner checking is pull-based and scoped to one user and one bounded prize slot.
5. Never loop over depositors. Fenwick work is bounded by configured depth; slot work is bounded by explicit limits.
6. Closed draws use immutable versioned cumulative-balance snapshots while a new version accepts balance changes.
7. Each prize slot stores encrypted randomness generated with `FHE.randEuint64()` in a transaction.
8. A losing check yields encrypted zero and does not revert or emit a public outcome signal.
9. User values are decrypted client-side through EIP-712-authorized user decryption only.
10. No server, owner, keeper, or administrator may decrypt another user’s state.
11. Never emit or log plaintext user amounts, including in tests and debug code.
12. `VaultRegistry` is curated and non-custodial. Never reuse an asset or component across registry
    entries or mix balances, snapshots, draws, or prize accounting across vault IDs.

## Accounting language

Use these exact concepts:

- **Principal TVL**: saver principal held by the selected vault's `ConfidentialVault`.
- **Available prize liquidity**: uncommitted sponsor-funded assets in its `PrizePool`.
- **Reserve**: prize liquidity held back as a backstop.
- **Tier allocation**: a draw-specific budget for a tier.
- **Rollover**: unused tier liquidity returned to future availability.

Do not call a sum of principal and prize buckets “pool size.” Do not describe sponsor funding as accrued vault yield.

## Public and encrypted state

Encrypted by default: user amounts, balances, cumulative balances, weights, ranges, slot randomness, eligibility, outcomes, and prizes.

Public by design: draw lifecycle, snapshot version, tier definitions, bounded slot counts, and aggregate prize accounting. Principal TVL is public only when deliberately authorized for aggregate public decryption.

## Engineering workflow

- Keep changes scoped and reviewable.
- Add or update tests with every contract behavior change.
- Verify snapshot immutability, accounting conservation, ACL isolation, range boundaries, and bounded work.
- Do not preserve a legacy pattern merely because it exists in the current implementation when it contradicts the canonical brief.
- Do not claim a target feature is available before implementation.
- Do not publish deployment addresses without matching implementation and verified deployment records.

## Style

- TypeScript strict mode; no `any` without a reason comment.
- NatSpec on every external or public Solidity function.
- Prefer explicit invariants and bounded constants over decorative abstraction.
- Use official Zama documentation as the primary source for fhEVM APIs.
