import { act, render, screen } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  AccountScreen,
  AppShell,
  Dialog,
  ScreenHeader,
  Sheet,
  Toast,
} from "../../src/ui";

const theme = readFileSync(join(process.cwd(), "src/ui/theme.css"), "utf8");

/** A fake visualViewport whose height we can shrink like an on-screen keyboard does. */
function fakeViewport(height: number) {
  const listeners = new Set<() => void>();
  const viewport = {
    height,
    offsetTop: 0,
    addEventListener: (_: string, fn: () => void) => listeners.add(fn),
    removeEventListener: (_: string, fn: () => void) => listeners.delete(fn),
  };
  Object.defineProperty(window, "visualViewport", {
    value: viewport,
    configurable: true,
  });
  return {
    resize(next: number) {
      viewport.height = next;
      act(() => listeners.forEach((fn) => fn()));
    },
  };
}

afterEach(() => {
  Object.defineProperty(window, "visualViewport", {
    value: undefined,
    configurable: true,
  });
});

describe("On-screen keyboard (UX-20, UX-21)", () => {
  it("lifts the bottom bars by the height the keyboard covers", () => {
    vi.spyOn(window, "innerHeight", "get").mockReturnValue(800);
    const viewport = fakeViewport(800);
    render(
      <AppShell tab="inbox" capture={{ onWrite: () => {} }}>
        <p>content</p>
      </AppShell>,
    );
    const root = document.documentElement;
    expect(root.style.getPropertyValue("--keyboard-inset")).toBe("0px");

    viewport.resize(500);
    expect(root.style.getPropertyValue("--keyboard-inset")).toBe("300px");
    const bars = screen.getByRole("navigation", {
      name: "Main",
    }).parentElement!;
    expect(bars.className).toContain("bottom-[var(--keyboard-inset,0px)]");

    viewport.resize(800);
    expect(root.style.getPropertyValue("--keyboard-inset")).toBe("0px");
  });

  it("scrolls the focused field into view while the keyboard is open", () => {
    vi.spyOn(window, "innerHeight", "get").mockReturnValue(800);
    const viewport = fakeViewport(800);
    render(
      <AppShell tab="inbox">
        <input aria-label="Title" />
      </AppShell>,
    );
    const field = screen.getByRole("textbox", { name: "Title" });
    const scroll = vi.fn();
    field.scrollIntoView = scroll;
    field.focus();

    viewport.resize(450);
    expect(scroll).toHaveBeenCalledWith({ block: "nearest" });
  });

  it("keeps sheets above the keyboard", () => {
    render(
      <Sheet open title="New task" closeLabel="Close" onClose={() => {}} />,
    );
    expect(screen.getByRole("dialog").className).toContain(
      "mb-[var(--keyboard-inset,0px)]",
    );
  });

  it("does nothing where visualViewport is missing", () => {
    render(
      <AppShell tab="inbox">
        <p>content</p>
      </AppShell>,
    );
    expect(
      document.documentElement.style.getPropertyValue("--keyboard-inset"),
    ).toBe("");
  });
});

describe("Side margins and safe areas (UX-25)", () => {
  it("defines the gutter as 20px plus the side safe areas", () => {
    expect(theme).toContain(
      "padding-left: calc(1.25rem + env(safe-area-inset-left, 0px));",
    );
    expect(theme).toContain(
      "padding-right: calc(1.25rem + env(safe-area-inset-right, 0px));",
    );
  });

  it("puts the gutter on the content and the capture bar, and the safe areas on the tab bar", () => {
    render(
      <AppShell tab="inbox" capture={{ onWrite: () => {} }}>
        <p>content</p>
      </AppShell>,
    );
    expect(screen.getByRole("main").className).toContain("px-gutter");
    const capture = screen.getByRole("button", { name: "Write a note" })
      .parentElement!.parentElement!;
    expect(capture.className).toContain("px-gutter");
    expect(
      screen.getByRole("navigation", { name: "Main" }).className,
    ).toContain("px-safe");
  });

  it("puts the gutter on sheets and dialogs", () => {
    render(
      <>
        <Sheet open title="New task" closeLabel="Close" onClose={() => {}} />
        <Dialog
          open
          title="Delete “Portfolio”?"
          onClose={() => {}}
          actions={null}
        />
      </>,
    );
    expect(screen.getByRole("dialog").className).toContain("px-gutter");
    expect(screen.getByRole("alertdialog").parentElement!.className).toContain(
      "px-gutter",
    );
  });
});

