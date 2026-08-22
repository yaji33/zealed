import type { Transition, Variants } from "framer-motion";

export const revealEase = [0.22, 1, 0.36, 1] as const;

export const revealTransition: Transition = {
  duration: 0.6,
  ease: revealEase,
};

export const revealVariants: Variants = {
  hidden: { opacity: 0, y: 28 },
  visible: {
    opacity: 1,
    y: 0,
    transition: revealTransition,
  },
};

export const staggerContainerVariants: Variants = {
  hidden: {},
  visible: {
    transition: {
      staggerChildren: 0.09,
      delayChildren: 0.1,
    },
  },
};

export const staggerItemVariants: Variants = {
  hidden: { opacity: 0, y: 22 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.55, ease: revealEase },
  },
};

export const NAVIGATE_EVENT = "zealed:navigate";

export function dispatchNavigateEvent(): void {
  window.dispatchEvent(new Event(NAVIGATE_EVENT));
}
