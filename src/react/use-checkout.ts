"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { postCheckout, postVerify } from "./api.js";
import type { Purchase } from "../core/types.js";

export interface UseCheckoutOptions {
  basePath?: string;
  /** Se llama tras cerrar el popup o verificar: refrescar balance/historial. */
  onSettled?(): void | Promise<void>;
}

export interface UseCheckoutResult {
  startCheckout(amountARS?: number): Promise<void>;
  pending: boolean;
  checkingPopup: boolean;
  error: string | null;
  verifyingId: string | null;
  verifyMessage: string | null;
  verifySession(sessionId: string): Promise<void>;
  continuePayment(purchase: Pick<Purchase, "sessionId" | "url">): void;
}

/**
 * Abre una ventana en blanco de forma SÍNCRONA (dentro del handler de click,
 * antes de cualquier await) para que el navegador no la bloquee como popup;
 * el caller setea `.location.href` después de resolver la URL real.
 */
function openCheckoutPopup(): Window | null {
  const w = 480;
  const h = 760;
  const left = window.screenX + Math.max(0, (window.outerWidth - w) / 2);
  const top = window.screenY + Math.max(0, (window.outerHeight - h) / 2);
  return window.open("about:blank", "argen_checkout", `width=${w},height=${h},left=${left},top=${top}`);
}

export function useCheckout(opts: UseCheckoutOptions = {}): UseCheckoutResult {
  const basePath = opts.basePath ?? "/api/credits";
  const [pending, setPending] = useState(false);
  const [checkingPopup, setCheckingPopup] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [verifyingId, setVerifyingId] = useState<string | null>(null);
  const [verifyMessage, setVerifyMessage] = useState<string | null>(null);
  const popupIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    return () => {
      if (popupIntervalRef.current) clearInterval(popupIntervalRef.current);
    };
  }, []);

  // Al cerrar la ventana emergente de pago, verificamos contra MercadoPago y
  // notificamos onSettled. No dependemos del auto_return de MP (que en dev,
  // sin HTTPS público, nunca redirige de vuelta): el cierre de la ventana es
  // la única señal confiable de que el usuario terminó el flujo.
  const watchCheckoutPopup = useCallback(
    (popup: Window, sessionId: string) => {
      if (popupIntervalRef.current) clearInterval(popupIntervalRef.current);
      setCheckingPopup(true);
      popupIntervalRef.current = setInterval(async () => {
        let closed = false;
        try {
          closed = popup.closed;
        } catch {
          closed = true; // COOP/cross-origin: no podemos leerla, asumimos cerrada
        }
        if (!closed) return;

        clearInterval(popupIntervalRef.current!);
        popupIntervalRef.current = null;
        try {
          await postVerify(basePath, sessionId);
        } catch {
          // el refresco de onSettled igual muestra el estado real
        } finally {
          await opts.onSettled?.();
          setCheckingPopup(false);
        }
      }, 1000);
    },
    [basePath, opts]
  );

  const startCheckout = useCallback(
    async (amountARS?: number) => {
      setPending(true);
      setError(null);
      const popup = openCheckoutPopup();
      try {
        const json = await postCheckout(basePath, amountARS);
        if (popup && !popup.closed) {
          popup.location.href = json.url;
          popup.focus();
          watchCheckoutPopup(popup, json.sessionId);
        } else {
          // Popup bloqueado por el navegador: fallback al flujo de siempre.
          window.location.href = json.url;
        }
      } catch (e) {
        popup?.close();
        setError(e instanceof Error ? e.message : "Error al iniciar la compra");
      } finally {
        setPending(false);
      }
    },
    [basePath, watchCheckoutPopup]
  );

  const continuePayment = useCallback(
    (purchase: Pick<Purchase, "sessionId" | "url">) => {
      if (!purchase.url) return;
      const popup = openCheckoutPopup();
      if (popup) {
        popup.location.href = purchase.url;
        popup.focus();
        watchCheckoutPopup(popup, purchase.sessionId);
      } else {
        window.location.href = purchase.url;
      }
    },
    [watchCheckoutPopup]
  );

  const verifySession = useCallback(
    async (sessionId: string) => {
      setVerifyingId(sessionId);
      setVerifyMessage(null);
      try {
        const { result, status, error: err } = await postVerify(basePath, sessionId);
        if (status === 429) {
          setVerifyMessage(err ?? "Demasiados intentos, esperá un minuto.");
          return;
        }
        if (!result) {
          setVerifyMessage(err ?? "No se pudo verificar el pago. Probá de nuevo más tarde.");
          return;
        }
        if (result.status === "PAID") {
          setVerifyMessage("¡Pago acreditado! Tus créditos ya están disponibles.");
          await opts.onSettled?.();
        } else {
          setVerifyMessage("El pago todavía no se acreditó. Si ya pagaste, probá de nuevo en unos minutos.");
        }
      } catch {
        setVerifyMessage("No se pudo verificar el pago. Probá de nuevo más tarde.");
      } finally {
        setVerifyingId(null);
      }
    },
    [basePath, opts]
  );

  return { startCheckout, pending, checkingPopup, error, verifyingId, verifyMessage, verifySession, continuePayment };
}
