import { ArgenProviderError, NotConfiguredError } from "./errors.js";
import type { KeyStore } from "./key-store.js";
import type {
  Balance,
  CheckoutSession,
  ProvisionResult,
  PurchaseList,
  Rates,
  TopupResult,
  VerifyResult,
} from "./types.js";

export const SESSION_ID_RE = /^cs_[A-Za-z0-9_-]{20,}$/;

/** Timeout por defecto de cada request a argenprovider. */
export const DEFAULT_TIMEOUT_MS = 10_000;

/** Observabilidad: se invoca cuando un request de solo-lectura falla en silencio. */
export interface ArgenProviderErrorEvent {
  /** Endpoint lógico: "balance", "purchases", "verify", "rates". */
  scope: string;
  /** HTTP status si hubo respuesta; undefined si fue error de red/timeout. */
  status?: number;
  message: string;
}

export interface ArgenProviderClientConfig {
  /** Base URL pública de argenprovider (ej: https://argenprovider.example.com). */
  baseUrl?: string;
  /** Provision key de la plataforma (prov-...). */
  provisionKey?: string;
  /** Storage inyectado para persistir la API key por usuario final. */
  keyStore?: KeyStore;
  fetchImpl?: typeof fetch;
  /** Timeout por request en ms. Default DEFAULT_TIMEOUT_MS. */
  timeoutMs?: number;
  /**
   * Hook opcional para observar fallos de los métodos fail-soft (getBalance,
   * listPurchases, verifyPurchase, getRates). Sin él, esos fallos devuelven
   * null en silencio y son indistinguibles de "sin datos".
   */
  onError?(event: ArgenProviderErrorEvent): void;
}

async function readErrorBody(res: Response): Promise<string> {
  try {
    return await res.text();
  } catch {
    return "";
  }
}

/**
 * La provision key viaja como Bearer en CADA request. Si baseUrl es http:// a
 * un host que no es local, esa key (y las de usuario) viajan en claro y son
 * interceptables. Fallamos fuerte en construcción para que una misconfig no
 * derive silenciosamente en fuga de credenciales, salvo desarrollo local.
 */
function assertSecureBaseUrl(baseUrl?: string): void {
  if (!baseUrl) return;
  let parsed: URL;
  try {
    parsed = new URL(baseUrl);
  } catch {
    throw new ArgenProviderError(`baseUrl inválida: ${baseUrl}`, 0);
  }
  if (parsed.protocol === "https:") return;
  const host = parsed.hostname;
  const isLocal = host === "localhost" || host === "127.0.0.1" || host === "::1" || host === "[::1]";
  if (parsed.protocol === "http:" && isLocal) return;
  throw new ArgenProviderError(
    `baseUrl debe ser https:// (recibido "${parsed.protocol}//${host}"): la provision key viajaría en claro`,
    0
  );
}

export class ArgenProviderClient {
  readonly configured: boolean;
  private readonly baseUrl?: string;
  private readonly provisionKey?: string;
  private readonly keyStore?: KeyStore;
  private readonly fetchImpl: typeof fetch;
  private readonly timeoutMs: number;
  private readonly onError?: (event: ArgenProviderErrorEvent) => void;

  // Single-flight: deduplica provisiones concurrentes del MISMO externalId.
  // Sin esto, dos requests en paralelo de un usuario sin key guardada llaman
  // ambos a provisionUser → el backend ROTA dos veces → el keyStore puede
  // terminar con la key ya revocada y el usuario recibe 401 en cada llamada.
  private readonly inflight = new Map<string, Promise<string>>();

  constructor(config: ArgenProviderClientConfig = {}) {
    assertSecureBaseUrl(config.baseUrl);
    this.baseUrl = config.baseUrl;
    this.provisionKey = config.provisionKey;
    this.keyStore = config.keyStore;
    this.fetchImpl = config.fetchImpl ?? fetch;
    this.timeoutMs = config.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    this.onError = config.onError;
    this.configured = Boolean(this.baseUrl && this.provisionKey);
  }

  private requireConfig(): { url: string; key: string } {
    if (!this.baseUrl || !this.provisionKey) throw new NotConfiguredError();
    return { url: this.baseUrl, key: this.provisionKey };
  }

  private authHeaders(key: string): Record<string, string> {
    return { Authorization: `Bearer ${key}`, "Content-Type": "application/json" };
  }

  /** fetch con timeout duro vía AbortSignal para no colgar al proxy de la plataforma. */
  private async fetchT(input: string, init: RequestInit = {}): Promise<Response> {
    return this.fetchImpl(input, { ...init, signal: AbortSignal.timeout(this.timeoutMs) });
  }

