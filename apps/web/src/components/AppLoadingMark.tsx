type AppLoadingMarkProps = {
  label?: string;
  fill?: "screen" | "host";
};

export function AppLoadingMark({
  label = "Opening app",
  fill = "screen",
}: AppLoadingMarkProps) {
  const fillClass = fill === "screen" ? "min-h-svh" : "h-full min-h-full";

  return (
    <div
      className={`flex ${fillClass} flex-col items-center justify-center gap-7 bg-void font-dm-sans`}
      role="status"
      aria-live="polite"
      aria-label={label}
    >
      <p className="m-0 text-[1.65rem] font-bold tracking-tight text-ink">
        Zealed
      </p>

      <div className="flex w-40 flex-col items-center gap-3">
        <div
          className="relative h-[2px] w-full overflow-hidden rounded-full bg-ink/12"
          aria-hidden="true"
        >
          <span className="absolute inset-y-0 left-0 w-2/5 rounded-full bg-mint animate-zealed-load" />
        </div>
        <p className="m-0 font-mono text-[0.68rem] tracking-[0.18em] text-muted">
          {label}
        </p>
      </div>
    </div>
  );
}
