import type { Metadata } from "next";
import { DashboardShell } from "@/components/DashboardShell";
import { ROUTES, SITE_NAME } from "@/lib/seo";

export const metadata: Metadata = {
  title: {
    default: ROUTES.vaults.title,
    template: `%s · ${SITE_NAME}`,
  },
  description: ROUTES.vaults.description,
  alternates: { canonical: ROUTES.vaults.path },
  openGraph: {
    title: ROUTES.vaults.title,
    description: ROUTES.vaults.description,
    url: ROUTES.vaults.path,
  },
};

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <DashboardShell>{children}</DashboardShell>;
}

