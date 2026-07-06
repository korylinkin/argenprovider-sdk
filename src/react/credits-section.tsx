"use client";

import { useCallback } from "react";
import { useCreditsBalance } from "./use-credits-balance.js";
import { usePurchases } from "./use-purchases.js";
import { useCheckout } from "./use-checkout.js";
import { useReturnRefresh } from "./use-return-refresh.js";
import { StatusBadge } from "./status-badge.js";
import type { Purchase } from "../core/types.js";

export interface CreditsTexts {
  title: string;
  subtitle: string;
  balanceLabel: string;
  balanceUnavailable: string;
  buyButton: string;
  checkingPopup: string;
  hint: string;
  historyTitle: string;
  emptyTitle: string;
  emptyBody: string;
  emptyUnavailable: string;
  dateHeader: string;
  amountHeader: string;
  creditsHeader: string;
  statusHeader: string;
  verifyAction: string;
  continueAction: string;
  prevPage: string;
  nextPage: string;
  pageInfo(current: number, pages: number, total: number): string;
}

const DEFAULT_TEXTS: CreditsTexts = {
  title: "Créditos",
  subtitle: "Saldo para usar el asistente de IA",
  balanceLabel: "Créditos disponibles",
  balanceUnavailable: "No se pudo consultar el saldo en este momento.",
  buyButton: "Comprar créditos",
  checkingPopup: "Verificando tu pago…",
  hint: "Vas a ser redirigido a un checkout seguro de MercadoPago.",
  historyTitle: "Historial de compras",
  emptyTitle: "Sin compras todavía",
  emptyBody: "Cuando compres créditos, vas a ver el estado de cada pago acá.",
  emptyUnavailable: "No se pudo consultar el historial en este momento.",
  dateHeader: "Fecha",
  amountHeader: "Monto",
  creditsHeader: "Créditos",
  statusHeader: "Estado",
  verifyAction: "Verificar pago",
  continueAction: "Continuar pago",
  prevPage: "‹ Anterior",
  nextPage: "Siguiente ›",
  pageInfo: (current, pages, total) => `Página ${current} de ${pages} · ${total} compras`,
};

