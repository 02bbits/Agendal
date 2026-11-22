import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  ApiRequestError,
  handleResponse,
  type RateLimit,
} from "../../src/lib/apiError";
import { undoNote } from "../../src/lib/noteApi";
import { RateLimited, t } from "../../src/ui";
import { expectAxeCleanInBothThemes } from "./axe";

// UX-43: a screen whose load got a 429 shows the limit it hit and waits out Retry-After (Refs #169)

const limitedBy = (retryAfter: number, limit?: RateLimit) =>
  new ApiRequestError(
    "error.rate_limited",
    429,
    "req-1",
    retryAfter,
    undefined,
    limit,
  );
const tryAgain = () => screen.getByRole("button") as HTMLButtonElement;

describe("RateLimited page", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-23T08:00:00Z"));
  });
  afterEach(() => vi.useRealTimers());

  it("a burst says it was too fast, counts down, then Try again loads again", () => {
    const onRetry = vi.fn();
    render(
      <RateLimited
        error={limitedBy(3, { max: 20, window: 1 })}
        onRetry={onRetry}
      />,
    );

    expect(
      screen.getByRole("heading", { name: t("rate.burst_title") }),
    ).toBeTruthy();
    expect(
      screen.getByText(
        `${t("rate.burst_body")} ${t("rate.wait", { seconds: 3 })}`,
      ),
    ).toBeTruthy();
    expect(tryAgain().textContent).toBe(t("rate.try_again_in", { seconds: 3 }));
    expect(tryAgain().disabled).toBe(true);

    act(() => vi.advanceTimersByTime(1000));
    expect(tryAgain().textContent).toBe(t("rate.try_again_in", { seconds: 2 }));

    act(() => vi.advanceTimersByTime(2000));
    expect(tryAgain().textContent).toBe(t("rate.try_again"));
    expect(tryAgain().disabled).toBe(false);
    expect(screen.getByText(t("rate.burst_body"))).toBeTruthy();
    fireEvent.click(tryAgain());
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it("a window names the limit it hit: 150 requests per minute", () => {
    render(
      <RateLimited
        error={limitedBy(42, { max: 150, window: 60 })}
        onRetry={() => {}}
      />,
    );

    expect(
      screen.getByRole("heading", { name: t("rate.window_title") }),
    ).toBeTruthy();
    expect(
      screen.getByText(
        "You've reached 150 requests per minute, the most Agendal allows. Try again in 42 s.",
      ),
    ).toBeTruthy();
  });

  it("a day's limit reads per day", () => {
    render(
      <RateLimited
        error={limitedBy(60, { max: 300, window: 86400 })}
        onRetry={() => {}}
      />,
    );

    expect(
      screen.getByText(/You've reached 300 requests per day/),
    ).toBeTruthy();
  });

  it("a limit it can't name still says how long to wait", () => {
    render(<RateLimited error={limitedBy(5)} onRetry={() => {}} />);

    expect(
      screen.getByRole("heading", { name: t("rate.window_title") }),
    ).toBeTruthy();
    expect(screen.getByText(t("rate.wait", { seconds: 5 }))).toBeTruthy();
  });

  it("limited again after Try again: a new countdown starts", () => {
    const { rerender } = render(
      <RateLimited
        error={limitedBy(1, { max: 20, window: 1 })}
        onRetry={() => {}}
      />,
    );
    act(() => vi.advanceTimersByTime(1000));
    expect(tryAgain().disabled).toBe(false);

    rerender(
      <RateLimited
        error={limitedBy(4, { max: 150, window: 60 })}
        onRetry={() => {}}
      />,
    );

    expect(tryAgain().disabled).toBe(true);
    expect(tryAgain().textContent).toBe(t("rate.try_again_in", { seconds: 4 }));
  });
});

describe("RateLimited page accessibility", () => {
  it("A11Y: the page, its illustration hidden, passes axe in both themes", async () => {
    // Inside the shell's main landmark, as on every screen
    render(
      <main>
        <RateLimited
          error={limitedBy(30, { max: 150, window: 60 })}
          onRetry={() => {}}
        />
      </main>,
    );

    expect(document.querySelector("svg")?.getAttribute("aria-hidden")).toBe(
      "true",
    );
    await expectAxeCleanInBothThemes();
  });
});

describe("the 429 a client hears", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("reads which limit was hit, and how long to wait", async () => {
    const response = new Response(
      JSON.stringify({
        error: {
          code: "error.rate_limited",
          retry_after: 9,
          limit: { max: 150, window: 60 },
        },
      }),
      { status: 429, headers: { "Retry-After": "7" } },
    );

    const error = await handleResponse(response).catch((e: unknown) => e);

    expect(error).toBeInstanceOf(ApiRequestError);
    expect((error as ApiRequestError).limit).toEqual({ max: 150, window: 60 });
    expect((error as ApiRequestError).retryAfter).toBe(7);
  });

  it("a limited note action toasts a wait with no bare {seconds}", async () => {
    document.cookie = "XSRF-TOKEN=test-token";
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response(
            JSON.stringify({
              error: { code: "error.rate_limited", retry_after: 30 },
            }),
            { status: 429 },
          ),
      ),
    );

    const outcome = await undoNote("n1", false);

    expect(outcome).toEqual({ error: "error.rate_limited_soon" });
    expect(t("error.rate_limited_soon")).not.toMatch(/\{/);
  });
});
