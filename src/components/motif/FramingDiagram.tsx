'use client';

import clsx from "clsx";
import { immediateViewport, useStrokeDraw } from "@/lib/motion";

const HAIRLINE = "rgba(255, 255, 255, 0.42)";
const INK = "rgba(255, 255, 255, 0.68)";

type PathSpec = {
  d: string;
  stroke?: string;
  width?: number;
};

/*
 * Draw order follows the real build sequence: plates, studs, top plates,
 * door framing, then the roof (the single accent stroke), then dimensions.
 */
const FRAME_PATHS: PathSpec[] = [
  // bottom plate (doubled)
  { d: "M70 300 H370 M70 292 H370" },
  // studs
  { d: "M70 292 V108 M120 292 V108 M320 292 V108 M370 292 V108" },
  // double top plate
  { d: "M70 108 H370 M70 100 H370" },
  // door rough opening: king studs + header
  { d: "M170 292 V188 M270 292 V188" },
  { d: "M170 196 H270 M170 188 H270" },
  // collar tie
  { d: "M138 76 H302" },
  // rafters + ridge — the diagram's one accent stroke
  { d: "M54 118 L220 30 L386 118", stroke: "var(--accent)", width: 1.6 },
];

const DIMENSION_PATHS: PathSpec[] = [
  // width: extension lines + dimension line with arrowheads
  { d: "M70 308 V338 M370 308 V338" },
  { d: "M70 332 H190 M250 332 H370 M70 332 l10 -3.5 m-10 3.5 l10 3.5 M370 332 l-10 -3.5 m10 3.5 l-10 3.5" },
  // wall height: extension lines + dimension line
  { d: "M376 300 H408 M376 100 H408" },
  { d: "M402 300 V222 M402 178 V100 M402 300 l-3.5 -10 m3.5 10 l3.5 -10 M402 100 l-3.5 10 m3.5 -10 l3.5 10" },
];

type FramingDiagramProps = {
  className?: string;
};

/**
 * Signature motif: gable shed framing in section view, drawn stroke by
 * stroke like a shop drawing. Decorative only — always pair with
 * aria-hidden on the positioning wrapper.
 */
export default function FramingDiagram({ className }: FramingDiagramProps) {
  const { ref, drawProps } = useStrokeDraw<SVGSVGElement>(immediateViewport);
  let drawIndex = 0;
  const nextIndex = () => drawIndex++;

  const renderPaths = (specs: PathSpec[]) =>
    specs.map((spec) => (
      <path
        key={spec.d}
        d={spec.d}
        pathLength={1}
        stroke={spec.stroke ?? HAIRLINE}
        strokeWidth={spec.width ?? 1}
        vectorEffect="non-scaling-stroke"
        style={{ ["--draw-index" as string]: nextIndex() }}
      />
    ));

  return (
    <svg
      ref={ref}
      {...drawProps}
      viewBox="0 0 440 372"
      fill="none"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={clsx("block h-auto w-full", drawProps.className, className)}
    >
      {renderPaths(FRAME_PATHS)}
      {renderPaths(DIMENSION_PATHS)}
      <g
        fill={INK}
        fontFamily="var(--font-geist-mono)"
        fontSize="12"
        letterSpacing="0.12em"
      >
        <text x="220" y="337" textAnchor="middle" style={{ ["--draw-index" as string]: nextIndex() }}>
          12 FT
        </text>
        <text
          x="402"
          y="200"
          textAnchor="middle"
          transform="rotate(-90 402 200)"
          style={{ ["--draw-index" as string]: nextIndex() }}
        >
          8 FT WALL
        </text>
        <text x="34" y="364" fontSize="10" style={{ ["--draw-index" as string]: nextIndex() }}>
          SHED210 · SAN ANTONIO, TX
        </text>
        <text x="408" y="364" fontSize="10" textAnchor="end" style={{ ["--draw-index" as string]: nextIndex() }}>
          GABLE · DWG 210-A
        </text>
      </g>
    </svg>
  );
}
