"use client";

import { motion, useReducedMotion } from "framer-motion";
import { type ReactNode } from "react";
import { staggerContainerVariants, staggerItemVariants } from "@/lib/motionPresets";

type StaggerGridProps = {
  className?: string;
  children: ReactNode;
};

export function StaggerGrid({ className, children }: StaggerGridProps) {
  const reduceMotion = useReducedMotion();

  if (reduceMotion) {
    return <div className={className}>{children}</div>;
  }

  return (
    <motion.div
      className={className}
      initial="hidden"
      whileInView="visible"
      viewport={{ once: false, amount: 0.12, margin: "0px 0px -6% 0px" }}
      variants={staggerContainerVariants}
    >
      {children}
    </motion.div>
  );
}

type StaggerItemProps = {
  className?: string;
  children: ReactNode;
  as?: "article" | "div";
};

export function StaggerItem({ className, children, as = "article" }: StaggerItemProps) {
  const reduceMotion = useReducedMotion();
  const MotionTag = as === "div" ? motion.div : motion.article;

  if (reduceMotion) {
    const StaticTag = as;
    return <StaticTag className={className}>{children}</StaticTag>;
  }

  return (
    <MotionTag className={className} variants={staggerItemVariants}>
      {children}
    </MotionTag>
  );
}
