export const cardClass =
  "relative mb-5 overflow-hidden rounded-lg border border-edge bg-surface p-6 sm:p-8";

export const sectionRuleClass = "my-10 h-px bg-line";

export const panelPrivateClass = cardClass;

export const ledeClass = "m-0 text-[0.92rem] leading-relaxed text-muted";

export const sectionTitleClass =
  "relative m-0 font-dm-sans text-[1.35rem] font-medium leading-snug text-ink";

export const statGridClass =
  "relative my-5 grid grid-cols-[repeat(auto-fit,minmax(160px,1fr))] gap-[0.85rem]";

export const statCardClass =
  "relative overflow-hidden rounded-lg border border-edge bg-surface p-6";

export const statPublicClass = statCardClass;

export const statPrivateClass = statCardClass;

export const statLabelClass = "relative m-0 text-[0.82rem] font-medium text-muted";

export const statValueClass =
  "relative my-2 flex items-baseline font-dm-sans text-4xl font-semibold tabular-nums";

export const statUnitClass = "ml-[0.35em] text-[0.42em] font-medium text-muted";

export const statNoteClass = "relative m-0 text-[0.8rem] leading-snug text-muted";

export const btnClass =
  "cursor-pointer appearance-none rounded bg-mint px-[1.15rem] py-[0.55rem] font-dm-sans font-medium text-void disabled:cursor-not-allowed disabled:opacity-45";

export const btnSecondaryClass =
  "cursor-pointer appearance-none rounded border border-line/50 bg-transparent px-[1.15rem] py-[0.55rem] font-dm-sans font-medium text-ink disabled:cursor-not-allowed disabled:opacity-45";

export const bannerClass =
  "relative mt-4 rounded-lg bg-soft/80 px-[0.9rem] py-3 text-[0.92rem] text-muted";

export const bannerWarnClass = `${bannerClass} text-[#f0c2b8]`;

export const bannerOkClass = `${bannerClass} text-[#c8ebd4]`;

export const actionCardClass =
  "relative mt-4 overflow-hidden rounded-lg border border-edge bg-surface";

export const actionTabListClass =
  "relative m-0 flex list-none items-end gap-7 border-b border-line px-5";

export const actionTabClass =
  "relative inline-flex items-center gap-1.5 cursor-pointer appearance-none rounded-none border-0 bg-transparent px-0 pb-3 pt-3.5 font-dm-sans text-[0.92rem] font-medium text-muted transition-colors after:pointer-events-none after:absolute after:inset-x-0 after:bottom-0 after:h-0.5 after:bg-transparent after:content-[''] after:transition-colors [&:not([aria-selected='true'])]:hover:text-ink [&:not([aria-selected='true'])]:hover:after:bg-ember/40";

export const actionTabActiveClass = "text-ember after:bg-ember";

export const actionPanelClass =
  "relative p-5 [&_h3]:relative [&_h3]:mb-1 [&_h3]:mt-0 [&_h3]:font-dm-sans [&_h3]:text-[1.1rem] [&_h3]:font-medium [&_p]:relative [&_p]:mb-3 [&_p]:mt-0 [&_p]:text-[0.88rem] [&_p]:leading-relaxed [&_p]:text-muted";

export const fieldClass =
  "relative mb-3 grid gap-1.5 text-[0.85rem] text-muted [&_input]:rounded-lg [&_input]:border [&_input]:border-line/40 [&_input]:bg-base [&_input]:p-[0.65rem_0.75rem] [&_input]:font-inherit [&_input]:text-ink";

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
