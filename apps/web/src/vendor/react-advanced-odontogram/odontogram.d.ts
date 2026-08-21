import { JSX as JSX_2 } from 'react/jsx-runtime';

/** User accepted the divergence: run the deferred edit (status only — the plan
 *  stays as planned), then notify (post-edit refresh + close the modal). No-op
 *  when nothing is pending. */
export declare function acceptDualStateConfirm(): void;

declare type Any = any;

declare function App({ language, onLanguageChange, numberingSystem, onNumberingChange, darkMode, onDarkModeChange, themeConfig, plugins, readOnly: readOnlyProp, enableNotes, enableIcdas, pulpDetailLevel, secondaryCariesMode, rootCariesMode, radiographicDepthMode, cariesDepthEnabled, wearDetailLevel, discolorationDetailLevel, surfaceNotation, showStatusCard: showStatusCardProp, showOrthoCard: showOrthoCardProp, }: AppProps): JSX_2.Element;
export { App as OdontogramShell }
export default App;

/**
 * Props for the main Odontogram application component.
 *
 * All props are optional — when omitted, the component operates in
 * **standalone** mode with internal state. When provided, the component
 * operates in **controlled** mode and delegates state to the parent.
 */
declare type AppProps = {
    /** Override the UI language (controlled mode). */
    language?: Language;
    /** Callback when the user changes the language. */
    onLanguageChange?: (lang: Language) => void;
    /** Override the tooth numbering system (controlled mode). */
    numberingSystem?: NumberingSystem;
    /** Callback when the user changes the numbering system. */
    onNumberingChange?: (system: NumberingSystem) => void;
    /** Override dark mode state (controlled mode). */
    darkMode?: boolean;
    /** Callback when the user toggles dark mode. */
    onDarkModeChange?: (dark: boolean) => void;
    /**
     * Custom theme configuration. Overrides the default color palette via
     * CSS custom properties (`--odon-*`). See {@link OdontogramThemeConfig}.
     */
    themeConfig?: OdontogramThemeConfig;
    /**
     * Custom SVG plugins for extending the odontogram with additional visual
     * overlays and per-tooth custom state. See {@link OdontogramPlugin}.
     */
    plugins?: OdontogramPlugin[];
    /**
     * When true, disables all interactions (click, touch, keyboard).
     * Useful for print/report/view modes.
     */
    readOnly?: boolean;
    /**
     * When true, enables per-tooth notes. Double-click a tooth to add/edit a note.
     * Notes are shown in hover tooltips and included in JSON export/import.
     */
    enableNotes?: boolean;
    /**
     * Enable ICDAS II per-surface caries scoring (0–6). When enabled, the depth
     * selector/popup expose ICDAS codes 1–6 and the surface indicator shows a
     * numeric badge; otherwise the 3-level scale is used.
     */
    enableIcdas?: boolean;
    /**
     * Pulp-diagnosis detail level for the pulp control:
     * `"simple"` (healthy / pulpitis), `"aae"` (4 AAE pulp diagnoses, default) or
     * `"latin"` (9 practical-Latin subtypes). A stored value round-trips at every
     * level; the level only governs how the pulp control presents it.
     */
    pulpDetailLevel?: PulpDetailLevel;
    /**
     * Secondary-caries (CARS) granularity for the per-surface score picker:
     * `"simple"` ([0,3]), `"standard"` ([0,1,3,6], default) or `"full"` ([0..6]).
     * A stored score round-trips at every mode; the mode only governs the offered
     * option list. (The mode UI lives in the Settings modal; this prop is the
     * controlled entry point.)
     */
    secondaryCariesMode?: SecondaryCariesMode;
    /**
     * Root-caries granularity for the per-tooth picker: `"simple"` (none /
     * present, default) or `"severity"` (the full none/active/arrested/
     * active-cavitated enum). Non-collapsing across modes.
     */
    rootCariesMode?: RootCariesMode;
    /**
     * Radiographic-depth granularity for the per-surface picker: `"off"`
     * (hidden, default), `"threeLevel"` (superficial/middle/deep) or `"detailed"`
     * (E1..D3). When off, the per-surface radiographic badge is not shown.
     */
    radiographicDepthMode?: RadiographicDepthMode;
    /**
     * Whether the visual caries-depth encoding (per-surface depth picker + the
     * opacity/contour depth tier in the render) is active. Default `true`; set
     * `false` to render caried surfaces at the SVG default with no depth tier.
     */
    cariesDepthEnabled?: boolean;
    /**
     * Detail level for the per-tooth wear control: `"simple"` (yes/no toggle for
     * attrition) or `"complex"` (wear type per edge and cervix, default).
     */
    wearDetailLevel?: ToothDetailLevel;
    /**
     * Detail level for the per-tooth discoloration control: `"simple"` (yes/no
     * toggle) or `"complex"` (choose the discoloration cause, default).
     */
    discolorationDetailLevel?: ToothDetailLevel;
    /**
     * Surface-notation mode for caries/filling surface letters + captions:
     * `"full"` (default) makes them position-aware (incisal on an anterior
     * tooth, labial on an anterior buccal surface, palatal on an upper lingual
     * surface) or `"simple"` (always the tooth-independent B/O/L set).
     */
    surfaceNotation?: SurfaceNotation;
    /**
     * Whether the Statuses panel (`#statusCard`) is shown. Default `true`. The
     * panel visibility is a settings-driven wrapper around the section — the
     * section's own imperative collapse/expand behavior is unaffected.
     */
    showStatusCard?: boolean;
    /**
     * Whether the Orthodontics panel (`#orthoCard`) is shown. Default `true`.
     * Composes with the panel's own imperative ortho-eligibility gate (hidden
     * when no selected tooth is ortho-eligible) — both must be satisfied for
     * the panel to render.
     */
    showOrthoCard?: boolean;
};

