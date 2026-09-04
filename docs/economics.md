# Prize economics and accounting

Zealed does not currently integrate a production yield source. For each registered asset, a sponsor
transfers that asset to its `PrizePool` as explicit mock yield. The matching `ConfidentialVault`
principal is held in a separate contract and cannot be allocated or transferred as a prize.

Before allocation, the pool publicly decrypts its own aggregate ERC-7984 balance and synchronizes accounting to that verified value. The configured shares divide available liquidity among three bounded tiers and reserve:

- Grand: one slot;
- Standard: two slots;
- Community: four slots;
- Reserve: retained prize liquidity.

Integer division dust is assigned to reserve. Each slot in a tier receives the same public aggregate allocation. Individual checks and payouts remain encrypted.

After the claim deadline, the pool publicly decrypts its own aggregate balance again. Paid prizes have left that balance; unclaimed allocations remain. Reconciliation preserves the reserve up to the actual balance and rolls the remainder into future available liquidity.

The old `TVL × elapsed time` prize formula is intentionally absent. A delayed keeper cannot synthesize a prize larger than funded prize liquidity, and live TVL is never presented as the source of a historical tier allocation.

Every accounting identity is vault-scoped. Values denominated in different assets must never be added
into a protocol-wide TVL, reserve, or prize figure. The UI changes all principal, prize, tier, and draw
queries together when the selected `vaultId` changes.
