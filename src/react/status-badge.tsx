"use client";

import type { PurchaseStatus } from "../core/types.js";

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

export function StatusBadge({ status }: { status: PurchaseStatus }) {
  return <span className={CLASS[status]}>{LABELS[status]}</span>;
}
