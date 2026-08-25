import type { Address } from "viem";

function readAddress(value: string | undefined): Address | undefined {
  const trimmed = value?.trim();
  if (!trimmed || !/^0x[a-fA-F0-9]{40}$/.test(trimmed)) return undefined;
  return trimmed as Address;
}

export const addresses = {
  vault: readAddress(process.env.NEXT_PUBLIC_VAULT_ADDRESS),
  ticketEngine: readAddress(process.env.NEXT_PUBLIC_TICKET_ENGINE_ADDRESS),
  drawManager: readAddress(process.env.NEXT_PUBLIC_DRAW_MANAGER_ADDRESS),
  asset: readAddress(process.env.NEXT_PUBLIC_ASSET_ADDRESS),
} as const;

export const OPERATOR_UNTIL = Number(2n ** 48n - 1n);

export function contractsConfigured(): boolean {
  return Boolean(addresses.vault && addresses.ticketEngine && addresses.drawManager && addresses.asset);
}
