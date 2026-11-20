import type { ChangeEvent, CSSProperties } from 'react';
import { Check, ChevronDown, ChevronsUpDown } from 'lucide-react';
import { brandColors, type QuoteFormErrors, type QuoteFormParams } from '@/lib/quoteForm';
import { QUOTE_WINDOW_COUNT_MIN, QUOTE_WINDOW_COUNT_MAX } from '@/lib/quoteLimits';
import {
  DOOR_OPTIONS,
  FRAME_GAUGE_OPTIONS,
  WINDOW_PACKAGE_OPTIONS,
} from '@/lib/quoteFlow';
import { triggerHaptic } from '@/lib/haptics';
import {
  QuoteFieldError,
  QuoteSectionCard,
} from '@/components/quote/QuoteSectionCard';
import { QuoteAddOnsSelector } from '@/components/quote/QuoteAddOnsSelector';
import { QuoteNumberStepper } from '@/components/quote/QuoteNumberStepper';
import {
  specField,
  specLabel,
  specSelect,
  specTile,
} from '@/components/quote/quoteStyles';

function isLightColor(hex: string) {
  const normalized = hex.replace('#', '');
  const red = parseInt(normalized.slice(0, 2), 16);
  const green = parseInt(normalized.slice(2, 4), 16);
  const blue = parseInt(normalized.slice(4, 6), 16);

  return (red * 299 + green * 587 + blue * 114) / 1000 > 160;
}

/*
 * Phone (iOS) skin. Everything below is applied through the `phone:` variant
 * only, so desktop renders exactly as before. Door and window buttons draw
 * their decoration with ::before/::after (no extra children), which keeps
 * their DOM and accessible names untouched.
 */

/** Inline SVG (24×24 stroke glyph) as a CSS url() for masks/backgrounds. */
function svgUrl(body: string, stroke = 'black') {
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='${stroke}' stroke-width='1.6' stroke-linecap='round' stroke-linejoin='round'>${body}</svg>`;
  return `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;
}

const DOOR_GLYPHS: Record<string, string> = {
  single_shed: svgUrl(
    "<path d='M3.5 20.5h17'/><rect x='7' y='3.5' width='10' height='17' rx='1.2'/><path d='M14.2 11v2.8'/>"
  ),
  double_shed: svgUrl(
    "<path d='M3.5 20.5h17'/><rect x='4.5' y='3.5' width='15' height='17' rx='1.2'/><path d='M12 3.5v17M10 11v2.8M14 11v2.8'/>"
  ),
  garage_roll_up: svgUrl(
    "<path d='M3.5 20.5h17'/><path d='M4.5 20.5V5.2c0-.94.76-1.7 1.7-1.7h11.6c.94 0 1.7.76 1.7 1.7v15.3'/><path d='M4.5 8h15M4.5 11.5h15M4.5 15h15M10.5 18h3'/>"
  ),
  house: svgUrl(
    "<path d='M3.5 20.5h17'/><rect x='6.5' y='3' width='11' height='17.5' rx='1.2'/><rect x='9' y='5.5' width='6' height='4.5' rx='.6'/><rect x='9' y='12.5' width='6' height='5.5' rx='.6'/><path d='M16.1 11.2v.6'/>"
  ),
};

/** Check glyph in the accent ink colour, painted on the accent badge. */
const doorGridStyle = {
  '--qm-check-glyph': svgUrl("<path d='M6 12.5l4 4L18 8' stroke-width='3'/>", '#1a0d02'),
} as CSSProperties;

/** 2×2 selectable cards: glyph top-left, label bottom-left, check badge when chosen. */
const phoneDoorTile =
  "phone:qm-tile phone:flex phone:min-h-[5.75rem] phone:w-full phone:items-end phone:justify-start phone:px-3.5 phone:pb-3 phone:pt-11 phone:text-left phone:text-[15px] phone:font-semibold phone:leading-5 " +
  'phone:before:absolute phone:before:left-3.5 phone:before:top-3.5 phone:before:size-7 phone:before:bg-[var(--qm-label-2)] phone:before:transition-colors phone:before:duration-200 phone:before:[mask:var(--qm-glyph)_center/contain_no-repeat] ' +
  'phone:aria-pressed:before:bg-[var(--accent-light)] ' +
  'phone:aria-pressed:after:absolute phone:aria-pressed:after:right-3 phone:aria-pressed:after:top-3 phone:aria-pressed:after:size-[22px] phone:aria-pressed:after:rounded-full phone:aria-pressed:after:[background:var(--qm-check-glyph)_center/13px_no-repeat,var(--accent)] phone:aria-pressed:after:shadow-[0_4px_10px_-2px_rgb(var(--accent-glow-rgb)/0.7)] phone:aria-pressed:after:animate-[qm-pop_0.42s_var(--qm-ease-bounce)_both]';

