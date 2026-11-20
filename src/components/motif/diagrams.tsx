import clsx from "clsx";

type DiagramProps = {
  className?: string;
  strokeWidth?: number;
  /** Index offset for `.motif-draw` stagger; each path adds one step. */
  drawFrom?: number;
};

type Segment = { d: string };

function diagramPaths(segments: Segment[], drawFrom: number) {
  return segments.map((segment, i) => (
    <path
      key={segment.d}
      d={segment.d}
      pathLength={1}
      vectorEffect="non-scaling-stroke"
      style={{ ["--draw-index" as string]: drawFrom + i }}
    />
  ));
}

function DiagramSvg({
  className,
  strokeWidth = 1,
  children,
  viewBox,
}: {
  className?: string;
  strokeWidth?: number;
  children: React.ReactNode;
  viewBox: string;
}) {
  return (
    <svg
      viewBox={viewBox}
      aria-hidden="true"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={clsx("block", className)}
    >
      {children}
    </svg>
  );
}

/** Gable shed front elevation: walls, ridge roof with overhang, door opening. */
export function GableProfile({ className, strokeWidth, drawFrom = 0 }: DiagramProps) {
  return (
    <DiagramSvg viewBox="0 0 64 48" className={className} strokeWidth={strokeWidth}>
      {diagramPaths(
        [
          { d: "M6 44 H58" },
          { d: "M10 44 V25 M54 44 V25" },
          { d: "M5 27 L32 8 L59 27" },
          { d: "M26 44 V31 H38 V44" },
        ],
        drawFrom
      )}
    </DiagramSvg>
  );
}

/** Gambrel (barn) profile: double-pitch roof. */
export function GambrelProfile({ className, strokeWidth, drawFrom = 0 }: DiagramProps) {
  return (
    <DiagramSvg viewBox="0 0 64 48" className={className} strokeWidth={strokeWidth}>
      {diagramPaths(
        [
          { d: "M6 44 H58" },
          { d: "M10 44 V27 M54 44 V27" },
          { d: "M5 28 L13 14 L32 7 L51 14 L59 28" },
          { d: "M26 44 V32 H38 V44" },
        ],
        drawFrom
      )}
    </DiagramSvg>
  );
}

/** Lean-to profile: single-slope roof, tall side left. */
export function LeanToProfile({ className, strokeWidth, drawFrom = 0 }: DiagramProps) {
  return (
    <DiagramSvg viewBox="0 0 64 48" className={className} strokeWidth={strokeWidth}>
      {diagramPaths(
        [
          { d: "M6 44 H58" },
          { d: "M10 44 V17 M54 44 V26" },
          { d: "M5 15 L59 24" },
          { d: "M26 44 V31 H38 V44" },
        ],
        drawFrom
      )}
    </DiagramSvg>
  );
}

/** Framed stud bay: top/bottom plates with studs at implied 16" OC. */
export function StudBay({ className, strokeWidth, drawFrom = 0 }: DiagramProps) {
  return (
    <DiagramSvg viewBox="0 0 64 48" className={className} strokeWidth={strokeWidth}>
      {diagramPaths(
        [
          { d: "M4 8 H60 M4 12 H60" },
          { d: "M4 40 H60 M4 36 H60" },
          { d: "M8 12 V36 M21 12 V36 M34 12 V36 M47 12 V36 M56 12 V36" },
        ],
        drawFrom
      )}
    </DiagramSvg>
  );
}

/*
 * Build-term icons (40x40). Same drafting stroke as the profiles above,
 * sized for the home page "Why buy from Shed210?" strip.
 */

/** Shed with an X-braced barn door, sun setting on the horizon: built on-site, done by sunset. */
export function SunsetShedIcon({ className, strokeWidth, drawFrom = 0 }: DiagramProps) {
  return (
    <DiagramSvg viewBox="0 0 40 40" className={className} strokeWidth={strokeWidth}>
      {diagramPaths(
        [
          { d: "M4 31 H36" },
          { d: "M7 31 V20.5 M21 31 V20.5" },
          { d: "M5 22 L14 12.5 L23 22" },
          { d: "M10.5 31 V24 H17.5 V31 M10.5 24 L17.5 31 M17.5 24 L10.5 31" },
          { d: "M25.5 31 A4.5 4.5 0 0 1 34.5 31" },
          { d: "M30 25 V23 M34.2 26.8 L35.6 25.4 M25.8 26.8 L24.4 25.4" },
        ],
        drawFrom
      )}
    </DiagramSvg>
  );
}

/** Torn-off receipt with a check: the bill comes once the build is done. */
export function SettledReceiptIcon({ className, strokeWidth, drawFrom = 0 }: DiagramProps) {
  return (
    <DiagramSvg viewBox="0 0 40 40" className={className} strokeWidth={strokeWidth}>
      {diagramPaths(
        [
          { d: "M10 34 V6 H30 V34 L27.5 32 L25 34 L22.5 32 L20 34 L17.5 32 L15 34 L12.5 32 Z" },
          { d: "M14.5 11.5 H25.5 M14.5 15.5 H21.5" },
          { d: "M15 24 L18.5 27.5 L25.5 20.5" },
        ],
        drawFrom
      )}
    </DiagramSvg>
  );
}

/** Carpenter's framing square and pencil: workmanship, measured and laid out by hand. */
export function FramingSquareIcon({ className, strokeWidth, drawFrom = 0 }: DiagramProps) {
  return (
    <DiagramSvg viewBox="0 0 40 40" className={className} strokeWidth={strokeWidth}>
      {diagramPaths(
        [
          { d: "M7 7 H11 V29 H33 V33 H7 Z" },
          { d: "M11 11 H9 M11 15 H9 M11 19 H9 M11 23 H9" },
          { d: "M15 29 V31 M19 29 V31 M23 29 V31 M27 29 V31" },
          { d: "M15.5 25.5 L17.4 21.4 L27.9 10.9 L30.1 13.1 L19.6 23.6 Z M17.4 21.4 L19.6 23.6" },
        ],
        drawFrom
      )}
    </DiagramSvg>
  );
}

/** Corrugated metal sheet shedding rain: the long-life metal the warranty covers. */
export function MetalPanelIcon({ className, strokeWidth, drawFrom = 0 }: DiagramProps) {
  return (
    <DiagramSvg viewBox="0 0 40 40" className={className} strokeWidth={strokeWidth}>
      {diagramPaths(
        [
          {
            d: "M4 18.5 C5.5 18.5 6.5 21.5 8 21.5 S10.5 18.5 12 18.5 S14.5 21.5 16 21.5 S18.5 18.5 20 18.5 S22.5 21.5 24 21.5 S26.5 18.5 28 18.5 S30.5 21.5 32 21.5 S34.5 18.5 36 18.5",
          },
          { d: "M4 18.5 V34 H36 V18.5" },
          { d: "M12 18.5 V34 M20 18.5 V34 M28 18.5 V34" },
          {
            d: "M12 7 L13.6 10.2 A1.8 1.8 0 1 1 10.4 10.2 Z M20 4.5 L21.6 7.7 A1.8 1.8 0 1 1 18.4 7.7 Z M28 7 L29.6 10.2 A1.8 1.8 0 1 1 26.4 10.2 Z",
          },
        ],
        drawFrom
      )}
    </DiagramSvg>
  );
}
