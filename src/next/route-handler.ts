import { ArgenProviderClient, SESSION_ID_RE } from "../core/client.js";
import { rateLimit } from "./rate-limit.js";

export interface AuthResult {
  userId: string;
  email?: string | null;
  name?: string | null;
}

export interface RateLimitConfig {
  max: number;
  windowMs: number;
}

export interface CreditsRouteConfig {
  client: ArgenProviderClient;
  /** Resuelve el usuario autenticado a partir del request. null → 401. */
  auth(req: Request): Promise<AuthResult | null>;
  /** Path relativo (con o sin query) al que vuelve el usuario tras el checkout. Default "/creditos?recarga=ok". */
  returnPath?: string;
  /**
   * URL base pública de la app (ej: https://miapp.com). Se usa para construir
   * la returnUrl del checkout. RECOMENDADA en producción: sin ella la returnUrl
   * se deriva del Host del request, que detrás de un proxy es spoofeable
   * (un atacante podría redirigir al usuario a su dominio tras pagar).
   */
  appBaseUrl?: string;
  /**
   * Rechaza los POST con Origin/Sec-Fetch-Site cross-site (defensa CSRF).
   * Default true. Ponelo en false solo si llamás estos endpoints server-to-server
   * desde otro origen a propósito.
   */
  enforceSameOrigin?: boolean;
  verifyRateLimit?: RateLimitConfig;
  checkoutRateLimit?: RateLimitConfig;
  /**
   * Límite para los GET de lectura (balance/purchases). Cada hit dispara un
   * fetch con la provision key al backend, así que sin tope un usuario
   * autenticado puede amplificar carga contra argenprovider. Default 60/min.
   */
  readRateLimit?: RateLimitConfig;
}

export interface CreditsRouteHandlers {
  GET(req: Request, ctx: { params: Promise<{ path?: string[] }> }): Promise<Response>;
  POST(req: Request, ctx: { params: Promise<{ path?: string[] }> }): Promise<Response>;
}

function json(body: unknown, init?: ResponseInit): Response {
  return Response.json(body, init);
}

function resolveReturnUrl(req: Request, returnPath: string, appBaseUrl?: string): string {
  // appBaseUrl (configurada) manda sobre el origin del request, que detrás de
  // un proxy sale del header Host y es manipulable.
  const origin = appBaseUrl ? appBaseUrl.replace(/\/$/, "") : new URL(req.url).origin;
  return new URL(returnPath, origin).toString();
}

/**
 * Defensa CSRF para requests que mutan estado. Rechaza si el navegador marca la
 * petición como cross-site. Requests sin estos headers (server-to-server, o
 * navegadores viejos) se dejan pasar: la protección real es que auth() valida
 * la sesión; esto solo corta el vector cross-site de cookies ambientales.
 */
function isCrossSite(req: Request, appBaseUrl?: string): boolean {
  const fetchSite = req.headers.get("sec-fetch-site");
  if (fetchSite && fetchSite !== "same-origin" && fetchSite !== "none") return true;

  const origin = req.headers.get("origin");
  if (origin) {
    const expected = appBaseUrl ? appBaseUrl.replace(/\/$/, "") : new URL(req.url).origin;
    try {
      if (new URL(origin).origin !== new URL(expected).origin) return true;
    } catch {
      return true;
    }
  }
  return false;
}

/**
 * Crea handlers GET/POST montables en un catch-all
 * `app/api/credits/[...path]/route.ts`. Implementa el contrato HTTP interno
 * que consumen los hooks de `argenprovider-sdk/react`.
 */
