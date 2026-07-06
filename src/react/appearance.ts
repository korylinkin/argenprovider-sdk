import type { CSSProperties } from "react";

// ============================================================
// Theme preset
// ============================================================

export type ApcTheme = "light" | "dark" | "auto";

// ============================================================
// CSS variable tokens (camelCase → --apc-kebab-case)
// ============================================================

export interface ApcVariables {
  font: string;
  bg: string;
  cardBg: string;
  cardFg: string;
  fg: string;
  muted: string;
  border: string;
  radius: string;
  btnRadius: string;
  maxWidth: string;
  shadow: string;
  primary: string;
  primaryFg: string;
  ghostHoverBg: string;
  skeletonBg: string;
  focusRing: string;
  successBg: string;
  successFg: string;
  warningBg: string;
  warningFg: string;
  dangerBg: string;
  dangerFg: string;
  badgeMutedBg: string;
  badgeMutedFg: string;
}

// ============================================================
// Slots — every CSS hook in the component tree
// ============================================================

export type ApcSlot =
  | "root"
  | "header"
  | "title"
  | "subtitle"
  | "card"
  | "cardFlush"
  | "cardFlushHeader"
  | "balanceLabel"
  | "balanceValue"
  | "note"
  | "divider"
  | "error"
  | "btnPrimary"
  | "btnGhost"
  | "checking"
  | "rate"
  | "hint"
  | "sectionTitle"
  | "verifyMsg"
  | "skeleton"
  | "empty"
  | "emptyIcon"
  | "tableWrap"
  | "table"
  | "badge"
  | "actions"
  | "pagination"
  | "paginationInfo"
  | "spinner"
  // ModelSelector slots
  | "modelGrid"
  | "modelCard"
  | "modelBadge"
  | "modelName"
  | "modelId"
  | "modelPricing"
  | "modelRadio";

// ============================================================
// Top-level Appearance contract
// ============================================================

export interface Appearance {
  /**
   * Preset de tema. "light" = defaults del SDK (comportamiento original).
   * "dark" = preset oscuro built-in. "auto" = sigue prefers-color-scheme (CSS puro, sin JS).
   * Default: "light".
   */
  theme?: ApcTheme;
  /**
   * Variables CSS inline en el root. Tienen la mayor especificidad posible
   * (style inline) → ganan a cualquier stylesheet, independientemente del
   * orden de imports. camelCase → --apc-kebab-case automáticamente.
   */
  variables?: Partial<ApcVariables>;
  /**
   * Clases extra por slot (ej: Tailwind utilities). Se concatenan DESPUÉS de
   * las clases nativas del SDK.
   */
  classNames?: Partial<Record<ApcSlot, string>>;
}

// ============================================================
// Internal helpers (exported for testing / host use)
// ============================================================

/** camelCase key → --apc-kebab-case CSS custom property name. */
function toCustomProp(key: string): string {
  return "--apc-" + key.replace(/[A-Z]/g, (c) => "-" + c.toLowerCase());
}

/**
 * Converts an ApcVariables partial into a CSSProperties object with
 * --apc-* custom properties, suitable for the `style` prop of the root div.
 * Returns undefined if there are no variables to apply.
 */
export function apcVariablesToStyle(
  variables?: Partial<ApcVariables>
): CSSProperties | undefined {
  if (!variables) return undefined;
  const entries = Object.entries(variables) as [keyof ApcVariables, string][];
  if (entries.length === 0) return undefined;
  return Object.fromEntries(
    entries.map(([key, value]) => [toCustomProp(key), value])
  ) as CSSProperties;
}

/**
 * Simple className joiner — filters out falsy values and joins with a space.
 * Equivalent to the popular `clsx` micro-library but zero-dependency.
 */
export function cx(...classes: (string | undefined | null | false)[]): string {
  return classes.filter(Boolean).join(" ");
}
