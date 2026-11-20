import { fireEvent, render, screen } from "@testing-library/react";
import ProjectThumbnailImage from "@/components/ProjectThumbnailImage";
import { getProjectThumbnailImageProps } from "@/lib/projectImages";

const photo = {
  url: "https://example.convex.cloud/api/storage/gallery",
  thumbnailUrl: "https://example.convex.cloud/api/storage/thumbnail",
  galleryUrl: "https://example.convex.cloud/api/storage/gallery",
  socialPreviewUrl: "https://example.convex.cloud/api/storage/social",
  width: 1920,
  height: 1280,
  alt: "Completed garden shed",
  filename: "garden-shed.webp",
};

describe("ProjectThumbnailImage", () => {
  it("keeps the canonical primary source until failure, then uses the bounded direct thumbnail once", () => {
    const imageProps = getProjectThumbnailImageProps(photo);
    const onError = jest.fn();
    render(<ProjectThumbnailImage {...imageProps} width={800} height={600} alt={photo.alt} onError={onError} />);
    const image = screen.getByRole("img", { name: photo.alt });
    expect(new URL(image.getAttribute("src")!, window.location.origin).href).toBe(
      new URL(imageProps.src, window.location.origin).href,
    );
    expect(image).not.toHaveAttribute("srcset");

    fireEvent.error(image);
    expect(image).toHaveAttribute("src", photo.thumbnailUrl);
    expect(image).not.toHaveAttribute("srcset");
    expect(image).not.toHaveAttribute("fallbackSrc");
    fireEvent.error(image);
    expect(image).toHaveAttribute("src", photo.thumbnailUrl);
    expect(onError).toHaveBeenCalledTimes(2);
  });

  it("resets the fallback when the primary photo changes, including returning to an earlier photo", () => {
    const first = getProjectThumbnailImageProps(photo);
    const second = getProjectThumbnailImageProps({ ...photo, thumbnailUrl: `${photo.thumbnailUrl}-two` });
    const { rerender } = render(<ProjectThumbnailImage {...first} width={800} height={600} alt={photo.alt} />);
    fireEvent.error(screen.getByRole("img"));
    expect(screen.getByRole("img")).toHaveAttribute("src", photo.thumbnailUrl);

    rerender(<ProjectThumbnailImage {...second} width={800} height={600} alt={photo.alt} />);
    expect(new URL(screen.getByRole("img").getAttribute("src")!, window.location.origin).href).toBe(
      new URL(second.src, window.location.origin).href,
    );
    fireEvent.error(screen.getByRole("img"));
    expect(screen.getByRole("img")).toHaveAttribute("src", second.fallbackSrc);

    rerender(<ProjectThumbnailImage {...first} width={800} height={600} alt={photo.alt} />);
    expect(new URL(screen.getByRole("img").getAttribute("src")!, window.location.origin).href).toBe(
      new URL(first.src, window.location.origin).href,
    );
  });

  it("never falls back to a legacy original when optimization fails", () => {
    const legacy = { url: photo.url, alt: photo.alt, filename: photo.filename };
    render(<ProjectThumbnailImage {...getProjectThumbnailImageProps(legacy)} width={800} height={600} alt={photo.alt} />);
    const image = screen.getByRole("img");
    const optimizedSrc = image.getAttribute("src");
    const optimizedSrcSet = image.getAttribute("srcset");
    expect(optimizedSrc).toMatch(/^\/_next\/image\?/);
    expect(optimizedSrcSet).toBeTruthy();
    fireEvent.error(image);
    expect(image).toHaveAttribute("src", optimizedSrc);
    expect(image).toHaveAttribute("srcset", optimizedSrcSet);
  });
});
