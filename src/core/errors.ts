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
  constructor() {
    super("argenprovider-sdk: baseUrl / provisionKey no configurados");
    this.name = "NotConfiguredError";
  }
}
