"use client";

import type { Appearance } from "./appearance.js";
import { apcVariablesToStyle, cx } from "./appearance.js";

// ============================================================
// Public types
// ============================================================

export type ApcModelColor = "emerald" | "amber" | "purple" | "blue" | "cyan" | "rose" | string;

export interface ApcModelPricing {
  usd?: { prompt: number; completion: number };
  ars?: { prompt?: number | null; completion?: number | null };
}

export interface ApcModelDef {
  id: string;
  /** Display label, e.g. "The Fastest" */
  label: string;
  /** Text inside the colored badge, e.g. "RÁPIDO" */
  badgeText: string;
  /** One of the built-in color keys or any custom string for className-based coloring. */
  badgeColor: ApcModelColor;
  /** Optional tier — if "free" or id ends in ":free", price section shows free label. */
  tier?: string;
  pricing?: ApcModelPricing | null;
}

export interface ModelSelectorTexts {
  freeLabel: string;
  inputLabel: string;
  outputLabel: string;
  creditsUnit: string;
  pricingUnavailable: string;
  title: string;
  subtitle: string;
}

const DEFAULT_TEXTS: ModelSelectorTexts = {
  freeLabel: "Gratis — sin costo por token",
  inputLabel: "Input",
  outputLabel: "Output",
  creditsUnit: "créditos / 1M",
  pricingUnavailable: "Precio no disponible",
  title: "Modelo preferido",
  subtitle: "El asistente usa este modelo en tus conversaciones",
};

export interface ModelSelectorProps {
  models: ApcModelDef[];
  selectedModel: string;
  onSelect: (modelId: string) => void;
  /** If true, hides the header (title/subtitle). Default false. */
  hideHeader?: boolean;
  texts?: Partial<ModelSelectorTexts>;
  appearance?: Appearance;
  className?: string;
}

// ============================================================
// Color maps for built-in badge colors
// ============================================================

const BADGE_BG: Record<string, string> = {
  emerald: "apc-model-badge--emerald",
  amber:   "apc-model-badge--amber",
  purple:  "apc-model-badge--purple",
  blue:    "apc-model-badge--blue",
  cyan:    "apc-model-badge--cyan",
  rose:    "apc-model-badge--rose",
};

const CARD_SELECTED: Record<string, string> = {
  emerald: "apc-model-card--selected-emerald",
  amber:   "apc-model-card--selected-amber",
  purple:  "apc-model-card--selected-purple",
  blue:    "apc-model-card--selected-blue",
  cyan:    "apc-model-card--selected-cyan",
  rose:    "apc-model-card--selected-rose",
};

const RADIO_COLOR: Record<string, string> = {
  emerald: "apc-model-radio--emerald",
  amber:   "apc-model-radio--amber",
  purple:  "apc-model-radio--purple",
  blue:    "apc-model-radio--blue",
  cyan:    "apc-model-radio--cyan",
  rose:    "apc-model-radio--rose",
};

function formatCredits(n: number): string {
  return (n * 1_000_000).toLocaleString("es-AR", { maximumFractionDigits: 4 });
}

function isFree(model: ApcModelDef): boolean {
  return model.tier === "free" || (typeof model.id === "string" && model.id.endsWith(":free"));
}

// ============================================================
// ModelCard — single item
// ============================================================

interface ModelCardProps {
  model: ApcModelDef;
  selected: boolean;
  onSelect: () => void;
  t: ModelSelectorTexts;
  cn: Partial<Record<string, string>>;
}

function ModelCard({ model, selected, onSelect, t, cn }: ModelCardProps) {
  const color = model.badgeColor ?? "blue";
  const hasPricing =
    model.pricing?.usd?.prompt !== null &&
    model.pricing?.usd?.prompt !== undefined;
  const free = isFree(model);

  return (
    <button
      type="button"
      onClick={onSelect}
      className={cx(
        "apc-model-card",
        selected ? cx("apc-model-card--selected", CARD_SELECTED[color]) : "",
        cn["modelCard"]
      )}
    >
      {/* Top row: badge + radio */}
      <div className="apc-model-card-top">
        <span className={cx("apc-model-badge", BADGE_BG[color] ?? "", cn["modelBadge"])}>
          {model.badgeText}
        </span>
        <div className={cx("apc-model-radio", selected ? cx("apc-model-radio--active", RADIO_COLOR[color]) : "", cn["modelRadio"])}>
          {selected && <div className={cx("apc-model-radio-dot", RADIO_COLOR[color])} />}
        </div>
      </div>

      {/* Name + id */}
      <p className={cx("apc-model-name", cn["modelName"])}>{model.label}</p>
      <p className={cx("apc-model-id", cn["modelId"])}>{model.id}</p>

      {/* Pricing */}
      <div className={cx("apc-model-pricing", cn["modelPricing"])}>
        {free ? (
          <p className={cx("apc-model-price-free", BADGE_BG[color] ? `apc-model-free-text--${color}` : "")}>{t.freeLabel}</p>
        ) : hasPricing ? (
          <>
            <div className="apc-model-price-row">
              <span className="apc-model-price-label">{t.inputLabel}</span>
              <span className="apc-model-price-value">{formatCredits(model.pricing!.usd!.prompt)} {t.creditsUnit}</span>
            </div>
            <div className="apc-model-price-row">
              <span className="apc-model-price-label">{t.outputLabel}</span>
              <span className="apc-model-price-value">{formatCredits(model.pricing!.usd!.completion)} {t.creditsUnit}</span>
            </div>
          </>
        ) : (
          <p className="apc-model-price-unavailable">{t.pricingUnavailable}</p>
        )}
      </div>
    </button>
  );
}

// ============================================================
// ModelSelector — exported component
// ============================================================

export function ModelSelector(props: ModelSelectorProps) {
  const {
    models,
    selectedModel,
    onSelect,
    hideHeader = false,
    appearance,
    className,
  } = props;

  const theme = appearance?.theme ?? "light";
  const styleVars = apcVariablesToStyle(appearance?.variables);
  const cn = appearance?.classNames ?? {};
  const t: ModelSelectorTexts = { ...DEFAULT_TEXTS, ...props.texts };

  return (
    <div
      className={cx("apc-root", className, cn["root"])}
      data-apc-theme={theme}
      style={styleVars}
    >
      {!hideHeader && (
        <div className={cx("apc-header", cn["header"])}>
          <h2 className={cx("apc-section-title", cn["sectionTitle"])}>{t.title}</h2>
          <p className={cx("apc-subtitle", cn["subtitle"])}>{t.subtitle}</p>
        </div>
      )}

      <div className={cx("apc-model-grid", cn["modelGrid"])}>
        {models.map((model) => (
          <ModelCard
            key={model.id}
            model={model}
            selected={selectedModel === model.id}
            onSelect={() => onSelect(model.id)}
            t={t}
            cn={cn}
          />
        ))}
      </div>
    </div>
  );
}
