import { act, render, screen } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AppShell, Dialog, Sheet, Toast } from "../../src/ui";

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