/** User cancelled: do NOT apply the edit; re-sync the active tooth's controls
 *  from stored state so the control the user just changed snaps back (no stale
 *  UI), then notify (refresh + close the modal). No-op when nothing is pending. */
export declare function cancelDualStateConfirm(): void;

declare type ChartMode = "status" | "plan";

/** Remove the stored entry for the active (or default) key. */
export declare function clearPersistedState(): void;

/**
 * Clear the current tooth selection and reset the active tooth. Useful when
 * switching to view or quote-builder mode from the host application.
 */
export declare function clearSelection(): void;

/** Close the perio-chart overlay. No-op (still notifies) if already closed. */
export declare function closePerioOverlay(): void;

/**
 * Tear down the odontogram engine: clear all DOM elements built by the engine,
 * unsubscribe from i18n changes, and reset internal state. After this call,
 * {@link initOdontogram} may be called again to re-initialise.
 */
export declare function destroyOdontogram(): void;

/** Stop persisting. The stored entry is left in place (see clearPersistedState).
 *  A pending debounced save is flushed first so the last edit isn't lost. */
export declare function disablePersistence(): void;

/**
 * Turn on localStorage persistence: restores a previously saved case (if any),
 * then saves on every state change. Idempotent — calling again replaces the
 * previous subscription and options. Call AFTER the odontogram has mounted.
 */
export declare function enablePersistence(options?: PersistenceOptions): void;

/**
 * Export the current odontogram as an HL7 FHIR R4 collection Bundle (JSON).
 * @param options - Optional subject reference (e.g. "Patient/123"); when
 *   omitted a placeholder Patient is embedded.
 */
export declare function exportFhir(options?: FhirExportOptions): void;

/**
 * Export the odontogram as PNG or JPG. Renders the serialized SVG via the
 * browser's native rasterizer (Image → canvas) — much faster than the previous
 * html2canvas DOM rasterization, and sharper.
 */
export declare function exportImage(format?: "png" | "jpg"): Promise<void>;

/**
 * Assemble a printable PDF report (jsPDF-native — vector text + raster chart
 * PNGs, no svg2pdf.js). Gathers all `data` (SVG→PNG
 * rasterization via {@link rasterizeSvgToPng}, summary/classification text,
 * `hasAnyPerioData()`), drives the export-progress overlay, then hands off
 * to the PURE `assemblePdf()` (`src/perioPdf.ts`), which decides section
 * layout from `opts`/`data` alone.
 *
 * jsPDF-in-jsdom note: constructing a real `jsPDF` instance depends on
 * browser canvas/font internals jsdom doesn't fully provide, so this
 * wrapper is NOT unit-tested directly — `assemblePdf`'s section-gating IS
 * thoroughly unit-tested with an injectable fake doc (see
 * `ui3b-export-pdf.test.ts`). This wrapper's own raster→layout→save path is a
 * browser-verify item.
 */
export declare function exportPdf(opts: PdfExportOptions): Promise<void>;

