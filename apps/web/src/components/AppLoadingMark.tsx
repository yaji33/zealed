type AppLoadingMarkProps = {
  label?: string;
  fill?: "screen" | "host";
};

export function AppLoadingMark({ label = "Opening app", fill = "screen" }: AppLoadingMarkProps) {
  const fillClass = fill === "screen" ? "min-h-svh" : "h-full min-h-full";

  return (
    <div className={`flex ${fillClass} flex-col items-center justify-center gap-4 bg-base font-dm-sans`}>
      <p className="animate-pulse font-mono text-[0.72rem] tracking-[0.22em] text-ember/80">
        ZEALED
      </p>
      <p className="font-mono text-[0.68rem] tracking-[0.14em] text-muted">{label}</p>
    </div>
  );
}
