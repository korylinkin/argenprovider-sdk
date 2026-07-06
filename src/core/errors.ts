export class ArgenProviderError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly body?: string
  ) {
    super(message);
    this.name = "ArgenProviderError";
  }
}

export class NotConfiguredError extends Error {
  constructor(message = "argenprovider-sdk: baseUrl / provisionKey no configurados") {
    super(message);
    this.name = "NotConfiguredError";
  }
}

/**
 * El gateway rechazó la request porque el modelo pedido no soporta el
 * contenido enviado (ej: imágenes contra un modelo solo-texto). LiteLLM/
 * OpenRouter lo reportan dentro del mensaje de error, sin un código HTTP
 * dedicado — de ahí que se clasifique por texto en `classifyGatewayError`.
 */
export class VisionUnsupportedError extends ArgenProviderError {
  constructor(message: string, status: number, body?: string) {
    super(message, status, body);
    this.name = "VisionUnsupportedError";
  }
}

/**
 * La key no tiene permiso para llamar al modelo pedido (allowlist de modelos
 * de la key/usuario en LiteLLM, típicamente HTTP 401 con
 * type="key_model_access_denied"). A diferencia de un 401 por key revocada,
 * reintentar con una key refrescada NO resuelve esto — es una restricción de
 * configuración del lado de LiteLLM, no una key stale. `chatCompletionForUser`
 * usa esta distinción para no gastar una rotación en vano.
 */
export class ModelNotAllowedError extends ArgenProviderError {
  constructor(message: string, status: number, body?: string) {
    super(message, status, body);
    this.name = "ModelNotAllowedError";
  }
}

/**
 * El usuario superó su budget de créditos en LiteLLM (`spend >= max_budget`).
 * Solo puede darse en modelos con costo > 0 registrado en LiteLLM — un
 * modelo dado de alta con costo $0 nunca dispara esto.
 */
export class BudgetExceededError extends ArgenProviderError {
  constructor(message: string, status: number, body?: string) {
    super(message, status, body);
    this.name = "BudgetExceededError";
  }
}

/**
 * Clasifica una respuesta de error del gateway LLM (LiteLLM/OpenRouter) en el
 * subtipo de ArgenProviderError correspondiente, inspeccionando el texto del
 * mensaje/body — LiteLLM no siempre expone códigos de error dedicados por
 * HTTP status. Centralizado acá para que ninguna plataforma consumidora del
 * SDK tenga que reimplementar esta detección por su cuenta.
 */
export function classifyGatewayError(status: number, body: string, message: string): ArgenProviderError {
  const text = `${message} ${body}`.toLowerCase();

  if (text.includes("key_model_access_denied") || text.includes("not allowed to access model")) {
    return new ModelNotAllowedError(message, status, body);
  }
  if (
    text.includes("budget_exceeded") ||
    text.includes("exceededbudget") ||
    text.includes("over budget") ||
    text.includes("budget has been exceeded")
  ) {
    return new BudgetExceededError(message, status, body);
  }
  if (text.includes("image") || text.includes("vision") || text.includes("does not support")) {
    return new VisionUnsupportedError(message, status, body);
  }
  return new ArgenProviderError(message, status, body);
}
