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
