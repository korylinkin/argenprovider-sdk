"use client";

import type { PurchaseStatus } from "../core/types.js";
import { cx } from "./appearance.js";

const LABELS: Record<PurchaseStatus, string> = {
  PAID: "Pagado",
  PENDING: "Pendiente",
  EXPIRED: "Expirada",
};

const CLASS: Record<PurchaseStatus, string> = {
  PAID: "apc-badge apc-badge-success",
  PENDING: "apc-badge apc-badge-warning",
  EXPIRED: "apc-badge apc-badge-muted",
};

export interface StatusBadgeProps {
  status: PurchaseStatus;
  className?: string;
}

export function StatusBadge({ status, className }: StatusBadgeProps) {
  return <span className={cx(CLASS[status], className)}>{LABELS[status]}</span>;
}