/** Toggle row with an iOS switch drawn by ::after (track) and ::before (thumb). */
const phoneSwitchRow =
  'phone:qm-row phone:relative phone:pr-[5.25rem] ' +
  'phone:before:absolute phone:before:right-[2.375rem] phone:before:top-1/2 phone:before:z-[1] phone:before:size-[27px] phone:before:-translate-y-1/2 phone:before:rounded-full phone:before:bg-white phone:before:shadow-[0_3px_8px_rgb(0_0_0/0.18),0_3px_1px_rgb(0_0_0/0.06)] phone:before:transition-[translate] phone:before:duration-[380ms] phone:before:ease-[var(--qm-ease-soft-bounce)] ' +
  'phone:after:absolute phone:after:right-4 phone:after:top-1/2 phone:after:h-[31px] phone:after:w-[51px] phone:after:-translate-y-1/2 phone:after:rounded-full phone:after:bg-[var(--qm-fill)] phone:after:transition-colors phone:after:duration-[250ms] ' +
  'phone:aria-pressed:before:translate-x-5 phone:aria-pressed:after:bg-[var(--accent)]';

/** A standalone inset row (its own rounded group). */
const phoneSoloRow =
  'phone:flex phone:min-h-[52px] phone:items-center phone:gap-3 phone:rounded-[var(--qm-radius-group)] phone:bg-[var(--qm-group)] phone:px-4 phone:qm-body phone:text-[var(--qm-label)]';

/** Picker row: caption left, value + up/down chevron right; the real select covers the row. */
const phoneSelectRow = `${phoneSoloRow} phone:relative phone:transition-colors phone:duration-200 phone:qm-no-select phone:active:bg-[var(--qm-group-pressed)] phone:has-[select:focus]:bg-[var(--qm-group-pressed)] phone:has-[select:focus-visible]:outline-2 phone:has-[select:focus-visible]:outline-solid phone:has-[select:focus-visible]:outline-[var(--accent-light)] phone:has-[select:focus-visible]:-outline-offset-2`;
const phoneRowCaption = 'phone:min-w-0 phone:flex-1 phone:truncate phone:text-[var(--qm-label)]';
const phoneSelectWrap = 'phone:static phone:flex phone:min-w-0 phone:max-w-[62%] phone:shrink-0 phone:items-center';
const phoneSelect =
  'phone:absolute phone:inset-0 phone:z-[1] phone:m-0 phone:h-full phone:w-full phone:cursor-pointer phone:rounded-[var(--qm-radius-group)] phone:p-0 phone:opacity-0';
const phoneSelectValue =
  'hidden phone:flex phone:min-w-0 phone:items-center phone:gap-1.5 phone:text-[var(--qm-label-2)]';

const FOUNDATION_VALUE_LABELS: Record<string, string> = {
  none: 'None',
  blocks_level: 'Blocks & Level',
  anchored_slab: 'Anchored Slab',
};

function PhoneSelectValue({ label }: { label: string }) {
  return (
    <span aria-hidden="true" className={phoneSelectValue}>
      <span className="truncate">{label}</span>
      <ChevronsUpDown className="h-4 w-4 shrink-0 text-[var(--qm-label-3)]" strokeWidth={2.2} />
    </span>
  );
}

