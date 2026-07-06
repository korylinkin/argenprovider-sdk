"use client";

import { useEffect } from "react";

export interface UseReturnRefreshOptions {
  onTick(): void | Promise<void>;
  param?: string;
  value?: string;
  attempts?: number;
  intervalMs?: number;
}

/**
 * Al volver de una recarga (?recarga=ok en la URL), el crédito puede tardar
 * unos segundos en reflejarse (acreditación async) — reintenta unas cuantas
 * veces y limpia el query param. Lee window.location.search directamente
 * (no useSearchParams) para no forzar al consumidor a envolver en <Suspense>.
 */
export function useReturnRefresh(opts: UseReturnRefreshOptions): void {
  const { onTick, param = "recarga", value = "ok", attempts = 5, intervalMs = 2000 } = opts;

  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    if (params.get(param) !== value) return;

    params.delete(param);
    const query = params.toString();
    const cleanUrl = `${window.location.pathname}${query ? `?${query}` : ""}${window.location.hash}`;
    window.history.replaceState(null, "", cleanUrl);

    let cancelled = false;
    (async () => {
      for (let i = 0; i < attempts && !cancelled; i++) {
        await new Promise((r) => setTimeout(r, intervalMs));
        if (cancelled) break;
        await onTick();
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}
