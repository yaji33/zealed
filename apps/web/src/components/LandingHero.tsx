"use client";

import { motion, useReducedMotion } from "framer-motion";
import Link from "next/link";
import { AsciiPoolField } from "@/components/AsciiPoolField";
import { AnchorLink } from "@/components/motion/AnchorLink";
import { revealEase } from "@/lib/motionPresets";

export function LandingHero() {
  const reduceMotion = useReducedMotion();

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
        <nav className="flex items-center gap-[1.4rem] text-[0.85rem] max-[760px]:gap-4">
          <AnchorLink href="#how-it-works" className="text-ink">
            How it works
          </AnchorLink>
          <AnchorLink href="#faq" className="text-ink">
            FAQ
          </AnchorLink>
          <span className="text-ink/55" aria-hidden="true">
            |
          </span>
          <Link
            href="/dashboard"
            className="rounded bg-mint px-[1.15rem] py-[0.55rem] font-medium text-void"
          >
            Launch App
          </Link>
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
          Save together.
          <br />
          Win in{" "}
          <em className="font-fraunces italic font-normal text-ember">private</em>.
        </motion.h1>
        <motion.p
          custom={1}
          variants={headlineVariants}
          className="mt-6 max-w-[30rem] text-[1.02rem] text-ink/90"
        >
          Deposit into a shared pool. Yield funds the prize. Your balance stays encrypted, and only
          you can see if you won.
        </motion.p>
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
