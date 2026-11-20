import type { QuoteParams } from '@/lib/pricing/calculateQuote';
import { STANDARD_WALL_HEIGHT } from '@/lib/pricing/pricingData';

// v2: window sills drop on short walls so the frame stays below the eave.
// v3: default windows stay clear of the door; a door wall only gets windows
// when one fits beside the door.
// v4: well houses use a fixed 7 ft visual wall, so their default door is 6'9".
export const QUOTE_VISUAL_DEFAULTS_VERSION = 'quote-visual-defaults-v4';

export type QuoteVisualSide = 'front' | 'back' | 'left' | 'right';
export type QuoteVisualPlacementKind = 'default' | 'custom';

export type QuoteVisualDoor = {
  id: string;
  side: QuoteVisualSide;
  width: number;
  height: number;
  offset: number;
  color?: string;
  placement: QuoteVisualPlacementKind;
};

export type QuoteVisualWindow = {
  id: string;
  side: QuoteVisualSide;
  width: number;
  height: number;
  offset: number;
  heightFromFloor: number;
  placement: QuoteVisualPlacementKind;
};

export type QuoteVisualPlacement = {
  version: 1;
  defaultsVersion: string;
  customized: boolean;
  doors: QuoteVisualDoor[];
  windows: QuoteVisualWindow[];
};

export type QuoteVisualFeatures = {
  doors: QuoteVisualDoor[];
  windows: QuoteVisualWindow[];
};

export type QuoteVisualPlacementInputs = Pick<
  QuoteParams,
  | 'structureType'
  | 'length'
  | 'width'
  | 'roofStyle'
  | 'wallHeight'
  | 'roofMaterial'
  | 'frameGauge'
  | 'windowPackage'
  | 'windowCount'
  | 'ventilation'
  | 'color'
  | 'addOns'
  | 'foundation'
  | 'door'
  | 'siding'
  | 'deliveryRadius'
>;

export type QuoteVisualPreviewParams = Omit<QuoteVisualPlacementInputs, 'door'> & {
  doors: QuoteVisualDoor[];
  windows: QuoteVisualWindow[];
};

const ZERO_DOOR_STRUCTURES: ReadonlySet<QuoteParams['structureType']> = new Set([
  'carport',
  'open_loafing',
]);
const WINDOW_SIDE_ORDER: QuoteVisualSide[] = ['right', 'left', 'back', 'front'];
const WINDOW_WIDTH_FEET = 2;
const WINDOW_HEIGHT_FEET = 3;
const WINDOW_SILL_HEIGHT_FEET = 3;
/** Width of the flat casing boards the preview draws around each window. */
export const WINDOW_CASING_FEET = 0.28;
const FEATURE_MARGIN_FEET = 0.5;
const MIN_WINDOW_SILL_FEET = 0.5;
/**
 * Space kept between the top of the glass and the wall top. The window frame
 * and the eave trim both need room here; without it a 3 ft window on a 3 ft
 * sill reaches the eave of a 6 ft wall and its frame pokes through the roof.
 */
export const WINDOW_TOP_CLEARANCE_FEET = 0.5;

/** Highest sill (feet above floor) that keeps a window clear of the eave. */
export function maxWindowHeightFromFloor(wallHeight: number, windowHeight: number) {
  return Math.max(MIN_WINDOW_SILL_FEET, wallHeight - windowHeight - WINDOW_TOP_CLEARANCE_FEET);
}
const NUMBER_EPSILON = 0.001;

/**
 * Wall heights (feet) the 3D preview draws for structure types whose quote has
 * no wall-height input. Real carports and loafing sheds clear 8 ft; well
 * houses are about 7 ft. Visual only: pricing keeps its own wall height.
 */
export const FIXED_VISUAL_WALL_HEIGHT_FEET: Partial<Record<QuoteParams['structureType'], number>> = {
  carport: 8,
  open_loafing: 8,
  well_pump: 7,
};

/**
 * Wall height (feet) used for the preview and the default door and window
 * placement. Types without a wall-height input ignore the (stale) draft value.
 */
