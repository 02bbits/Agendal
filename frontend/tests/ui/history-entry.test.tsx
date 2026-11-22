import { act, cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  afterHistoryEntryCloses,
  useHistoryEntry,
} from "../../src/ui/components/useHistoryEntry";
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

// jsdom runs history.back() asynchronously. Tests wait for the popstate it fires, not for a fixed
// time: a busy machine outruns 20 ms, and a late back then lands in the next test.
const popstate = (within = 2000) =>
  new Promise<boolean>((resolve) => {
    const timer = setTimeout(() => resolve(false), within);
    window.addEventListener(
      "popstate",
      () => {
        clearTimeout(timer);
        resolve(true);
      },
      { once: true },
    );
  });

const goBack = () =>
  act(async () => {
    const popped = popstate();
    window.history.back();
    await popped;
  });

// × and Escape close first; the sheet takes its entry off a tick later
const entryRemoved = () =>
  act(async () => {
    await popstate();
  });

// An unmounted sheet still takes its entry off a tick later: let that back land in this test
afterEach(async () => {
  cleanup();
  while (window.history.state?.agendalModal && (await popstate(200)));
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
    await entryRemoved();

    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("Escape a field inside already handled (preventDefault) leaves the sheet open", async () => {
    const onClose = vi.fn();
    render(
      <Sheet open title="Sheet" closeLabel="Close" onClose={onClose}>
        <input
          aria-label="Rename"
          onKeyDown={(event) => {
            if (event.key === "Escape") event.preventDefault();
          }}
        />
      </Sheet>,
    );
    await userEvent.click(screen.getByRole("textbox", { name: "Rename" }));
    await userEvent.keyboard("{Escape}");

    expect(onClose).not.toHaveBeenCalled();
  });

  it("closing with × takes its own entry off, so Back doesn't need an extra press", async () => {
    render(<Screen />);
    const before = window.history.state;
    await userEvent.click(screen.getByText("Open sheet"));
    await userEvent.click(screen.getByRole("button", { name: "Close" }));
    await entryRemoved();

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

  it("a picker that closes as it opens a dialog: tapping outside the dialog closes only the dialog (#154)", async () => {
    function Stack() {
      const [task, setTask] = useState(false);
      const [picker, setPicker] = useState(false);
      const [custom, setCustom] = useState(false);
      return (
        <>
          <Button onClick={() => setTask(true)}>Open task</Button>
          <Sheet
            open={task}
            title="New task"
            closeLabel="Close"
            onClose={() => setTask(false)}
          >
            <Button onClick={() => setPicker(true)}>Repeat</Button>
            <Sheet
              open={picker}
              title="Repeat"
              closeLabel="Close repeat"
              onClose={() => setPicker(false)}
            >
              <Button
                onClick={() => {
                  setPicker(false);
                  setCustom(true);
                }}
              >
                Custom
              </Button>
            </Sheet>
            <Dialog
              open={custom}
              title="Custom repeat"
              onClose={() => setCustom(false)}
              actions={<Button onClick={() => setCustom(false)}>Cancel</Button>}
            />
          </Sheet>
        </>
      );
    }
    render(<Stack />);
    await userEvent.click(screen.getByText("Open task"));
    await userEvent.click(screen.getByText("Repeat"));
    await userEvent.click(screen.getByText("Custom"));
    const dialog = screen.getByRole("alertdialog", { name: "Custom repeat" });

    await userEvent.click(dialog.parentElement!);
    await act(async () => {
      while (await popstate(300));
    });

    expect(screen.queryByRole("alertdialog")).toBeNull();
    expect(screen.getByRole("dialog", { name: "New task" })).toBeTruthy();

    // One Back now closes the task sheet: the picker's leftover entry was skipped
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
    render(<Guarded />);
    // Its own entry is on top (the length also counts forward entries earlier tests left)
    expect(window.history.state?.agendalModal).toBeTruthy();
    await goBack();
    expect(refuse).toHaveBeenCalledOnce();
    expect(window.history.state?.agendalModal).toBeTruthy();
    await goBack();
    expect(refuse).toHaveBeenCalledTimes(2);
  });
});

// Navigating after a sheet closes waits for its Back entry to go, or the
// sheet's history.back() undoes the push (sidebar New project, stuck skeleton)
describe("afterHistoryEntryCloses", () => {
  afterEach(() => vi.useRealTimers());

  it("runs once, as soon as the sheet's entry is popped", () => {
    vi.useFakeTimers();
    const go = vi.fn();
    afterHistoryEntryCloses(go);
    expect(go).not.toHaveBeenCalled();

    window.dispatchEvent(new PopStateEvent("popstate"));
    expect(go).toHaveBeenCalledTimes(1);

    vi.advanceTimersByTime(300);
    window.dispatchEvent(new PopStateEvent("popstate"));
    expect(go).toHaveBeenCalledTimes(1);
  });

  it("runs after the wait when no popstate comes (the entry wasn't on top)", () => {
    vi.useFakeTimers();
    const go = vi.fn();
    afterHistoryEntryCloses(go, 250);
    vi.advanceTimersByTime(249);
    expect(go).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(go).toHaveBeenCalledTimes(1);
  });
});
