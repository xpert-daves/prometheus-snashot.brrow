import { SHED210_DELIVERY_ORIGIN } from "@/lib/location/distance";
import {
  FALLBACK_SERVICE_AREA_MAP_LOCATIONS,
  type ServiceAreaMapLocation,
} from "@/lib/serviceAreaRegistry";

type StaticServiceAreaMapProps = {
  className?: string;
  priority?: boolean;
  showCityLinks?: boolean;
  locations?: readonly ServiceAreaMapLocation[];
};

type Coordinate = {
  lat: number;
  lon: number;
};

const MAX_MAP_ZOOM = 8;
const MIN_MAP_ZOOM = 2;
const TILE_SIZE = 256;
const MAP_WIDTH = 800;
const MAP_HEIGHT = 500;
const MAP_PADDING = 40;
const DELIVERY_RADIUS_MILES = 35;
const EARTH_RADIUS_MILES = 3958.8;

const DELIVERY_ORIGIN = {
  lat: SHED210_DELIVERY_ORIGIN.lat,
  lon: SHED210_DELIVERY_ORIGIN.lng,
} as const;

const STATIC_MARKER_OFFSETS: Readonly<
  Record<string, { x: number; y: number } | undefined>
> = {
  "universal-city": { x: -36, y: -7 },
  schertz: { x: -25, y: -29 },
  cibolo: { x: 18, y: 13 },
  castroville: { x: -29, y: 13 },
  seguin: { x: 24, y: -13 },
  lakehills: { x: -22, y: -15 },
  converse: { x: 18, y: 37 },
  "rio-medina": { x: -8, y: -5 },
  marion: { x: 36, y: 28 },
};

export const MAP_LOCATIONS = FALLBACK_SERVICE_AREA_MAP_LOCATIONS;

function projectToWorldPixels({ lat, lon }: Coordinate, zoom: number) {
  const worldSize = TILE_SIZE * 2 ** zoom;
  const latitudeRadians = (lat * Math.PI) / 180;

  return {
    x: ((lon + 180) / 360) * worldSize,
    y:
      ((1 -
        Math.log(Math.tan(latitudeRadians) + 1 / Math.cos(latitudeRadians)) /
          Math.PI) /
        2) *
      worldSize,
  };
}

function destinationPoint(
  origin: Coordinate,
  bearingDegrees: number,
  distanceMiles: number,
) {
  const angularDistance = distanceMiles / EARTH_RADIUS_MILES;
  const bearing = (bearingDegrees * Math.PI) / 180;
  const startLatitude = (origin.lat * Math.PI) / 180;
  const startLongitude = (origin.lon * Math.PI) / 180;
  const endLatitude = Math.asin(
    Math.sin(startLatitude) * Math.cos(angularDistance) +
      Math.cos(startLatitude) * Math.sin(angularDistance) * Math.cos(bearing),
  );
  const endLongitude =
    startLongitude +
    Math.atan2(
      Math.sin(bearing) * Math.sin(angularDistance) * Math.cos(startLatitude),
      Math.cos(angularDistance) -
        Math.sin(startLatitude) * Math.sin(endLatitude),
    );

  return {
    lat: (endLatitude * 180) / Math.PI,
    lon: (endLongitude * 180) / Math.PI,
  };
}

const DELIVERY_BOUNDARY_COORDINATES = Array.from(
  { length: 128 },
  (_, index) =>
    destinationPoint(
    DELIVERY_ORIGIN,
    (index / 128) * 360,
      DELIVERY_RADIUS_MILES
    )
);

