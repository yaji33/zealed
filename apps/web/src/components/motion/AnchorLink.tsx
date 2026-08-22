"use client";

import { type MouseEvent, type ReactNode } from "react";
import { dispatchNavigateEvent } from "@/lib/motionPresets";

type AnchorLinkProps = {
  href: string;
  className?: string;
  children: ReactNode;
};

export function AnchorLink({ href, className, children }: AnchorLinkProps) {
  const handleClick = (event: MouseEvent<HTMLAnchorElement>) => {
    if (!href.startsWith("#")) return;

    const id = href.slice(1);
    const target = document.getElementById(id);
    if (!target) return;

    event.preventDefault();
    target.scrollIntoView({ behavior: "smooth", block: "start" });
    window.history.pushState(null, "", href);
    dispatchNavigateEvent();
  };

  return (
    <a href={href} className={className} onClick={handleClick}>
      {children}
    </a>
  );
}