/** Export the full perio chart as PNG/JPG (SVG → canvas @2×, via the
 *  shared {@link rasterizeSvgToCanvas} raster core). */
export declare function exportPerioImage(format?: "png" | "jpg"): Promise<void>;

/** Export the full perio chart as a standalone vector SVG file. */
export declare function exportPerioSvg(): Promise<void>;

export declare function exportStatus(): void;

export declare function exportSvg(): Promise<void>;

/** Options for buildFhirBundle / exportFhir. */
export declare interface FhirExportOptions {
    /**
     * FHIR reference string for the subject, e.g. "Patient/123".
     * When omitted, a placeholder Patient resource is added to the Bundle and
     * referenced by every Observation.
     */
    subject?: string;
}

/** Formats a tooth number for display using the active numbering system AND
 *  the milktooth display-remap ({@link getDisplayedToothNumber}) — the exact
 *  same formatting {@link getOdontogramSummary} uses for every tooth number
 *  it prints (permanent/missing lists, per-section entries, implants). Exported
 *  so the "What changes" box in App.tsx can label a {@link PlanChange.toothNo}
 *  identically, without duplicating the numbering/milktooth logic. */
export declare function formatToothLabel(toothNo: number): string;

export declare function getCariesDepthEnabled(): boolean;

/** Current active chart mode ("status" | "plan"). */
export declare function getChartMode(): ChartMode;

export declare function getDiscolorationDetailLevel(): ToothDetailLevel;

export declare function getFillingComplexity(): "complex" | "simple";

export declare function getFillingDefectEnabled(): boolean;

export declare function getFillingMaterialAvailability(): Record<string, boolean>;

export declare function getFissureSealingEnabled(): boolean;

export declare function getIcdasEnabled(): boolean;

/**
 * Get the current notes-enabled state.
 */
export declare function getNotesEnabled(): boolean;

export declare function getOdontogramSummary(): OdontogramSummary;

export declare function getPdfSettings(): PdfSettings;

/** Current perio index-name display mode. Defaults to `"translated"`. */
export declare function getPerioIndexNameMode(): PerioIndexNameMode;

/** Current per-index perio-chart row visibility. Defaults to all-visible. */
export declare function getPerioRowVisibility(): Record<PerioRowId, boolean>;

/** Current perio-chart housing mode. Defaults to `"toggle"`. */
export declare function getPerioViewMode(): PerioViewMode;

/**
 * Compare the "status" chart against the "plan" chart, tooth by tooth and
 * axis by axis (see {@link DIFF_AXES}), and report every axis whose label
 * differs. Pure and read-only: never mutates either chart, never touches the
 * DOM, never renders — a `parity.test.ts`-safe addition.
 *
 * Returns `[]` whenever the plan chart hasn't been initialized yet (no plan
 * exists to diff against). A tooth absent from either chart resolves via
 * `defaultState()`, so a status-only or plan-only tooth still diffs correctly
 * against the clinical default rather than throwing.
 *
 * Iterates the fixed `ALL_TEETH` list (not chart key insertion order), so
 * results are always grouped by tooth in the same stable clinical order the
 * rest of the app already uses (quadrant-by-quadrant); within a tooth,
 * entries follow `DIFF_AXES` order.
 */
export declare function getPlanChanges(): PlanChange[];

/**
 * Export the PLAN chart's payload alone: same shape as the status export
 * (`{version, globals, teeth}`), but `teeth` is collected from `charts.plan`.
 * `globals` are shared app-level settings, not owned by either chart.
 */
export declare function getPlanChart(): Any;

/**
 * Get a plugin's custom state for a specific tooth.
 *
 * @param toothNo - The FDI tooth number (11–48).
 * @param pluginId - The plugin's unique identifier.
 * @returns The custom state value, or `undefined` if not set.
 */
export declare function getPluginState(toothNo: number, pluginId: string): unknown;

export declare function getPulpDetailLevel(): PulpDetailLevel;

export declare function getRadiographicDepthMode(): RadiographicDepthMode;

/**
 * Get the current read-only mode state.
 */
export declare function getReadOnly(): boolean;

export declare function getRootCariesMode(): RootCariesMode;

export declare function getSecondaryCariesMode(): SecondaryCariesMode;

/**
 * Export the STATUS chart's payload — identical to exportStatus()'s JSON
 * (status-primary; unaffected by the current chart mode).
 */
