"use client";

import { motion, useReducedMotion } from "framer-motion";
import Image from "next/image";
import Link from "next/link";
import { useEffect } from "react";
import AccountBalanceIcon from "@mui/icons-material/AccountBalance";
import bannerBg from "@/assets/banner-bg.png";
import { AppIcon } from "@/components/AppIcon";
import { LandingPrizeLedger } from "@/components/LandingMarketPreview";
import { AnchorLink } from "@/components/motion/AnchorLink";
import { LaunchAppLink } from "@/components/LaunchAppLink";
import { btnClass } from "@/lib/uiClasses";
import { prefetchApp } from "@/lib/prefetchApp";
import { revealEase } from "@/lib/motionPresets";
import { VAULTS_PATH } from "@/lib/vaultPath";

export function LandingHero() {
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    const timer = window.setTimeout(() => prefetchApp(), 1200);
    return () => window.clearTimeout(timer);
  }, []);

  const line = {
    hidden: { opacity: 0, y: 22 },
    visible: (i: number) => ({
      opacity: 1,
      y: 0,
      transition: { duration: 0.7, delay: 0.08 + i * 0.1, ease: revealEase },
    }),
  };

  return (
    <section className="relative flex min-h-svh flex-col overflow-hidden">
      <motion.div
        className="absolute inset-0 z-0"
        initial={reduceMotion ? false : { scale: 1.06, opacity: 0.85 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 1.4, ease: revealEase }}
      >
        <Image
          src={bannerBg}
          alt=""
          fill
          priority
          sizes="100vw"
          className="object-cover object-center"
        />
      </motion.div>

      {/* Readability veil — keeps type legible on the hot left of the plate */}
      <div
        className="pointer-events-none absolute inset-0 z-[1] bg-gradient-to-r from-void/55 via-void/20 to-transparent"
        aria-hidden="true"
      />
      <div
        className="pointer-events-none absolute inset-x-0 bottom-0 z-[1] h-[42%] bg-gradient-to-t from-void/85 via-void/40 to-transparent"
        aria-hidden="true"
      />

      <div className="relative z-10 mx-auto flex w-full max-w-[1160px] flex-1 flex-col px-6 pt-7 pb-8">
        <header className="flex items-center justify-between font-dm-sans">
          <Link
            href="/"
            className="text-2xl font-bold tracking-tight text-ink drop-shadow-sm"
          >
            Zealed
          </Link>
          <nav
            aria-label="Primary"
            className="flex items-center gap-[1.4rem] text-[0.85rem] max-[760px]:gap-4"
          >
            <LaunchAppLink
              href={VAULTS_PATH}
              className="inline-flex items-center gap-1.5 text-ink/90"
            >
              <AppIcon icon={AccountBalanceIcon} size={16} />
              Vaults
            </LaunchAppLink>
            <AnchorLink href="#how-it-works" className="text-ink/90">
              How it works
            </AnchorLink>
            <AnchorLink href="#faq" className="text-ink/90">
              FAQ
            </AnchorLink>
            <span className="text-ink/40" aria-hidden="true">
              |
            </span>
            <LaunchAppLink className={btnClass}>Launch App</LaunchAppLink>
          </nav>
        </header>

        <motion.div
          className="flex max-w-[34rem] flex-1 flex-col justify-center py-16 max-[760px]:py-12"
          initial={reduceMotion ? false : "hidden"}
          animate="visible"
        >
          <motion.h1
            custom={0}
            variants={line}
            className="m-0 font-dm-sans text-[clamp(2.6rem,7vw,4.5rem)] font-medium leading-[1.08] tracking-tight text-ink"
          >
            Save.
            <br />
            Win privately.
          </motion.h1>
          <motion.p
            custom={1}
            variants={line}
            className="mt-4 max-w-[26rem] text-[1.05rem] leading-snug text-ink/80"
          >
            Deposits stay encrypted. Prizes come from a separate sponsor pool.
          </motion.p>
          <motion.div custom={2} variants={line} className="mt-8">
            <LaunchAppLink className={`${btnClass} px-6 py-3 text-[0.95rem]`}>
              Launch App
            </LaunchAppLink>
          </motion.div>
        </motion.div>

        <LandingPrizeLedger />
      </div>
    </section>
  );
}
