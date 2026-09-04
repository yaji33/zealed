# @zealed/web

Next.js client for Zealed’s public aggregate view and wallet-scoped private actions.

Status: the client discovers the verified Sepolia cUSDCMock and cUSDTMock systems through the live
registry. Accounting, private actions, draw data, and faucet wrapping follow the selected vault.

## Setup

```bash
# from the repository root
pnpm install
cp apps/web/.env.example apps/web/.env.local
pnpm --filter @zealed/web dev
```

Populate only the environment values required by the current application. Do not document an address as current until it belongs to the implemented architecture and has a matching deployment record.

Set `NEXT_PUBLIC_VAULT_REGISTRY_ADDRESS` for curated multi-vault discovery. The individual contract
address variables remain a safe single-vault fallback during deployment recovery. A selected registry
entry supplies the asset, vault, ticket engine, prize pool, and draw manager as one indivisible bundle.

## Target public experience

The public interface must label these values separately:

- **Selected vault and asset**: the registry entry currently in view.
- **Principal TVL**: aggregate saver principal in `ConfidentialVault`.
- **Available prize liquidity**: sponsor-funded mock yield not yet committed.
- **Reserve**: prize liquidity held back as a backstop.
- **Tier allocations**: draw-specific budgets by tier.
- **Rollover**: unused allocation returned for future draws.

It may also show draw timing, lifecycle state, snapshot version, tier definitions, slot counts, and aggregate paid prizes. It must never imply that sponsor funding is yield accrued by the vault.

## Target private experience

For the connected wallet:

- discover and select an active curated vault;
- grant ERC-7984 operator permission;
- encrypt deposit and withdrawal inputs;
- deposit principal and withdraw it at any time;
- decrypt the user’s own balance and eligibility data;
- request a private check for a specific draw and prize slot;
- decrypt the user’s own encrypted outcome and prize;
- claim through a confidential asset transfer.

The client must not infer a loss from a failed transaction. A normal losing check succeeds and yields encrypted zero.

## Privacy requirements

- User decryption occurs in the browser through the Zama relayer flow and EIP-712 authorization.
- Never send user ciphertexts to an application backend for decryption.
- Never render raw wallet error dumps, calldata, proofs, or sensitive provider details.
- Never log plaintext deposit, withdrawal, balance, weight, outcome, or prize values.
- Aggregate public values must be named precisely and must not be mixed into a single ambiguous “pool” figure.

## Styling

Use Tailwind v4 utilities in JSX and the tokens defined by the application’s Tailwind configuration. Keep global CSS limited to framework imports, tokens, fonts, and resets. Shared utility strings may live in `src/lib/uiClasses.ts`.

## References

- [Zama Relayer SDK guides](https://docs.zama.org/protocol/relayer-sdk-guides)
- [Zama user decryption example](https://docs.zama.org/protocol/examples/basic/decryption/fhe-user-decrypt-single-value)
- [Zama ACL examples](https://docs.zama.org/protocol/solidity-guides/smart-contract/acl/acl_examples)
- [PoolTogether V5 design](https://dev.pooltogether.com/protocol/design/)