export declare function getStatusChart(): Any;

export declare function getSurfaceNotation(): SurfaceNotation;

/**
 * Get a human-readable summary of all active states for a tooth.
 * Useful for building custom tooltip or info-panel UIs.
 *
 * @param toothNo - The FDI tooth number (11–48).
 * @returns Array of localized state description strings.
 */
export declare function getToothStateSummary(toothNo: number): string[];

export declare function getWearDetailLevel(): ToothDetailLevel;

/** True iff ANY periodontal axis has been charted anywhere in the mouth. Used
 *  to auto-skip the perio section of an export and to disable the
 *  perio image-export menu items on a blank chart. Derived entirely from
 *  `getPerioSummary()` — no new traversal. */
export declare function hasAnyPerioData(): boolean;

export declare function importStatus(data: Any): void;

/**
 * Initialise the odontogram engine: wire up DOM controls, build the SVG tooth
 * grid, and start listening for i18n changes. Safe to call multiple times
 * (subsequent calls are no-ops).
 */
export declare function initOdontogram(): Promise<void>;

/** Whether a status-vs-plan divergence confirm is awaiting the user's choice. */
export declare function isDualStateConfirmPending(): boolean;

/** Whether the perio-chart overlay is currently open. */
export declare function isPerioOverlayOpen(): boolean;

/** True while a state-change subscription is active. */
export declare function isPersistenceEnabled(): boolean;

/**
 * Supported UI languages.
 *
 * | Code  | Language             |
 * |-------|-----------------------|
 * | hu    | Hungarian             |
 * | en    | English               |
 * | de    | German                |
 * | es    | Spanish               |
 * | it    | Italian               |
 * | sk    | Slovak                |
 * | pl    | Polish                |
 * | ru    | Russian               |
 * | pt-br | Portuguese (Brazil)   |
 * | zh    | Chinese (Simplified) |
 * | ar    | Arabic (RTL — UI mirrors, dental/perio charts pinned LTR) |
 * | fr    | French                |
 */
declare type Language = "hu" | "en" | "de" | "es" | "it" | "sk" | "pl" | "ru" | "pt-br" | "zh" | "ar" | "fr";

/**
 * Supported tooth numbering systems.
 * - **FDI** – ISO 3950 two-digit notation (default in most countries).
 * - **UNIVERSAL** – ADA numbering (1-32 adult, A-T primary).
 * - **PALMER** – Quadrant-based notation (UR/UL/LL/LR + position).
 */
declare type NumberingSystem = "FDI" | "UNIVERSAL" | "PALMER";

/**
 * Custom SVG plugin definition for the Odontogram engine.
 *
 * Plugins can inject custom SVG content into each tooth's rendering and
 * maintain per-tooth custom state that is automatically included in
 * JSON export/import.
 *
 * @example
 * ```typescript
 * const implantBrandPlugin: OdontogramPlugin = {
 *   id: "implant-brand",
 *   label: { hu: "Implantátum márka", en: "Implant brand", de: "Implantat-Marke", ... },
 *   layer: "overlay",
 *   renderSvg: (toothNo, _quadrant, customState) => {
 *     if (!customState?.brand) return null;
 *     return `<text x="16" y="60" font-size="6" fill="#3b7bff">${customState.brand}</text>`;
 *   },
 * };
 * ```
 */
export declare type OdontogramPlugin = {
    /** Unique plugin identifier (used as key in customStates). */
    id: string;
    /** Localized display label for the plugin (shown in the state tooltip). */
    label: Partial<Record<Language, string>>;
    /**
     * SVG layer where this plugin's output will be rendered.
     * @see {@link PluginLayer}
     */
    layer: PluginLayer;
    /**
     * Render SVG markup for a specific tooth. Return an SVG fragment string
     * (will be wrapped in a `<g>` element) or `null`/`undefined` to render nothing.
     *
     * @param toothNo - The FDI tooth number (11–48).
     * @param quadrant - The quadrant (1–4) derived from the tooth number.
     * @param customState - The plugin's custom state for this tooth, or `undefined`.
     */
    renderSvg: (toothNo: number, quadrant: 1 | 2 | 3 | 4, customState: unknown) => string | null | undefined;
    /**
     * Optional: which panel section this plugin adds controls to.
     * When set to `"custom"`, the engine will render a dedicated panel
     * section for the plugin (future expansion).
     */
    panelSection?: "custom";
};

