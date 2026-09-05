"use client";

import dynamic from "next/dynamic";

const VaultsDirectory = dynamic(
  () =>
    import("@/components/VaultsDirectory").then((m) => ({
      default: m.VaultsDirectory,
    })),
  { ssr: false },
);

export default function DashboardPage() {
  return <VaultsDirectory />;
}
