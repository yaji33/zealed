export const HOW_IT_WORKS_STEPS = [
  {
    number: "01",
    title: "Deposit",
    body: "Your amount is encrypted before it reaches the contract.",
    visual: "deposit",
  },
  {
    number: "02",
    title: "Prizes",
    body: "Mock yield enters PrizePool only. Principal never funds a tier.",
    visual: "yield",
  },
  {
    number: "03",
    title: "Draw",
    body: "Each slot stores encrypted FHE randomness. You check your own range.",
    visual: "draw",
  },
  {
    number: "04",
    title: "Claim or withdraw",
    body: "Decrypt locally, claim privately, or withdraw anytime.",
    visual: "claim",
  },
] as const;

export const LANDING_FAQ = [
  {
    q: "Can I lose my deposit?",
    a: "No. Principal stays in ConfidentialVault and is withdrawable at any time. Prizes are paid only from PrizePool sponsor-funded mock yield.",
  },
  {
    q: "If balances are encrypted, how can the draw be fair?",
    a: "Each prize slot stores onchain FHE.randEuint64() randomness. Your client compares it to your encrypted range. Fairness does not require publishing your balance.",
  },
  {
    q: "Can anyone tell whether I won?",
    a: "No. A losing check and a winning check look the same onchain. Only you decrypt the result.",
  },
  {
    q: "What can the public actually see?",
    a: "Aggregates only: principal TVL, available prize liquidity, reserve, tier allocations, draw lifecycle, and snapshot versions.",
  },
  {
    q: "What asset does the pool hold?",
    a: "Curated ERC-7984 vaults, one asset each. The Sepolia faucet mints the selected vault's official mock underlying.",
  },
  {
    q: "Is this live?",
    a: "Yes. The verified Sepolia registry lists independent confidential wrapper vaults with isolated principal, draws, and prize liquidity.",
  },
] as const;
