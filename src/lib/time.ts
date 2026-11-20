export const CENTRAL_TIME_ZONE = "America/Chicago";

const centralFormatter = new Intl.DateTimeFormat("en-US", {
  timeZone: CENTRAL_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hourCycle: "h23",
  timeZoneName: "longOffset",
});

const centralDisplayFormatter = new Intl.DateTimeFormat("en-US", {
  timeZone: CENTRAL_TIME_ZONE,
  month: "short",
  day: "numeric",
  year: "numeric",
  hour: "numeric",
  minute: "2-digit",
  timeZoneName: "short",
});

type CentralParts = {
  year: string;
  month: string;
  day: string;
  hour: string;
  minute: string;
  second: string;
  timeZoneName?: string;
};

function normalizeOffset(value: string) {
  if (value === "GMT" || value === "UTC") return "Z";

  const offset = value.replace("GMT", "");
  const match = offset.match(/^([+-])(\d{1,2})(?::?(\d{2}))?$/);
  if (!match) return offset;

  const [, sign, hour, minute = "00"] = match;
  return `${sign}${hour.padStart(2, "0")}:${minute}`;
}

function getCentralParts(date: Date): CentralParts {
  const parts = centralFormatter.formatToParts(date);
  return Object.fromEntries(parts.map((part) => [part.type, part.value])) as CentralParts;
}

function offsetToMilliseconds(value: string) {
  if (value === "Z") return 0;
  const match = value.match(/^([+-])(\d{2}):(\d{2})$/);
  if (!match) throw new Error(`Unsupported time zone offset: ${value}`);
  const [, sign, hour, minute] = match;
  const total = (Number(hour) * 60 + Number(minute)) * 60 * 1000;
  return sign === "-" ? -total : total;
}

function getCentralOffsetMilliseconds(date: Date) {
  const values = getCentralParts(date);
  return offsetToMilliseconds(normalizeOffset(values.timeZoneName ?? "Z"));
}

function parseCentralDateTime(dateValue: string, timeValue: string) {
  const dateMatch = dateValue.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  const timeMatch = timeValue.match(/^(\d{2}):(\d{2})$/);
  if (!dateMatch || !timeMatch) return null;

  const [, yearText, monthText, dayText] = dateMatch;
  const [, hourText, minuteText] = timeMatch;
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  const hour = Number(hourText);
  const minute = Number(minuteText);

  if (
    month < 1 ||
    month > 12 ||
    day < 1 ||
    day > 31 ||
    hour < 0 ||
    hour > 23 ||
    minute < 0 ||
    minute > 59
  ) {
    return null;
  }

  return {
    year,
    month,
    day,
    hour,
    minute,
    dateValue,
    timeValue,
  };
}

function centralPartsMatch(
  timestamp: number,
  parsed: NonNullable<ReturnType<typeof parseCentralDateTime>>
) {
  const parts = getCentralParts(new Date(timestamp));
  return (
    parts.year === String(parsed.year).padStart(4, "0") &&
    parts.month === String(parsed.month).padStart(2, "0") &&
    parts.day === String(parsed.day).padStart(2, "0") &&
    parts.hour === String(parsed.hour).padStart(2, "0") &&
    parts.minute === String(parsed.minute).padStart(2, "0")
  );
}

export function getCentralTimestamp(date: Date): string {
  const values = getCentralParts(date);
  const offset = normalizeOffset(values.timeZoneName ?? "Z");

  return `${values.year}-${values.month}-${values.day}T${values.hour}:${values.minute}:${values.second}${offset}`;
}

export function centralDateTimeToUtcMillis(
  dateValue: string,
  timeValue: string
): number | null {
  const parsed = parseCentralDateTime(dateValue, timeValue);
  if (!parsed) return null;

  const wallClockUtc = Date.UTC(
    parsed.year,
    parsed.month - 1,
    parsed.day,
    parsed.hour,
    parsed.minute
  );
  const offsets = Array.from(
    new Set(
      [wallClockUtc, wallClockUtc - 12 * 60 * 60 * 1000, wallClockUtc + 12 * 60 * 60 * 1000]
        .map((timestamp) => getCentralOffsetMilliseconds(new Date(timestamp)))
    )
  );

  for (const offset of offsets) {
    const candidate = wallClockUtc - offset;
    if (centralPartsMatch(candidate, parsed)) return candidate;
  }

  return null;
}

export function formatCentralDateInputValue(value: number | Date): string {
  const parts = getCentralParts(value instanceof Date ? value : new Date(value));
  return `${parts.year}-${parts.month}-${parts.day}`;
}

export function formatCentralTimeInputValue(value: number | Date): string {
  const parts = getCentralParts(value instanceof Date ? value : new Date(value));
  return `${parts.hour}:${parts.minute}`;
}

export function formatCentralDateTime(value: number | null | undefined): string {
  return value ? centralDisplayFormatter.format(new Date(value)) : "None";
}
