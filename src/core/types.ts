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