function buildViewport(locations: readonly ServiceAreaMapLocation[]) {
  const coordinates: readonly Coordinate[] = [
    ...DELIVERY_BOUNDARY_COORDINATES,
    ...locations,
  ];
  let zoom = MAX_MAP_ZOOM;
  let projected = coordinates.map((coordinate) =>
    projectToWorldPixels(coordinate, zoom)
  );

  for (let candidateZoom = MAX_MAP_ZOOM; candidateZoom >= MIN_MAP_ZOOM; candidateZoom -= 1) {
    zoom = candidateZoom;
    projected = coordinates.map((coordinate) =>
      projectToWorldPixels(coordinate, zoom)
    );
    const xs = projected.map(({ x }) => x);
    const ys = projected.map(({ y }) => y);
    if (
      Math.max(...xs) - Math.min(...xs) <= MAP_WIDTH - MAP_PADDING * 2 &&
      Math.max(...ys) - Math.min(...ys) <= MAP_HEIGHT - MAP_PADDING * 2
    ) {
      break;
    }
  }

  const xs = projected.map(({ x }) => x);
  const ys = projected.map(({ y }) => y);
  const mapOrigin = {
    x: (Math.min(...xs) + Math.max(...xs)) / 2 - MAP_WIDTH / 2,
    y: (Math.min(...ys) + Math.max(...ys)) / 2 - MAP_HEIGHT / 2,
  };
  const minimumTileX = Math.floor(mapOrigin.x / TILE_SIZE);
  const maximumTileX = Math.floor((mapOrigin.x + MAP_WIDTH - 1) / TILE_SIZE);
  const minimumTileY = Math.floor(mapOrigin.y / TILE_SIZE);
  const maximumTileY = Math.floor((mapOrigin.y + MAP_HEIGHT - 1) / TILE_SIZE);
  const tiles = Array.from(
    { length: maximumTileX - minimumTileX + 1 },
    (_, xOffset) =>
      Array.from(
        { length: maximumTileY - minimumTileY + 1 },
        (_, yOffset) => ({
          x: minimumTileX + xOffset,
          y: minimumTileY + yOffset,
        })
      )
  ).flat();
  const boundaryPoints = DELIVERY_BOUNDARY_COORDINATES.map((coordinate) => {
    const point = projectToWorldPixels(coordinate, zoom);
    return `${(point.x - mapOrigin.x).toFixed(4)},${(
      point.y - mapOrigin.y
    ).toFixed(4)}`;
  }).join(" ");

  return { zoom, mapOrigin, tiles, boundaryPoints };
}