  private report(scope: string, status: number | undefined, message: string): void {
    try {
      this.onError?.({ scope, status, message });
    } catch {
      // un hook de observabilidad roto no debe tumbar el flujo
    }
  }

  /**
   * Provisiona (o rota) el usuario en argenprovider. CRUDO: si el usuario ya
   * existe, el backend ROTA su API key. Usar getOrProvisionKey para el caso
   * normal de "quiero la key de este usuario", no este método directamente.
   */
  async provisionUser(input: { email: string; externalId: string; name?: string }): Promise<ProvisionResult> {
    const { url, key } = this.requireConfig();
    const res = await this.fetchT(`${url}/api/provision/user`, {
      method: "POST",
      headers: this.authHeaders(key),
      body: JSON.stringify({ email: input.email, externalId: input.externalId, name: input.name ?? input.email }),
    });
    if (!res.ok) {
      throw new ArgenProviderError(`provision/user falló: ${res.status}`, res.status, await readErrorBody(res));
    }
    return res.json();
  }

  /**
   * Devuelve la API key del usuario. Lazy: si no está en el KeyStore,
   * provisiona y persiste. NO re-provisiona si ya existe una key guardada
   * (provisionUser rota la key en cada llamada al backend). Deduplica
   * provisiones concurrentes del mismo externalId (single-flight).
   *
   * LIMITACIÓN multi-instancia: el single-flight es POR PROCESO. Con varias
   * réplicas o funciones serverless, dos instancias pueden provisionar en
   * paralelo → el backend rota dos veces → la instancia más lenta persiste la
   * key YA revocada. Para ese escenario, implementá el KeyStore.save de forma
   * atómica "save-if-absent" (INSERT ... ON CONFLICT DO NOTHING + releer) para
   * que el primer save gane y el resto lea la key vigente en vez de pisarla.
   */
  async getOrProvisionKey(externalId: string, email: string, name?: string): Promise<string> {
    if (this.keyStore) {
      const existing = await this.keyStore.get(externalId);
      if (existing) return existing;
    }

    const pending = this.inflight.get(externalId);
    if (pending) return pending;

    const task = (async () => {
      // Re-chequeo dentro del single-flight: otra provisión pudo terminar y
      // guardar la key entre el get() de arriba y la toma del lock.
      if (this.keyStore) {
        const existing = await this.keyStore.get(externalId);
        if (existing) return existing;
      }
      const result = await this.provisionUser({ externalId, email, name });
      if (this.keyStore) {
        await this.keyStore.save(externalId, result.apiKey, { providerUserId: result.userId });
      }
      return result.apiKey;
    })();

    this.inflight.set(externalId, task);
    try {
      return await task;
    } finally {
      this.inflight.delete(externalId);
    }
  }

  /**
   * Descarta la key guardada y provisiona una nueva (recuperación tras 401 del
   * proxy LLM). Pasá `failedKey` (la key que recibió el 401) para evitar la
   * "tormenta de rotaciones": si entre medio otra request ya rotó y guardó una
   * key distinta, la devolvemos tal cual en vez de rotar de nuevo y revocar esa
   * key recién emitida. Sin `failedKey` el borrado es incondicional (comportamiento
   * previo).
   */
  async refreshKey(externalId: string, email: string, name?: string, failedKey?: string): Promise<string> {
    if (this.keyStore) {
      if (failedKey !== undefined) {
        const current = await this.keyStore.get(externalId);
        // Compare-and-delete: otra request ya emitió una key nueva; usala.
        if (current && current !== failedKey) return current;
      }
      await this.keyStore.delete(externalId);
    }
    return this.getOrProvisionKey(externalId, email, name);
  }

  /** Ceros/null si argenprovider no está configurado, no responde o el usuario no tiene budget. Fail-soft. */
  async getBalance(externalId: string): Promise<Balance | null> {
    if (!this.baseUrl || !this.provisionKey) return null;
    try {
      const res = await this.fetchT(
        `${this.baseUrl}/api/budget/balance?externalId=${encodeURIComponent(externalId)}`,
        { headers: { Authorization: `Bearer ${this.provisionKey}` }, cache: "no-store" }
      );
      if (!res.ok) {
        this.report("balance", res.status, `balance devolvió ${res.status}`);
        return null;
      }
      return await res.json();
    } catch (e) {
      this.report("balance", undefined, e instanceof Error ? e.message : "error de red");
      return null;
    }
  }

