import type { PublicProjectPhoto } from '@/lib/crmProjects.server';
import { getProjectThumbnailImageProps } from '@/lib/projectImages';

const photo: PublicProjectPhoto = {
  url: 'https://example.convex.cloud/api/storage/gallery',
  thumbnailUrl: 'https://example.convex.cloud/api/storage/thumbnail',
  galleryUrl: 'https://example.convex.cloud/api/storage/gallery',
  socialPreviewUrl: 'https://example.convex.cloud/api/storage/social',
  width: 1920,
  height: 1280,
  alt: 'Finished shed',
  filename: 'shed.jpg',
};

describe('project thumbnail delivery', () => {
  it('uses one same-origin width/quality variant for complete, bounded V3 thumbnails', () => {
    expect(getProjectThumbnailImageProps(photo)).toEqual({
      src: '/_next/image?url=https%3A%2F%2Fexample.convex.cloud%2Fapi%2Fstorage%2Fthumbnail&w=828&q=60',
      unoptimized: true,
      fallbackSrc: photo.thumbnailUrl,
    });
  });

  it('encodes the complete source URL without allowing its query to change optimizer parameters', () => {
    const thumbnailUrl = 'https://example.convex.cloud/api/storage/thumbnail?name=a b&w=384&q=100';
    const { src } = getProjectThumbnailImageProps({ ...photo, thumbnailUrl });
    const url = new URL(src, 'https://www.shed210.com');
    expect(url.pathname).toBe('/_next/image');
    expect(url.searchParams.get('url')).toBe(thumbnailUrl);
    expect(url.searchParams.getAll('w')).toEqual(['828']);
    expect(url.searchParams.getAll('q')).toEqual(['60']);
  });

  it('retains the original source and responsive optimizer for legacy photos', () => {
    const legacyPhoto = { url: photo.url, alt: photo.alt, filename: photo.filename };
    expect(getProjectThumbnailImageProps(legacyPhoto)).toEqual({
      src: photo.url,
      unoptimized: false,
    });
  });

  it.each<Partial<PublicProjectPhoto>>([
    { thumbnailUrl: undefined },
    { galleryUrl: undefined },
    { socialPreviewUrl: undefined },
    { width: undefined },
    { height: undefined },
    { width: 0 },
    { height: 1921 },
    { width: Number.NaN },
    { thumbnailUrl: photo.url },
  ])('keeps optimization for incomplete or original image metadata: %j', (overrides) => {
    expect(getProjectThumbnailImageProps({ ...photo, ...overrides }).unoptimized).toBe(false);
    expect(getProjectThumbnailImageProps({ ...photo, ...overrides })).not.toHaveProperty('fallbackSrc');
  });
});
