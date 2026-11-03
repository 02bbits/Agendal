import { ApiRequestError } from "../../../lib/apiError";
import { isCopyKey, t } from "../../copy";

export interface SaveErrorMessageResult {
  message: string;
  retry: boolean;
}

/** Values for the copy's placeholders, e.g. `{ name }` for `project.name_taken`. */
export type SaveErrorParams = Record<string, string | number>;

/**
 * Pure helper for save errors (TK §7 / UX standards). Never shows a raw code.
 *
 * - 429 -> `error.rate_limited` with the seconds to wait, no retry button;
 * - ApiRequestError status < 500 with a copy key other than `error.generic`
 *   -> t(code, params), no retry;
 * - otherwise -> `error.save_failed`, retry.
 */
export function saveErrorMessage(
  error: unknown,
  params: SaveErrorParams = {},
): SaveErrorMessageResult {
  if (error instanceof ApiRequestError && error.status === 429) {
    return {
      message: t("error.rate_limited", { seconds: error.retryAfter ?? 60 }),
      retry: false,
    };
  }
  if (
    error instanceof ApiRequestError &&
    error.status < 500 &&
    error.code !== "error.generic" &&
    isCopyKey(error.code)
  ) {
    return {
      message: t(error.code, params),
      retry: false,
    };
  }

  return {
    message: t("error.save_failed"),
    retry: true,
  };
}