  /** Historial paginado de compras (sesiones de checkout). null si argenprovider no responde. */
  async listPurchases(externalId: string, opts: { page?: number; limit?: number } = {}): Promise<PurchaseList | null> {
    if (!this.baseUrl || !this.provisionKey) return null;
    try {
      const params = new URLSearchParams({
        externalId,
        page: String(opts.page ?? 1),
        limit: String(opts.limit ?? 10),
      });
      const res = await this.fetchT(`${this.baseUrl}/api/checkout/sessions?${params}`, {
        headers: { Authorization: `Bearer ${this.provisionKey}` },
        cache: "no-store",
      });
      if (!res.ok) {
        this.report("purchases", res.status, `purchases devolvió ${res.status}`);
        return null;
      }
      return await res.json();
    } catch (e) {
      this.report("purchases", undefined, e instanceof Error ? e.message : "error de red");
      return null;
    }
  }

  /**
   * Crea una sesión de checkout hosteado. Si hay keyStore + email, asegura
   * que el usuario esté provisionado antes (argenprovider exige que exista).
   */
  async createCheckoutSession(input: {
    externalId: string;
    email?: string;
    amountARS?: number;
    returnUrl?: string;
  }): Promise<CheckoutSession> {
    const { url, key } = this.requireConfig();

    if (this.keyStore && input.email) {
      await this.getOrProvisionKey(input.externalId, input.email);
    }

    const res = await this.fetchT(`${url}/api/checkout/session`, {
      method: "POST",
      headers: this.authHeaders(key),
      body: JSON.stringify({
        externalId: input.externalId,
        ...(input.amountARS !== undefined ? { amountARS: input.amountARS } : {}),
        ...(input.returnUrl ? { returnUrl: input.returnUrl } : {}),
      }),
    });
    if (!res.ok) {
      throw new ArgenProviderError(`checkout/session falló: ${res.status}`, res.status, await readErrorBody(res));
    }
    return res.json();
  }

  /** Acredita créditos directamente (sin pasar por MercadoPago). Idempotente por externalRef. */
  async topup(input: { externalId: string; amountARS: number; externalRef: string }): Promise<TopupResult> {
    const { url, key } = this.requireConfig();
    if (!input.externalId || !input.externalId.trim()) {
      throw new ArgenProviderError("topup: externalId requerido", 0);
    }
    // Una externalRef vacía colapsaría la idempotencia (todas las cargas sin ref
    // colisionan en la misma clave y solo la primera acredita).
    if (!input.externalRef || !input.externalRef.trim()) {
      throw new ArgenProviderError("topup: externalRef requerido y no vacío", 0);
    }
    if (typeof input.amountARS !== "number" || !Number.isFinite(input.amountARS) || input.amountARS <= 0) {
      throw new ArgenProviderError("topup: amountARS debe ser un número finito mayor a 0", 0);
    }
    const res = await this.fetchT(`${url}/api/budget/topup`, {
      method: "POST",
      headers: this.authHeaders(key),
      body: JSON.stringify(input),
    });
    if (!res.ok) {
      throw new ArgenProviderError(`budget/topup falló: ${res.status}`, res.status, await readErrorBody(res));
    }
    return res.json();
  }

  /**
   * Re-verifica una sesión de checkout contra MercadoPago (acredita si el
   * pago ya está aprobado; idempotente del lado de argenprovider). Endpoint
   * público tipo capability URL: no lleva provision key.
   */
  async verifyPurchase(sessionId: string): Promise<VerifyResult | null> {
    if (!this.baseUrl) return null;
    try {
      const res = await this.fetchT(`${this.baseUrl}/api/checkout/${encodeURIComponent(sessionId)}/verify`, {
        method: "POST",
        cache: "no-store",
      });
      if (res.status === 429) return { status: "RATE_LIMITED" };
      if (!res.ok) {
        this.report("verify", res.status, `verify devolvió ${res.status}`);
        return null;
      }
      return await res.json();
    } catch (e) {
      this.report("verify", undefined, e instanceof Error ? e.message : "error de red");
      return null;
    }
  }

  /** Tipo de cambio y precio de créditos vigentes. null si no responde. */
  async getRates(): Promise<Rates | null> {
    if (!this.baseUrl) return null;
    try {
      const res = await this.fetchT(`${this.baseUrl}/api/rates`, { cache: "no-store" });
      if (!res.ok) {
        this.report("rates", res.status, `rates devolvió ${res.status}`);
        return null;
      }
      return await res.json();
    } catch (e) {
      this.report("rates", undefined, e instanceof Error ? e.message : "error de red");
      return null;
    }
  }
}
