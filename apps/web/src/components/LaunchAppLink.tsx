"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { startAppTransition } from "@/lib/appTransition";
import { prefetchApp } from "@/lib/prefetchApp";

type LaunchAppLinkProps = {
  href?: string;
  className?: string;
  children: ReactNode;
};

export function LaunchAppLink({
  href = "/dashboard",
  className,
  children,
}: LaunchAppLinkProps) {
  return (
    <Link
      href={href}
      className={className}
      onMouseEnter={() => prefetchApp()}
      onFocus={() => prefetchApp()}
      onTouchStart={() => prefetchApp()}
      onClick={() => {
        prefetchApp();
        startAppTransition();
      }}
    >
      {children}
    </Link>
  );
}
