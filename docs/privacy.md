# Privacy and leakage boundary

Zealed encrypts user deposit and withdrawal amounts, balances, historical draw weights, ticket ranges, slot randomness, outcomes, and confidential transfers.

Public state is limited to contract addresses, lifecycle timestamps, snapshot versions, tier definitions, slot counts, and deliberately published pool aggregates. Principal TVL is an aggregate saver liability. Prize liquidity, reserve, and tier allocations are separate sponsor-funded aggregates.

## Observable actions

Transactions reveal that an address called deposit, withdraw, check, or claim and when that happened. Events contain no amount. A claim can therefore reveal participation timing but not the confidential transfer value or encrypted outcome.

Stable ticket indexes reveal registration order and activity, not balance or weight. Optional win disclosure is a two-step opt-in: the user first makes one encrypted win flag publicly decryptable, then submits its public proof. It never publishes the prize amount.

## Claim graph and public slot sizes

`PrizePool.prizePerSlot(drawId, tier)` is a public aggregate. Combined with a successful `claim` transaction, observers can infer that an address interacted with a slot whose **public budget** is known. That is metadata, not a plaintext user amount:

- The confidential transfer value is still an ERC-7984 ciphertext.
- A losing `checkPrize` succeeds and stores encrypted zero, so a check transaction is not a win signal.
- A later `claim` is the stronger public cue (participation in that slot after a check).
- Check-without-claim during the window is weak evidence: the user may not have decrypted yet, or may have decrypted a zero.

Do not treat public `prizePerSlot` as proof of a decrypted personal payout. It is the draw’s published per-slot budget, identical for every checker of that slot.

## Encrypted random mapping and bias

`DrawManager` stores one `FHE.randEuint64()` ciphertext per slot. A check compares the caller’s sealed half-open range `[start, end)` to that random value after a domain map:

```text
RANDOM_DOMAIN = 2^64
point = random * totalScore          // euint128
lower = start * RANDOM_DOMAIN
upper = end * RANDOM_DOMAIN
win  = (point >= lower) && (point < upper)
```

This is equivalent to asking whether `random * totalScore / 2^64` falls in `[start, end)`.

**Bias.** Mapping a uniform 64-bit integer onto `{0, …, totalScore − 1}` by multiply-high is uniform only when `totalScore` divides `2^64`. Otherwise some residues occur `floor(2^64 / totalScore) + 1` times and others `floor(2^64 / totalScore)` times. The absolute count gap is 1. Relative bias is at most `(totalScore − 1) / 2^64`. For any realistic sealed score (`totalScore << 2^64`) that term is far below one part in `2^32`. Adjacent user ranges stay disjoint and cover `[0, totalScore)` up to that residual. A zero-weight range has `start == end`, so the half-open interval is empty and cannot win.

The ciphertext is never publicly decrypted. Tests cover zero-weight and domain-boundary behavior.

## Decryption

User values are decrypted only in the browser using the Zama EIP-712 user-decrypt flow. Keepers public-decrypt only protocol aggregates prepared for draw scoring or pool reconciliation. There is no administrator or server path for decrypting individual state.

Application, test, keeper, and deployment logs must not print plaintext user amounts.
