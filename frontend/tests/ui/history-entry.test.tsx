import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { useHistoryEntry } from "../../src/ui/components/useHistoryEntry";
import { Button, Dialog, Sheet } from "../../src/ui";

// AP-4, AP-E9: Back closes the open sheet or dialog and stays on the screen (T-AP-106)
function Screen({ inner = false }: { inner?: boolean }) {
  const [sheet, setSheet] = useState(false);
  const [dialog, setDialog] = useState(false);
  return (
    <>
      <p>Screen</p>
      <Button onClick={() => setSheet(true)}>Open sheet</Button>
      <Sheet
        open={sheet}
        title="Sheet"
        closeLabel="Close"
        onClose={() => setSheet(false)}
      >
        {inner && <Button onClick={() => setDialog(true)}>Open dialog</Button>}
      </Sheet>
      <Dialog
        open={dialog}
        title="Dialog"
        onClose={() => setDialog(false)}
        actions={<Button onClick={() => setDialog(false)}>Cancel</Button>}
      />
    </>
  );
}

// jsdom runs history.back() asynchronously
const goBack = () =>
  act(async () => {
    window.history.back();
    await new Promise((resolve) => setTimeout(resolve, 20));
  });

describe("history entries for sheets and dialogs", () => {
  it("T-AP-106: Back closes the sheet and leaves the screen in place", async () => {
    const start = window.history.length;
    render(<Screen />);
    await userEvent.click(screen.getByText("Open sheet"));
    expect(screen.getByRole("dialog", { name: "Sheet" })).toBeTruthy();
    expect(window.history.length).toBe(start + 1);

    await goBack();

    expect(screen.queryByRole("dialog")).toBeNull();
    expect(screen.getByText("Screen")).toBeTruthy();
  });

  it("Escape closes a sheet whose onClose is a new function every render", async () => {
    render(<Screen />);
    await userEvent.click(screen.getByText("Open sheet"));
    await userEvent.keyboard("{Escape}");
    await act(() => new Promise((resolve) => setTimeout(resolve, 20)));

    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("closing with × takes its own entry off, so Back doesn't need an extra press", async () => {
    render(<Screen />);
    const before = window.history.state;
    await userEvent.click(screen.getByText("Open sheet"));
    await userEvent.click(screen.getByRole("button", { name: "Close" }));
    await act(() => new Promise((resolve) => setTimeout(resolve, 20)));

    expect(screen.queryByRole("dialog")).toBeNull();
    expect(window.history.state).toEqual(before);
  });

  it("Back closes a dialog over a sheet first, then the sheet", async () => {
    render(<Screen inner />);
    await userEvent.click(screen.getByText("Open sheet"));
    await userEvent.click(screen.getByText("Open dialog"));

    await goBack();
    expect(screen.queryByRole("alertdialog")).toBeNull();
    expect(screen.getByRole("dialog", { name: "Sheet" })).toBeTruthy();

    await goBack();
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("keeps Next.js's history state on the entry it adds", async () => {
    window.history.replaceState({ __NA: true }, "");
    render(<Screen />);
    await userEvent.click(screen.getByText("Open sheet"));

    expect(window.history.state.__NA).toBe(true);
  });

  it("an onClose that returns false refuses Back and puts the entry back", async () => {
    const refuse = vi.fn(() => false);
    const Guarded = () => {
      useHistoryEntry(true, refuse);
      return <p>Guarded</p>;
    };
    const before = window.history.length;
    render(<Guarded />);
    expect(window.history.length).toBe(before + 1);
    await goBack();
    expect(refuse).toHaveBeenCalledOnce();
    expect(window.history.state?.agendalModal).toBeTruthy();
    await goBack();
    expect(refuse).toHaveBeenCalledTimes(2);
  });
});
