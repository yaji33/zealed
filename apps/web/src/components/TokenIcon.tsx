import Image, { type StaticImageData } from "next/image";
import type { Address } from "viem";
import bron from "@/assets/tokens/bron.png";
import eth from "@/assets/tokens/eth.svg";
import gbp from "@/assets/tokens/gbp.svg";
import usdc from "@/assets/tokens/usdc.svg";
import usdt from "@/assets/tokens/usdt.svg";
import xaut from "@/assets/tokens/xaut.png";
import zama from "@/assets/tokens/zama.png";
import { metaForAsset, metaForSlug, wrapperAccentFor } from "@/lib/wrapperMeta";
import { cn } from "@/lib/utils";

/** Underlying asset marks used to label confidential wrappers (no separate c* logos exist). */
const BY_SLUG: Record<string, StaticImageData> = {
  cusdc: usdc,
  cusdt: usdt,
  cweth: eth,
  czama: zama,
  cxaut: xaut,
  cbron: bron,
  ctgbp: gbp,
};

export function tokenLogoFor(
  asset: Address | string | undefined,
): StaticImageData | undefined {
  const meta = metaForAsset(asset);
  if (!meta) return undefined;
  return BY_SLUG[meta.slug];
}

export function TokenIcon({
  asset,
  slug,
  label,
  size = 36,
  className,
}: {
  asset?: Address | string;
  slug?: string;
  label?: string;
  size?: number;
  className?: string;
}) {
  const meta = asset ? metaForAsset(asset) : slug ? metaForSlug(slug) : undefined;
  const logo = meta ? BY_SLUG[meta.slug] : undefined;
  const text = (label ?? meta?.shortLabel ?? "?").slice(0, 2);
  const dim = `${size}px`;

  if (logo) {
    return (
      <Image
        src={logo}
        alt=""
        width={size}
        height={size}
        className={cn("shrink-0 rounded-full object-cover", className)}
        style={{ width: dim, height: dim }}
      />
    );
  }

  return (
    <span
      className={cn(
        "grid shrink-0 place-items-center rounded-full text-[0.7rem] font-semibold text-void",
        className,
      )}
      style={{
        width: dim,
        height: dim,
        background: wrapperAccentFor(
          typeof asset === "string" ? (asset as Address) : asset,
        ),
      }}
      aria-hidden
    >
      {text}
    </span>
  );
}
