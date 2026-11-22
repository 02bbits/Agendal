/** The limit a 429 hit: `max` requests per `window` seconds. A 1-second window is a burst (UX-43). */
export interface RateLimit {
  max: number;
  window: number;
}

export class ApiRequestError extends Error {
  readonly code: string;
  readonly status: number;
  readonly requestId?: string;
  /** Seconds to wait before trying again, from `Retry-After` or the body's `retry_after` (429). */
  readonly retryAfter?: number;
  readonly fields?: Record<string, string[]>;
  /** The limit a 429 hit, when the server named it. */
  readonly limit?: RateLimit;

  constructor(
    code: string,
    status: number,
    requestId?: string,
    retryAfter?: number,
    fields?: Record<string, string[]>,
    limit?: RateLimit,
  ) {
    super(code);
    this.name = "ApiRequestError";
    this.code = code;
    this.status = status;
    this.requestId = requestId;
    this.retryAfter = retryAfter;
    this.fields = fields;
    this.limit = limit;
  }
}

/** The 429 a screen's load got, for the rate-limited page (UX-43); null for any other failure. */
export const rateLimited = (error: unknown) =>
  error instanceof ApiRequestError && error.status === 429 ? error : null;

/** The parsed JSON body of a successful response; any other status throws an `ApiRequestError`. */
export async function handleResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    let errorCode: string | undefined;
    let requestId: string | undefined;
    let fields: Record<string, string[]> | undefined;
    let limit: RateLimit | undefined;
    let retryAfter = Number(response.headers.get("Retry-After"));
    try {
      const data = await response.json();
      errorCode = data?.error?.code;
      requestId = data?.error?.request_id;
      fields = data?.error?.fields;
      limit = data?.error?.limit;
      if (!retryAfter) retryAfter = Number(data?.error?.retry_after);
    } catch {
      // Body is not JSON
    }
    throw new ApiRequestError(
      errorCode ?? "error.generic",
      response.status,
      requestId,
      retryAfter > 0 ? retryAfter : undefined,
      fields,
      limit,
    );
  }

  if (response.status === 204) {
    return undefined as unknown as T;
  }

  const text = await response.text();
  if (!text) {
    return undefined as unknown as T;
  }

  return JSON.parse(text) as T;
}
