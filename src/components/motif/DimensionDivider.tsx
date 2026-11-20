import clsx from "clsx";

function DimensionTerminal({ flip = false }: { flip?: boolean }) {
  return (
    <svg
      viewBox="0 0 14 10"
      className={clsx("h-2.5 w-3.5 flex-none", flip && "-scale-x-100")}
      fill="none"
      stroke="currentColor"
      strokeWidth="1"
    >
      <line x1="1" y1="0" x2="1" y2="10" />
      <path d="M1 5 L9 1.8 M1 5 L9 8.2" />
      <line x1="1" y1="5" x2="14" y2="5" />
    </svg>
  );
}

type DimensionDividerProps = {
  label?: string;
  className?: string;
  tone?: "default" | "quiet";
};

/**
 * Drafting dimension line: |<-------- LABEL -------->|
 * Used as a section divider; label carries a real fact or section marker.
 */
export default function DimensionDivider({ label, className, tone = "default" }: DimensionDividerProps) {
  return (
    <div
      aria-hidden="true"
      className={clsx(
        "flex w-full items-center gap-3",
        tone === "quiet" ? "text-white/30" : "text-white/45",
        className
      )}
    >
      <DimensionTerminal />
      <span className="h-px min-w-4 flex-1 bg-current opacity-60" />
      {label ? <span className="motif-spec whitespace-nowrap text-current">{label}</span> : null}
      <span className="h-px min-w-4 flex-1 bg-current opacity-60" />
      <DimensionTerminal flip />
    </div>
  );
}
