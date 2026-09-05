"use client";

import Link from "next/link";
import type { MouseEvent, ReactNode } from "react";
import { startAppTransition } from "@/lib/appTransition";
import { prefetchApp } from "@/lib/prefetchApp";

type LaunchAppLinkProps = {
  href?: string;
  className?: string;
  children: ReactNode;
  onClick?: (event: MouseEvent<HTMLAnchorElement>) => void;
};

export function LaunchAppLink({
  href = "/dashboard",
  className,
  children,
  onClick,
}: LaunchAppLinkProps) {
  return (
    <Link
      href={href}
      className={className}
      onMouseEnter={() => prefetchApp()}
      onFocus={() => prefetchApp()}
      onTouchStart={() => prefetchApp()}
      onClick={(event) => {
        onClick?.(event);
        prefetchApp();
        startAppTransition();
      }}
    >
      {children}
    </Link>
  );
}
