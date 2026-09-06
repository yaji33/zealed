import Link from "next/link";
import type { Metadata } from "next";
import { BrandMark } from "@/components/BrandMark";
import { btnClass, btnSecondaryClass } from "@/lib/uiClasses";
import { FAUCET_PATH, VAULTS_PATH } from "@/lib/vaultPath";
import { ROUTES } from "@/lib/seo";

export const metadata: Metadata = {
  title: ROUTES.notFound.title,
  description: ROUTES.notFound.description,
  robots: { index: false, follow: false },
};

export default function NotFound() {
  return (
    <main
      id="main"
      className="flex min-h-svh flex-col items-center justify-center bg-void px-6 py-16 font-dm-sans text-ink"
    >
      <Link
        href="/"
        className="inline-flex items-center gap-2 text-2xl font-bold tracking-tight text-ink"
      >
        <BrandMark size={40} />
        Zealed
      </Link>
      <p className="mt-16 m-0 font-mono text-[0.68rem] tracking-[0.18em] text-ember/75">
        404
      </p>
      <h1 className="mt-4 text-center font-fraunces text-[clamp(2rem,6vw,3.2rem)] font-medium tracking-tight">
        This page is not here.
      </h1>
      <p className="mt-4 max-w-md text-center text-[1rem] leading-relaxed text-muted">
        The route does not exist. Open vaults to save privately, or go back to
        the start.
      </p>
      <div className="mt-10 flex w-full max-w-sm flex-col gap-3 sm:max-w-none sm:flex-row sm:justify-center">
        <Link className={`${btnClass} min-h-11 justify-center`} href={VAULTS_PATH}>
          Open vaults
        </Link>
        <Link
          className={`${btnSecondaryClass} min-h-11 justify-center`}
          href={FAUCET_PATH}
        >
          Open faucet
        </Link>
        <Link
          className={`${btnSecondaryClass} min-h-11 justify-center`}
          href="/"
        >
          Back home
        </Link>
      </div>
    </main>
  );
}
