import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ComponentType } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import AccountPage from "../../src/app/account/page";
import { AppFrame } from "../../src/app/AppFrame";
import NotesPage from "../../src/app/notes/page";
import InboxPage from "../../src/app/page";
import ProjectsPage from "../../src/app/projects/page";
import SearchPage from "../../src/app/search/page";
import UpcomingPage from "../../src/app/upcoming/page";
import { expectAxeCleanInBothThemes } from "../ui/axe";

const router = { push: vi.fn(), replace: vi.fn(), back: vi.fn() };
let pathname = "/";
vi.mock("next/navigation", () => ({
  usePathname: () => pathname,
  useRouter: () => router,
}));

function renderAt(path: string, Page: ComponentType) {
  pathname = path;
  return render(
    <AppFrame>
      <Page />
    </AppFrame>,
  );
}

// The auth gate's session check: signed in unless a test says otherwise
const session = vi.fn();
const signedIn = () =>
  new Response(
    JSON.stringify({ id: 1, email: "example@gmail.com", display_name: "Mai" }),
  );

beforeEach(() => {
  router.push.mockClear();
  router.replace.mockClear();
  router.back.mockClear();
  session.mockReset().mockImplementation(async () => signedIn());
  vi.stubGlobal("fetch", session);
});
afterEach(() => vi.unstubAllGlobals());

const tabs: Array<[string, ComponentType, string, string]> = [
  ["/", InboxPage, "Inbox", "Write a note to make your first tasks."],
  [
    "/upcoming",
    UpcomingPage,
    "Upcoming",
    "Nothing coming up. Write a note to plan ahead.",
  ],
  ["/projects", ProjectsPage, "Projects", "Group tasks by area or goal."],
  [
    "/notes",
    NotesPage,
    "Notes",
    "Your notes will show here. Write one to get started.",
  ],
];

describe("Routes (IM-07): every route renders with an empty state", () => {
  it.each(tabs)(
    "%s shows its title, empty state and the active tab",
    async (path, Page, title, empty) => {
      renderAt(path, Page);
      expect(
        screen.getByRole("heading", { level: 1, name: title }),
      ).toBeTruthy();
      expect(
        screen.getByRole("heading", { level: 2, name: empty }),
      ).toBeTruthy();
      const nav = screen.getByRole("navigation", { name: "Main" });
      expect(
        within(nav)
          .getByRole("link", { name: title })
          .getAttribute("aria-current"),
      ).toBe("page");
      await expectAxeCleanInBothThemes();
    },
  );

  it("/search is a pushed screen with Back and the search hint", async () => {
    renderAt("/search", SearchPage);
    expect(screen.queryByRole("navigation", { name: "Main" })).toBeNull();
    expect(
      screen.getByRole("heading", {
        level: 2,
        name: "Search titles and notes",
      }),
    ).toBeTruthy();
    await userEvent.click(screen.getByRole("button", { name: "Back" }));
    expect(router.back).toHaveBeenCalledOnce();
  });

  it("/account is a pushed screen whose Appearance switches the daisyUI theme", async () => {
    renderAt("/account", AccountPage);
    expect(screen.queryByRole("navigation", { name: "Main" })).toBeNull();
    const appearance = screen.getByRole("radiogroup", { name: "Appearance" });
    await userEvent.click(
      within(appearance).getByRole("radio", { name: "Dark" }),
    );
    expect(document.documentElement.getAttribute("data-theme")).toBe(
      "agendal-dark",
    );
    await userEvent.click(
      within(appearance).getByRole("radio", { name: "Light" }),
    );
    expect(document.documentElement.getAttribute("data-theme")).toBe(
      "agendal-light",
    );
    await userEvent.click(
      within(appearance).getByRole("radio", { name: "System" }),
    );
    expect(document.documentElement.hasAttribute("data-theme")).toBe(false);
  });

  it("tab links and header links go through the Next.js router", async () => {
    renderAt("/", InboxPage);
    // The sidebar (from 768px) has the same links; these are the phone's tab bar and header
    const tabBar = screen.getByRole("navigation", { name: "Main" });
    const header = screen.getByRole("banner");
    await userEvent.click(
      within(tabBar).getByRole("link", { name: "Upcoming" }),
    );
    expect(router.push).toHaveBeenLastCalledWith("/upcoming");
    await userEvent.click(within(header).getByRole("link", { name: "Search" }));
    expect(router.push).toHaveBeenLastCalledWith("/search");
    await userEvent.click(
      within(header).getByRole("link", { name: "Account" }),
    );
    expect(router.push).toHaveBeenLastCalledWith("/account");
  });

  it("the capture bar opens Notes until the note editor lands, and hides + until New task exists", async () => {
    renderAt("/", InboxPage);
    await userEvent.click(screen.getByRole("button", { name: "Write a note" }));
    expect(router.push).toHaveBeenLastCalledWith("/notes");
    expect(screen.queryByRole("button", { name: "Add a task" })).toBeNull();
  });
});

describe("Auth gate (AA §1)", () => {
  it("sends a signed-out visit to Sign in and remembers where it was going", async () => {
    session.mockImplementation(async () => new Response("{}", { status: 401 }));
    renderAt("/upcoming", UpcomingPage);

    await vi.waitFor(() =>
      expect(router.replace).toHaveBeenCalledWith("/sign-in?next=%2Fupcoming"),
    );
  });

  it("stays put offline, when the session check can't reach the server", async () => {
    session.mockRejectedValue(new TypeError("Failed to fetch"));
    renderAt("/", InboxPage);

    await vi.waitFor(() => expect(session).toHaveBeenCalled());
    // Let the failed request settle before checking nothing moved
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(router.replace).not.toHaveBeenCalled();
  });

  it("shows the signed-in user's name and email on Account", async () => {
    renderAt("/account", AccountPage);

    expect(await screen.findByText("example@gmail.com")).toBeTruthy();
    expect(within(screen.getByRole("main")).getByText("Mai")).toBeTruthy();
  });
});
