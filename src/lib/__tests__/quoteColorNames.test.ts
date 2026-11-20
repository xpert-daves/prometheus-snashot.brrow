import {
  COLOR_NAME_BY_HEX,
  LEGACY_COLOR_NAME_BY_HEX,
  WIZARD_DEFAULT_WALL_COLOR_HEX,
  formatColorValue,
} from '../../../convex/quoteColorNames';
import {
  brandColors,
  currentBrandColorHex,
  initialQuoteFormParams,
} from '../quoteForm';

describe('owner alert color names', () => {
  it('names every wizard palette color', () => {
    expect(
      Object.fromEntries(brandColors.map((color) => [color.hex, color.name]))
    ).toEqual(COLOR_NAME_BY_HEX);
  });

  it('still names the palette hex values used before the swatch update', () => {
    expect(
      Object.fromEntries(
        brandColors.map((color) => [color.legacyHex, color.name])
      )
    ).toEqual(LEGACY_COLOR_NAME_BY_HEX);
    expect(formatColorValue('#1e90ff')).toBe('Gallery (dark blue)');
  });

  it('treats the off-palette wizard default as an unpicked wall color', () => {
    expect(initialQuoteFormParams.color.toUpperCase()).toBe(
      WIZARD_DEFAULT_WALL_COLOR_HEX
    );
    expect(COLOR_NAME_BY_HEX[WIZARD_DEFAULT_WALL_COLOR_HEX]).toBeUndefined();
    expect(
      LEGACY_COLOR_NAME_BY_HEX[WIZARD_DEFAULT_WALL_COLOR_HEX]
    ).toBeUndefined();
  });
});

describe('currentBrandColorHex', () => {
  it('moves a saved pre-swatch hex to the current palette value', () => {
    expect(currentBrandColorHex('#8b4513')).toBe('#842424');
  });

  it('leaves current palette and off-palette colors alone', () => {
    expect(currentBrandColorHex('#842424')).toBe('#842424');
    expect(currentBrandColorHex('#ffffff')).toBe('#ffffff');
  });
});
