"use client";

import { PrivatePositionCard } from "@/components/PrivatePositionCard";
import { PrizeBoard } from "@/components/PrizeBoard";
import { cardClass } from "@/lib/uiClasses";

export function PrivateDashboard() {
  return (
    <section className={cardClass} aria-label="Private saver dashboard">
      <PrivatePositionCard />
      <PrizeBoard />
    </section>
  );
}
