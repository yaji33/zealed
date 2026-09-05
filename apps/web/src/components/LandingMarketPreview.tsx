"use client";

import Link from "next/link";
import { motion, useReducedMotion } from "framer-motion";
import { TokenIcon } from "@/components/TokenIcon";
import { useVaultDirectory } from "@/components/VaultDirectoryProvider";
import { useVaultMarketData } from "@/hooks/useVaultMarketData";
import { formatCompactAmount } from "@/lib/format";
import { revealEase } from "@/lib/motionPresets";
import { vaultWorkspacePath } from "@/lib/vaultPath";

/** Six-vault prize ledger: typography + hairlines, not cards. */
export function LandingPrizeLedger() {
  const reduceMotion = useReducedMotion();
  const { selectVault } = useVaultDirectory();
  const { rows, isLoading } = useVaultMarketData();
  const preview = rows.slice(0, 6);

  return (
    <div className="w-full" aria-labelledby="landing-prizes-title">
      <div className="mb-4 flex flex-wrap items-baseline justify-between gap-3">
        <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
          <h2
            id="landing-prizes-title"
            className="m-0 font-mono text-[0.68rem] font-medium tracking-[0.22em] text-ink/70"
          >
            PRIZES BUILDING
          </h2>
          <p className="m-0 font-mono text-[0.65rem] tracking-[0.14em] text-ink/45">
            {isLoading ? "…" : `${rows.length} VAULTS`}
            <span className="mx-2 text-ink/25" aria-hidden="true">
              ·
            </span>
            SEPOLIA
          </p>
        </div>
        <p className="m-0 font-mono text-[0.62rem] tracking-[0.16em] text-ink/40">
          AVAILABLE PRIZE LIQUIDITY
        </p>
      </div>

      <ul
        className={[
          "m-0 grid list-none grid-cols-1 border-t border-ink/15 p-0",
          "divide-y divide-ink/10",
          "sm:grid-cols-3 sm:divide-x sm:divide-y-0",
          "lg:grid-cols-6",
        ].join(" ")}
      >
        {(isLoading && preview.length === 0
          ? Array.from({ length: 6 }, (_, i) => ({ kind: "skel" as const, i }))
          : preview.map((row) => ({ kind: "row" as const, row }))
        ).map((item, index) => {
          if (item.kind === "skel") {
            return (
              <li key={`skel-${item.i}`} className="px-0 py-4 sm:px-5 sm:py-5">
                <span className="font-mono text-[0.65rem] tracking-widest text-ink/40">
                  …
                </span>
              </li>
            );
          }

          const { row } = item;
          const amount =
            row.availablePrizeLiquidity === undefined
              ? "…"
              : formatCompactAmount(
                  row.availablePrizeLiquidity,
                  row.decimals,
                );

          return (
            <motion.li
              key={row.system.id}
              initial={reduceMotion ? false : { opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{
                duration: 0.5,
                delay: 0.32 + index * 0.06,
                ease: revealEase,
              }}
              className="px-0 py-4 sm:px-5 sm:py-5 sm:first:pl-0 lg:last:pr-0"
            >
              <Link
                href={vaultWorkspacePath(row.system.slug)}
                onClick={() => selectVault(row.system.id)}
                className="group flex cursor-pointer items-center justify-between gap-4 text-left no-underline sm:flex-col sm:items-start sm:gap-3"
              >
                <span className="flex items-center gap-2">
                  <TokenIcon
                    asset={row.system.asset}
                    label={row.system.label}
                    size={22}
                  />
                  <span className="font-mono text-[0.62rem] tracking-[0.14em] text-ink/55 transition-colors group-hover:text-mint">
                    {row.system.label}
                  </span>
                </span>
                <span className="font-dm-sans text-[1.5rem] font-semibold leading-none tabular-nums text-ink transition-colors duration-200 group-hover:text-mint sm:text-[clamp(1.35rem,2.2vw,1.75rem)]">
                  {amount}
                </span>
              </Link>
            </motion.li>
          );
        })}
      </ul>
    </div>
  );
}
