'use client';

import { useId, useState, type ChangeEvent, type ComponentType } from 'react';
import clsx from 'clsx';
import { Check, ChevronDown, Info } from 'lucide-react';
import { roofLabels, type QuoteFormErrors, type QuoteFormParams } from '@/lib/quoteForm';
import { QUOTE_DIMENSION_MIN_FT, QUOTE_LEAN_TO_MAX_WIDTH_FT } from '@/lib/quoteLimits';
import {
  ROOF_STYLE_OPTIONS,
  SIZE_PRESETS,
  STRUCTURE_OPTIONS,
  WALL_HEIGHT_OPTIONS,
  type QuotePresetKey,
} from '@/lib/quoteFlow';
import { triggerHaptic } from '@/lib/haptics';
import {
  GableProfile,
  GambrelProfile,
  LeanToProfile,
} from '@/components/motif/diagrams';
import { QuoteBuildingPicker } from '@/components/quote/QuoteBuildingPicker';
import { QuoteNumberStepper } from '@/components/quote/QuoteNumberStepper';
import {
  QuoteFieldError,
  QuoteSectionCard,
} from '@/components/quote/QuoteSectionCard';
import {
  QuoteSegmentedChoice,
  type QuoteSegmentedOption,
} from '@/components/quote/QuoteSegmentedChoice';
import {
  specChip,
  specField,
  specLabel,
  specSelect,
  specTile,
} from '@/components/quote/quoteStyles';

const roofDiagrams: Record<
  'gabled' | 'barn' | 'lean-to',
  ComponentType<{ className?: string; strokeWidth?: number }>
> = {
  gabled: GableProfile,
  barn: GambrelProfile,
  'lean-to': LeanToProfile,
};

const ROOF_MATERIALS = ['29ga metal', '26ga metal'] as const;

/*
 * Phone-only (`phone:`) styling for the custom length/width rows: the wrapper
 * is `display: contents` on desktop so the grid still sees the <label> alone.
 */
const dimensionRow =
  'contents phone:flex phone:items-start phone:gap-3 phone:py-1 phone:pl-4 phone:pr-3 phone:transition-colors phone:has-[input:focus]:bg-[var(--qm-group-pressed)]';
const dimensionLabel =
  'phone:flex phone:min-w-0 phone:flex-1 phone:flex-wrap phone:items-center phone:gap-x-3 phone:[&>p[role=alert]]:mt-0 phone:[&>p[role=alert]]:basis-full phone:[&>p[role=alert]]:px-0 phone:[&>p[role=alert]]:pb-2.5';
const dimensionCaption =
  'phone:flex phone:h-11 phone:min-w-0 phone:flex-1 phone:items-center phone:qm-body phone:text-[var(--qm-label)]';
// `outline-none!`: the row shows focus (tint); the global phone focus ring
// otherwise outranks the `[data-qm-row-input]` reset on specificity.
const dimensionInput =
  'phone:h-11 phone:w-16 phone:m-0 phone:p-0 phone:border-0 phone:bg-transparent phone:rounded-none phone:shadow-none phone:text-right phone:qm-body phone:tabular-nums phone:text-[var(--qm-label)] phone:focus-visible:outline-none! phone:[appearance:textfield] phone:[&::-webkit-inner-spin-button]:appearance-none phone:[&::-webkit-outer-spin-button]:appearance-none';

/** A number that rolls in from the direction it changed (phone readout only). */
function RollingNumber({ value }: { value: string }) {
  const [previous, setPrevious] = useState(value);
  const [direction, setDirection] = useState<'none' | 'up' | 'down'>('none');
  if (value !== previous) {
    setPrevious(value);
    setDirection(Number(value) < Number(previous) ? 'down' : 'up');
  }

  return (
    <span
      key={value}
      data-dir={direction}
      className="inline-block transition-[translate,opacity] duration-[320ms] ease-[var(--qm-ease-spring)] data-[dir=down]:starting:-translate-y-[0.55em] data-[dir=down]:starting:opacity-0 data-[dir=up]:starting:translate-y-[0.55em] data-[dir=up]:starting:opacity-0"
    >
      {value}
    </span>
  );
}

