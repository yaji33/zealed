"use client";

import { useEffect, useState } from "react";
import { AppLoadingMark } from "@/components/AppLoadingMark";
import { subscribeAppTransition, endAppTransition } from "@/lib/appTransition";

export function AppLoadingOverlay() {
  const [pending, setPending] = useState(false);

  useEffect(() => subscribeAppTransition(setPending), []);

  useEffect(() => {
    if (!pending) return;
    const safety = window.setTimeout(() => endAppTransition(), 12_000);
    return () => window.clearTimeout(safety);
  }, [pending]);

  if (!pending) return null;

  return (
    <div
      className="fixed inset-0 z-[200]"
      role="status"
      aria-live="polite"
      aria-label="Opening app"
    >
      <AppLoadingMark fill="host" />
    </div>
  );
}
