"use client";

import { useCallback } from "react";
import { useCreditsBalance } from "./use-credits-balance.js";
import { usePurchases } from "./use-purchases.js";
import { useCheckout } from "./use-checkout.js";
import { useReturnRefresh } from "./use-return-refresh.js";
import { StatusBadge } from "./status-badge.js";
import type { Purchase } from "../core/types.js";
import type { Appearance } from "./appearance.js";
import { apcVariablesToStyle, cx } from "./appearance.js";

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
  hint: "Vas a ser redirigido a un checkout seguro de MercadoPago.  ",
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
  appearance?: Appearance;
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

  const theme = props.appearance?.theme ?? "light";
  const styleVars = apcVariablesToStyle(props.appearance?.variables);
  const cn = props.appearance?.classNames ?? {};

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
    <div
      className={cx("apc-root", props.className, cn["root"])}
      data-apc-theme={theme}
      style={styleVars}
    >
      <div className={cx("apc-header", cn["header"])}>
        <h1 className={cx("apc-title", cn["title"])}>{t.title}</h1>
        <p className={cx("apc-subtitle", cn["subtitle"])}>{t.subtitle}</p>
      </div>

      <div className={cx("apc-card", cn["card"])}>
        {loadingBalance ? (
          <span className={cx("apc-spinner", cn["spinner"])} />
        ) : (
          <>
            <span className={cx("apc-balance-label", cn["balanceLabel"])}>{t.balanceLabel}</span>
            <div className={cx("apc-balance-value", cn["balanceValue"])}>{balance ? formatCredits(balance.remainingUSD) : "—"}</div>
            {!balance && <p className={cx("apc-note", cn["note"])}>{t.balanceUnavailable}</p>}

            <div className={cx("apc-divider", cn["divider"])} />

            {error && <p className={cx("apc-error", cn["error"])}>{error}</p>}

            <button type="button" className={cx("apc-btn apc-btn-primary", cn["btnPrimary"])} onClick={() => startCheckout()} disabled={pending}>
              {pending ? <span className={cx("apc-spinner", cn["spinner"])} /> : t.buyButton}
            </button>

            {checkingPopup && (
              <p className={cx("apc-checking", cn["checking"])}>
                <span className={cx("apc-spinner", cn["spinner"])} /> {t.checkingPopup}
              </p>
            )}

            {arsPerUSD !== null && <p className={cx("apc-rate", cn["rate"])}>1 crédito = ${formatARS(arsPerUSD)} ARS - <small>1M tokens equivalen a 750mil palabras aproximadamente o entre 1200 y 1500 paginas de texto denso en pdf.</small></p>}
            <p className={cx("apc-hint", cn["hint"])}>{t.hint}</p>
          </>
        )}
      </div>

      <div className={cx("apc-card apc-card-flush", cn["card"], cn["cardFlush"])}>
        <div className={cx("apc-card-flush-header", cn["cardFlushHeader"])}>
          <h2 className={cx("apc-section-title", cn["sectionTitle"])}>{t.historyTitle}</h2>
          {verifyMessage && <p className={cx("apc-verify-msg", cn["verifyMsg"])}>{verifyMessage}</p>}
        </div>

        {loadingPurchases ? (
          <div style={{ padding: 20, display: "grid", gap: 8 }}>
            {[0, 1, 2].map((i) => (
              <div key={i} className={cx("apc-skeleton", cn["skeleton"])} />
            ))}
          </div>
        ) : !purchases || purchases.items.length === 0 ? (
          <div className={cx("apc-empty", cn["empty"])}>
            <div className={cx("apc-empty-icon", cn["emptyIcon"])}>🧾</div>
            <h3>{t.emptyTitle}</h3>
            <p className="apc-muted">{purchases ? t.emptyBody : t.emptyUnavailable}</p>
          </div>
        ) : (
          <>
            <div className={cx("apc-table-wrap", cn["tableWrap"])}>
              <table className={cx("apc-table", cn["table"])}>
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
                      <td>{p.amountARS !== null ? `$${formatARS(p.amountARS)}` : <span className="apc-muted">-</span>}</td>
                      <td>{p.creditsUSD !== null ? formatCredits(p.creditsUSD) : <span className="apc-muted">-</span>}</td>
                      <td>
                        <StatusBadge status={p.status} />
                      </td>
                      <td>
                        <div className={cx("apc-actions", cn["actions"])}>
                          {p.status !== "PAID" && p.paymentInitiated && (
                            <button
                              className={cx("apc-btn apc-btn-ghost", cn["btnGhost"])}
                              onClick={() => verifySession(p.sessionId)}
                              disabled={verifyingId !== null}
                            >
                              {verifyingId === p.sessionId ? <span className={cx("apc-spinner", cn["spinner"])} /> : t.verifyAction}
                            </button>
                          )}
                          {p.status === "PENDING" && p.url && (
                            <button className={cx("apc-btn apc-btn-ghost", cn["btnGhost"])} onClick={() => continuePayment(p)}>
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
              <div className={cx("apc-pagination", cn["pagination"])}>
                <span className={cx("apc-pagination-info", cn["paginationInfo"])}>{t.pageInfo(purchases.currentPage, purchases.pages, purchases.total)}</span>
                <button
                  className={cx("apc-btn apc-btn-ghost", cn["btnGhost"])}
                  onClick={() => setPage(Math.max(1, page - 1))}
                  disabled={page <= 1 || loadingPurchases}
                >
                  {t.prevPage}
                </button>
                <button
                  className={cx("apc-btn apc-btn-ghost", cn["btnGhost"])}
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
