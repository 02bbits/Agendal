import { render, screen } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { AppShell, Dialog, Sheet, Toast } from "../../src/ui";

const theme = readFileSync(join(process.cwd(), "src/ui/theme.css"), "utf8");

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
