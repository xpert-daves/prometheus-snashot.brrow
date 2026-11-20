import {
  QUOTE_VISUAL_DEFAULTS_VERSION,
  WINDOW_CASING_FEET,
  WINDOW_TOP_CLEARANCE_FEET,
  buildQuoteVisualPlacement,
  getVisualWallHeight,
  maxWindowHeightFromFloor,
  type QuoteVisualDoor,
  type QuoteVisualWindow,
} from '@/lib/quoteVisualPlacement';
import type { QuoteParams } from '@/lib/pricing/calculateQuote';

// Widest door trim the preview draws (roll-up header and side posts).
const DOOR_TRIM_FEET = 0.25;

type Rect = { left: number; right: number; bottom: number; top: number };

function windowCasingRect(window: QuoteVisualWindow): Rect {
  return {
    left: window.offset - window.width / 2 - WINDOW_CASING_FEET,
    right: window.offset + window.width / 2 + WINDOW_CASING_FEET,
    bottom: window.heightFromFloor - WINDOW_CASING_FEET,
    top: window.heightFromFloor + window.height + WINDOW_CASING_FEET,
  };
}

function doorRect(door: QuoteVisualDoor): Rect {
  return {
    left: door.offset - door.width / 2 - DOOR_TRIM_FEET,
    right: door.offset + door.width / 2 + DOOR_TRIM_FEET,
    bottom: 0,
    top: door.height + DOOR_TRIM_FEET,
  };
}

function rectsOverlap(a: Rect, b: Rect) {
  return a.left < b.right && b.left < a.right && a.bottom < b.top && b.bottom < a.top;
}

const baseInputs: QuoteParams = {
  structureType: 'storage_shed',
  length: 12,
  width: 8,
  roofStyle: 'gabled',
  wallHeight: 7,
  deliveryRadius: 0,
};

