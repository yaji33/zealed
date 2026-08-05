# @zealed/contracts

fhEVM Hardhat package for Zealed. Week-1 surface: `ConfidentialVault` (encrypted cUSDC deposit / withdraw + TWAB).

```bash
pnpm --filter @zealed/contracts compile
pnpm --filter @zealed/contracts test
```

Depositors must `setOperator(vault, until)` on the ERC-7984 asset before calling `deposit`. Encrypt inputs against the vault address. Events never include plaintext amounts.
