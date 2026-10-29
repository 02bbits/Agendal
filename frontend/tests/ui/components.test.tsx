import { act, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import {
  Button,
  Chip,
  Dialog,
  EmptyState,
  IconButton,
  PlusIcon,
  Sheet,
  TextField,
  Toast,
  type ToastData,
} from "../../src/ui";
import { expectAxeCleanInBothThemes } from "./axe";

describe("Button", () => {
  it("renders each variant and is axe clean in both themes", async () => {
    render(
      <main>
        <Button variant="primary" size="lg" fullWidth>
          Make tasks
        </Button>
        <Button variant="secondary">Cancel</Button>
        <Button variant="outline">Edit note</Button>
        <Button variant="destructive">Delete</Button>
        <Button disabled>Save</Button>
      </main>,
    );
    expect(screen.getByRole("button", { name: "Make tasks" })).toHaveProperty(
      "className",
      expect.stringContaining("btn-primary"),
    );
    await expectAxeCleanInBothThemes();
  });

  it("calls onClick when pressed", async () => {
    const onClick = vi.fn();
    render(<Button onClick={onClick}>Add</Button>);
    await userEvent.click(screen.getByRole("button", { name: "Add" }));
    expect(onClick).toHaveBeenCalledOnce();
  });

  it("keeps its label for screen readers and ignores taps while busy (UX-06)", async () => {
    const onClick = vi.fn();
    render(
      <Button variant="primary" busy onClick={onClick}>
        Make tasks
      </Button>,
    );
    const button = screen.getByRole("button", { name: "Make tasks" });
    expect(button.getAttribute("aria-busy")).toBe("true");
    await userEvent.click(button);
    expect(onClick).not.toHaveBeenCalled();
  });

  it('defaults to type="button" so it never submits a form by accident', () => {
    render(<Button>Cancel</Button>);
    expect(screen.getByRole("button").getAttribute("type")).toBe("button");
  });
});

describe("IconButton", () => {
  it("has an accessible name and hides its icon (NF-2)", async () => {
    render(<IconButton label="Add a task" icon={<PlusIcon />} />);
    const button = screen.getByRole("button", { name: "Add a task" });
    expect(
      button.querySelector("svg")?.closest('[aria-hidden="true"]'),
    ).not.toBeNull();
    await expectAxeCleanInBothThemes();
  });
});

describe("TextField", () => {
  it("links the label, helper and error to the input", async () => {
    render(
      <main>
        <TextField
          label="Password"
          helper="At least 8 characters, and not your email."
          error="Your password can't be your email."
        />
      </main>,
    );
    const input = screen.getByLabelText("Password");
    expect(input.getAttribute("aria-invalid")).toBe("true");
    const describedBy = input.getAttribute("aria-describedby")!.split(" ");
    const texts = describedBy.map(
      (id) => document.getElementById(id)?.textContent,
    );
    expect(texts).toEqual([
      "Your password can't be your email.",
      "At least 8 characters, and not your email.",
    ]);
    await expectAxeCleanInBothThemes();
  });

  it("is valid and accepts input when there is no error", async () => {
    render(
      <TextField
        label="Email"
        type="email"
        inputMode="email"
        autoComplete="email"
      />,
    );
    const input = screen.getByLabelText("Email");
    expect(input.hasAttribute("aria-invalid")).toBe(false);
    await userEvent.type(input, "example@gmail.com");
    expect((input as HTMLInputElement).value).toBe("example@gmail.com");
  });
});

describe("Chip", () => {
  it("exposes the selected state with aria-pressed", async () => {
    function Chips() {
      const [due, setDue] = useState("Today");
      return (
        <main>
          <div role="group" aria-label="Due">
            {["Today", "Tomorrow"].map((label) => (
              <Chip
                key={label}
                selected={due === label}
                onClick={() => setDue(label)}
              >
                {label}
              </Chip>
            ))}
          </div>
        </main>
      );
    }
    render(<Chips />);
    expect(
      screen
        .getByRole("button", { name: "Today" })
        .getAttribute("aria-pressed"),
    ).toBe("true");
    await userEvent.click(screen.getByRole("button", { name: "Tomorrow" }));
    expect(
      screen
        .getByRole("button", { name: "Tomorrow" })
        .getAttribute("aria-pressed"),
    ).toBe("true");
    expect(
      screen
        .getByRole("button", { name: "Today" })
        .getAttribute("aria-pressed"),
    ).toBe("false");
    await expectAxeCleanInBothThemes();
  });
});

function SheetHarness({ withField = true }: { withField?: boolean }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button onClick={() => setOpen(true)}>Open details</Button>
      <Sheet
        open={open}
        title="New task"
        closeLabel="Close"
        confirmLabel="Add"
        onConfirm={() => setOpen(false)}
        onClose={() => setOpen(false)}
      >
        {withField && <TextField label="Title" />}
      </Sheet>
    </>
  );
}

