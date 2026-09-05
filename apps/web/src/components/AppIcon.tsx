import type { SvgIconComponent } from "@mui/icons-material";

export function AppIcon({
  icon: Icon,
  size = 20,
  className,
}: {
  icon: SvgIconComponent;
  size?: number;
  className?: string;
}) {
  return (
    <Icon
      aria-hidden
      className={className}
      style={{ fontSize: size, width: size, height: size }}
    />
  );
}
