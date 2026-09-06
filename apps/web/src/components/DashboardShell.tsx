"use client";

import dynamic from "next/dynamic";
import { useEffect, type ReactNode } from "react";
import { endAppTransition } from "@/lib/appTransition";
import { prefetchDashboardChunks } from "@/lib/prefetchApp";

const SiteHeader = dynamic(
  () => import("@/components/SiteHeader").then((m) => ({ default: m.SiteHeader })),
  { ssr: false },
);

export function DashboardShell({ children }: { children: ReactNode }) {
  useEffect(() => {
    endAppTransition();
    prefetchDashboardChunks();
  }, []);

  return (
    <div className="min-h-svh bg-base font-dm-sans text-ink">
      <SiteHeader />
      <main
        id="main"
        className="mx-auto w-full max-w-[1160px] px-4 pb-[max(4rem,env(safe-area-inset-bottom))] pt-6 sm:pt-8"
      >
        {children}
      </main>
    </div>
  );
}
