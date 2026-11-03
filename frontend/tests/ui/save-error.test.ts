import { describe, expect, it, vi } from "vitest";
import { ApiRequestError } from "../../src/lib/apiError";
import { t } from "../../src/ui/copy";
import { saveErrorMessage } from "../../src/ui/features/tasks/saveError";
import { formatSaveErrorToast } from "../../src/ui/features/tasks/types";

describe("saveErrorMessage pure helper (TK §7, UX standards)", () => {
  it("maps 429 to error.rate_limited with the seconds to wait, never the raw code", () => {
    const error = new ApiRequestError("error.rate_limited", 429, "r", 12);
    expect(saveErrorMessage(error)).toEqual({
      message: t("error.rate_limited", { seconds: 12 }),
      retry: false,
    });
    expect(saveErrorMessage(error).message).not.toContain("{seconds}");
  });

  it("fills the copy's placeholders, e.g. project.name_taken with the name", () => {
    const error = new ApiRequestError("project.name_taken", 422);
    const { message } = saveErrorMessage(error, { name: "HCI" });
    expect(message).toBe(t("project.name_taken", { name: "HCI" }));
    expect(message).not.toContain("project.name_taken");
  });

  it("maps error.not_found (< 500) to 'This item no longer exists.' with no retry", () => {
    const error = new ApiRequestError("error.not_found", 404);
    const result = saveErrorMessage(error);
    expect(result).toEqual({
      message: "This item no longer exists.",
      retry: false,
    });
  });

  it("maps known 4xx copy keys (e.g. task.limit) to their copy with no retry", () => {
    const error = new ApiRequestError("task.limit", 422);
    const result = saveErrorMessage(error);
    expect(result).toEqual({
      message: t("task.limit"),
      retry: false,
    });
  });

  it("maps error.generic with status < 500 to error.save_failed with retry", () => {
    const error = new ApiRequestError("error.generic", 400);
    const result = saveErrorMessage(error);
    expect(result).toEqual({
      message: t("error.save_failed"),
      retry: true,
    });
  });

  it("maps unknown copy key with status < 500 to error.save_failed with retry", () => {
    const error = new ApiRequestError("completely.unknown.key", 400);
    const result = saveErrorMessage(error);
    expect(result).toEqual({
      message: t("error.save_failed"),
      retry: true,
    });
  });

  it("maps server error status >= 500 (even with a known code) to error.save_failed with retry", () => {
    const error = new ApiRequestError("error.not_found", 500);
    const result = saveErrorMessage(error);
    expect(result).toEqual({
      message: t("error.save_failed"),
      retry: true,
    });
  });

  it("maps arbitrary non-ApiRequestError (e.g. Network Error) to error.save_failed with retry", () => {
    const result = saveErrorMessage(new Error("Network failed"));
    expect(result).toEqual({
      message: t("error.save_failed"),
      retry: true,
    });
  });

  it("maps unknown non-Error values to error.save_failed with retry", () => {
    expect(saveErrorMessage("something went wrong")).toEqual({
      message: t("error.save_failed"),
      retry: true,
    });
    expect(saveErrorMessage(null)).toEqual({
      message: t("error.save_failed"),
      retry: true,
    });
  });

  it("formatSaveErrorToast uses saveErrorMessage rule", () => {
    const retryFn = vi.fn();

    // With error.not_found (no retry)
    const toastNotFound = formatSaveErrorToast(
      new ApiRequestError("error.not_found", 404),
      retryFn,
    );
    expect(toastNotFound).toEqual({
      message: "This item no longer exists.",
    });

    // With 500 error (with retry)
    const toast500 = formatSaveErrorToast(
      new ApiRequestError("error.internal", 500),
      retryFn,
    );
    expect(toast500).toEqual({
      message: t("error.save_failed"),
      actionLabel: t("common.retry"),
      onAction: retryFn,
    });
  });
});
