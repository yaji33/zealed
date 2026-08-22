"use client";

import { motion, useReducedMotion } from "framer-motion";
import { useEffect, useState, type ReactNode } from "react";
import { NAVIGATE_EVENT, revealTransition, revealVariants } from "@/lib/motionPresets";

type SectionElement = "section" | "footer" | "div";

type ScrollRevealSectionProps = {
  id?: string;
  className?: string;
  children: ReactNode;
  as?: SectionElement;
  /** Mount animation for above-the-fold content (hero). */
  trigger?: "scroll" | "mount";
  delay?: number;
};

const motionTags = {
  section: motion.section,
  footer: motion.footer,
  div: motion.div,
} as const;

export function ScrollRevealSection({
  id,
  className,
  children,
  as = "section",
  trigger = "scroll",
  delay = 0,
}: ScrollRevealSectionProps) {
  const reduceMotion = useReducedMotion();
  const [navKey, setNavKey] = useState(0);
  const MotionTag = motionTags[as];

  useEffect(() => {
    if (!id) return;

    const bumpIfTarget = () => {
      if (window.location.hash === `#${id}`) {
        setNavKey((key) => key + 1);
      }
    };

    bumpIfTarget();
    window.addEventListener("hashchange", bumpIfTarget);
    window.addEventListener(NAVIGATE_EVENT, bumpIfTarget);
    return () => {
      window.removeEventListener("hashchange", bumpIfTarget);
      window.removeEventListener(NAVIGATE_EVENT, bumpIfTarget);
    };
  }, [id]);

  if (reduceMotion) {
    const StaticTag = as;
    return (
      <StaticTag id={id} className={className}>
        {children}
      </StaticTag>
    );
  }

  const transition = { ...revealTransition, delay };

  if (trigger === "mount") {
    return (
      <MotionTag
        key={navKey}
        id={id}
        className={className}
        initial="hidden"
        animate="visible"
        variants={revealVariants}
        transition={transition}
      >
        {children}
      </MotionTag>
    );
  }

  return (
    <MotionTag
      key={navKey}
      id={id}
      className={className}
      initial="hidden"
      whileInView="visible"
      viewport={{ once: false, amount: 0.14, margin: "0px 0px -6% 0px" }}
      variants={revealVariants}
      transition={transition}
    >
      {children}
    </MotionTag>
  );
}
