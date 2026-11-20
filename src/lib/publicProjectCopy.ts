function matchReplacementCase(source: string, replacement: string): string {
  if (source === source.toUpperCase()) return replacement.toUpperCase();
  if (source[0] === source[0]?.toUpperCase()) {
    return replacement[0]?.toUpperCase() + replacement.slice(1);
  }
  return replacement;
}

export function normalizePublicProjectCopy(value: string): string {
  let normalized = value;

  normalized = normalized.replace(
    /\bportable[\s-]+buildings?\b/giu,
    (match) =>
      matchReplacementCase(
        match,
        /\bbuildings\b/iu.test(match) ? "sheds" : "shed"
      )
  );
  normalized = normalized.replace(
    /\bportable[\s-]+(sheds?|garages?|barns?|carports?)\b/giu,
    (match, structure: string) =>
      matchReplacementCase(match, structure.toLowerCase())
  );
  normalized = normalized.replace(/\bportable\b/giu, "");

  normalized = normalized.replace(
    /\bfree[\s-]+delivery\b/giu,
    (match) => matchReplacementCase(match, "no distance fee")
  );
  normalized = normalized.replace(
    /\bdelivery[\s-]+(area|radius)\b/giu,
    (match) => matchReplacementCase(match, "service area")
  );
  normalized = normalized.replace(
    /\bdelivery[\s-]+(details|guidance|planning|coverage)\b/giu,
    (match, qualifier: string) =>
      matchReplacementCase(match, `service-area ${qualifier.toLowerCase()}`)
  );
  normalized = normalized.replace(
    /\bdelivery[\s-]+(charge|charges|fee|fees)\b/giu,
    (match, charge: string) =>
      matchReplacementCase(match, `distance ${charge.toLowerCase()}`)
  );
  normalized = normalized.replace(
    /\bdelivery[\s-]+(day|date|timing|schedule)\b/giu,
    (match, timing: string) =>
      matchReplacementCase(match, `build ${timing.toLowerCase()}`)
  );
  normalized = normalized.replace(
    /\bdelivery\b/giu,
    (match) => matchReplacementCase(match, "service")
  );

  normalized = normalized.replace(
    /\b(materials?) were delivered\b/giu,
    (_match, materials: string) => `${materials} arrived`
  );
  normalized = normalized.replace(
    /\b(materials?) delivered\b/giu,
    (_match, materials: string) => `${materials} brought`
  );
  normalized = normalized.replace(
    /\bdelivered\b/giu,
    (match) => matchReplacementCase(match, "completed")
  );

  normalized = normalized.replace(
    /\binstalled(?=\s+in\b)/giu,
    (match) => matchReplacementCase(match, "built")
  );
  normalized = normalized.replace(
    /\b(sheds?|buildings?|structures?|garages?|greenhouses?|dog[\s-]*houses?) installations?\b/giu,
    (_match, structure: string) => `${structure} build`
  );

  return normalized
    .replace(/\b(sheds?)\s+sheds?\b/giu, "$1")
    .replace(/[ \t]{2,}/g, " ")
    .replace(/[ \t]+\n/g, "\n")
    .trim();
}
