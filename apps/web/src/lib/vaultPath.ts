import { hexToString, type Hex } from "viem";

export const VAULTS_PATH = "/dashboard";
export const FAUCET_PATH = "/dashboard/faucet";

export function slugFromVaultId(id: Hex): string {
  try {
    const slug = hexToString(id, { size: 32 }).replaceAll("\0", "").toLowerCase();
    return slug || id.slice(2, 10).toLowerCase();
  } catch {
    return id.slice(2, 10).toLowerCase();
  }
}

export function vaultWorkspacePath(slug: string): string {
  return `${VAULTS_PATH}/${encodeURIComponent(slug)}`;
}

export function isVaultWorkspacePath(pathname: string): boolean {
  return (
    pathname.startsWith(`${VAULTS_PATH}/`) && !pathname.startsWith(FAUCET_PATH)
  );
}

export function prizeVaultName(label: string): string {
  return `Prize ${label}`;
}