/** Structured, already-localized textual summary of the whole odontogram. */
export declare type OdontogramSummary = {
    overview: string;
    permanentList: string | null;
    missingList: string | null;
    /** Grouped dentition table (the flat permanent/missing lists stay for
     *  back-compat). */
    toothTable: OdontogramToothTable;
    /** True when any odontogram-markable periodontal finding
     *  (inflammation, mobility, calculus, …) exists — drives showing the perio
     *  summary line in the PDF's odontogram section even with no perio module. */
    periodontalHasFindings: boolean;
    sections: OdontogramSummarySection[];
    /** Implants heading + list — only present when at least one implant exists. */
    implants: {
        heading: string;
        text: string;
    } | null;
    periodontalTitle: string;
    periodontalText: string;
    /** The status->plan diff (see {@link getPlanChanges}), verbatim.
     *  `[]` whenever the plan chart hasn't been initialized or plan === status —
     *  a distinct field, not a section, since it's a diff rather than a status
     *  list. The "What changes" box in App.tsx renders from this field only
     *  when it's non-empty. */
    plannedChanges: PlanChange[];
    /** Per-tooth free-text notes — one "&lt;tooth&gt;: &lt;note&gt;" line per tooth
     *  that carries a note (gated on the notes-enabled setting, like the tooltip).
     *  `null` when no tooth has a note, so the panel/PDF omit the section entirely. */
    individualNotes: {
        heading: string;
        items: string[];
    } | null;
};

/** One heading + its per-tooth entries in the tooth-information summary. */
export declare type OdontogramSummarySection = {
    key: "caries" | "fillings" | "endo" | "diagnoses" | "wear" | "discoloration" | "orthodontics" | "prosthetics";
    heading: string;
    items: string[];
    /** Localized "no such tooth" sentence, shown when `items` is empty. */
    emptyText: string;
};

/**
 * Theme configuration for the Odontogram component.
 *
 * Allows host applications to override the default color palette without
 * modifying CSS files. All properties are optional — only the provided
 * values are overridden; the rest fall back to the built-in defaults.
 *
 * Colors are applied as CSS custom properties (`--odon-*`) on the
 * component root element, so they work regardless of whether the host
 * uses Tailwind CSS or plain CSS.
 *
 * @example
 * ```tsx
 * const myTheme: OdontogramThemeConfig = {
 *   colors: {
 *     accent: '#e74c3c',
 *     background: '#fafafa',
 *   },
 * };
 * <App themeConfig={myTheme} />
 * ```
 */
export declare type OdontogramThemeConfig = {
    colors?: {
        /** Primary background. Default: `#f3f6fb` (light) / `#0f172a` (dark). */
        background?: string;
        /** Panel & card background. Default: `#ffffff` (light) / `#1e293b` (dark). */
        panel?: string;
        /** Card background. Default: same as panel. */
        card?: string;
        /** Primary text color. Default: `#1e2a3a` (light) / `#f1f5f9` (dark). */
        text?: string;
        /** Muted / secondary text color. Default: `#5b6b7d` (light) / `#94a3b8` (dark). */
        muted?: string;
        /** Border / divider color. Default: `#d7e0ec` (light) / `#334155` (dark). */
        line?: string;
        /** Primary accent (buttons, active states). Default: `#3b7bff`. */
        accent?: string;
        /** Secondary accent (success, selected states). Default: `#12b981`. */
        accent2?: string;
    };
};

/** A grouped dentition overview: category columns (only non-empty ones) ×
 *  anatomical group rows (whole mouth / jaw / quadrant / sextant), each cell a
 *  list of that group's teeth of that category, tagged with a status. */
declare interface OdontogramToothTable {
    columns: {
        key: string;
        label: string;
    }[];
    rows: {
        key: string;
        label: string;
        cells: Record<string, ToothTableCell[]>;
    }[];
    /** Localized note explaining the bold / bold-italic emphasis. */
    legend: string;
}

/**
 * Subscribe to odontogram state changes. The callback runs after any tooth
 * state edit, the edentulous toggle, or an import.
 *
 * @param cb - Callback invoked on each change.
 * @returns An unsubscribe function.
 */
export declare function onStateChange(cb: () => void): () => void;

/** Open the perio-chart overlay. No-op (still notifies) if already open. */
export declare function openPerioOverlay(): void;

declare type PdfBorderThickness = "thin" | "medium" | "thick";

