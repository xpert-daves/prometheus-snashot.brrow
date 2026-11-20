import { useEffect, useRef, useState } from "react";

export const appleEase = "cubic-bezier(0.25, 0.1, 0.25, 1)";
export const appleEaseOut = "cubic-bezier(0.16, 1, 0.3, 1)";
export const appleEaseInOut = "cubic-bezier(0.45, 0, 0.55, 1)";
export const smoothEase = appleEaseOut;

export type RevealOptions = {
  amount?: number;
  margin?: string;
  once?: boolean;
};

export const smoothViewport: RevealOptions = {
  amount: 0.2,
  margin: "0px 0px -10% 0px",
  once: true,
};

export const immediateViewport: RevealOptions = {
  amount: 0.1,
  margin: "0px",
  once: true,
};

export function useRevealInView<T extends Element>(options: RevealOptions = smoothViewport) {
  const ref = useRef<T | null>(null);
  const [visible, setVisible] = useState(process.env.NODE_ENV === "test");

  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    if (typeof IntersectionObserver === "undefined") {
      setVisible(true);
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (!entry) return;
        if (entry.isIntersecting) {
          setVisible(true);
          if (options.once !== false) observer.disconnect();
        } else if (options.once === false) {
          setVisible(false);
        }
      },
      {
        rootMargin: options.margin,
        threshold: options.amount ?? 0,
      }
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, [options.amount, options.margin, options.once]);

  return { ref, visible };
}

/**
 * Stroke draw-in for motif SVGs. Pair with the `.motif-draw` class:
 * strokes stay hidden until the element scrolls into view, then dash-draw
 * with a per-element stagger via `--draw-index`. Reduced motion renders
 * the strokes fully drawn (handled in globals.css).
 */
export function useStrokeDraw<T extends Element>(options: RevealOptions = smoothViewport) {
  const { ref, visible } = useRevealInView<T>(options);
  return {
    ref,
    drawProps: { className: "motif-draw", "data-drawn": visible } as const,
  };
}
