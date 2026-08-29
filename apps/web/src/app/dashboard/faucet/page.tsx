"use client";

import dynamic from "next/dynamic";

const FaucetApp = dynamic(
  () => import("@/components/FaucetApp").then((m) => ({ default: m.FaucetApp })),
  { ssr: false },
);

export default function FaucetPage() {
  return <FaucetApp />;
}
