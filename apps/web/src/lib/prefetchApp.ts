export function prefetchDashboardChunks(): void {
  void import("@/components/PrivateDashboard");
  void import("@/components/VaultChart");
  void import("@/components/FaucetApp");
}

export function warmFheSdk(): void {
  void import("@/lib/fhe").then((mod) => {
    void mod.warmFheSdk();
  });
}

export function prefetchApp(): void {
  prefetchDashboardChunks();
  warmFheSdk();
}
