import clsx from "clsx";

type BlueprintFrameProps = {
  children: React.ReactNode;
  className?: string;
  as?: "div" | "article" | "section" | "aside" | "figure";
};

/**
 * Card wrapper with drafting corner tick marks (`.motif-corners`).
 * Purely decorative framing; keeps whatever surface the child provides.
 */
export default function BlueprintFrame({ children, className, as: Tag = "div" }: BlueprintFrameProps) {
  return <Tag className={clsx("motif-corners", className)}>{children}</Tag>;
}
