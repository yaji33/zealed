"use client";

import { SiteHeader } from "@/components/SiteHeader";
import { PrivateDashboard } from "@/components/PrivateDashboard";

export default function DashboardPage() {
  return (
    <div className="mx-auto w-full max-w-[1100px] px-4 pb-16 pt-5">
      <SiteHeader />
      <main>
        <PrivateDashboard />
      </main>
    </div>
  );
}
