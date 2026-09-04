# Privacy and leakage boundary

Zealed encrypts user deposit and withdrawal amounts, balances, historical draw weights, ticket ranges, slot randomness, outcomes, and confidential transfers.

Public state is limited to contract addresses, lifecycle timestamps, snapshot versions, tier definitions, slot counts, and deliberately published pool aggregates. Principal TVL is an aggregate saver liability. Prize liquidity, reserve, and tier allocations are separate sponsor-funded aggregates.

## Observable actions

Transactions reveal that an address called deposit, withdraw, check, or claim and when that happened. Events contain no amount. A claim can therefore reveal participation timing but not the confidential transfer value or encrypted outcome.

Stable ticket indexes reveal registration order and activity, not balance or weight. Optional win disclosure is a two-step opt-in: the user first makes one encrypted win flag publicly decryptable, then submits its public proof. It never publishes the prize amount.

## Decryption

User values are decrypted only in the browser using the Zama EIP-712 user-decrypt flow. Keepers public-decrypt only protocol aggregates prepared for draw scoring or pool reconciliation. There is no administrator or server path for decrypting individual state.

Application, test, keeper, and deployment logs must not print plaintext user amounts.