describe("No horizontal scroll from 320px (UX-23)", () => {
  it("lets a long toast wrap instead of daisyUI's nowrap, inside the gutter", () => {
    render(
      <Toast
        toast={{
          id: 1,
          message: "Deleted “Read chapter 4 for SQL and the ER diagram”",
        }}
        onDismiss={() => {}}
      />,
    );
    const region = screen.getByRole("status");
    expect(region.className).toContain("whitespace-normal");
    expect(region.className).toContain("px-gutter");
    expect(region.className).toContain("max-w-[600px]");
  });
});

describe("Overline labels", () => {
  it("never use Tailwind's `overline` class, which draws a line above the text", () => {
    expect(theme).not.toMatch(/@utility overline/);
    render(
      <main>
        <ScreenHeader
          overline="Friday 23 October"
          title="Inbox"
          accountInitial="e"
        />
        <AccountScreen
          name="example"
          email="example@gmail.com"
          settings={{
            theme: "system",
            weekStart: "mon",
            timeFormat: "24h",
            rememberDevice: true,
          }}
          onChange={() => {}}
          onBack={() => {}}
          onSignOut={() => {}}
        />
      </main>,
    );
    const labels = [
      screen.getByText("Friday 23 October"),
      ...screen.getAllByRole("heading", { level: 2 }),
    ];
    for (const label of labels) {
      expect(label.className.split(/\s+/)).not.toContain("overline");
      expect(label.className).toContain("text-overline");
      expect(label.className).toContain("uppercase");
    }
  });
});

describe("One centred column above 600px (UX-24) and sideways phones (UX-26)", () => {
  it("keeps the content and the bottom bars in one centred 600px column", () => {
    render(
      <AppShell tab="inbox" capture={{ onWrite: () => {} }}>
        <p>content</p>
      </AppShell>,
    );
    const column = screen.getByRole("main").parentElement!;
    expect(column.className).toContain("max-w-[600px]");
    expect(column.className).toContain("mx-auto");
    expect(column.className).toContain("min-h-dvh");
    const bars = screen.getByRole("navigation", {
      name: "Main",
    }).parentElement!;
    expect(bars.className).toContain("max-w-[600px]");
    expect(bars.className).toContain("mx-auto");
    expect(bars.className).toContain("inset-x-0");
  });

  it("reserves room under the content so the bottom bars never cover it", () => {
    render(
      <AppShell tab="inbox" capture={{ onWrite: () => {} }}>
        <p>content</p>
      </AppShell>,
    );
    expect(screen.getByRole("main").className).toContain(
      "pb-[calc(160px+env(safe-area-inset-bottom))]",
    );
  });

  it("keeps sheets inside the column and within the visible height", () => {
    render(
      <Sheet open title="New task" closeLabel="Close" onClose={() => {}} />,
    );
    const sheet = screen.getByRole("dialog");
    expect(sheet.className).toContain("max-w-[600px]");
    expect(sheet.className).toContain(
      "max-h-[calc(100dvh-32px-var(--keyboard-inset,0px))]",
    );
    // daisyUI's modal-box scrolls its own overflow.
    expect(sheet.className).toContain("modal-box");
  });
});

