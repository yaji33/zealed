"use client";

import { motion, useReducedMotion } from "framer-motion";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useId, useState } from "react";
import CloseIcon from "@mui/icons-material/Close";
import MenuIcon from "@mui/icons-material/Menu";
import bannerBg from "@/assets/banner-bg.png";
import { AppIcon } from "@/components/AppIcon";
import { LandingPrizeLedger } from "@/components/LandingMarketPreview";
import { AnchorLink } from "@/components/motion/AnchorLink";
import { LaunchAppLink } from "@/components/LaunchAppLink";
import { btnClass } from "@/lib/uiClasses";
import { prefetchApp } from "@/lib/prefetchApp";
import { revealEase } from "@/lib/motionPresets";

export function LandingHero() {
  const reduceMotion = useReducedMotion();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuId = useId();

  useEffect(() => {
    const timer = window.setTimeout(() => prefetchApp(), 1200);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!menuOpen) return;

    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMenuOpen(false);
    };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [menuOpen]);

  const closeMenu = () => setMenuOpen(false);

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

      <div
        className="pointer-events-none absolute inset-0 z-[1] bg-gradient-to-r from-void/55 via-void/20 to-transparent"
        aria-hidden="true"
      />
      <div
        className="pointer-events-none absolute inset-x-0 bottom-0 z-[1] h-[42%] bg-gradient-to-t from-void/85 via-void/40 to-transparent"
        aria-hidden="true"
      />

      <div className="relative z-10 mx-auto flex w-full max-w-[1160px] flex-1 flex-col px-6 pt-7 pb-8">
        <header className="relative z-20 flex items-center justify-between font-dm-sans">
          <Link
            href="/"
            className="text-2xl font-bold tracking-tight text-ink drop-shadow-sm"
            onClick={closeMenu}
          >
            Zealed
          </Link>

          <nav
            aria-label="Primary"
            className="hidden items-center gap-[1.4rem] text-[0.85rem] md:flex"
          >
            <AnchorLink
              href="#how-it-works"
              className="cursor-pointer text-ink/90 transition-colors hover:text-mint"
            >
              How it works
            </AnchorLink>
            <AnchorLink
              href="#faq"
              className="cursor-pointer text-ink/90 transition-colors hover:text-mint"
            >
              FAQ
            </AnchorLink>
            <span className="text-ink/40" aria-hidden="true">
              |
            </span>
            <LaunchAppLink
              className={`${btnClass} cursor-pointer transition-[filter] hover:brightness-110`}
            >
              Launch App
            </LaunchAppLink>
          </nav>

          <button
            type="button"
            className="inline-flex h-10 w-10 cursor-pointer items-center justify-center rounded text-ink transition-colors hover:text-mint md:hidden"
            aria-expanded={menuOpen}
            aria-controls={menuId}
            aria-label={menuOpen ? "Close menu" : "Open menu"}
            onClick={() => setMenuOpen((open) => !open)}
          >
            <AppIcon icon={menuOpen ? CloseIcon : MenuIcon} size={24} />
          </button>
        </header>

        {menuOpen ? (
          <div
            id={menuId}
            className="fixed inset-0 z-[18] flex flex-col bg-void pt-[4.75rem] md:hidden"
          >
            <nav
              aria-label="Mobile"
              className="flex flex-1 flex-col px-6 pb-10"
            >
              <AnchorLink
                href="#how-it-works"
                className="cursor-pointer border-b border-ink/10 py-5 text-[1.15rem] text-ink transition-colors hover:text-mint"
                onClick={closeMenu}
              >
                How it works
              </AnchorLink>
              <AnchorLink
                href="#faq"
                className="cursor-pointer border-b border-ink/10 py-5 text-[1.15rem] text-ink transition-colors hover:text-mint"
                onClick={closeMenu}
              >
                FAQ
              </AnchorLink>
              <LaunchAppLink
                className={`${btnClass} mt-auto w-full cursor-pointer py-3.5 transition-[filter] hover:brightness-110`}
                onClick={closeMenu}
              >
                Launch App
              </LaunchAppLink>
            </nav>
          </div>
        ) : null}

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
            <LaunchAppLink
              className={`${btnClass} cursor-pointer px-6 py-3 text-[0.95rem] transition-[filter] hover:brightness-110`}
            >
              Launch App
            </LaunchAppLink>
          </motion.div>
        </motion.div>

        <LandingPrizeLedger />
      </div>
    </section>
  );
}