/** Selectable report colour themes — the default is "blue"; the other three are
 *  distinct but equally calm/medical. */
declare type PdfColorTheme = "blue" | "teal" | "amber" | "slate";

declare type PdfDateFormat = "iso" | "dmy" | "mdy";

/** Which PDF sections the user opted into. The perio sections are additionally
 *  auto-skipped whenever `data.hasPerio` is false (see {@link assemblePdf}),
 *  regardless of these flags — a blank perio chart never gets an empty
 *  "Periodontal status" page. */
declare interface PdfExportOptions {
    patientData: boolean;
    /** The odontogram chart IMAGE — selectable independently of its prose
     *  description in the export dialog. */
    odontogramChart: boolean;
    /** The whole-mouth odontogram summary PROSE. */
    odontogramDescription: boolean;
    /** The per-tooth "Individual notes" section — omitted whenever no tooth
     *  carries a note (`data.individualNotes` empty), regardless of this flag. */
    individualNotes: boolean;
    perioStatus: boolean;
    perioDescription: boolean;
}

declare type PdfPerioFontSize = "small" | "normal" | "xlarge";

declare type PdfPerioLabelPlacement = "center" | "edge";

declare interface PdfSettings {
    /** Placeholder patient name when the case has none (default "John Doe"). */
    defaultName: string;
    /** Placeholder DOB (ISO `YYYY-MM-DD`) when the case has none. */
    defaultDob: string;
    /** Show the patient's age (in parentheses) after the DOB. */
    showAge: boolean;
    /** Date order for DOB / exam date / generation timestamp. */
    dateFormat: PdfDateFormat;
    /** Report colour theme. */
    colorTheme: PdfColorTheme;
    /** Show the bone/gum base layer on the dental chart. */
    showBone: boolean;
    /** Show the healthy-pulp layer on the dental chart. */
    showHealthyPulp: boolean;
    /** How close the teeth sit — closer spacing yields a taller chart image. */
    toothSpacing: PdfToothSpacing;
    /** Draw a frame around the dental-chart image. */
    border: boolean;
    borderThickness: PdfBorderThickness;
    /** Frame colour (CSS hex, default black). */
    borderColor: string;
    /** Tooth-number label size. */
    toothNumberSize: PdfToothNumberSize;
    /** Include the whole-mouth prose description of the chart. */
    includeOdontogramText: boolean;
    /** Include the tabular findings/prosthetic summary. */
    includeOdontogramTable: boolean;
    /** Perio-chart tooth spacing (closer → taller chart image). */
    perioToothSpacing: PdfToothSpacing;
    /** Show numeric rows that have no charted value anywhere. */
    perioShowEmptyRows: boolean;
    /** Buccal / Lingual-Palatal band-label placement. */
    perioLabelPlacement: PdfPerioLabelPlacement;
    /** Perio-chart row/label font size. */
    perioFontSize: PdfPerioFontSize;
    /** Include the periodontal metrics + classification table. */
    includePerioTable: boolean;
    /** Include the abbreviation glossary. */
    includePerioAbbrev: boolean;
    /** Show the medical disclaimer at the bottom of the report. */
    showDisclaimer: boolean;
    /** Custom disclaimer text; empty = use the localized default. Editable only
     *  while `showDisclaimer` is on. */
    disclaimerText: string;
    /** Show the generation / version / attribution stamp. */
    showGenerator: boolean;
    /** How the dentition overview table is grouped (also drives the on-screen
     *  Tooth-information panel table). */
    summaryGrouping: PdfSummaryGrouping;
}

declare type PdfSummaryGrouping = "whole" | "jaw" | "quadrant" | "sextant";

declare type PdfToothNumberSize = "small" | "normal" | "xlarge";

declare type PdfToothSpacing = "wide" | "medium" | "close";

