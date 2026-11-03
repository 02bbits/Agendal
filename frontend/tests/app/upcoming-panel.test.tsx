import { Suspense } from "react";
import { act, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AppFrame } from "../../src/app/AppFrame";
import UpcomingPage from "../../src/app/upcoming/page";
import { setTimeZone } from "../../src/lib/clock";
import { t } from "../../src/ui";
import { task } from "../ui/fixtures";

const router = { push: vi.fn(), replace: vi.fn(), back: vi.fn() };
const pathname = "/upcoming";
let searchParams = new URLSearchParams();

vi.mock("next/navigation", () => ({
  usePathname: () => pathname,
  useRouter: () => router,
  useSearchParams: () => searchParams,
}));

const mockMatchMedia = (matches: boolean) => {
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    value: vi.fn().mockImplementation((query) => ({
      matches,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });
};

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });

const mockTask1 = task({
  id: "t-1",
  title: "Upcoming Task 1",
  due_date: "2026-10-24",
  done: false,
});

describe("Upcoming task panel integration (Refs #28)", () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-10-23T08:00:00Z"));
    setTimeZone("Asia/Ho_Chi_Minh");
    searchParams = new URLSearchParams();
    mockMatchMedia(true);

    fetchMock = vi.fn().mockImplementation(async (url: string) => {
      const u = typeof url === "string" ? url : (url as Request).url;
      if (u.includes("/api/v1/me")) {
        return json(200, { id: 1, email: "u@test.com" });
      }
      if (u.includes("view=upcoming")) {
        return json(200, {
          days: [{ date: "2026-10-24", tasks: [mockTask1] }],
          next_from: null,
        });
      }
      if (u.includes("/projects")) {
        return json(200, []);
      }
      if (u.includes("/tasks/t-1")) {
        return json(200, mockTask1);
      }
      return json(200, {});
    });
    vi.stubGlobal("fetch", fetchMock);
    document.cookie = "XSRF-TOKEN=test-token";
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("wide: clicking row adds ?task=, shows panel with selected state; × closes (back)", async () => {
    let view: ReturnType<typeof render>;
    await act(async () => {
      view = render(
        <AppFrame>
          <Suspense>
            <UpcomingPage />
          </Suspense>
        </AppFrame>,
      );
    });

    const rowLink = await screen.findByRole("link", {
      name: /Upcoming Task 1/,
    });
    expect(rowLink.getAttribute("aria-current")).toBeNull();

    await userEvent.click(rowLink);
    expect(router.push).toHaveBeenCalledWith("/upcoming?task=t-1", {
      scroll: false,
    });

    searchParams = new URLSearchParams("task=t-1");
    await act(async () => {
      view.rerender(
        <AppFrame>
          <Suspense>
            <UpcomingPage />
          </Suspense>
        </AppFrame>,
      );
    });

    const panel = await screen.findByRole("complementary", {
      name: t("task.heading"),
    });
    expect(panel).toBeTruthy();

    const activeLink = screen.getByRole("link", {
      name: /Upcoming Task 1/,
    });
    expect(activeLink.getAttribute("aria-current")).toBe("true");

    const closeBtn = within(panel).getByRole("button", {
      name: t("common.close"),
    });
    await userEvent.click(closeBtn);
    expect(router.back).toHaveBeenCalledOnce();
  });
});