export function getVisualWallHeight(
  structureType: QuoteParams['structureType'] | undefined,
  wallHeight: QuoteParams['wallHeight'] | undefined
) {
  const fixed = structureType ? FIXED_VISUAL_WALL_HEIGHT_FEET[structureType] : undefined;
  return fixed ?? wallHeight ?? STANDARD_WALL_HEIGHT;
}

function wallHeightOrDefault(inputs: Pick<QuoteVisualPlacementInputs, 'structureType' | 'wallHeight'>) {
  return getVisualWallHeight(inputs.structureType, inputs.wallHeight);
}

function defaultDoorHeight(wallHeight: number) {
  return wallHeight >= 7 ? 6.75 : 5.75;
}

function doorWidthForOption(door: QuoteParams['door']) {
  if (door === 'double_shed') return 6;
  if (door === 'garage_roll_up') return 8;
  return 3;
}

function sideSpan(
  side: QuoteVisualSide,
  dimensions: Pick<QuoteVisualPlacementInputs, 'length' | 'width'>
) {
  return side === 'front' || side === 'back' ? dimensions.length : dimensions.width;
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function clampOffset(
  side: QuoteVisualSide,
  dimensions: Pick<QuoteVisualPlacementInputs, 'length' | 'width'>,
  featureWidth: number,
  offset: number
) {
  const span = sideSpan(side, dimensions);
  const maxAbs = Math.max(0, span / 2 - featureWidth / 2 - FEATURE_MARGIN_FEET);
  return clamp(offset, -maxAbs, maxAbs);
}

function roundPlacementValue(value: number) {
  return Math.round(value * 1000) / 1000;
}

function samePlacementNumber(left: number, right: number) {
  return Math.abs(left - right) < NUMBER_EPSILON;
}

function findMatchingFeature<T extends { id: string }>(
  features: T[] | undefined,
  defaults: T[]
) {
  if (!features || features.length !== defaults.length) return null;

  const byId = new Map(features.map((feature) => [feature.id, feature]));
  const matched = defaults.map((feature) => byId.get(feature.id));
  if (matched.some((feature) => feature === undefined)) return null;
  return matched as T[];
}

function buildDoors(inputs: QuoteVisualPlacementInputs): QuoteVisualDoor[] {
  if (ZERO_DOOR_STRUCTURES.has(inputs.structureType)) return [];

  const door = inputs.door ?? 'single_shed';
  const wallHeight = wallHeightOrDefault(inputs);
  const width = doorWidthForOption(door);

  return [
    {
      id: `door-default-${door}`,
      side: 'front',
      width,
      height: defaultDoorHeight(wallHeight),
      offset: 0,
      placement: 'default',
    },
  ];
}

type WindowZone = { min: number; max: number };

/**
 * Ranges of window-centre offsets on a door wall that keep the window casing
 * a full margin away from every door and from the wall ends.
 */
function windowZonesBesideDoors(span: number, sideDoors: QuoteVisualDoor[]) {
  const clearance = WINDOW_WIDTH_FEET / 2 + WINDOW_CASING_FEET + FEATURE_MARGIN_FEET;
  const zones: WindowZone[] = [];
  let openFrom = -span / 2;

  for (const door of [...sideDoors].sort((a, b) => a.offset - b.offset)) {
    zones.push({ min: openFrom + clearance, max: door.offset - door.width / 2 - clearance });
    openFrom = Math.max(openFrom, door.offset + door.width / 2);
  }
  zones.push({ min: openFrom + clearance, max: span / 2 - clearance });

  return zones.filter((zone) => zone.max >= zone.min);
}

// Skipping a door wall puts its share of windows on the side walls, so 7-8
// windows on a shed with sides of 8 ft or less overlap there by design.
function windowSidesClearOfDoors(doorZones: Map<QuoteVisualSide, WindowZone[]>) {
  const sides = WINDOW_SIDE_ORDER.filter((side) => {
    const zones = doorZones.get(side);
    return !zones || zones.length > 0;
  });
  return sides.length > 0 ? sides : WINDOW_SIDE_ORDER;
}

function groupWindowIndexes(windowCount: number, sideOrder: QuoteVisualSide[]) {
  const groups = new Map<QuoteVisualSide, number[]>();

  for (let index = 0; index < windowCount; index += 1) {
    const side = sideOrder[index % sideOrder.length];
    const indexes = groups.get(side) ?? [];
    indexes.push(index);
    groups.set(side, indexes);
  }

  return groups;
}

function offsetForWindowOnSide(args: {
  side: QuoteVisualSide;
  indexOnSide: number;
  countOnSide: number;
  dimensions: Pick<QuoteVisualPlacementInputs, 'length' | 'width'>;
}) {
  if (args.countOnSide <= 1) return 0;

  const span = sideSpan(args.side, args.dimensions);
  const maxAbs = Math.max(0, span / 2 - WINDOW_WIDTH_FEET / 2 - FEATURE_MARGIN_FEET);
  if (maxAbs === 0) return 0;

  const min = -maxAbs;
  const step = (maxAbs * 2) / (args.countOnSide - 1);
  return clampOffset(
    args.side,
    args.dimensions,
    WINDOW_WIDTH_FEET,
    min + step * args.indexOnSide
  );
}

function offsetForWindowBesideDoors(args: {
  zones: WindowZone[];
  indexOnSide: number;
  countOnSide: number;
}) {
  // Alternate windows across the free zones, then spread each zone's share.
  const zoneIndex = args.indexOnSide % args.zones.length;
  const zone = args.zones[zoneIndex];
  const indexInZone = Math.floor(args.indexOnSide / args.zones.length);
  const countInZone = Math.ceil((args.countOnSide - zoneIndex) / args.zones.length);
  if (countInZone <= 1) return roundPlacementValue((zone.min + zone.max) / 2);

  const step = (zone.max - zone.min) / (countInZone - 1);
  return roundPlacementValue(zone.min + step * indexInZone);
}

function buildWindows(
  inputs: QuoteVisualPlacementInputs,
  doors: QuoteVisualDoor[]
): QuoteVisualWindow[] {
  if (inputs.windowPackage !== '24x36') return [];

  const count = Math.max(0, Math.trunc(inputs.windowCount ?? 0));
  if (count === 0) return [];

  const doorZones = new Map<QuoteVisualSide, WindowZone[]>();
  for (const side of WINDOW_SIDE_ORDER) {
    const sideDoors = doors.filter((door) => door.side === side);
    if (sideDoors.length > 0) {
      doorZones.set(side, windowZonesBesideDoors(sideSpan(side, inputs), sideDoors));
    }
  }

  const groups = groupWindowIndexes(count, windowSidesClearOfDoors(doorZones));
  const sillHeight = roundPlacementValue(
    Math.min(
      WINDOW_SILL_HEIGHT_FEET,
      maxWindowHeightFromFloor(wallHeightOrDefault(inputs), WINDOW_HEIGHT_FEET)
    )
  );
  const windowByIndex = new Map<number, QuoteVisualWindow>();

  for (const [side, indexes] of groups) {
    const zones = doorZones.get(side);
    indexes.forEach((windowIndex, indexOnSide) => {
      windowByIndex.set(windowIndex, {
        id: `window-default-${windowIndex + 1}`,
        side,
        width: WINDOW_WIDTH_FEET,
        height: WINDOW_HEIGHT_FEET,
        offset: zones && zones.length > 0
          ? offsetForWindowBesideDoors({
            zones,
            indexOnSide,
            countOnSide: indexes.length,
          })
          : offsetForWindowOnSide({
            side,
            indexOnSide,
            countOnSide: indexes.length,
            dimensions: inputs,
          }),
        heightFromFloor: sillHeight,
        placement: 'default',
      });
    });
  }

  return Array.from({ length: count }, (_, index) => {
    const win = windowByIndex.get(index);
    if (!win) throw new Error(`Missing default window placement for index ${index}`);
    return win;
  });
}

function normalizeDoors(
  inputs: QuoteVisualPlacementInputs,
  defaults: QuoteVisualDoor[],
  features?: QuoteVisualFeatures,
  keepOnlyCustom = false
) {
  const matched = findMatchingFeature(features?.doors, defaults);
  if (!matched) return defaults;

  return defaults.map((defaultDoor, index) => {
    const requested = matched[index];
    if (keepOnlyCustom && requested.placement !== 'custom') return defaultDoor;
    const side = requested.side;
    const offset = roundPlacementValue(
      clampOffset(side, inputs, defaultDoor.width, requested.offset)
    );
    const isCustom =
      requested.placement === 'custom' ||
      side !== defaultDoor.side ||
      !samePlacementNumber(offset, defaultDoor.offset);

    return {
      ...defaultDoor,
      side,
      offset,
      placement: isCustom ? 'custom' : 'default',
    } satisfies QuoteVisualDoor;
  });
}

function normalizeWindowHeightFromFloor(
  wallHeight: number,
  windowHeight: number,
  requested: number
) {
  const max = maxWindowHeightFromFloor(wallHeight, windowHeight);
  return roundPlacementValue(clamp(requested, MIN_WINDOW_SILL_FEET, max));
}

function normalizeWindows(
  inputs: QuoteVisualPlacementInputs,
  defaults: QuoteVisualWindow[],
  features?: QuoteVisualFeatures,
  keepOnlyCustom = false
) {
  const matched = findMatchingFeature(features?.windows, defaults);
  if (!matched) return defaults;

  const wallHeight = wallHeightOrDefault(inputs);

  return defaults.map((defaultWindow, index) => {
    const requested = matched[index];
    if (keepOnlyCustom && requested.placement !== 'custom') return defaultWindow;
    const side = requested.side;
    const offset = roundPlacementValue(
      clampOffset(side, inputs, defaultWindow.width, requested.offset)
    );
    const heightFromFloor = normalizeWindowHeightFromFloor(
      wallHeight,
      defaultWindow.height,
      requested.heightFromFloor
    );
    const isCustom =
      requested.placement === 'custom' ||
      side !== defaultWindow.side ||
      !samePlacementNumber(offset, defaultWindow.offset) ||
      !samePlacementNumber(heightFromFloor, defaultWindow.heightFromFloor);

    return {
      ...defaultWindow,
      side,
      offset,
      heightFromFloor,
      placement: isCustom ? 'custom' : 'default',
    } satisfies QuoteVisualWindow;
  });
}

export function buildQuoteVisualPlacement(
  inputs: QuoteVisualPlacementInputs,
  features?: QuoteVisualFeatures & { defaultsVersion?: string }
): QuoteVisualPlacement {
  const defaultDoors = buildDoors(inputs);
  const defaultWindows = buildWindows(inputs, defaultDoors);
  // A page loaded before a defaults change still posts its old default spots.
  // Rebuild those, so they aren't saved as a customer's custom placement.
  const keepOnlyCustom =
    features?.defaultsVersion !== undefined &&
    features.defaultsVersion !== QUOTE_VISUAL_DEFAULTS_VERSION;
  const doors = normalizeDoors(inputs, defaultDoors, features, keepOnlyCustom);
  const windows = normalizeWindows(inputs, defaultWindows, features, keepOnlyCustom);
  const customized =
    doors.some((door) => door.placement === 'custom') ||
    windows.some((window) => window.placement === 'custom');

  return {
    version: 1,
    defaultsVersion: QUOTE_VISUAL_DEFAULTS_VERSION,
    customized,
    doors,
    windows,
  };
}

export function buildQuoteVisualPreviewParams(
  inputs: QuoteVisualPlacementInputs
): QuoteVisualPreviewParams {
  const visualPlacement = buildQuoteVisualPlacement(inputs);

  return {
    structureType: inputs.structureType,
    length: inputs.length,
    width: inputs.width,
    roofStyle: inputs.roofStyle,
    wallHeight: inputs.wallHeight,
    roofMaterial: inputs.roofMaterial,
    frameGauge: inputs.frameGauge,
    windowPackage: inputs.windowPackage,
    windowCount: inputs.windowCount,
    ventilation: inputs.ventilation,
    color: inputs.color,
    foundation: inputs.foundation,
    siding: inputs.siding,
    addOns: inputs.addOns ?? [],
    deliveryRadius: inputs.deliveryRadius ?? 0,
    doors: visualPlacement.doors,
    windows: visualPlacement.windows,
  };
}
