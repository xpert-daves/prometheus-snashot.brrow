"use client";

import Image, { type ImageProps } from "next/image";
import { useState } from "react";

type ProjectThumbnailImageProps = ImageProps & {
  fallbackSrc?: string;
};

function ThumbnailImage({
  src,
  alt,
  fallbackSrc,
  unoptimized,
  overrideSrc,
  onError,
  ...props
}: ProjectThumbnailImageProps) {
  const [usingFallback, setUsingFallback] = useState(false);

  return (
    <Image
      {...props}
      alt={alt}
      src={usingFallback && fallbackSrc ? fallbackSrc : src}
      overrideSrc={usingFallback ? undefined : overrideSrc}
      unoptimized={usingFallback ? true : unoptimized}
      onError={fallbackSrc ? (event) => {
        onError?.(event);
        if (!usingFallback && fallbackSrc && fallbackSrc !== src) {
          setUsingFallback(true);
        }
      } : onError}
    />
  );
}

export default function ProjectThumbnailImage(props: ProjectThumbnailImageProps) {
  const primarySrc = typeof props.src === "string"
    ? props.src
    : "default" in props.src ? props.src.default.src : props.src.src;
  // A different photo starts with its normal indexable source again. The keyed
  // state also avoids retrying the optimizer if the bounded fallback fails.
  return <ThumbnailImage key={primarySrc} {...props} />;
}