export interface CreditsSectionProps {
  basePath?: string;
  pageSize?: number;
  texts?: Partial<CreditsTexts>;
  className?: string;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("es-AR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatARS(n: number): string {
  return n.toLocaleString("es-AR", { maximumFractionDigits: 0 });
}

function formatCredits(n: number): string {
  return n.toLocaleString("es-AR", { maximumFractionDigits: 4 });
}

export function CreditsSection(props: CreditsSectionProps) {
  const basePath = props.basePath ?? "/api/credits";
  const pageSize = props.pageSize ?? 10;
  const t: CreditsTexts = { ...DEFAULT_TEXTS, ...props.texts };

  const { balance, loading: loadingBalance, refresh: refreshBalance } = useCreditsBalance({ basePath });
  const { purchases, page, setPage, loading: loadingPurchases, refresh: refreshPurchases } = usePurchases({
    basePath,
    pageSize,
  });

  const onSettled = useCallback(async () => {
    await Promise.all([refreshBalance(), refreshPurchases(1)]);
  }, [refreshBalance, refreshPurchases]);

  const {
    startCheckout,
    pending,
    checkingPopup,
    error,
    verifyingId,
    verifyMessage,
    verifySession,
    continuePayment,
  } = useCheckout({ basePath, onSettled });

  useReturnRefresh({ onTick: onSettled });

  const arsPerUSD = balance?.arsPerUSD ?? null;

  return (
    <div className={`apc-root ${props.className ?? ""}`}>
      <div className="apc-header">
        <h1 className="apc-title">{t.title}</h1>
        <p className="apc-subtitle">{t.subtitle}</p>
      </div>

      <div className="apc-card">
        {loadingBalance ? (
          <span className="apc-spinner" />
        ) : (
          <>
            <span className="apc-balance-label">{t.balanceLabel}</span>
            {/* Sin balance = argenprovider no respondió: mostramos "—" (no un 0
                que haría creer al usuario que se quedó sin créditos). */}
            <div className="apc-balance-value">{balance ? formatCredits(balance.remainingUSD) : "—"}</div>
            {!balance && <p className="apc-note">{t.balanceUnavailable}</p>}

            <div className="apc-divider" />

            {error && <p className="apc-error">{error}</p>}

            <button type="button" className="apc-btn apc-btn-primary" onClick={() => startCheckout()} disabled={pending}>
              {pending ? <span className="apc-spinner" /> : t.buyButton}
            </button>

            {checkingPopup && (
              <p className="apc-checking">
                <span className="apc-spinner" /> {t.checkingPopup}
              </p>
            )}

            {arsPerUSD !== null && <p className="apc-rate">1 crédito = ${formatARS(arsPerUSD)} ARS</p>}
            <p className="apc-hint">{t.hint}</p>
          </>
        )}
      </div>

      <div className="apc-card apc-card-flush">
        <div className="apc-card-flush-header">
          <h2 className="apc-section-title">{t.historyTitle}</h2>
          {verifyMessage && <p className="apc-verify-msg">{verifyMessage}</p>}
        </div>

        {loadingPurchases ? (
          <div style={{ padding: 20, display: "grid", gap: 8 }}>
            {[0, 1, 2].map((i) => (
              <div key={i} className="apc-skeleton" />
            ))}
          </div>
        ) : !purchases || purchases.items.length === 0 ? (
          <div className="apc-empty">
            <div className="apc-empty-icon">🧾</div>
            <h3>{t.emptyTitle}</h3>
            <p className="apc-muted">{purchases ? t.emptyBody : t.emptyUnavailable}</p>
          </div>
        ) : (
          <>
            <div className="apc-table-wrap">
              <table className="apc-table">
                <thead>
                  <tr>
                    <th>{t.dateHeader}</th>
                    <th>{t.amountHeader}</th>
                    <th>{t.creditsHeader}</th>
                    <th>{t.statusHeader}</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {purchases.items.map((p: Purchase) => (
                    <tr key={p.sessionId}>
                      <td>{formatDate(p.createdAt)}</td>
                      <td>{p.amountARS !== null ? `$${formatARS(p.amountARS)}` : <span className="apc-muted">—</span>}</td>
                      <td>{p.creditsUSD !== null ? formatCredits(p.creditsUSD) : <span className="apc-muted">—</span>}</td>
                      <td>
                        <StatusBadge status={p.status} />
                      </td>
                      <td>
                        <div className="apc-actions">
                          {p.status !== "PAID" && p.paymentInitiated && (
                            <button
                              className="apc-btn apc-btn-ghost"
                              onClick={() => verifySession(p.sessionId)}
                              disabled={verifyingId !== null}
                            >
                              {verifyingId === p.sessionId ? <span className="apc-spinner" /> : t.verifyAction}
                            </button>
                          )}
                          {p.status === "PENDING" && p.url && (
                            <button className="apc-btn apc-btn-ghost" onClick={() => continuePayment(p)}>
                              {t.continueAction}
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {purchases.pages > 1 && (
              <div className="apc-pagination">
                <span className="apc-pagination-info">{t.pageInfo(purchases.currentPage, purchases.pages, purchases.total)}</span>
                <button
                  className="apc-btn apc-btn-ghost"
                  onClick={() => setPage(Math.max(1, page - 1))}
                  disabled={page <= 1 || loadingPurchases}
                >
                  {t.prevPage}
                </button>
                <button
                  className="apc-btn apc-btn-ghost"
                  onClick={() => setPage(page + 1)}
                  disabled={page >= purchases.pages || loadingPurchases}
                >
                  {t.nextPage}
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