describe("Sheet", () => {
  it("is a labelled modal dialog and axe clean in both themes", async () => {
    render(<SheetHarness />);
    await userEvent.click(screen.getByRole("button", { name: "Open details" }));
    const sheet = screen.getByRole("dialog", { name: "New task" });
    expect(sheet.getAttribute("aria-modal")).toBe("true");
    await expectAxeCleanInBothThemes();
  });

  it("focuses the first field when opened (UX-10)", async () => {
    render(<SheetHarness />);
    await userEvent.click(screen.getByRole("button", { name: "Open details" }));
    expect(document.activeElement).toBe(screen.getByLabelText("Title"));
  });

  it("focuses the title when there is no field (UX-10)", async () => {
    render(<SheetHarness withField={false} />);
    await userEvent.click(screen.getByRole("button", { name: "Open details" }));
    expect(document.activeElement).toBe(
      screen.getByRole("heading", { name: "New task" }),
    );
  });

  it("traps Tab inside the sheet", async () => {
    render(<SheetHarness />);
    await userEvent.click(screen.getByRole("button", { name: "Open details" }));
    await userEvent.tab();
    expect(document.activeElement).toBe(
      screen.getByRole("button", { name: "Close" }),
    );
    await userEvent.tab({ shift: true });
    expect(document.activeElement).toBe(screen.getByLabelText("Title"));
  });

  it("closes on Escape and returns focus to the opener (UX-10, UX-11)", async () => {
    render(<SheetHarness />);
    const opener = screen.getByRole("button", { name: "Open details" });
    await userEvent.click(opener);
    await userEvent.keyboard("{Escape}");
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(document.activeElement).toBe(opener);
  });

  it("closes from the × button", async () => {
    render(<SheetHarness />);
    await userEvent.click(screen.getByRole("button", { name: "Open details" }));
    await userEvent.click(screen.getByRole("button", { name: "Close" }));
    expect(screen.queryByRole("dialog")).toBeNull();
  });
});

describe("Dialog", () => {
  function DeleteHarness({ onDelete }: { onDelete: () => void }) {
    const [open, setOpen] = useState(false);
    return (
      <>
        <Button onClick={() => setOpen(true)}>Delete project</Button>
        <Dialog
          open={open}
          title="Delete “Portfolio”?"
          description="It has 3 tasks. What should happen to them?"
          onClose={() => setOpen(false)}
          actions={
            <>
              <Button variant="destructive" onClick={onDelete}>
                Delete
              </Button>
              <Button onClick={() => setOpen(false)}>Cancel</Button>
            </>
          }
        />
      </>
    );
  }

  it("is a labelled, described alertdialog and axe clean in both themes", async () => {
    render(<DeleteHarness onDelete={() => {}} />);
    await userEvent.click(
      screen.getByRole("button", { name: "Delete project" }),
    );
    const dialog = screen.getByRole("alertdialog", {
      name: "Delete “Portfolio”?",
    });
    expect(dialog.getAttribute("aria-describedby")).toBeTruthy();
    await expectAxeCleanInBothThemes();
  });

  it("moves focus to the title, not the destructive button", async () => {
    const onDelete = vi.fn();
    render(<DeleteHarness onDelete={onDelete} />);
    await userEvent.click(
      screen.getByRole("button", { name: "Delete project" }),
    );
    expect(document.activeElement).toBe(
      screen.getByRole("heading", { name: "Delete “Portfolio”?" }),
    );
    await userEvent.keyboard("{Enter}");
    expect(onDelete).not.toHaveBeenCalled();
  });

  it("closes on Escape", async () => {
    render(<DeleteHarness onDelete={() => {}} />);
    await userEvent.click(
      screen.getByRole("button", { name: "Delete project" }),
    );
    await userEvent.keyboard("{Escape}");
    expect(screen.queryByRole("alertdialog")).toBeNull();
  });
});

