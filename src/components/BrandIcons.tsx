import type { CSSProperties, SVGProps } from "react";

type BrandIconProps = SVGProps<SVGSVGElement> & {
  style?: CSSProperties;
  size?: number | string;
};

function LetterIcon({
  children,
  className,
  style,
  viewBox = "0 0 24 24",
  size,
  width,
  height,
  ...props
}: BrandIconProps) {
  const w = width ?? size;
  const h = height ?? size;
  return (
    <svg
      viewBox={viewBox}
      fill="none"
      aria-hidden="true"
      className={className}
      style={style}
      width={w}
      height={h}
      {...props}
    >
      <circle cx="12" cy="12" r="10" fill="currentColor" opacity="0.16" />
      <text
        x="12"
        y="15"
        textAnchor="middle"
        fill="currentColor"
        fontFamily="Arial, sans-serif"
        fontSize="11"
        fontWeight="700"
      >
        {children}
      </text>
    </svg>
  );
}

export function FacebookBadgeIcon(props: BrandIconProps) {
  return <LetterIcon {...props}>f</LetterIcon>;
}

export function GoogleBadgeIcon(props: BrandIconProps) {
  return <LetterIcon {...props}>G</LetterIcon>;
}
