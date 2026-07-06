export interface ProvisionResult {
  apiKey: string;
  userId: string;
  alreadyExisted: boolean;
  rotated?: boolean;
}

export interface Balance {
  maxBudgetUSD: number;
  spendUSD: number;
  remainingUSD: number;
  totalBudgetARS: number;
  /** Precio del crédito: 1 crédito (= 1 USD de budget) cuesta arsPerUSD ARS. */
  arsPerUSD?: number;
}

export type PurchaseStatus = "PAID" | "PENDING" | "EXPIRED";

export interface Purchase {
  sessionId: string;
  amountARS: number | null;
  creditsUSD: number | null;
  arsPerUSD: number;
  status: PurchaseStatus;
  paymentInitiated: boolean;
  url: string | null;
  createdAt: string;
  expiresAt: string;
}

export interface PurchaseList {
  items: Purchase[];
  total: number;
  pages: number;
  currentPage: number;
}

export type VerifyResult =
  | { status: "PAID" | "PENDING"; amountARS?: number }
  | { status: "RATE_LIMITED" };

export interface CheckoutSession {
  sessionId: string;
  url: string;
  expiresAt: string;
}

export interface TopupResult {
  transactionId: string;
  amountUSD: number;
  newMaxBudgetUSD?: number;
  alreadyProcessed: boolean;
}

export interface Rates {
  usdToArs: number;
  arsPerUSD: number;
}

// ============================================================
// GATEWAY LLM (LiteLLM detrás de argenprovider)
// ============================================================

/**
 * Request OpenAI-compatible para /v1/chat/completions. El SDK no valida su
 * forma más allá de model+messages: lo que mandes viaja tal cual al gateway
 * (tools, temperature, max_tokens, cache_control, etc.).
 */
export interface ChatCompletionRequest {
  model: string;
  messages: unknown[];
  [key: string]: unknown;
}

export interface ChatToolCall {
  id: string;
  type: "function";
  function: { name: string; arguments: string };
}

export interface ChatCompletionResponse {
  id?: string;
  model?: string;
  choices?: Array<{
    finish_reason?: string;
    message?: {
      role: string;
      content: string | null;
      tool_calls?: ChatToolCall[];
    };
  }>;
  usage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
    total_tokens?: number;
    /** Costo en USD calculado por LiteLLM, si el gateway lo reporta. */
    total_cost?: number;
    cost?: number;
  };
  [key: string]: unknown;
}

/** Precio por token en USD (mismo formato que expone OpenRouter). */
export interface ModelPricing {
  prompt: number;
  completion: number;
  image?: number;
  request?: number;
}

export interface ModelInfo {
  id: string;
  pricing?: { usd?: ModelPricing; ars?: ModelPricing };
  [key: string]: unknown;
}

export interface ModelList {
  data: ModelInfo[];
  exchangeRate?: number;
}