export default function StaticServiceAreaMap({
  className = "",
  showCityLinks = false,
  locations = MAP_LOCATIONS,
}: StaticServiceAreaMapProps) {
  const { zoom, mapOrigin, tiles, boundaryPoints } = buildViewport(locations);
  return (
    <div
      className={`overflow-hidden rounded-xl bg-[#e8e1d5] text-neutral-950 ring-1 ring-white/10 ${className}`.trim()}
    >
      <div className="relative overflow-hidden bg-[#e8e1d5]">
        <div className="pointer-events-none absolute left-3 top-3 z-10 flex items-center gap-2 rounded-lg bg-neutral-950/95 px-3 py-2 text-white shadow-lg sm:left-5 sm:top-5 sm:gap-3 sm:px-4 sm:py-3">
          <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-[#f47a0b] sm:h-10 sm:w-10">
            <span className="h-4 w-4 rounded-full border-[3px] border-neutral-950 sm:h-5 sm:w-5" />
          </span>
          <span>
            <span className="brand-label block text-[10px] leading-tight tracking-[0.12em] sm:text-sm">
              No distance fee
            </span>
            <span className="motif-spec mt-1 block text-[9px] leading-none text-neutral-300 sm:text-xs">
              Within 35 miles
            </span>
          </span>
        </div>

        <svg
          viewBox={`0 0 ${MAP_WIDTH} ${MAP_HEIGHT}`}
          role={showCityLinks ? "img" : "group"}
          aria-label={
            showCityLinks
              ? "OpenStreetMap view of the 35-mile Shed210 service area. Labeled city links follow the map."
              : "Interactive OpenStreetMap view of the 35-mile Shed210 service area. Use the labeled city links to open a service area."
          }
          className="block aspect-[8/5] h-auto w-full"
          preserveAspectRatio="xMidYMid meet"
        >
          <rect width={MAP_WIDTH} height={MAP_HEIGHT} fill="#e8e1d5" />

          <g>
            {tiles.map((tile) => (
              <image
                key={`${tile.x}-${tile.y}`}
                href={`https://tile.openstreetmap.org/${zoom}/${tile.x}/${tile.y}.png`}
                x={tile.x * TILE_SIZE - mapOrigin.x}
                y={tile.y * TILE_SIZE - mapOrigin.y}
                width={TILE_SIZE}
                height={TILE_SIZE}
                preserveAspectRatio="none"
              />
            ))}
          </g>

          <rect
            width={MAP_WIDTH}
            height={MAP_HEIGHT}
            fill="#ead8bf"
            fillOpacity="0.14"
            pointerEvents="none"
          />

          <polygon
            points={boundaryPoints}
            fill="none"
            stroke="#a84e0b"
            strokeWidth="3"
            strokeDasharray="9 7"
            vectorEffect="non-scaling-stroke"
            pointerEvents="none"
          />

          {locations.map((location, index) => {
            const projectedLocation = projectToWorldPixels(location, zoom);
            const x = projectedLocation.x - mapOrigin.x;
            const y = projectedLocation.y - mapOrigin.y;
            const isHomeBase = location.slug === "san-antonio";
            const markerOffset = STATIC_MARKER_OFFSETS[location.slug];
            const markerX = x + (markerOffset?.x ?? 0);
            const markerY = y + (markerOffset?.y ?? 0);

            const marker = (
              <>
                <title>{location.city}</title>
                {markerOffset && (
                  <>
                    <line
                      x1={x}
                      y1={y}
                      x2={markerX}
                      y2={markerY}
                      stroke="#fffaf0"
                      strokeWidth="5"
                      vectorEffect="non-scaling-stroke"
                      pointerEvents="none"
                    />
                    <line
                      x1={x}
                      y1={y}
                      x2={markerX}
                      y2={markerY}
                      stroke="#292524"
                      strokeWidth="2"
                      vectorEffect="non-scaling-stroke"
                      pointerEvents="none"
                    />
                    <circle
                      cx={x}
                      cy={y}
                      r="4"
                      fill="#292524"
                      stroke="#fffaf0"
                      strokeWidth="2"
                      vectorEffect="non-scaling-stroke"
                      pointerEvents="none"
                    />
                  </>
                )}
                <circle
                  cx={markerX}
                  cy={markerY}
                  r={isHomeBase ? 16 : 13}
                  fill={isHomeBase ? "#f47a0b" : "#1c1917"}
                  stroke="#fffaf0"
                  strokeWidth="3"
                  vectorEffect="non-scaling-stroke"
                />
                <text
                  x={markerX}
                  y={markerY + 4}
                  textAnchor="middle"
                  fill={isHomeBase ? "#1c1917" : "#fffaf0"}
                  fontFamily="var(--font-geist-mono), ui-monospace, monospace"
                  fontSize="11"
                  fontWeight="800"
                  pointerEvents="none"
                >
                  {isHomeBase ? "H" : index + 1}
                </text>
              </>
            );

            // Pins are always tappable. With the city list below, the list carries
            // keyboard and screen reader access, so the pins are hidden from both.
            return (
              <a
                key={location.slug}
                href={`/service-area/${location.slug}`}
                aria-label={`View ${location.city} service area`}
                tabIndex={showCityLinks ? -1 : undefined}
                aria-hidden={showCityLinks ? true : undefined}
                data-map-pin=""
                className="group cursor-pointer"
              >
                {marker}
              </a>
            );
          })}
        </svg>

        <a
          href="https://www.openstreetmap.org/copyright"
          target="_blank"
          rel="noreferrer"
          className="absolute bottom-2 right-2 z-10 inline-flex min-h-6 items-center rounded bg-white/90 px-2 py-1 text-[9px] font-medium text-neutral-700 shadow-sm hover:text-neutral-950 sm:text-[10px]"
        >
          © OpenStreetMap contributors
        </a>
      </div>

      {showCityLinks && (
        <div className="grid grid-cols-2 border-t border-[#c9c0b2] bg-[#e5ded1] sm:grid-cols-4">
          {locations.map((location, index) => (
            <a
              key={location.slug}
              href={`/service-area/${location.slug}`}
              className="group flex min-h-11 items-center gap-2 border-b border-r border-[#c9c0b2] px-3 py-2 font-medium text-[#2b221b] transition hover:bg-[#d8cebd] hover:text-[#8b410e]"
            >
              <span
                className={`grid h-5 w-5 shrink-0 place-items-center rounded-full text-[10px] font-bold ${
                  location.slug === "san-antonio"
                    ? "bg-[#f47a0b] text-neutral-950"
                    : "bg-neutral-900 text-white"
                }`}
              >
                {location.slug === "san-antonio" ? "H" : index + 1}
              </span>
              <span>{location.city}</span>
            </a>
          ))}
        </div>
      )}
    </div>
  );
}
