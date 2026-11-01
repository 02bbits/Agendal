import { ApiRequestError } from "../../../lib/apiError";
import { isCopyKey, t } from "../../copy";

export interface SaveErrorMessageResult {
  message: string;
  retry: boolean;
}

/**
 * Pure helper for save errors (TK §7 / UX standards).
 *
 * Store's rule:
 * ApiRequestError status < 500 with a copy key other than `error.generic` -> t(code), no retry;
 * otherwise -> error.save_failed, retry.
 */
export function saveErrorMessage(error: unknown): SaveErrorMessageResult {
  if (
    error instanceof ApiRequestError &&
    error.status < 500 &&
    error.code !== "error.generic" &&
    isCopyKey(error.code)
  ) {
    return {
      message: t(error.code),
      retry: false,
    };
  }

  return {
    message: t("error.save_failed"),
    retry: true,
  };
}
