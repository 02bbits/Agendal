import { Suspense } from "react";
import { act, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AppFrame } from "../../src/app/AppFrame";
import InboxPage from "../../src/app/page";
import { setTimeZone } from "../../src/lib/clock";
import { ScreenHeader, t } from "../../src/ui";
import { TASK_COLUMN_CLASS } from "../../src/ui/features/tasks/layout";
import { expectAxeCleanInBothThemes } from "../ui/axe";
import { task } from "../ui/fixtures";
import { TODAY } from "../ui/harness";

const router = { push: vi.fn(), replace: vi.fn(), back: vi.fn() };
let pathname = "/";
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
  title: "Inbox Task 1",
  due_date: TODAY,
  done: false,
});

const mockInboxData = {
  overdue: [],
  today: [mockTask1],
  no_date: [],
  completed_today: [],
  progress: { done: 0, total: 1 },
  no_date_count: 0,
  completed_count: 0,
};

describe("Inbox task panel integration", () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-10-23T08:00:00Z"));
    setTimeZone("Asia/Ho_Chi_Minh");
    window.localStorage.setItem("agendal.page_view", "full");
    pathname = "/";
    searchParams = new URLSearchParams();
    mockMatchMedia(true);

    fetchMock = vi.fn().mockImplementation(async (url: string) => {
      const u = typeof url === "string" ? url : (url as Request).url;
      if (u.includes("/api/v1/me")) {
        return json(200, { id: 1, email: "u@test.com" });
      }
      if (u.includes("view=inbox")) {
        return json(200, mockInboxData);
      }
      if (u.includes("/projects")) {
        return json(200, []);
      }
      if (u.includes("/complete")) {
        return json(200, {
          task: {
            ...mockTask1,
            done: true,
            done_at: "2026-10-23T10:00:00Z",
          },
        });
      }
      if (u.includes("/tasks/t-1")) {
        return json(200, { task: mockTask1 });
      }
      return json(200, {});
    });
    vi.stubGlobal("fetch", fetchMock);
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
            <InboxPage />
          </Suspense>
        </AppFrame>,
      );
    });

    const rowLink = await screen.findByRole("link", { name: /Inbox Task 1/ });
    expect(rowLink.getAttribute("aria-current")).toBeNull();

    await userEvent.click(rowLink);
    expect(router.push).toHaveBeenCalledWith("/?task=t-1", {
      scroll: false,
    });

    searchParams = new URLSearchParams("task=t-1");
    await act(async () => {
      view.rerender(
        <AppFrame>
          <Suspense>
            <InboxPage />
          </Suspense>
        </AppFrame>,
      );
    });

    const panel = await screen.findByRole("complementary", {
      name: t("task.heading"),
    });
    expect(panel).toBeTruthy();

    const activeLink = screen.getByRole("link", { name: /Inbox Task 1/ });
    expect(activeLink.getAttribute("aria-current")).toBe("true");

    const closeBtn = within(panel).getByRole("button", {
      name: t("common.close"),
    });
    await userEvent.click(closeBtn);
    expect(router.back).toHaveBeenCalledOnce();
  });

  it("ticking in the panel moves the row in Inbox", async () => {
    searchParams = new URLSearchParams("task=t-1");
    await act(async () => {
      render(
        <AppFrame>
          <Suspense>
            <InboxPage />
          </Suspense>
        </AppFrame>,
      );
    });

    const panel = await screen.findByRole("complementary", {
      name: t("task.heading"),
    });
    const panelCheck = within(panel).getByRole("checkbox", {
      name: t("task.complete", { title: "Inbox Task 1" }),
    });

    await userEvent.click(panelCheck);

    const todaySection = screen.queryByRole("region", {
      name: new RegExp(t("list.today")),
    });
    expect(todaySection).toBeNull();
  });

  it("narrow: clicking goes to /tasks/{id}", async () => {
    mockMatchMedia(false);
    await act(async () => {
      render(
        <AppFrame>
          <Suspense>
            <InboxPage />
          </Suspense>
        </AppFrame>,
      );
    });

    const rowLink = await screen.findByRole("link", { name: /Inbox Task 1/ });
    await userEvent.click(rowLink);

    expect(router.push).toHaveBeenCalledWith("/tasks/t-1");
    expect(
      screen.queryByRole("complementary", { name: t("task.heading") }),
    ).toBeNull();
  });

  it("lists wrapper has the shared cap class and is axe clean", async () => {
    searchParams = new URLSearchParams("task=t-1");
    let container: HTMLElement;
    await act(async () => {
      const res = render(
        <AppFrame>
          <Suspense>
            <InboxPage />
          </Suspense>
        </AppFrame>,
      );
      container = res.container;
    });

    await screen.findByRole("complementary", { name: t("task.heading") });
    const wrapper = document.querySelector(".max-w-\\[820px\\]");
    expect(wrapper).toBeTruthy();
    expect(wrapper?.className).toContain(TASK_COLUMN_CLASS);

    await expectAxeCleanInBothThemes(container!);
  });

  it("subtitle stays under the title in the left column with action vertically centred", () => {
    render(
      <ScreenHeader
        title="Inbox"
        accountInitial="T"
        action={<button>New task</button>}
      >
        <p>1 overdue · 4 due today</p>
      </ScreenHeader>,
    );

    const heading = screen.getByRole("heading", { level: 1, name: "Inbox" });
    const subtitle = screen.getByText("1 overdue · 4 due today");
    const actionBtn = screen.getByRole("button", { name: "New task" });

    expect(heading.parentElement).toBe(subtitle.parentElement);

    const flexRow = heading.parentElement?.parentElement;
    expect(flexRow?.className).toContain("flex");
    expect(flexRow?.className).toContain("items-center");
    expect(flexRow?.contains(actionBtn)).toBe(true);
    expect(actionBtn.parentElement).not.toBe(heading.parentElement);
  });
});
