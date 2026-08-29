# Zealed web

Next.js 15 frontend for the confidential prize-savings demo.

## Setup

```bash
# from repo root
pnpm install
cp apps/web/.env.example apps/web/.env.local
# fill NEXT_PUBLIC_PRIVY_APP_ID, NEXT_PUBLIC_PRIVY_CLIENT_ID, VAULT, TICKET_ENGINE, DRAW_MANAGER, ASSET
pnpm --filter @zealed/web dev
```

## Views

- `/` — public aggregates + draw history (no wallet)
- `/dashboard` — wallet-gated decrypt / setOperator / deposit / withdraw / checkIfWon / prize decrypt

## Notes

- Deposit requires an explicit `setOperator(vault, …)` step on the cUSDC asset before `deposit`.
- User decryption uses `@zama-fhe/relayer-sdk` 0.4.1 (EIP-712 permit), matching the contracts package pin.
- `revealWin()` is not in the contracts yet — UI deferred until that lands (ask before changing `packages/contracts`).
