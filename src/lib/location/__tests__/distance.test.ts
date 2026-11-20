import { SHED210_DELIVERY_ORIGIN, haversineDistanceMiles } from '../distance';

describe('haversineDistanceMiles', () => {
  it('returns zero for identical coordinates', () => {
    const { lat, lng } = SHED210_DELIVERY_ORIGIN;
    const result = haversineDistanceMiles(lat, lng, lat, lng);
    expect(result).toBeCloseTo(0);
  });

  it('calculates distance from the build origin to Austin', () => {
    const { lat, lng } = SHED210_DELIVERY_ORIGIN;
    const distance = haversineDistanceMiles(lat, lng, 30.2672, -97.7431);
    expect(distance).toBeCloseTo(73.4, 1);
  });

  it('calculates distance from the build origin to Houston', () => {
    const { lat, lng } = SHED210_DELIVERY_ORIGIN;
    const distance = haversineDistanceMiles(lat, lng, 29.7604, -95.3698);
    expect(distance).toBeCloseTo(186, 1);
  });
});
