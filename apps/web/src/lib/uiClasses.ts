export const cardClass =
  "relative mb-5 overflow-hidden rounded-lg bg-gradient-to-b from-[#1a1a1a] to-[#0f0f0f] p-6 shadow-[0_12px_40px_rgba(0,0,0,0.45)] sm:p-8";

export const cardHighlightClass =
  "pointer-events-none absolute inset-x-0 top-0 h-28 bg-gradient-to-b from-white/[0.07] to-transparent";

export const panelClass = cardClass;

export const panelPrivateClass = cardClass;

export const ledeClass = "m-0 text-[0.92rem] leading-relaxed text-muted";

export const sectionTitleClass =
  "relative m-0 font-fraunces text-[1.35rem] font-medium leading-snug text-ink";

export const statGridClass =
  "relative my-5 grid grid-cols-[repeat(auto-fit,minmax(160px,1fr))] gap-[0.85rem]";

export const statCardClass =
  "relative overflow-hidden rounded-lg bg-gradient-to-b from-[#1a1a1a] to-[#0f0f0f] p-4 shadow-[0_12px_40px_rgba(0,0,0,0.45)]";

export const statPublicClass = statCardClass;

export const statPrivateClass = statCardClass;

export const statLabelClass = "relative m-0 text-[0.82rem] font-medium text-muted";

export const statValueClass =
  "relative my-2 text-[1.25rem] font-semibold font-mono tabular-nums text-ink";

export const statNoteClass = "relative m-0 text-[0.8rem] leading-snug text-muted";

export const btnClass =
  "cursor-pointer appearance-none rounded bg-mint px-[1.15rem] py-[0.55rem] font-dm-sans font-medium text-void disabled:cursor-not-allowed disabled:opacity-45";

export const btnSecondaryClass =
  "cursor-pointer appearance-none rounded border border-line/50 bg-transparent px-[1.15rem] py-[0.55rem] font-dm-sans font-medium text-ink disabled:cursor-not-allowed disabled:opacity-45";

export const bannerClass =
  "relative mt-4 rounded-lg bg-soft/80 px-[0.9rem] py-3 text-[0.92rem] text-muted";

export const bannerWarnClass = `${bannerClass} text-[#f0c2b8]`;

export const bannerOkClass = `${bannerClass} text-[#c8ebd4]`;

export const flowCardClass =
  "relative mt-4 overflow-hidden rounded-lg bg-gradient-to-b from-[#1a1a1a] to-[#0f0f0f] p-5 shadow-[0_12px_40px_rgba(0,0,0,0.45)] [&_h3]:relative [&_h3]:mb-1 [&_h3]:mt-0 [&_h3]:font-fraunces [&_h3]:text-[1.1rem] [&_h3]:font-medium [&_p]:relative [&_p]:mb-3 [&_p]:mt-0 [&_p]:text-[0.88rem] [&_p]:leading-relaxed [&_p]:text-muted";

export const fieldClass =
  "relative mb-3 grid gap-1.5 text-[0.85rem] text-muted [&_input]:rounded-lg [&_input]:border [&_input]:border-line/40 [&_input]:bg-void [&_input]:p-[0.65rem_0.75rem] [&_input]:font-inherit [&_input]:text-ink";

export const dataTableClass =
  "relative w-full border-collapse text-[0.92rem] [&_td]:border-b [&_td]:border-line/40 [&_td]:py-[0.7rem] [&_td]:pr-2 [&_td]:text-left [&_th]:border-b [&_th]:border-line/40 [&_th]:py-[0.7rem] [&_th]:pr-2 [&_th]:text-left [&_th]:font-medium [&_th]:text-muted";

export const pillOkClass =
  "inline-flex rounded px-[0.55rem] py-[0.15rem] text-[0.78rem] text-ok";

export const pillPendingClass =
  "inline-flex rounded px-[0.55rem] py-[0.15rem] text-[0.78rem] text-muted";

export const monoClass = "font-mono tabular-nums";

export const eyebrowPublicClass =
  "m-0 font-mono text-[0.68rem] font-medium tracking-[0.18em] text-muted";

export const eyebrowPrivateClass = eyebrowPublicClass;
