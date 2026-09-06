import type { ReactNode } from "react";
import { bannerClass, bannerOkClass, bannerWarnClass } from "@/lib/uiClasses";

export type StatusKind = "ok" | "err" | "cancel" | "info";

export function StatusNotice({
  kind,
  children,
  className,
}: {
  kind: StatusKind;
  children: ReactNode;
  className?: string;
}) {
  const tone =
    kind === "ok"
      ? bannerOkClass
      : kind === "err"
        ? bannerWarnClass
        : bannerClass;
  return (
    <p
      className={className ? `${tone} ${className}` : tone}
      role={kind === "err" ? "alert" : "status"}
      aria-live="polite"
    >
      {children}
    </p>
  );
}
