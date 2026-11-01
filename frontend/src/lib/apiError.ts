export class ApiRequestError extends Error {
  readonly code: string;
  readonly status: number;
  readonly requestId?: string;
  /** Seconds to wait before trying again, from `Retry-After` or the body's `retry_after` (429). */
  readonly retryAfter?: number;

  constructor(
    code: string,
    status: number,
    requestId?: string,
    retryAfter?: number,
  ) {
    super(code);
    this.name = "ApiRequestError";
    this.code = code;
    this.status = status;
    this.requestId = requestId;
    this.retryAfter = retryAfter;
  }
}

/** The parsed JSON body of a successful response; any other status throws an `ApiRequestError`. */
export async function handleResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    let errorCode: string | undefined;
    let requestId: string | undefined;
    let retryAfter = Number(response.headers.get("Retry-After"));
    try {
      const data = await response.json();
      errorCode = data?.error?.code;
      requestId = data?.error?.request_id;
      if (!retryAfter) retryAfter = Number(data?.error?.retry_after);
    } catch {
      // Body is not JSON
    }
    throw new ApiRequestError(
      errorCode ?? "error.generic",
      response.status,
      requestId,
      retryAfter > 0 ? retryAfter : undefined,
    );
  }

  return response.json();
}
