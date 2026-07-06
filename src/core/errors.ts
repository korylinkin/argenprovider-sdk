export class ArgenProviderError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly body?: string
  ) {
    super(message);
    this.name = "ArgenProviderError";
  }

  /**
   * true si el gateway LLM rechazó la request por budget agotado (LiteLLM
   * bloquea pre-call cuando spend >= max_budget del usuario). Permite a la
   * plataforma responder "sin créditos" en vez de un error genérico.
   * LiteLLM lo reporta con type "budget_exceeded" / mensaje "ExceededBudget".
   */
  get isBudgetExceeded(): boolean {
    const text = `${this.message} ${this.body ?? ""}`.toLowerCase();
    return (
      text.includes("budget_exceeded") ||
      text.includes("exceededbudget") ||
      text.includes("over budget") ||
      text.includes("budget has been exceeded")
    );
  }
}

export class NotConfiguredError extends Error {
  constructor(message = "argenprovider-sdk: baseUrl / provisionKey no configurados") {
    super(message);
    this.name = "NotConfiguredError";
  }
}