describe('buildQuoteVisualPlacement', () => {
  it('creates deterministic default metadata flags', () => {
    const placement = buildQuoteVisualPlacement(baseInputs);

    expect(placement).toMatchObject({
      version: 1,
      defaultsVersion: QUOTE_VISUAL_DEFAULTS_VERSION,
      customized: false,
    });
    expect(placement.doors[0]).toMatchObject({
      id: 'door-default-single_shed',
      side: 'front',
      offset: 0,
      placement: 'default',
    });
  });

  it('maps door options to front-centered default doors', () => {
    const cases: Array<[QuoteParams['door'], number]> = [
      ['single_shed', 3],
      ['double_shed', 6],
      ['garage_roll_up', 8],
      ['house', 3],
    ];

    for (const [door, width] of cases) {
      const placement = buildQuoteVisualPlacement({ ...baseInputs, door });

      expect(placement.doors).toEqual([
        expect.objectContaining({
          id: `door-default-${door}`,
          side: 'front',
          width,
          height: 6.75,
          offset: 0,
          placement: 'default',
        }),
      ]);
    }
  });

  it('omits doors for open structures', () => {
    expect(
      buildQuoteVisualPlacement({ ...baseInputs, structureType: 'carport' }).doors
    ).toEqual([]);
    expect(
      buildQuoteVisualPlacement({ ...baseInputs, structureType: 'open_loafing' }).doors
    ).toEqual([]);
  });

  it('uses 69 inch doors for 6 foot walls', () => {
    const placement = buildQuoteVisualPlacement({ ...baseInputs, wallHeight: 6 });

    expect(placement.doors[0].height).toBe(5.75);
  });

  it('sizes well-house doors for the fixed 7 ft visual wall, ignoring a stale wall height', () => {
    for (const wallHeight of [6, 8, undefined] as const) {
      const placement = buildQuoteVisualPlacement({
        ...baseInputs,
        structureType: 'well_pump',
        wallHeight,
      });

      expect(placement.doors[0].height).toBe(6.75);
    }
  });

  it('uses fixed visual wall heights only for types without a wall-height input', () => {
    expect(getVisualWallHeight('carport', 6)).toBe(8);
    expect(getVisualWallHeight('open_loafing', 6)).toBe(8);
    expect(getVisualWallHeight('well_pump', 8)).toBe(7);
    expect(getVisualWallHeight('storage_shed', 8)).toBe(8);
    expect(getVisualWallHeight('greenhouse', undefined)).toBe(6);
  });

  it('uses the 6-foot customer default when wall height is omitted', () => {
    const placement = buildQuoteVisualPlacement({
      ...baseInputs,
      wallHeight: undefined,
    });

    expect(placement.doors[0].height).toBe(5.75);
  });

  it('creates no windows without a selected 24x36 window package', () => {
    const placement = buildQuoteVisualPlacement({
      ...baseInputs,
      windowCount: 3,
    });

    expect(placement.windows).toEqual([]);
  });

  it('never puts a default window casing over a door', () => {
    const doors: QuoteParams['door'][] = ['single_shed', 'double_shed', 'garage_roll_up', 'house'];
    const sizes: Array<[number, number]> = [[8, 8], [10, 8], [12, 10]];
    const overlaps: string[] = [];

    for (const door of doors) {
      for (const [length, width] of sizes) {
        for (const wallHeight of [6, 7] as const) {
          for (let windowCount = 1; windowCount <= 8; windowCount += 1) {
            const placement = buildQuoteVisualPlacement({
              ...baseInputs,
              length,
              width,
              wallHeight,
              door,
              windowPackage: '24x36',
              windowCount,
            });

            expect(placement.windows).toHaveLength(windowCount);
            for (const window of placement.windows) {
              for (const placedDoor of placement.doors) {
                if (
                  window.side === placedDoor.side &&
                  rectsOverlap(windowCasingRect(window), doorRect(placedDoor))
                ) {
                  overlaps.push(`${door} ${length}x${width} wall${wallHeight} n=${windowCount} ${window.id}`);
                }
              }
            }
          }
        }
      }
    }

    expect(overlaps).toEqual([]);
  });

  it('skips the door wall when no window fits beside the door', () => {
    const placement = buildQuoteVisualPlacement({
      ...baseInputs,
      length: 10,
      width: 8,
      windowPackage: '24x36',
      windowCount: 5,
    });

    expect(placement.windows.map((window) => window.side)).toEqual([
      'right',
      'left',
      'back',
      'right',
      'left',
    ]);
    expect(placement.windows).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          width: 2,
          height: 3,
          heightFromFloor: 3,
          placement: 'default',
        }),
      ])
    );
  });

  it('places front windows beside the door when the wall has room', () => {
    const placement = buildQuoteVisualPlacement({
      ...baseInputs,
      windowPackage: '24x36',
      windowCount: 8,
    });

    expect(placement.windows.map((window) => window.side)).toEqual([
      'right',
      'left',
      'back',
      'front',
      'right',
      'left',
      'back',
      'front',
    ]);
    expect(
      placement.windows
        .filter((window) => window.side === 'front')
        .map((window) => window.offset)
    ).toEqual([-3.75, 3.75]);
  });

  it('drops the front wall for doors too wide to leave room beside them', () => {
    const placement = buildQuoteVisualPlacement({
      ...baseInputs,
      door: 'double_shed',
      windowPackage: '24x36',
      windowCount: 4,
    });

    expect(placement.windows.map((window) => window.side)).toEqual([
      'right',
      'left',
      'back',
      'right',
    ]);
  });

  it('keeps every wall in the rotation for structures without doors', () => {
    const placement = buildQuoteVisualPlacement({
      ...baseInputs,
      structureType: 'open_loafing',
      windowPackage: '24x36',
      windowCount: 4,
    });

    expect(placement.doors).toEqual([]);
    expect(placement.windows.map((window) => window.side)).toEqual([
      'right',
      'left',
      'back',
      'front',
    ]);
    expect(placement.windows[3].offset).toBe(0);
  });

  it('round-trips default windows beside the door as default placement', () => {
    const inputs = {
      ...baseInputs,
      length: 14,
      windowPackage: '24x36' as const,
      windowCount: 12,
    };
    const defaults = buildQuoteVisualPlacement(inputs);
    const placement = buildQuoteVisualPlacement(inputs, {
      doors: defaults.doors,
      windows: defaults.windows,
    });

    expect(placement.customized).toBe(false);
    expect(placement.windows).toEqual(defaults.windows);
  });

  it('lowers default window sills on 6 foot walls so frames stay below the eave', () => {
    const placement = buildQuoteVisualPlacement({
      ...baseInputs,
      wallHeight: 6,
      windowPackage: '24x36',
      windowCount: 2,
    });

    for (const window of placement.windows) {
      expect(window.heightFromFloor).toBe(2.5);
      expect(window.heightFromFloor + window.height).toBeLessThanOrEqual(
        6 - WINDOW_TOP_CLEARANCE_FEET
      );
    }
  });

  it('clamps saved window heights that would reach the eave', () => {
    const inputs = {
      ...baseInputs,
      wallHeight: 6 as const,
      windowPackage: '24x36' as const,
      windowCount: 1,
    };
    const defaults = buildQuoteVisualPlacement(inputs);
    const placement = buildQuoteVisualPlacement(inputs, {
      doors: defaults.doors,
      windows: [{ ...defaults.windows[0], heightFromFloor: 3, placement: 'default' }],
    });

    expect(placement.windows[0].heightFromFloor).toBe(2.5);
    expect(placement.windows[0].placement).toBe('default');
    expect(maxWindowHeightFromFloor(8, 3)).toBe(4.5);
  });

  it('clamps repeated window offsets within the wall span', () => {
    const placement = buildQuoteVisualPlacement({
      ...baseInputs,
      length: 6,
      width: 6,
      windowPackage: '24x36',
      windowCount: 20,
    });

    expect(placement.windows).toHaveLength(20);
    for (const window of placement.windows) {
      expect(Math.abs(window.offset)).toBeLessThanOrEqual(1.5);
    }
  });

  it('is deterministic for identical inputs', () => {
    const inputs = {
      ...baseInputs,
      door: 'double_shed' as const,
      windowPackage: '24x36' as const,
      windowCount: 5,
    };

    expect(buildQuoteVisualPlacement(inputs)).toEqual(buildQuoteVisualPlacement(inputs));
  });

  it('persists moved feature positions as customized placement', () => {
    const defaults = buildQuoteVisualPlacement({
      ...baseInputs,
      door: 'garage_roll_up',
      windowPackage: '24x36',
      windowCount: 2,
    });
    const placement = buildQuoteVisualPlacement(
      {
        ...baseInputs,
        door: 'garage_roll_up',
        windowPackage: '24x36',
        windowCount: 2,
      },
      {
        doors: [{ ...defaults.doors[0], offset: 99, placement: 'custom' }],
        windows: [
          { ...defaults.windows[0], offset: 1.25, heightFromFloor: 2.5, placement: 'custom' },
          defaults.windows[1],
        ],
      }
    );

    expect(placement.customized).toBe(true);
    expect(placement.doors[0]).toMatchObject({
      offset: 1.5,
      placement: 'custom',
    });
    expect(placement.windows[0]).toMatchObject({
      offset: 1.25,
      heightFromFloor: 2.5,
      placement: 'custom',
    });
    expect(placement.windows[1].placement).toBe('default');
  });

  it('persists features dragged to different walls', () => {
    const defaults = buildQuoteVisualPlacement({
      ...baseInputs,
      door: 'single_shed',
      windowPackage: '24x36',
      windowCount: 1,
    });
    const placement = buildQuoteVisualPlacement(
      {
        ...baseInputs,
        door: 'single_shed',
        windowPackage: '24x36',
        windowCount: 1,
      },
      {
        doors: [
          {
            ...defaults.doors[0],
            side: 'left',
            offset: 99,
            placement: 'custom',
          },
        ],
        windows: [
          {
            ...defaults.windows[0],
            side: 'back',
            offset: -99,
            placement: 'custom',
          },
        ],
      }
    );

    expect(placement.customized).toBe(true);
    expect(placement.doors[0]).toMatchObject({
      side: 'left',
      offset: 2,
      placement: 'custom',
    });
    expect(placement.windows[0]).toMatchObject({
      side: 'back',
      offset: -4.5,
      placement: 'custom',
    });
  });

  it('falls back to deterministic defaults when submitted features do not match defaults', () => {
    const placement = buildQuoteVisualPlacement(
      {
        ...baseInputs,
        windowPackage: '24x36',
        windowCount: 1,
      },
      {
        doors: [],
        windows: [],
      }
    );

    expect(placement.customized).toBe(false);
    expect(placement.doors).toHaveLength(1);
    expect(placement.windows).toHaveLength(1);
    expect(placement.doors[0].placement).toBe('default');
    expect(placement.windows[0].placement).toBe('default');
  });
});