describe("Toast", () => {
  function ToastHarness({
    onUndo,
    initial,
  }: {
    onUndo: () => void;
    initial: ToastData;
  }) {
    const [toast, setToast] = useState<ToastData | null>(initial);
    return (
      <>
        <Toast
          toast={toast}
          onDismiss={(id) => setToast((t) => (t?.id === id ? null : t))}
        />
        <button
          type="button"
          onClick={() =>
            setToast({
              id: 2,
              message: "Deleted “Buy milk”",
              actionLabel: "Undo",
              onAction: onUndo,
            })
          }
        >
          Replace
        </button>
      </>
    );
  }

  const completed = (onUndo: () => void): ToastData => ({
    id: 1,
    message: "Completed “Read chapter 3”",
    actionLabel: "Undo",
    onAction: onUndo,
  });

  it("announces in a polite live region and is axe clean in both themes (UX-60)", async () => {
    render(<ToastHarness onUndo={() => {}} initial={completed(() => {})} />);
    const region = screen.getByRole("status");
    expect(region.getAttribute("aria-live")).toBe("polite");
    expect(region.textContent).toContain("Completed “Read chapter 3”");
    await expectAxeCleanInBothThemes();
  });

  it("runs Undo and dismisses (UX-05)", async () => {
    const onUndo = vi.fn();
    render(<ToastHarness onUndo={onUndo} initial={completed(onUndo)} />);
    await userEvent.click(screen.getByRole("button", { name: "Undo" }));
    expect(onUndo).toHaveBeenCalledOnce();
    expect(screen.getByRole("status").textContent).toBe("");
  });

  it("hides after 5 s (UX-04)", () => {
    vi.useFakeTimers();
    try {
      render(<ToastHarness onUndo={() => {}} initial={completed(() => {})} />);
      act(() => vi.advanceTimersByTime(4999));
      expect(screen.getByRole("status").textContent).toContain("Completed");
      act(() => vi.advanceTimersByTime(1));
      expect(screen.getByRole("status").textContent).toBe("");
    } finally {
      vi.useRealTimers();
    }
  });

  it("pauses while hovered or focused and restarts after (WCAG 2.2.1)", () => {
    vi.useFakeTimers();
    try {
      render(<ToastHarness onUndo={() => {}} initial={completed(() => {})} />);
      const toast = screen.getByText(
        "Completed “Read chapter 3”",
      ).parentElement!;
      fireEvent.mouseEnter(toast);
      act(() => vi.advanceTimersByTime(10_000));
      expect(screen.getByRole("status").textContent).toContain("Completed");
      fireEvent.mouseLeave(toast);
      act(() => vi.advanceTimersByTime(5000));
      expect(screen.getByRole("status").textContent).toBe("");
    } finally {
      vi.useRealTimers();
    }
  });

  it("shows one toast at a time; a new one replaces the old", async () => {
    render(<ToastHarness onUndo={() => {}} initial={completed(() => {})} />);
    await userEvent.click(screen.getByRole("button", { name: "Replace" }));
    const text = screen.getByRole("status").textContent!;
    expect(text).toContain("Deleted “Buy milk”");
    expect(text).not.toContain("Completed");
  });

  it("uses an assertive alert region for blocking errors", () => {
    render(
      <Toast
        assertive
        toast={{
          id: 1,
          message: "Couldn't save that change.",
          actionLabel: "Retry",
          onAction: () => {},
        }}
        onDismiss={() => {}}
      />,
    );
    expect(screen.getByRole("alert").getAttribute("aria-live")).toBe(
      "assertive",
    );
  });
});

describe("EmptyState", () => {
  it("renders a serif heading, body and action, axe clean in both themes", async () => {
    render(
      <main>
        <h1>Inbox</h1>
        <EmptyState
          title="Nothing left for today"
          action={<Button variant="outline">{"See what's coming"}</Button>}
        />
        <EmptyState
          title="No tasks yet"
          body="Group tasks by area or goal."
          headingLevel={2}
        />
      </main>,
    );
    expect(
      screen.getByRole("heading", { level: 2, name: "Nothing left for today" })
        .className,
    ).toContain("font-serif");
    expect(screen.getByText("Group tasks by area or goal.")).toBeTruthy();
    await expectAxeCleanInBothThemes();
  });
});
