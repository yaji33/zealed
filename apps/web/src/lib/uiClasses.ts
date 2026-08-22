export const panelClass =
  "mb-5 rounded-panel border border-line bg-gradient-to-b from-white/[0.02] to-transparent bg-elevated p-[1.4rem]";

export const panelPrivateClass = `${panelClass} shadow-[inset_0_0_0_1px_rgba(212,168,75,0.14)]`;

export const eyebrowPublicClass =
  "m-0 text-[0.72rem] font-semibold uppercase tracking-[0.12em] text-public";

export const eyebrowPrivateClass =
  "m-0 text-[0.72rem] font-semibold uppercase tracking-[0.12em] text-private";

export const ledeClass = "m-0 leading-normal text-muted";

export const statGridClass =
  "my-5 grid grid-cols-[repeat(auto-fit,minmax(200px,1fr))] gap-[0.85rem]";

export const statCardClass = "rounded-xl border border-line bg-soft p-4";

export const statPublicClass = `${statCardClass} shadow-[inset_3px_0_0_#5b9fd4]`;

export const statPrivateClass = `${statCardClass} shadow-[inset_3px_0_0_#d4a84b]`;

export const statLabelClass = "m-0 text-[0.85rem] font-medium text-muted";

export const statValueClass =
  "my-2 text-[1.35rem] font-semibold font-mono tabular-nums";

export const statNoteClass = "m-0 text-[0.82rem] leading-snug text-muted";

export const btnClass =
  "cursor-pointer appearance-none rounded-btn border border-transparent bg-accent px-4 py-[0.65rem] font-semibold text-[#14110a] disabled:cursor-not-allowed disabled:opacity-45";

export const btnSecondaryClass =
  "cursor-pointer appearance-none rounded-btn border border-line bg-transparent px-4 py-[0.65rem] font-semibold text-ink disabled:cursor-not-allowed disabled:opacity-45";

export const bannerClass =
  "mt-4 rounded-[10px] border border-line bg-soft px-[0.9rem] py-3 text-[0.92rem] text-muted";

export const bannerWarnClass = `${bannerClass} border-[rgba(216,123,106,0.35)] text-[#f0c2b8]`;

export const bannerOkClass = `${bannerClass} border-[rgba(111,191,138,0.35)] text-[#c8ebd4]`;

export const flowCardClass =
  "mt-4 rounded-xl border border-dashed border-line bg-black/20 p-4 [&_h3]:mb-1 [&_h3]:mt-0 [&_p]:mb-3 [&_p]:mt-0 [&_p]:leading-snug [&_p]:text-muted";

export const fieldClass =
  "mb-3 grid gap-1.5 text-[0.85rem] text-muted [&_input]:rounded-[10px] [&_input]:border [&_input]:border-line [&_input]:bg-void [&_input]:p-[0.65rem_0.75rem] [&_input]:font-inherit [&_input]:text-ink";

export const dataTableClass =
  "w-full border-collapse text-[0.92rem] [&_td]:border-b [&_td]:border-line [&_td]:py-[0.7rem] [&_td]:pr-2 [&_td]:text-left [&_th]:border-b [&_th]:border-line [&_th]:py-[0.7rem] [&_th]:pr-2 [&_th]:text-left [&_th]:font-medium [&_th]:text-muted";

export const pillOkClass =
  "inline-flex rounded-btn border border-[rgba(111,191,138,0.35)] px-[0.55rem] py-[0.15rem] text-[0.78rem] text-ok";

export const pillPendingClass =
  "inline-flex rounded-btn border border-line px-[0.55rem] py-[0.15rem] text-[0.78rem] text-muted";

export const monoClass = "font-mono tabular-nums";
