export class ApiRequestError extends Error {
  readonly code: string;
  readonly requestId?: string;

  constructor(code: string, requestId?: string) {
    super(code);
    this.name = "ApiRequestError";
    this.code = code;
    this.requestId = requestId;
  }
}
