"use client";

import Link from "next/link";
import { BrandMark } from "@/components/BrandMark";
import { StatusNotice } from "@/components/StatusNotice";
import { btnClass, btnSecondaryClass } from "@/lib/uiClasses";

export default function ErrorPage({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
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
        ERROR
      </p>
      <h1 className="mt-4 text-center font-fraunces text-[clamp(2rem,6vw,3.2rem)] font-medium tracking-tight">
        Something went wrong.
      </h1>
      <p className="mt-4 max-w-md text-center text-[1rem] leading-relaxed text-muted">
        The page hit an unexpected error. Try again, or return home.
      </p>
      <StatusNotice kind="err" className="max-w-md text-center">
        This request could not be completed. Your funds are not moved by this
        page error.
      </StatusNotice>
      <div className="mt-8 flex w-full max-w-sm flex-col gap-3 sm:max-w-none sm:flex-row sm:justify-center">
        <button
          type="button"
          className={`${btnClass} min-h-11 justify-center`}
          onClick={() => reset()}
        >
          Try again
        </button>
        <Link className={`${btnSecondaryClass} min-h-11 justify-center`} href="/">
          Back home
        </Link>
      </div>
    </main>
  );
}