describe("Tablet and desktop (UX-27, UX-28)", () => {
  const renderWide = (aside?: React.ReactNode) =>
    render(
      <AppShell
        tab="upcoming"
        capture={{ onWrite: () => {} }}
        sidebar={{ accountName: "example", counts: { inbox: 5 } }}
        aside={aside}
      >
        <p>content</p>
      </AppShell>,
    );

  it("shows the sidebar from 768px in place of the tab bar", () => {
    renderWide();
    const menu = screen.getByRole("navigation", { name: "Menu" });
    const sidebar = menu.closest(".sticky")!;
    expect(sidebar.className).toContain("hidden");
    expect(sidebar.className).toContain("md:block");
    expect(sidebar.className).toContain("w-[248px]");
    expect(
      screen.getByRole("navigation", { name: "Main" }).className,
    ).toContain("md:hidden");
  });

  it("lists the four tabs with the active one marked and its count", () => {
    renderWide();
    const menu = screen.getByRole("navigation", { name: "Menu" });
    const links = menu.querySelectorAll("li a");
    expect([...links].map((link) => link.getAttribute("href"))).toEqual([
      "/",
      "/upcoming",
      "/projects",
      "/notes",
    ]);
    expect(links[1].getAttribute("aria-current")).toBe("page");
    expect(links[0].textContent).toContain("5");
  });

  it("links Search and the account from the sidebar", () => {
    renderWide();
    const sidebar = screen
      .getByRole("navigation", { name: "Menu" })
      .closest(".sticky")!;
    expect(sidebar.querySelector('a[href="/search"]')!.textContent).toContain(
      "Search tasks",
    );
    const account = sidebar.querySelector('a[href="/account"]')!;
    expect(account.textContent).toContain("example");
    expect(account.textContent).toContain("E");
  });

  it("widens the column to 712px with 40px margins and keeps the capture bar at its bottom", () => {
    renderWide();
    const column = screen.getByRole("main").parentElement!;
    expect(column.className).toContain("md:max-w-[792px]");
    expect(screen.getByRole("main").className).toContain("md:px-gutter-wide");
    expect(theme).toContain(
      "padding-left: calc(2.5rem + env(safe-area-inset-left, 0px));",
    );
    const bars = screen.getByRole("navigation", {
      name: "Main",
    }).parentElement!;
    expect(bars.className).toContain("md:sticky");
    expect(bars.className).toContain("md:w-full");
  });

  it("shows the side panel only from 1280px, and only when a screen gives one", () => {
    const { unmount } = renderWide();
    expect(screen.queryByText("Task detail")).toBeNull();
    unmount();
    renderWide(<p>Task detail</p>);
    const panel = screen.getByText("Task detail").parentElement!;
    expect(panel.className).toContain("hidden");
    expect(panel.className).toContain("xl:block");
    expect(panel.className).toContain("w-[400px]");
  });

  it("leaves the sidebar out on signed-out screens", () => {
    render(
      <AppShell>
        <p>Sign in</p>
      </AppShell>,
    );
    expect(screen.queryByRole("navigation", { name: "Menu" })).toBeNull();
  });

  it("opens sheets as a centred dialog up to 560px wide", () => {
    render(
      <Sheet open title="New task" closeLabel="Close" onClose={() => {}} />,
    );
    const sheet = screen.getByRole("dialog");
    expect(sheet.parentElement!.className).toContain("md:modal-middle");
    expect(sheet.className).toContain("md:max-w-[560px]");
    expect(sheet.className).toContain("md:rounded-dialog");
  });

  it("hides the header's Search and Account where the sidebar has them", () => {
    render(<ScreenHeader title="Inbox" accountInitial="e" />);
    expect(
      screen.getByRole("link", { name: "Search" }).parentElement!.className,
    ).toContain("md:hidden");
  });

  it("keeps the tab bar compact on a phone held sideways (UX-26)", () => {
    render(
      <AppShell tab="inbox">
        <p>content</p>
      </AppShell>,
    );
    const tab = screen.getByRole("link", { name: "Inbox" });
    expect(tab.className).toContain("[@media(max-height:480px)]:min-h-12");
  });
});
