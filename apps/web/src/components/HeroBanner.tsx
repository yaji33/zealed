import Image from "next/image";
import type { ReactNode } from "react";
import bannerBg from "@/assets/banner-bg.webp";

export function HeroBanner({
  icon,
  headline,
  line,
  cta,
  visual,
}: {
  icon?: ReactNode;
  headline: ReactNode;
  line?: ReactNode;
  cta?: ReactNode;
  visual?: ReactNode;
}) {
  return (
    <section className="relative mb-5 overflow-hidden rounded-lg border-0 bg-transparent p-6 shadow-none sm:p-8">
      <Image
        src={bannerBg}
        alt=""
        fill
        priority
        sizes="100vw"
        className="pointer-events-none z-0 object-cover object-bottom"
      />
      <div className="relative z-10 flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-start gap-4">
          {icon ? (
            <span className="mt-0.5 grid h-11 w-11 shrink-0 place-items-center rounded-lg bg-void/40 text-mint backdrop-blur-sm">
              {icon}
            </span>
          ) : null}
          <div className="min-w-0">
            <h1 className="m-0 font-dm-sans text-[clamp(1.5rem,3.2vw,2.15rem)] font-medium tracking-tight text-ink">
              {headline}
            </h1>
            {line ? (
              <p className="mt-2 max-w-xl text-[0.95rem] leading-snug text-ink/75">
                {line}
              </p>
            ) : null}
          </div>
        </div>
        <div className="flex w-full shrink-0 flex-wrap items-center gap-3 sm:w-auto">
          {cta}
          {visual}
        </div>
      </div>
    </section>
  );
}