export function QuoteSizeStyleStep({
  draft,
  errors,
  area,
  maxLength,
  maxWidth,
  sizePreset,
  showWallHeight,
  showRoofStyle,
  showRoofMaterial,
  onInputChange,
  onStructureTypeChange,
  onSizePresetChange,
  onWallHeightChange,
  onRoofStyleChange,
  onRoofMaterialChange,
}: {
  draft: QuoteFormParams;
  errors: QuoteFormErrors;
  area: number | null;
  maxLength: number;
  maxWidth: number;
  sizePreset: QuotePresetKey;
  showWallHeight: boolean;
  showRoofStyle: boolean;
  showRoofMaterial: boolean;
  onInputChange: (event: ChangeEvent<HTMLInputElement | HTMLSelectElement>) => void;
  onStructureTypeChange: (structureType: QuoteFormParams['structureType']) => void;
  onSizePresetChange: (sizePreset: QuotePresetKey) => void;
  onWallHeightChange: (wallHeight: QuoteFormParams['wallHeight']) => void;
  onRoofStyleChange: (roofStyle: QuoteFormParams['roofStyle']) => void;
  onRoofMaterialChange: (roofMaterial: QuoteFormParams['roofMaterial']) => void;
}) {
  const ids = useId();
  const sizeHeaderId = `${ids}size`;
  const wallHeightLabelId = `${ids}wall-height`;
  const roofMaterialLabelId = `${ids}roof-material`;
  const widthMax =
    draft.roofStyle === 'lean-to'
      ? Math.min(maxWidth, QUOTE_LEAN_TO_MAX_WIDTH_FT)
      : maxWidth;

  // Phones: the size/roof sections rise in when a building is picked here,
  // but not when a step with a saved building mounts (Back, restore).
  const [revealSections, setRevealSections] = useState(!draft.structureType);
  if (!draft.structureType && !revealSections) setRevealSections(true);

  const stepDimension = (name: 'length' | 'width') => (next: string) =>
    onInputChange({ target: { name, value: next } } as ChangeEvent<HTMLInputElement>);

  const sizeOptions: QuoteSegmentedOption<QuotePresetKey>[] = [
    ...SIZE_PRESETS.map((preset) => ({
      value: preset.key,
      label: preset.label,
      className: 'whitespace-nowrap',
    })),
    {
      value: 'custom',
      label: (
        <>
          Custom<span className="phone:sr-only"> Size</span>
        </>
      ),
      className: 'order-last whitespace-nowrap min-[460px]:ml-3 phone:order-none phone:ml-0',
    },
  ];

  return (
    <QuoteSectionCard title="Size & Style" code="01 / 03" eyebrow="Step 1 of 3">
      <label className="block text-sm font-medium phone:hidden">
        <span className={specLabel}>Structure Type</span>
        <span className="relative block">
          <select
            name="structureType"
            required
            value={draft.structureType}
            onChange={(event) =>
              onStructureTypeChange(event.target.value as QuoteFormParams['structureType'])
            }
            className={specSelect}
          >
            <option value="" disabled>
              Select a structure
            </option>
            {STRUCTURE_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          <ChevronDown
            aria-hidden="true"
            className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/45"
          />
        </span>
      </label>

      <QuoteBuildingPicker
        value={draft.structureType}
        onChange={onStructureTypeChange}
      />

      {draft.structureType ? (
        <div
          className={clsx(
            'mt-5 space-y-6 phone:mt-8 phone:space-y-8',
            revealSections && 'phone:qm-animate-rise'
          )}
        >
          <div
            className={clsx(
              'space-y-2 phone:flex phone:flex-col',
              sizePreset === 'custom' && 'phone:mb-4'
            )}
          >
            <p
              id={sizeHeaderId}
              aria-hidden="true"
              className="hidden phone:block phone:qm-section-header"
            >
              Size
            </p>
            <p className="text-sm text-white/60 phone:sr-only">
              Select a preset or enter a custom size:
            </p>
            {sizePreset !== 'custom' ? (
              <p className="hidden phone:order-last phone:block phone:qm-section-footer phone:tabular-nums">
                <RollingNumber value={draft.width} /> ft wide ×{' '}
                <RollingNumber value={draft.length} /> ft long
              </p>
            ) : null}
            <QuoteSegmentedChoice
              options={sizeOptions}
              value={sizePreset}
              onChange={onSizePresetChange}
              itemClassName={(selected) => specChip(selected)}
              className="-mx-2 flex gap-2 overflow-x-auto px-2 text-sm min-[460px]:flex-nowrap"
              groupLabelledBy={sizeHeaderId}
            />
          </div>

          {sizePreset === 'custom' ? (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 phone:relative phone:mb-[3.625rem] phone:block phone:rounded-[var(--qm-radius-group)] phone:bg-[var(--qm-group)] phone:shadow-[inset_0_0.5px_0_rgb(255_255_255/0.06)]">
              <div
                data-qm-row=""
                className={`${dimensionRow} phone:relative phone:rounded-t-[var(--qm-radius-group)]`}
              >
                <label className={`block text-sm font-medium ${dimensionLabel}`}>
                  <span className={`${specLabel} ${dimensionCaption}`}>Length (ft)</span>
                  <input
                    type="number"
                    name="length"
                    inputMode="numeric"
                    min={QUOTE_DIMENSION_MIN_FT}
                    max={maxLength}
                    step="1"
                    required
                    value={draft.length}
                    onChange={onInputChange}
                    aria-invalid={!!errors.length}
                    aria-describedby={errors.length ? 'err-length' : undefined}
                    data-qm-row-input=""
                    className={`${specField} font-mono tabular-nums ${dimensionInput}`}
                  />
                  <div className="motif-spec mt-1.5 flex justify-between text-white/60 phone:hidden">
                    <span>{draft.length} ft</span>
                  </div>
                  <QuoteFieldError id="err-length" message={errors.length} />
                </label>
                <QuoteNumberStepper
                  value={draft.length}
                  min={QUOTE_DIMENSION_MIN_FT}
                  max={maxLength}
                  onStep={stepDimension('length')}
                  decreaseLabel="Decrease length"
                  increaseLabel="Increase length"
                  announce={(next) => `Length ${next} feet`}
                />
                <span
                  aria-hidden="true"
                  className="pointer-events-none absolute right-0 bottom-0 left-4 hidden h-px origin-bottom scale-y-50 bg-[var(--qm-sep)] phone:block"
                />
              </div>

              <div data-qm-row="" className={`${dimensionRow} phone:rounded-b-[var(--qm-radius-group)]`}>
                <label className={`block text-sm font-medium ${dimensionLabel}`}>
                  <span className={`${specLabel} ${dimensionCaption}`}>Width (ft)</span>
                  <input
                    type="number"
                    name="width"
                    inputMode="numeric"
                    min={QUOTE_DIMENSION_MIN_FT}
                    max={widthMax}
                    step="1"
                    required
                    value={draft.width}
                    onChange={onInputChange}
                    aria-invalid={!!errors.width}
                    aria-describedby={errors.width ? 'err-width' : undefined}
                    data-qm-row-input=""
                    className={`${specField} font-mono tabular-nums ${dimensionInput}`}
                  />
                  {/* Phones: the area becomes a footer under the group (absolute to the group). */}
                  <div className="motif-spec mt-1.5 flex justify-between text-white/60 phone:absolute phone:inset-x-0 phone:top-[calc(100%+0.5rem)] phone:m-0 phone:justify-start phone:gap-1.5 phone:px-4 phone:qm-footnote phone:text-[var(--qm-label-2)]">
                    <span className="phone:hidden">{draft.width} ft</span>
                    {area !== null ? (
                      <>
                        <span aria-hidden="true" className="hidden phone:inline">
                          Floor area
                        </span>
                        <span className="text-[var(--accent-light)] phone:font-semibold phone:tabular-nums">
                          {area} sq ft
                        </span>
                      </>
                    ) : null}
                  </div>
                  <QuoteFieldError id="err-width" message={errors.width} />
                </label>
                <QuoteNumberStepper
                  value={draft.width}
                  min={QUOTE_DIMENSION_MIN_FT}
                  max={widthMax}
                  onStep={stepDimension('width')}
                  decreaseLabel="Decrease width"
                  increaseLabel="Increase width"
                  announce={(next) => `Width ${next} feet`}
                />
              </div>
            </div>
          ) : null}

          {showWallHeight ? (
            <div className="block cursor-default text-sm font-medium">
              <span
                id={wallHeightLabelId}
                className={`${specLabel} phone:qm-section-header`}
              >
                Wall Height (ft)
              </span>
              <QuoteSegmentedChoice
                options={WALL_HEIGHT_OPTIONS.map((height) => ({
                  value: height,
                  label: `${height} ft`,
                }))}
                value={draft.wallHeight}
                onChange={onWallHeightChange}
                itemClassName={(selected) => specChip(selected)}
                className="mt-1.5 flex gap-2 phone:mt-0"
                groupLabelledBy={wallHeightLabelId}
              />
              <p className="mt-2 text-xs leading-5 text-white/50 phone:qm-section-footer">
                6 ft is the included base and uses 69&quot; doors. Published
                wall-height pricing applies to 7 ft and 8 ft walls, which use
                81&quot; doors.
              </p>
            </div>
          ) : null}

          {showRoofStyle ? (
            <div className="space-y-2">
              <p className="brand-subheading flex items-center gap-1.5 text-sm phone:qm-section-header">
                Roof Style
                <span
                  title="Gable: standard gable roof; Gambrel: barn-style roof; Lean-to: single slope"
                  className="phone:hidden"
                >
                  <Info size={16} className="text-white/40" aria-hidden="true" />
                  <span className="sr-only">
                    Gable is a standard roof, Gambrel is barn-style, and Lean-to
                    is a single-slope roof.
                  </span>
                </span>
              </p>
              <div className="flex flex-wrap gap-3 phone:grid phone:grid-cols-3 phone:gap-2.5">
                {ROOF_STYLE_OPTIONS.map((option) => {
                  const Profile = roofDiagrams[option];
                  const selected = draft.roofStyle === option;
                  return (
                    <button
                      key={option}
                      type="button"
                      aria-pressed={selected}
                      onClick={() => {
                        if (!selected) triggerHaptic('selection');
                        onRoofStyleChange(option);
                      }}
                      className={specTile(
                        selected,
                        'flex min-h-[44px] min-w-[44px] flex-col items-center gap-1 px-4 pb-2.5 pt-3 phone:qm-tile phone:min-w-0 phone:justify-center phone:gap-2 phone:px-2 phone:pt-4 phone:pb-3'
                      )}
                    >
                      <Profile
                        className={clsx(
                          'h-16 w-24 sm:h-18 sm:w-28 phone:h-14 phone:w-[5.25rem] phone:transition-colors',
                          selected
                            ? 'phone:text-[var(--accent-light)] phone:[stroke-width:2]'
                            : 'phone:text-[var(--qm-label-2)] phone:[stroke-width:1.5]'
                        )}
                        strokeWidth={selected ? 1.5 : 1.1}
                      />
                      <span className="motif-spec phone:qm-subhead phone:font-semibold">
                        {roofLabels[option]}
                      </span>
                      {selected ? (
                        <span
                          aria-hidden="true"
                          className="hidden phone:absolute phone:top-2 phone:right-2 phone:qm-check-badge phone:qm-animate-pop"
                        >
                          <Check className="size-3.5" strokeWidth={3.5} />
                        </span>
                      ) : null}
                    </button>
                  );
                })}
                <p className="hidden phone:col-span-full phone:block phone:qm-section-footer phone:mt-0!">
                  Gable is a classic peak, Gambrel is barn-style, and Lean-to is
                  a single slope.
                </p>
              </div>
            </div>
          ) : null}

          {showRoofMaterial ? (
            <div className="block cursor-default text-sm font-medium">
              <span
                id={roofMaterialLabelId}
                className={`${specLabel} flex items-center gap-1.5 phone:qm-section-header`}
              >
                Roof Material
                <span title="Thickness of the metal on the roof" className="phone:hidden">
                  <Info size={16} className="text-white/40" aria-hidden="true" />
                  <span className="sr-only">
                    The gauge describes the thickness of the roof metal.
                  </span>
                </span>
              </span>
              <QuoteSegmentedChoice
                options={ROOF_MATERIALS.map((material) => ({
                  value: material,
                  label: material,
                }))}
                value={draft.roofMaterial}
                onChange={onRoofMaterialChange}
                itemClassName={(selected) => specChip(selected)}
                className="mt-1.5 flex gap-2 phone:mt-0"
                groupLabelledBy={roofMaterialLabelId}
              />
              <p className="hidden phone:block phone:qm-section-footer">
                Gauge is the thickness of the roof metal. 26ga is thicker than
                29ga.
              </p>
            </div>
          ) : null}
        </div>
      ) : null}

    </QuoteSectionCard>
  );
}