export function createCreditsRouteHandler(config: CreditsRouteConfig): CreditsRouteHandlers {
  const verifyLimit = config.verifyRateLimit ?? { max: 6, windowMs: 60_000 };
  const checkoutLimit = config.checkoutRateLimit ?? { max: 10, windowMs: 60_000 };
  const readLimit = config.readRateLimit ?? { max: 60, windowMs: 60_000 };
  const returnPath = config.returnPath ?? "/creditos?recarga=ok";
  const appBaseUrl = config.appBaseUrl;
  const enforceSameOrigin = config.enforceSameOrigin ?? true;

  async function GET(req: Request, ctx: { params: Promise<{ path?: string[] }> }): Promise<Response> {
    const auth = await config.auth(req);
    if (!auth) return json({ error: "No autenticado" }, { status: 401 });

    const { path = [] } = await ctx.params;
    const url = new URL(req.url);

    if (path.length === 1 && path[0] === "balance") {
      if (!rateLimit(`balance:${auth.userId}`, readLimit.max, readLimit.windowMs)) {
        return json({ error: "Demasiadas peticiones" }, { status: 429 });
      }
      const balance = await config.client.getBalance(auth.userId);
      // null = argenprovider no respondió (no "saldo 0"). Señalamos unavailable
      // para que el cliente muestre "no se pudo consultar" en vez de un 0
      // fabricado que haría creer al usuario que perdió sus créditos.
      if (!balance) return json({ error: "unavailable" }, { status: 503 });
      return json(balance);
    }

    if (path.length === 1 && path[0] === "purchases") {
      if (!rateLimit(`purchases:${auth.userId}`, readLimit.max, readLimit.windowMs)) {
        return json({ error: "Demasiadas peticiones" }, { status: 429 });
      }
      // Cota superior de page: sin ella un page enorme genera un OFFSET absurdo
      // en el backend. El límite real de páginas lo devuelve el propio backend.
      const page = Math.min(100_000, Math.max(1, Number(url.searchParams.get("page")) || 1));
      const limit = Math.min(50, Math.max(1, Number(url.searchParams.get("limit")) || 10));
      const purchases = await config.client.listPurchases(auth.userId, { page, limit });
      if (!purchases) return json({ error: "unavailable" }, { status: 503 });
      return json(purchases);
    }

    return json({ error: "No encontrado" }, { status: 404 });
  }

  async function POST(req: Request, ctx: { params: Promise<{ path?: string[] }> }): Promise<Response> {
    if (enforceSameOrigin && isCrossSite(req, appBaseUrl)) {
      return json({ error: "Origen no permitido" }, { status: 403 });
    }

    const auth = await config.auth(req);
    if (!auth) return json({ error: "No autenticado" }, { status: 401 });

    const { path = [] } = await ctx.params;

    if (path.length === 1 && path[0] === "checkout") {
      if (!rateLimit(`checkout:${auth.userId}`, checkoutLimit.max, checkoutLimit.windowMs)) {
        return json({ error: "Demasiados intentos, esperá un minuto." }, { status: 429 });
      }
      if (!auth.email) {
        return json(
          { error: "Tu cuenta no tiene un email configurado: no se puede iniciar la compra." },
          { status: 400 }
        );
      }

      let amountARS: number | undefined;
      try {
        const body = await req.json().catch(() => ({}));
        if (body?.amountARS !== undefined) {
          // Exigimos number real: Number(true)===1 y Number("500")===500 se
          // colarían con una coerción laxa.
          if (typeof body.amountARS !== "number" || !Number.isFinite(body.amountARS) || body.amountARS <= 0) {
            return json({ error: "amountARS inválido" }, { status: 400 });
          }
          amountARS = body.amountARS;
        }
      } catch {
        // sin body → monto variable
      }

      try {
        const session = await config.client.createCheckoutSession({
          externalId: auth.userId,
          email: auth.email,
          amountARS,
          returnUrl: resolveReturnUrl(req, returnPath, appBaseUrl),
        });
        return json({ sessionId: session.sessionId, url: session.url });
      } catch {
        return json({ error: "No se pudo iniciar la compra de créditos" }, { status: 502 });
      }
    }

    if (path.length === 3 && path[0] === "purchases" && path[2] === "verify") {
      const sessionId = path[1];
      if (!SESSION_ID_RE.test(sessionId)) {
        return json({ error: "sessionId inválido" }, { status: 400 });
      }
      if (!rateLimit(`verify:${auth.userId}`, verifyLimit.max, verifyLimit.windowMs)) {
        return json({ error: "Demasiados intentos, esperá un minuto." }, { status: 429 });
      }

      const result = await config.client.verifyPurchase(sessionId);
      if (!result) return json({ error: "No se pudo verificar el pago" }, { status: 502 });
      if (result.status === "RATE_LIMITED") {
        return json({ error: "Demasiados intentos, esperá un minuto." }, { status: 429 });
      }
      return json(result);
    }

    return json({ error: "No encontrado" }, { status: 404 });
  }

  return { GET, POST };
}
