"use client";

import Link from "next/link";
import { motion, useReducedMotion } from "framer-motion";
import { TokenIcon } from "@/components/TokenIcon";
import { useVaultDirectory } from "@/components/VaultDirectoryProvider";
import { useVaultMarketData } from "@/hooks/useVaultMarketData";
import { formatCompactAmount } from "@/lib/format";
import { revealEase } from "@/lib/motionPresets";
import { prizeVaultName, vaultWorkspacePath } from "@/lib/vaultPath";

/** Six-vault prize ledger: typography + hairlines, not cards. */
export function LandingPrizeLedger() {
  const reduceMotion = useReducedMotion();
  const { selectVault } = useVaultDirectory();
  const { rows, isLoading } = useVaultMarketData();
  const preview = rows.slice(0, 6);

  return (
    <div className="w-full" aria-labelledby="landing-prizes-title">
      <div className="mb-4 flex flex-wrap items-baseline justify-between gap-3 px-1">
        <div className="flex items-baseline gap-4">
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
        <p className="m-0 hidden font-mono text-[0.62rem] tracking-[0.16em] text-ink/40 sm:block">
          AVAILABLE PRIZE LIQUIDITY
        </p>
      </div>

      <ul className="m-0 grid list-none grid-cols-2 gap-0 border-t border-ink/15 p-0 sm:grid-cols-3 lg:grid-cols-6">
        {(isLoading && preview.length === 0
          ? Array.from({ length: 6 }, (_, i) => ({ kind: "skel" as const, i }))
          : preview.map((row) => ({ kind: "row" as const, row }))
        ).map((item, index) => {
          const cellBorder =
            "border-b border-ink/10 py-5 pr-3 sm:border-b-0 sm:border-r sm:px-4 sm:[&:nth-child(3n)]:border-r-0 lg:border-r lg:[&:nth-child(3n)]:border-r lg:last:border-r-0 lg:last:pr-0 sm:first:pl-0";

          if (item.kind === "skel") {
            return (
              <li key={`skel-${item.i}`} className={cellBorder}>
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
              initial={reduceMotion ? false : { opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{
                duration: 0.55,
                delay: 0.35 + index * 0.07,
                ease: revealEase,
              }}
              className={cellBorder}
            >
              <Link
                href={vaultWorkspacePath(row.system.slug)}
                onClick={() => selectVault(row.system.id)}
                className="group flex h-full flex-col gap-3 text-left no-underline"
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
                <span className="font-dm-sans text-[clamp(1.35rem,2.4vw,1.85rem)] font-semibold leading-none tabular-nums text-ink transition-transform duration-300 group-hover:-translate-y-0.5">
                  {amount}
                </span>
                <span className="font-mono text-[0.6rem] tracking-[0.12em] text-ink/40">
                  {prizeVaultName(row.system.label).toUpperCase()}
                </span>
              </Link>
            </motion.li>
          );
        })}
      </ul>
    </div>
  );
}

