"use client";

import dynamic from "next/dynamic";
import { useParams } from "next/navigation";

const DashboardApp = dynamic(
  () =>
    import("@/components/DashboardApp").then((m) => ({
      default: m.DashboardApp,
    })),
  { ssr: false },
);

export default function VaultWorkspacePage() {
  const params = useParams<{ vault: string }>();
  const slug = typeof params.vault === "string" ? params.vault : "";
  return <DashboardApp slug={slug} />;
}