export function QuoteMaterialsStep({
  draft,
  errors,
  showDoorOptions,
  showPanelMaterial,
  showFrameGauge,
  showWindowPackage,
  showVentilation,
  showColor,
  showUpgrades,
  onInputChange,
  onToggleAddOn,
  onColorChange,
}: {
  draft: QuoteFormParams;
  errors: QuoteFormErrors;
  showDoorOptions: boolean;
  showPanelMaterial: boolean;
  showFrameGauge: boolean;
  showWindowPackage: boolean;
  showVentilation: boolean;
  showColor: boolean;
  showUpgrades: boolean;
  onInputChange: (event: ChangeEvent<HTMLInputElement | HTMLSelectElement>) => void;
  onToggleAddOn: (option: string, checked: boolean) => void;
  onColorChange: (color: string) => void;
}) {
  const selectedColor = brandColors.find((color) => color.hex === draft.color);
  const selectedColorName = selectedColor?.name ?? 'Custom';
  const windowsOn = Boolean(draft.windowPackage);
  const wantsSlab = draft.foundation === 'anchored_slab';

  return (
    <QuoteSectionCard
      title="Materials & Options"
      code="02 / 03"
      eyebrow="Step 2 of 3"
      className="phone:[&>*+*]:mt-7"
    >
      {showDoorOptions ? (
        <div className="space-y-2 text-sm">
          <p className="brand-subheading phone:qm-section-header">Door Options</p>
          <div
            className="flex flex-wrap gap-3 phone:grid phone:grid-cols-2 phone:gap-2.5"
            style={doorGridStyle}
          >
            {DOOR_OPTIONS.map((option) => (
              <button
                key={option.value}
                type="button"
                aria-pressed={draft.door === option.value}
                onClick={() => {
                  if (draft.door !== option.value) triggerHaptic('selection');
                  onInputChange({
                    target: { name: 'door', value: option.value },
                  } as ChangeEvent<HTMLInputElement>);
                }}
                style={{ '--qm-glyph': DOOR_GLYPHS[option.value] } as CSSProperties}
                className={`${specTile(
                  draft.door === option.value,
                  'motif-spec min-h-[44px] min-w-[44px] px-4 py-3'
                )} ${phoneDoorTile}`}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>
      ) : null}

      {showPanelMaterial ? (
        <p
          className={`motif-spec mt-3 text-white/55 ${phoneSoloRow} phone:justify-between`}
        >
          Panel Material:{' '}
          <span className="text-white/85 phone:text-[var(--qm-label-2)]">Polycarbonate</span>
        </p>
      ) : null}

      {showFrameGauge ? (
        <label data-qm-row="" className={`mt-4 block text-sm font-medium ${phoneSelectRow}`}>
          <span className={`${specLabel} ${phoneRowCaption}`}>Frame Gauge</span>
          <span className={`relative block ${phoneSelectWrap}`}>
            <select
              name="frameGauge"
              value={draft.frameGauge}
              onChange={onInputChange}
              data-qm-row-input=""
              className={`${specSelect} ${phoneSelect}`}
            >
              {FRAME_GAUGE_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
            <ChevronDown
              aria-hidden="true"
              className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/45 phone:hidden"
            />
            <PhoneSelectValue label={draft.frameGauge} />
          </span>
        </label>
      ) : null}

      {showWindowPackage ? (
        <div className="mt-4 space-y-2 text-sm">
          <p className="brand-subheading phone:qm-section-header">Window Package</p>
          <div
            data-qm-group=""
            className={`flex gap-3 phone:block phone:overflow-clip phone:bg-[var(--qm-group)] ${
              windowsOn
                ? 'phone:mb-0 phone:rounded-t-[var(--qm-radius-group)]'
                : 'phone:rounded-[var(--qm-radius-group)]'
            }`}
          >
            {WINDOW_PACKAGE_OPTIONS.map((windowPackage) => (
              <button
                key={windowPackage}
                type="button"
                aria-pressed={draft.windowPackage === windowPackage}
                onClick={() => {
                  triggerHaptic('selection');
                  onInputChange({
                    target: {
                      name: 'windowPackage',
                      value: draft.windowPackage === windowPackage ? '' : windowPackage,
                    },
                  } as ChangeEvent<HTMLInputElement>);
                }}
                className={`${specTile(
                  draft.windowPackage === windowPackage,
                  'motif-spec min-h-[44px] min-w-[44px] px-4 py-3'
                )} ${phoneSwitchRow}`}
              >
                {windowPackage}
              </button>
            ))}
          </div>
          {draft.windowPackage ? (
            <div
              data-qm-row=""
              className="pt-2 phone:relative phone:flex phone:min-h-[52px] phone:flex-wrap phone:items-center phone:gap-x-2 phone:rounded-b-[var(--qm-radius-group)] phone:bg-[var(--qm-group)] phone:px-4 phone:py-1 phone:transition-colors phone:duration-200 phone:animate-[qm-rise_0.42s_var(--qm-ease-spring)_both] phone:has-[input:focus]:bg-[var(--qm-group-pressed)] phone:before:absolute phone:before:left-4 phone:before:right-0 phone:before:top-0 phone:before:h-px phone:before:origin-top phone:before:scale-y-50 phone:before:bg-[var(--qm-sep)] phone:[&>[role=alert]]:mt-0 phone:[&>[role=alert]]:basis-full phone:[&>[role=alert]]:px-0 phone:[&>[role=alert]]:pb-2.5"
            >
              <label className="block phone:flex phone:min-h-11 phone:min-w-0 phone:flex-1 phone:items-center phone:gap-3">
                <span className={`${specLabel} phone:min-w-0 phone:flex-1 phone:truncate phone:qm-body phone:text-[var(--qm-label)]`}>
                  Number of Windows
                </span>
                <input
                  type="number"
                  name="windowCount"
                  inputMode="numeric"
                  min={QUOTE_WINDOW_COUNT_MIN}
                  max={QUOTE_WINDOW_COUNT_MAX}
                  step="1"
                  required
                  value={draft.windowCount}
                  onChange={onInputChange}
                  aria-invalid={!!errors.windowCount}
                  aria-describedby={
                    errors.windowCount ? 'err-windowCount' : undefined
                  }
                  data-qm-row-input=""
                  className={`${specField} font-mono tabular-nums phone:m-0 phone:w-12 phone:shrink-0 phone:rounded-none phone:border-0 phone:bg-transparent phone:p-0 phone:text-right phone:font-[family-name:var(--qm-font-rounded)] phone:font-semibold phone:shadow-none ${
                    errors.windowCount
                      ? 'phone:text-[var(--qm-danger)]'
                      : 'phone:text-[var(--qm-label)]'
                  }`}
                />
              </label>
              <QuoteNumberStepper
                value={draft.windowCount}
                min={QUOTE_WINDOW_COUNT_MIN}
                max={QUOTE_WINDOW_COUNT_MAX}
                onStep={(next) =>
                  onInputChange({
                    target: { name: 'windowCount', value: next },
                  } as ChangeEvent<HTMLInputElement>)
                }
                decreaseLabel="Fewer windows"
                increaseLabel="More windows"
                announce={(next) => `${next} ${next === '1' ? 'window' : 'windows'}`}
                className="phone:ml-1"
              />
              <QuoteFieldError id="err-windowCount" message={errors.windowCount} />
            </div>
          ) : null}
        </div>
      ) : null}

      {showVentilation ? (
        <label
          data-qm-row=""
          className={`mt-4 flex items-center gap-3 rounded-none border border-white/15 bg-black/25 p-3 text-sm transition-colors hover:border-white/40 ${phoneSoloRow} phone:flex-row-reverse phone:justify-between phone:border-0 phone:py-2.5 phone:qm-no-select`}
        >
          <input
            type="checkbox"
            name="ventilation"
            checked={draft.ventilation}
            onChange={(event) => {
              triggerHaptic('selection');
              onInputChange(event);
            }}
            className="h-4 w-4 shrink-0 accent-[var(--primary)] phone:qm-switch-input"
          />
          Solar Vent Fan
        </label>
      ) : null}

      {showColor ? (
        <div className="mt-5 space-y-3 text-sm">
          <div className="flex items-center justify-between gap-3 phone:mb-[0.4375rem] phone:px-4">
            <p className="brand-subheading phone:qm-section-header phone:m-0! phone:p-0!">Color</p>
            <div className="motif-spec inline-flex min-w-0 items-center gap-2 border border-white/15 bg-black/25 px-2.5 py-1 text-white/60 phone:gap-1.5 phone:border-0 phone:bg-transparent phone:p-0 phone:qm-footnote phone:text-[var(--qm-label-2)]">
              <span
                aria-hidden="true"
                className="h-3.5 w-3.5 shrink-0 border border-white/30 shadow-inner phone:size-3 phone:rounded-full phone:border-white/25 phone:shadow-none"
                style={{ backgroundColor: draft.color }}
              />
              <span className="max-w-32 truncate">{selectedColorName}</span>
            </div>
          </div>
          <div className="-mx-4 grid auto-cols-[minmax(7.5rem,1fr)] grid-flow-col gap-2 overflow-x-auto px-4 pb-2 sm:mx-0 sm:grid-flow-row sm:grid-cols-3 sm:overflow-visible sm:px-0 sm:pb-0 lg:grid-cols-4 phone:mx-0 phone:grid-flow-row phone:grid-cols-6 phone:justify-items-center phone:gap-x-1 phone:gap-y-3.5 phone:overflow-visible phone:rounded-[var(--qm-radius-group)] phone:bg-[var(--qm-group)] phone:px-2 phone:py-4">
            {brandColors.map((color) => {
              const selected = draft.color === color.hex;
              return (
                <button
                  key={color.hex}
                  type="button"
                  aria-pressed={selected}
                  title={color.name}
                  onClick={() => {
                    if (!selected) triggerHaptic('selection');
                    onColorChange(color.hex);
                  }}
                  className={`${specTile(
                    selected,
                    'flex min-h-[56px] snap-start items-center gap-2 p-2 text-left'
                  )} phone:size-11 phone:min-h-0 phone:justify-center phone:rounded-full phone:border-0 phone:bg-transparent phone:p-0 phone:qm-no-select phone:transition-[scale] phone:duration-[420ms] phone:ease-[var(--qm-ease-bounce)] phone:active:scale-[0.88] phone:active:duration-[90ms] phone:active:ease-out phone:focus-visible:outline-white! phone:focus-visible:outline-offset-[6px]!`}
                >
                  <span
                    aria-hidden="true"
                    className={`flex h-9 w-9 shrink-0 items-center justify-center border border-white/30 shadow-inner phone:size-11 phone:rounded-full phone:border-0 phone:outline-[length:2.5px] phone:transition-[outline-offset,outline-color] phone:duration-[450ms] phone:ease-[var(--qm-ease-bounce)] ${
                      isLightColor(color.hex)
                        ? 'phone:shadow-[inset_0_0_0_0.5px_rgb(0_0_0/0.22)]'
                        : 'phone:shadow-[inset_0_0_0_1px_rgb(255_255_255/0.16)]'
                    } ${
                      selected
                        ? 'phone:outline-offset-[3px] phone:outline-[color:var(--accent)]'
                        : 'phone:outline-offset-0 phone:outline-transparent'
                    }`}
                    style={{ backgroundColor: color.hex }}
                  >
                    {selected ? (
                      <Check
                        className={`h-5 w-5 ${
                          isLightColor(color.hex) ? 'text-[#0D1117]' : 'text-white'
                        } phone:hidden`}
                      />
                    ) : null}
                  </span>
                  <span className="motif-spec min-w-0 truncate phone:sr-only">{color.name}</span>
                </button>
              );
            })}
          </div>
        </div>
      ) : null}

      {showUpgrades ? (
        <div className="mt-5 border-t border-white/10 pt-5 phone:border-t-0 phone:pt-0">
          <QuoteAddOnsSelector
            addOns={draft.addOns}
            door={draft.door}
            error={errors.addOns}
            errorId="err-addOns"
            onToggleAddOn={onToggleAddOn}
          />
        </div>
      ) : null}

      <label data-qm-row="" className={`mt-5 block text-sm font-medium ${phoneSelectRow}`}>
        <span className={`${specLabel} ${phoneRowCaption}`}>Foundation Needed?</span>
        <span className={`relative block ${phoneSelectWrap}`}>
          <select
            name="foundation"
            value={draft.foundation}
            onChange={onInputChange}
            aria-describedby={wantsSlab ? 'foundation-slab-note' : undefined}
            data-qm-row-input=""
            className={`${specSelect} ${phoneSelect}`}
          >
            <option value="none">None</option>
            <option value="blocks_level">Blocks &amp; Level (included)</option>
            <option value="anchored_slab">Anchored Slab (priced after site review)</option>
          </select>
          <ChevronDown
            aria-hidden="true"
            className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/45 phone:hidden"
          />
          <PhoneSelectValue
            label={FOUNDATION_VALUE_LABELS[draft.foundation] ?? draft.foundation}
          />
        </span>
      </label>
      {/* Slab work is never in the online estimate: David prices it from site photos, usually after seeing the spot. */}
      {wantsSlab ? (
        <p
          id="foundation-slab-note"
          className="mt-2 text-xs leading-5 text-white/60 phone:qm-section-footer phone:mt-2!"
        >
          Slab work isn&apos;t in the online estimate. David prices it from photos of
          your spot, and depending on what they show, he&apos;ll most likely need to see
          it in person.
        </p>
      ) : (
        // Phone-only footnote: the row shows a short value, the picker keeps the full labels.
        <p aria-hidden="true" className="hidden phone:block phone:qm-section-footer phone:mt-2!">
          Blocks &amp; level is included. A slab is priced after a site review.
        </p>
      )}

    </QuoteSectionCard>
  );
}
