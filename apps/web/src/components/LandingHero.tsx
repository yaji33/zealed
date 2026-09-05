"use client";

import { motion, useReducedMotion } from "framer-motion";
import Link from "next/link";
import { useEffect } from "react";
import AccountBalanceIcon from "@mui/icons-material/AccountBalance";
import { AsciiPoolField } from "@/components/AsciiPoolField";
import { AppIcon } from "@/components/AppIcon";
import { AnchorLink } from "@/components/motion/AnchorLink";
import { LandingStatsBanner } from "@/components/LandingStatsBanner";
import { LaunchAppLink } from "@/components/LaunchAppLink";
import { prefetchApp } from "@/lib/prefetchApp";
import { revealEase } from "@/lib/motionPresets";
import { VAULTS_PATH } from "@/lib/vaultPath";

export function LandingHero() {
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    const timer = window.setTimeout(() => prefetchApp(), 1200);
    return () => window.clearTimeout(timer);
  }, []);

  const headlineVariants = {
    hidden: { opacity: 0, y: 24 },
    visible: (i: number) => ({
      opacity: 1,
      y: 0,
      transition: { duration: 0.65, delay: i * 0.1, ease: revealEase },
    }),
  };

  return (
    <div className="relative z-[1] mx-auto flex w-full max-w-[1160px] flex-col px-6 pb-6 pt-7">
      <header className="flex items-center justify-between font-dm-sans">
        <Link href="/" className="text-2xl font-bold tracking-tight text-ink">
          Zealed
        </Link>
        <nav aria-label="Primary" className="flex items-center gap-[1.4rem] text-[0.85rem] max-[760px]:gap-4">
          <LaunchAppLink href={VAULTS_PATH} className="inline-flex items-center gap-1.5 text-ink">
            <AppIcon icon={AccountBalanceIcon} size={16} />
            Vaults
          </LaunchAppLink>
          <AnchorLink href="#how-it-works" className="text-ink">
            How it works
          </AnchorLink>
          <AnchorLink href="#faq" className="text-ink">
            FAQ
          </AnchorLink>
          <span className="text-ink/55" aria-hidden="true">
            |
          </span>
          <LaunchAppLink className="rounded bg-mint px-[1.15rem] py-[0.55rem] font-medium text-void">
            Launch App
          </LaunchAppLink>
        </nav>
      </header>

      <motion.div
        className="mx-auto mt-6 flex max-w-[40rem] flex-col items-center py-8 text-center max-[760px]:py-6"
        initial={reduceMotion ? false : "hidden"}
        animate="visible"
      >
        <motion.h1
          custom={0}
          variants={headlineVariants}
          className="font-dm-sans text-[clamp(2.6rem,6.5vw,4.6rem)] font-medium leading-[1.08] tracking-tight text-ink"
        >
          Save. Win{" "}
          <em className="font-fraunces italic font-normal text-ember">privately</em>.
        </motion.h1>
        <motion.p
          custom={1}
          variants={headlineVariants}
          className="mt-5 max-w-[28rem] text-[1.02rem] text-ink/90"
        >
          Deposits stay encrypted. Prizes come from a separate sponsor pool.
        </motion.p>
        <motion.div custom={2} variants={headlineVariants} className="mt-2 w-full">
          <LandingStatsBanner />
        </motion.div>
      </motion.div>

      <motion.div
        className="mb-8 mt-2"
        initial={reduceMotion ? false : { opacity: 0, y: 20 }}
        animate={reduceMotion ? undefined : { opacity: 1, y: 0 }}
        transition={{ duration: 0.65, delay: 0.28, ease: revealEase }}
      >
        <AsciiPoolField />
      </motion.div>
    </div>
  );
}
