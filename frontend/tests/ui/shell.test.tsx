import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import {
  AccountScreen,
  AppShell,
  RouteEmptyState,
  ScreenHeader,
  TABS,
  type AccountSettings,
  type TabId,
} from "../../src/ui";
import { expectAxeCleanInBothThemes } from "./axe";

const capture = { onWrite: () => {}, onAdd: () => {}, onDictate: () => {} };

describe("AppShell", () => {
  it("shows four labelled tabs with the active one marked (IM-07)", async () => {
    render(
      <AppShell tab="upcoming" capture={capture}>
        <ScreenHeader
          overline="From tomorrow"
          title="Upcoming"
          accountInitial="example"
        />
      </AppShell>,
    );
    const nav = screen.getByRole("navigation", { name: "Main" });
    const links = within(nav).getAllByRole("link");
    expect(links.map((l) => l.textContent)).toEqual([
      "Inbox",
      "Upcoming",
      "Projects",
      "Notes",
    ]);
    expect(
      within(nav)
        .getByRole("link", { name: "Upcoming" })
        .getAttribute("aria-current"),
    ).toBe("page");
    expect(
      within(nav).getByRole("link", { name: "Inbox" }).getAttribute("href"),
    ).toBe("/");
    await expectAxeCleanInBothThemes();
  });

  it("has the capture bar and the + button beside it", async () => {
    const onWrite = vi.fn();
    const onAdd = vi.fn();
    render(
      <AppShell tab="inbox" capture={{ onWrite, onAdd }}>
        <p>content</p>
      </AppShell>,
    );
    await userEvent.click(screen.getByRole("button", { name: "Write a note" }));
    await userEvent.click(screen.getByRole("button", { name: "Add a task" }));
    expect(onWrite).toHaveBeenCalledOnce();
    expect(onAdd).toHaveBeenCalledOnce();
    expect(screen.queryByRole("button", { name: "Dictate a note" })).toBeNull();
  });

  it("hands tab clicks to the router and keeps real hrefs", async () => {
    const navigate = vi.fn(() => true);
    render(
      <AppShell tab="inbox" navigate={navigate}>
        <p>content</p>
      </AppShell>,
    );
    await userEvent.click(screen.getByRole("link", { name: "Projects" }));
    expect(navigate).toHaveBeenCalledWith("/projects");
  });

  it("omits the bars on pushed screens", () => {
    render(
      <AppShell>
        <p>Task details</p>
      </AppShell>,
    );
    expect(screen.queryByRole("navigation")).toBeNull();
  });

  it.each([...TABS.map((tab) => tab.id), "search"] as Array<TabId | "search">)(
    "renders the %s route with an empty state",
    (route) => {
      render(
        <AppShell
          tab={route === "search" ? undefined : route}
          capture={capture}
        >
          <RouteEmptyState route={route} />
        </AppShell>,
      );
      expect(
        screen.getByRole("heading", { level: 2 }).textContent,
      ).toBeTruthy();
    },
  );
});

describe("ScreenHeader", () => {
  it("has search and account links with accessible names", async () => {
    render(
      <main>
        <ScreenHeader
          overline="Friday 23 October"
          title="Inbox"
          accountInitial="example"
        />
      </main>,
    );
    expect(
      screen.getByRole("heading", { level: 1, name: "Inbox" }),
    ).toBeTruthy();
    expect(
      screen.getByRole("link", { name: "Search" }).getAttribute("href"),
    ).toBe("/search");
    expect(screen.getByRole("link", { name: "Account" }).textContent).toBe("E");
    await expectAxeCleanInBothThemes();
  });
});

describe("AccountScreen", () => {
  function Harness({
    onChange,
  }: {
    onChange: (p: Partial<AccountSettings>) => void;
  }) {
    const [settings, setSettings] = useState<AccountSettings>({
      theme: "system",
      weekStart: "mon",
      timeFormat: "24h",
      rememberDevice: true,
    });
    return (
      <main>
        <AccountScreen
          name="example"
          email="example@gmail.com"
          settings={settings}
          onChange={(patch) => {
            onChange(patch);
            setSettings((s) => ({ ...s, ...patch }));
          }}
          onBack={() => {}}
          onSignOut={() => {}}
          onSignOutEverywhere={() => {}}
          onInstall={() => {}}
          remindersStatus="Allowed"
        />
      </main>
    );
  }

  it("changes appearance with a radio group, arrow keys included", async () => {
    const onChange = vi.fn();
    render(<Harness onChange={onChange} />);
    const appearance = screen.getByRole("radiogroup", { name: "Appearance" });
    await userEvent.click(
      within(appearance).getByRole("radio", { name: "Dark" }),
    );
    expect(onChange).toHaveBeenLastCalledWith({ theme: "dark" });
    within(appearance).getByRole("radio", { name: "Dark" }).focus();
    await userEvent.keyboard("{ArrowLeft}");
    expect(onChange).toHaveBeenLastCalledWith({ theme: "light" });
    expect(document.activeElement).toBe(
      within(appearance).getByRole("radio", { name: "Light" }),
    );
  });

  it("toggles Remember me with a switch", async () => {
    const onChange = vi.fn();
    render(<Harness onChange={onChange} />);
    const toggle = screen.getByRole("switch", {
      name: "Remember me on this device",
    });
    expect(toggle.getAttribute("aria-checked")).toBe("true");
    await userEvent.click(toggle);
    expect(onChange).toHaveBeenLastCalledWith({ rememberDevice: false });
  });

  it("is axe clean in both themes", async () => {
    render(<Harness onChange={() => {}} />);
    await expectAxeCleanInBothThemes();
  });
});

describe("No hard-coded strings (NF-12)", () => {
  it("feature components take every visible string from the copy module", () => {
    const dir = join(process.cwd(), "src/ui/features");
    const files = readdirSync(dir, {
      recursive: true,
      encoding: "utf8",
    }).filter((f) => f.endsWith(".tsx"));
    const offenders: string[] = [];
    for (const file of files) {
      const source = readFileSync(join(dir, file), "utf8");
      // JSX text nodes with letters, outside {expressions}
      for (const match of source.matchAll(
        /(?<![=\-])>\s*([A-Za-z][^<>{}()]*?)\s*</g,
      ))
        offenders.push(`${file}: ${match[1]}`);
      for (const match of source.matchAll(
        /(?:aria-label|title|label|placeholder)="([^"]*[A-Za-z][^"]*)"/g,
      ))
        offenders.push(`${file}: ${match[1]}`);
    }
    expect(offenders).toEqual([]);
  });
});