/**
 * Full-mouth perio-chart. The 32-tooth x 6-site grid (~450+ interactive
 * cells) is built with plain DOM (`buildArch`), NOT JSX/React state, and
 * updated via targeted `syncToothCells` calls rather than a full React
 * re-render — see `syncOneTooth`/`fullResync` below. Only the compact summary
 * bar is React-controlled (`useState`), since re-rendering ~4 numbers on every
 * edit is cheap. `suppressResyncRef` prevents the grid's own edits from ALSO
 * triggering a redundant full resync via the `onStateChange` subscription
 * (setPerioSite/setToothMobility both fire it synchronously) — external edits
 * (dual-state chart-mode switch, or another consumer editing perio data while
 * the overlay is open) still trigger the full resync normally. All writes go
 * through the data core (`setPerioSite`/`getToothPerio`/`getToothCal`/
 * `getPerioSummary`/`getPerioChart`); keyboard auto-advance between cells is
 * handled by `handleGridKeyDown`.
 *
 * Layers OVER the odontogram, which it never unmounts: `position: fixed`,
 * full-screen, high z-index (`.perio-overlay` in `index.css`). Mirrors
 * `SettingsModal`'s dialog contract — `role="dialog"` + `aria-modal`, Esc
 * closes, backdrop click closes, focus trap + focus-restore on close — on a
 * single element (`#perioOverlay` itself is the dialog; there is no separate
 * backdrop element, unlike `SettingsModal`).
 *
 * The optional `inline` prop selects a second chrome for the SAME body (grid +
 * summary bar) — a plain panel (`#perioInlinePanel`) meant to fill the chart
 * area in place of the hidden-but-mounted odontogram, instead of the
 * fixed-position modal dialog. `open`/`onClose` are the MODAL chrome's
 * contract and are ignored when `inline` is true (the caller controls
 * mount/unmount of an inline instance directly via conditional rendering) —
 * there is nothing to "close" in an embedded panel. Dialog-only concerns
 * (focus trap/restore, Esc-to-close, backdrop click, `role="dialog"`) do not
 * apply to the inline chrome at all.
 */
export declare function PerioChart({ open, onClose, inline, }: {
    open?: boolean;
    onClose?: () => void;
    inline?: boolean;
}): JSX_2.Element;

/** How perio-chart index row labels are rendered. */
export declare type PerioIndexNameMode = "translated" | "canonical";

/** The 16 toggleable periodontal index rows the Dental Chart can show/hide. */
export declare type PerioRowId = "plaque" | "bop" | "cal" | "gm" | "pd" | "furcation" | "mobility" | "cej" | "rootConcavity" | "pi" | "gi" | "mpi" | "mbi" | "kg" | "gt" | "miller";

export declare type PerioViewMode = "toggle" | "popup";

export declare type PersistenceOptions = {
    /** localStorage key. Default: "react-advanced-odontogram". */
    key?: string;
    /** Persist the plan chart too (payload's `plan` field). Default: false. */
    includePlan?: boolean;
    /** Called on any storage/parse error instead of console.warn. */
    onError?: (err: Error) => void;
};

declare type PlanChange = {
    toothNo: number;
    axis: string;
    from: string;
    to: string;
};

/**
 * Defines the SVG layer where a plugin's visual output will be inserted.
 *
 * | Layer         | Z-order | Description                             |
 * |---------------|---------|----------------------------------------|
 * | `base`        | 0       | Below the tooth — background indicators |
 * | `restoration` | 3       | Between endo and crown layers           |
 * | `overlay`     | 6       | Top-most — badges, markers, highlights  |
 */
export declare type PluginLayer = "base" | "restoration" | "overlay";

export declare type PulpDetailLevel = "simple" | "aae" | "latin";

export declare type RadiographicDepthMode = "off" | "threeLevel" | "detailed";

/**
 * Register one or more custom SVG plugins. Plugins can inject visual overlays
 * into the tooth SVG and maintain per-tooth custom state included in export/import.
 *
 * @param plugins - Array of {@link OdontogramPlugin} definitions.
 */
export declare function registerPlugins(plugins: OdontogramPlugin[]): void;

export declare type RootCariesMode = "simple" | "severity";

export declare type SecondaryCariesMode = "simple" | "standard" | "full";

export declare function setCariesDepthEnabled(value: boolean): void;

/**
 * Switch the active chart between "status" (current findings) and "plan"
 * (proposed treatment). The first time "plan" is entered, it is deep-cloned
 * from "status" (see {@link cloneChart}); later switches reuse the existing
 * plan chart untouched. Re-renders every tooth from the newly active chart
 * via the SAME full-repaint mechanism `importStatus()` uses, so no new
 * render path is introduced and SVG output stays byte-identical to the
 * single-chart render (parity is unaffected — only WHICH chart is active
 * changes, never how a chart renders).
 *
 * @param mode - "status" or "plan"; any other value is ignored.
 */
export declare function setChartMode(mode: ChartMode): void;

export declare function setDiscolorationDetailLevel(value: ToothDetailLevel): void;

