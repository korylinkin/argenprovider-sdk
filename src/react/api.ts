"use client";

import type { Balance, PurchaseList, VerifyResult } from "../core/types.js";

export interface CheckoutResponse {
  sessionId: string;
  url: string;
}

function joinPath(basePath: string, ...segments: string[]): string {
  const base = basePath.replace(/\/$/, "");
  return [base, ...segments].join("/");
}

export async function fetchBalance(basePath: string): Promise<Balance | { error: string }> {
  const res = await fetch(joinPath(basePath, "balance"));
  return res.json();
}

export async function fetchPurchases(
  basePath: string,
  page: number,
  limit: number
): Promise<PurchaseList | { error: string }> {
  const res = await fetch(`${joinPath(basePath, "purchases")}?page=${page}&limit=${limit}`);
  return res.json();
}

export async function postCheckout(
  basePath: string,
  amountARS?: number
): Promise<CheckoutResponse & { error?: string }> {
  const res = await fetch(joinPath(basePath, "checkout"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(amountARS !== undefined ? { amountARS } : {}),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error ?? "No se pudo iniciar la compra de créditos");
  return json;
}

export async function postVerify(
  basePath: string,
  sessionId: string
): Promise<{ result: VerifyResult | null; status: number; error?: string }> {
  const res = await fetch(joinPath(basePath, "purchases", encodeURIComponent(sessionId), "verify"), {
    method: "POST",
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) return { result: null, status: res.status, error: json.error };
  return { result: json as VerifyResult, status: res.status };
}
