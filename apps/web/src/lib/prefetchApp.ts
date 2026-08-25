export function prefetchDashboardChunks(): void {
  void import("@/components/PrivateDashboard");
  void import("@/components/PublicOverview");
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
