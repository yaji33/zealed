import Image from "next/image";
import logo from "@/assets/zealed-logo.svg";
import { cn } from "@/lib/utils";

export function BrandMark({
  size = 28,
  className,
}: {
  size?: number;
  className?: string;
}) {
  const dim = `${size}px`;
  return (
    <Image
      src={logo}
      alt=""
      width={size}
      height={size}
      className={cn("shrink-0 object-contain", className)}
      style={{ width: dim, height: dim }}
      unoptimized
      aria-hidden
    />
  );
}
