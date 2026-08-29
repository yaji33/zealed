"use client";

import dynamic from "next/dynamic";

const DashboardApp = dynamic(
  () => import("@/components/DashboardApp").then((m) => ({ default: m.DashboardApp })),
  { ssr: false },
);

export default function DashboardPage() {
  return <DashboardApp />;
}