export declare function setFillingComplexity(v: "complex" | "simple"): void;

export declare function setFillingDefectEnabled(v: boolean): void;

export declare function setFillingMaterialAvailability(material: string, v: boolean): void;

export declare function setFissureSealingEnabled(v: boolean): void;

/** Toggle visibility of the healthy-pulp layer on all teeth. */
export declare function setHealthyPulpVisible(on: Any): void;

export declare function setIcdasEnabled(value: boolean): void;

/** Set which parser the next file import uses. Defaults back to "status" after each import. */
export declare function setImportFormat(format: "status" | "fhir"): void;

/**
 * Enable or disable per-tooth notes. When enabled, double-clicking a tooth
 * opens a note editor popover, and notes are shown in hover tooltips with
 * a badge indicator.
 *
 * @param value - `true` to enable notes, `false` to disable.
 */
export declare function setNotesEnabled(value: boolean): void;

/**
 * Switch the displayed tooth numbering system and re-render all tooth labels.
 * @param system - The target {@link NumberingSystem}.
 */
export declare function setNumberingSystem(system: NumberingSystem): void;

/** Toggle visibility of occlusal-view tiles (premolars and molars). */
export declare function setOcclusalVisible(on: Any): void;

export declare function setPdfSettings(patch: Partial<PdfSettings>): void;

/** Switch the perio index-name display mode. No-op (does not notify) if unchanged. */
export declare function setPerioIndexNameMode(mode: PerioIndexNameMode): void;

/** Show/hide one perio-chart index row. No-op (does not notify) if unchanged. */
export declare function setPerioRowVisibility(id: PerioRowId, visible: boolean): void;

/** Switch the perio-chart housing mode. No-op (does not notify) if unchanged. */
export declare function setPerioViewMode(mode: PerioViewMode): void;

/**
 * Hydrate `payload.teeth` into the PLAN chart ONLY (status is left
 * untouched), mirroring the per-tooth hydrate importStatus() performs for
 * the status chart. Marks the plan chart initialized. Repaints the DOM only
 * when PLAN is the currently active chart mode — hydrating a chart that
 * isn't on screen must not visibly disturb whatever IS on screen (mirrors
 * setChartMode()'s own full-repaint-on-activation behavior).
 */
export declare function setPlanChart(payload: Any): void;

/**
 * Set a plugin's custom state for a specific tooth. Triggers SVG re-render
 * for that tooth and updates the tooltip.
 *
 * @param toothNo - The FDI tooth number (11–48).
 * @param pluginId - The plugin's unique identifier.
 * @param value - The custom state value (any JSON-serializable value, or `undefined` to clear).
 */
export declare function setPluginState(toothNo: number, pluginId: string, value: unknown): void;

export declare function setPulpDetailLevel(value: PulpDetailLevel): void;

export declare function setRadiographicDepthMode(value: RadiographicDepthMode): void;

/**
 * Enable or disable read-only mode. When read-only, all click, touch, and
 * keyboard interactions are disabled. The control panel is dimmed and
 * non-interactive. Useful for print/report views.
 *
 * @param value - `true` to enable read-only mode, `false` to disable.
 */
export declare function setReadOnly(value: boolean): void;

export declare function setRootCariesMode(value: RootCariesMode): void;

export declare function setSecondaryCariesMode(value: SecondaryCariesMode): void;

/** Toggle visibility of the bone/gum base layer on all teeth. */
export declare function setShowBase(on: Any): void;

export declare function setSurfaceNotation(value: SurfaceNotation): void;

export declare function setWearDetailLevel(value: ToothDetailLevel): void;

/** Toggle visibility of wisdom teeth (18, 28, 38, 48). */
export declare function setWisdomVisible(on: Any): void;

/** Start the 12-step interactive intro tour. */
export declare function startIntroTour(): void;

export declare type SurfaceNotation = "simple" | "full";

export declare type ToothDetailLevel = "simple" | "complex";

declare interface ToothTableCell {
    toothNo: number;
    label: string;
    status: ToothTableStatus;
}

/** Per-tooth status in the grouped dentition table — `empty`
 *  (nothing charted), `content` (has some finding/treatment — shown bold/accent),
 *  `problem` (caries / root inflammation / diagnosis / wear / discoloration —
 *  shown bold-italic in a warning colour). */
declare type ToothTableStatus = "empty" | "content" | "problem";

export { }
