import { fireEvent, render, screen } from '@testing-library/react';
import ProjectShowcaseCard from '@/components/ProjectShowcaseCard';
import { getProjectThumbnailImageProps } from '@/lib/projectImages';

describe('ProjectShowcaseCard image delivery', () => {
  it.each(['grid', 'overlay'] as const)('shares the canonical thumbnail variant in the %s layout without nesting optimizer URLs', (layout) => {
    const photo = {
      url: 'https://example.convex.cloud/api/storage/gallery',
      thumbnailUrl: 'https://example.convex.cloud/api/storage/thumbnail',
      galleryUrl: 'https://example.convex.cloud/api/storage/gallery',
      socialPreviewUrl: 'https://example.convex.cloud/api/storage/social',
      width: 1920,
      height: 1280,
      alt: 'Finished shed',
      filename: 'shed.jpg',
    };
    render(<ProjectShowcaseCard layout={layout} item={{
      ...getProjectThumbnailImageProps(photo),
      alt: photo.alt,
      city: 'San Antonio',
      eyebrow: 'September 2026',
      title: 'Garden shed',
      href: '/gallery',
      linkLabel: 'View shed',
    }} />);

    const image = screen.getByRole('img', { name: photo.alt });
    const imageUrl = new URL(image.getAttribute('src')!, 'https://www.shed210.com');
    expect(imageUrl.pathname).toBe('/_next/image');
    expect(imageUrl.searchParams.get('url')).toBe(photo.thumbnailUrl);
    expect(imageUrl.searchParams.get('w')).toBe('828');
    expect(imageUrl.searchParams.get('q')).toBe('60');
    expect(image).not.toHaveAttribute('srcset');
    fireEvent.error(image);
    expect(image).toHaveAttribute('src', photo.thumbnailUrl);
    expect(image).not.toHaveAttribute('srcset');
  });
});
