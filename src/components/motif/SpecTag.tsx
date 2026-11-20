import clsx from "clsx";

type SpecTagProps = {
  children: React.ReactNode;
  className?: string;
  as?: "span" | "p" | "div";
};

/**
 * Mono spec-sheet eyebrow with drafting corner ticks.
 * Replaces rounded-pill eyebrows; content should be a real fact
 * (e.g. "EST. SAN ANTONIO, TX", "6×6 – 16×16 FT").
 */
export default function SpecTag({ children, className, as: Tag = "span" }: SpecTagProps) {
  return (
    <Tag
      className={clsx(
        "motif-spec motif-corners inline-flex items-center gap-2 px-3.5 py-1.5 text-white/70",
        className
      )}
    >
      {children}
    </Tag>
  );
}
