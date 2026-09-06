import type { Metadata } from "next";
import { vaultPageMetadata } from "@/lib/seo";

type VaultLayoutProps = {
  children: React.ReactNode;
  params: Promise<{ vault: string }>;
};

export async function generateMetadata({
  params,
}: VaultLayoutProps): Promise<Metadata> {
  const { vault } = await params;
  return vaultPageMetadata(vault);
}

export default function VaultLayout({ children }: VaultLayoutProps) {
  return children;
}
