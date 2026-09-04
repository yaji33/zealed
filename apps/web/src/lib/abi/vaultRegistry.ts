export const vaultRegistryAbi = [
  {
    type: "function",
    name: "vaultCount",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "count", type: "uint256" }],
  },
  {
    type: "function",
    name: "vaultIdAt",
    stateMutability: "view",
    inputs: [{ name: "index", type: "uint256" }],
    outputs: [{ name: "vaultId", type: "bytes32" }],
  },
  {
    type: "function",
    name: "getVault",
    stateMutability: "view",
    inputs: [{ name: "vaultId", type: "bytes32" }],
    outputs: [
      {
        name: "system",
        type: "tuple",
        components: [
          { name: "asset", type: "address" },
          { name: "vault", type: "address" },
          { name: "ticketEngine", type: "address" },
          { name: "prizePool", type: "address" },
          { name: "drawManager", type: "address" },
          { name: "active", type: "bool" },
        ],
      },
    ],
  },
] as const;
