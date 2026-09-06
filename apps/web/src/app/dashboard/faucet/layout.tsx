import type { Metadata } from "next";
import { routeMetadata } from "@/lib/seo";

export const metadata: Metadata = routeMetadata("faucet");

export default function FaucetLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
