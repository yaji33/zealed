# Official References and Architectural Prior Art

Use current official documentation as the primary source. Confirm that examples match the package versions installed in this repository.

## Zama Protocol

- [Solidity guides](https://docs.zama.org/protocol/solidity-guides): encrypted types, operations, ACLs, configuration, testing, and deployment.
- [Encrypted types](https://docs.zama.org/protocol/solidity-guides/smart-contract/types): supported encrypted values and operations.
- [Random encrypted numbers](https://docs.zama.org/protocol/solidity-guides/smart-contract/operations/random): transaction-only encrypted CSPRNG operations including `FHE.randEuint64()`.
- [ACL examples](https://docs.zama.org/protocol/solidity-guides/smart-contract/acl/acl_examples): persistent and transient permissions, sender authorization, and public decryptability.
- [User decryption example](https://docs.zama.org/protocol/examples/basic/decryption/fhe-user-decrypt-single-value): contract and user permissions plus off-chain user decryption.
- [Relayer SDK guides](https://docs.zama.org/protocol/relayer-sdk-guides): browser encryption and decryption integration.
- [fhEVM repository](https://github.com/zama-ai/fhevm): framework source.
- [Official Hardhat template](https://github.com/zama-ai/fhevm-hardhat-template): current project and test patterns.

## PoolTogether

- [PoolTogether V5 protocol design](https://dev.pooltogether.com/protocol/design/): principal vaults, time-weighted balances, contributed prize liquidity, tiers, reserve, rollover behavior, and claims.
- [Prize Pool reference](https://dev.pooltogether.com/protocol/reference/prize-pool/): prize-liquidity contract boundary.
- [Prize Vault reference](https://dev.pooltogether.com/protocol/reference/prize-vault/): depositor-facing vault boundary.
- [Protocol reference index](https://dev.pooltogether.com/protocol/reference/): component responsibilities.

## How Zealed adapts the prior art

Zealed adopts these architectural ideas:

- saver principal and prize liquidity are separate;
- eligibility is based on balances over time;
- prize liquidity is divided among bounded tiers and reserve;
- unused prize liquidity can be recycled;
- users interact with a depositor-facing vault while a separate prize system pays awards.

Zealed’s target design differs in important ways:

- saver and eligibility state use fhEVM ciphertexts;
- principal is an ERC-7984 confidential asset;
- current prize funding is explicit sponsor-funded mock yield;
- eligibility history uses versioned encrypted Fenwick and cumulative-balance snapshots;
- each bounded prize slot stores encrypted `FHE.randEuint64()` randomness;
- users run pull-based checks for their own encrypted range;
- individual results and prize transfers remain encrypted;
- decryption is client-side and EIP-712 authorized.

PoolTogether’s formulas and automation are not copied automatically. `build-brief.md` remains the source of truth for Zealed’s bounded policy.
