import { act, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { clearDraft, loadDraft, saveDraft } from "../../src/lib/draft";
import { NoteEditor, t, type NoteResult } from "../../src/ui";
import done from "../../../docs/07-architecture/contracts/fixtures/note-result-done.json";
import { expectAxeCleanInBothThemes } from "./axe";

vi.mock("../../src/lib/draft", () => ({
  loadDraft: vi.fn(),
  saveDraft: vi.fn(),
  clearDraft: vi.fn(),
}));

beforeEach(() => {
  vi.mocked(loadDraft).mockReset().mockResolvedValue("");
  vi.mocked(saveDraft).mockReset().mockResolvedValue();
  vi.mocked(clearDraft).mockReset().mockResolvedValue();
});

const made = done as NoteResult;
const field = () => screen.getByRole("textbox", { name: "Your note" });
const makeTasks = () => screen.getByRole("button", { name: "Make tasks" });

describe("NoteEditor (IM-41)", () => {
  it("opens with the cursor in the text (T-NC-01)", () => {
    render(<NoteEditor onClose={() => {}} />);
    expect(document.activeElement).toBe(field());
  });

  it("shows three examples while empty and hides them once there is text (T-NC-03)", async () => {
    render(<NoteEditor onClose={() => {}} />);
    expect(
      screen
        .getAllByRole("button", { pressed: false })
        .map((b) => b.textContent),
    ).toEqual([
      "sql quiz monday 9am, email the group tonight",
      "done email the group",
      "move gym to sunday",
    ]);
    await userEvent.type(field(), "buy milk");
    expect(
      screen.queryByRole("button", { name: "move gym to sunday" }),
    ).toBeNull();
    await userEvent.clear(field());
    expect(
      screen.getByRole("button", { name: "move gym to sunday" }),
    ).toBeTruthy();
    await expectAxeCleanInBothThemes();
  });

  it("an example fills the editor and keeps focus at the end (NC-5)", async () => {
    render(<NoteEditor onClose={() => {}} />);
    await userEvent.click(
      screen.getByRole("button", { name: "move gym to sunday" }),
    );
    const input = field() as HTMLTextAreaElement;
    expect(input.value).toBe("move gym to sunday");
    expect(document.activeElement).toBe(input);
    await vi.waitFor(() =>
      expect(input.selectionStart).toBe(input.value.length),
    );
  });

  it("enables Make tasks as soon as there is text, and nothing else is required (T-NC-04)", async () => {
    const onSubmit = vi.fn().mockResolvedValue(made);
    render(<NoteEditor onClose={() => {}} onSubmit={onSubmit} />);
    expect((makeTasks() as HTMLButtonElement).disabled).toBe(true);
    await userEvent.type(field(), "a");
    expect((makeTasks() as HTMLButtonElement).disabled).toBe(false);
    await userEvent.click(makeTasks());
    expect(onSubmit).toHaveBeenCalledWith("a", expect.any(String));
  });

  it("keeps Make tasks disabled for spaces, line breaks and zero-width characters (T-NC-115)", async () => {
    const onSubmit = vi.fn();
    render(<NoteEditor onClose={() => {}} onSubmit={onSubmit} />);
    await userEvent.type(field(), "   {Enter}  ​");
    expect((makeTasks() as HTMLButtonElement).disabled).toBe(true);
    await userEvent.keyboard("{Control>}{Enter}{/Control}");
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("submits with Ctrl+Enter and Cmd+Enter (UX-12)", async () => {
    const onSubmit = vi.fn().mockResolvedValue(made);
    render(<NoteEditor onClose={() => {}} onSubmit={onSubmit} />);
    await userEvent.type(field(), "call mum{Control>}{Enter}{/Control}");
    await userEvent.keyboard("{Meta>}{Enter}{/Meta}");
    expect(onSubmit).toHaveBeenCalledTimes(2);
  });

  it("closes an empty editor at once", async () => {
    const onClose = vi.fn();
    render(<NoteEditor onClose={onClose} />);
    await userEvent.type(field(), "  ");
    await userEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(onClose).toHaveBeenCalledOnce();
    expect(screen.queryByRole("alertdialog")).toBeNull();
  });

  it.each([
    [
      "×",
      () => userEvent.click(screen.getByRole("button", { name: "Cancel" })),
    ],
    ["Escape", () => userEvent.keyboard("{Escape}")],
  ])(
    "%s with text asks first, and Keep editing goes back to the text",
    async (_, close) => {
      const onClose = vi.fn();
      render(<NoteEditor onClose={onClose} />);
      await userEvent.type(field(), "unsent");
      await close();
      const dialog = screen.getByRole("alertdialog", {
        name: "Discard this note?",
      });
      expect(dialog).toBeTruthy();
      expect(onClose).not.toHaveBeenCalled();
      await expectAxeCleanInBothThemes();
      await userEvent.click(
        within(dialog).getByRole("button", { name: "Keep editing" }),
      );
      expect(screen.queryByRole("alertdialog")).toBeNull();
      expect((field() as HTMLTextAreaElement).value).toBe("unsent");
      expect(onClose).not.toHaveBeenCalled();
    },
  );

  it("Discard clears the draft and closes without saving the text again", async () => {
    const onClose = vi.fn();
    const { unmount } = render(<NoteEditor onClose={onClose} />);
    await userEvent.type(field(), "unsent");
    await userEvent.click(screen.getByRole("button", { name: "Cancel" }));
    await userEvent.click(screen.getByRole("button", { name: "Discard" }));
    expect(clearDraft).toHaveBeenCalledOnce();
    expect(onClose).toHaveBeenCalledOnce();
    unmount();
    expect(saveDraft).not.toHaveBeenCalled();
  });

  it("Back with text asks first and keeps the editor's history entry", async () => {
    const onClose = vi.fn();
    render(<NoteEditor onClose={onClose} />);
    await userEvent.type(field(), "unsent");
    // Wait for the popstate rather than a fixed delay: the full suite can be slower than 20 ms
    await act(async () => {
      window.history.back();
    });
    expect(await screen.findByRole("alertdialog")).toBeTruthy();
    expect(onClose).not.toHaveBeenCalled();
    await act(async () => {
      window.history.back();
    });
    await vi.waitFor(() =>
      expect(screen.queryByRole("alertdialog")).toBeNull(),
    );
    expect(onClose).not.toHaveBeenCalled();
    expect(field()).toBe(screen.getByRole("textbox", { name: "Your note" }));
  });

  it("saves the draft 500 ms after the last keystroke (T-NC-101)", async () => {
    render(<NoteEditor onClose={() => {}} />);
    await userEvent.type(field(), "buy milk");
    expect(saveDraft).not.toHaveBeenCalled();
    await vi.waitFor(() => expect(saveDraft).toHaveBeenCalledWith("buy milk"), {
      timeout: 2000,
    });
    expect(saveDraft).toHaveBeenCalledOnce();
  });

  it("saves at once when the editor closes, and when the page is hidden", async () => {
    const { unmount } = render(<NoteEditor onClose={() => {}} />);
    await userEvent.type(field(), "unsent");
    window.dispatchEvent(new Event("pagehide"));
    expect(saveDraft).toHaveBeenCalledWith("unsent");
    await userEvent.type(field(), "!");
    unmount();
    expect(saveDraft).toHaveBeenLastCalledWith("unsent!");
  });

  it("puts an unsent note back with the cursor at the end (T-NC-101)", async () => {
    vi.mocked(loadDraft).mockResolvedValue("call the bank");
    const onDraftRestored = vi.fn();
    render(<NoteEditor onClose={() => {}} onDraftRestored={onDraftRestored} />);
    const input = field() as HTMLTextAreaElement;
    await vi.waitFor(() => expect(input.value).toBe("call the bank"));
    expect(onDraftRestored).toHaveBeenCalledOnce();
    expect(
      screen.queryByRole("button", { name: "move gym to sunday" }),
    ).toBeNull();
    await vi.waitFor(() => expect(input.selectionStart).toBe(13));
    expect(saveDraft).not.toHaveBeenCalled();
  });

  it("does not overwrite what was typed before the draft arrived", async () => {
    let arrive: (text: string) => void = () => {};
    vi.mocked(loadDraft).mockReturnValue(
      new Promise((resolve) => (arrive = resolve)),
    );
    const onDraftRestored = vi.fn();
    render(<NoteEditor onClose={() => {}} onDraftRestored={onDraftRestored} />);
    await userEvent.type(field(), "new");
    arrive("old draft");
    await Promise.resolve();
    expect((field() as HTMLTextAreaElement).value).toBe("new");
    expect(onDraftRestored).not.toHaveBeenCalled();
  });
});

// The Editor row of the NC state matrix (§3) and the NU rows for Make tasks; offline is IM-53
describe("NoteEditor submit (IM-42)", () => {
  const user = () => userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
  const alert = () => screen.queryByRole("alert");
  const advance = (ms: number) =>
    act(async () => {
      await vi.advanceTimersByTimeAsync(ms);
    });

  beforeEach(() => vi.useFakeTimers({ shouldAdvanceTime: true }));
  afterEach(() => vi.useRealTimers());

  it("is busy while the note is read, and says so only after 300 ms (busy)", async () => {
    let answer: (r: NoteResult) => void = () => {};
    const onSubmit = vi.fn(
      () => new Promise<NoteResult>((resolve) => (answer = resolve)),
    );
    const onSubmitted = vi.fn();
    const u = user();
    render(
      <NoteEditor
        onClose={() => {}}
        onSubmit={onSubmit}
        onSubmitted={onSubmitted}
      />,
    );
    await u.type(field(), "sql quiz monday 9am");
    await u.click(makeTasks());

    expect(makeTasks().getAttribute("aria-busy")).toBe("true");
    expect((field() as HTMLTextAreaElement).readOnly).toBe(true);
    expect(screen.queryByText(t("note.reading"))).toBeNull();
    await advance(300);
    expect(screen.getByRole("status").textContent).toBe(t("note.reading"));

    // A second tap and Ctrl+Enter while busy send nothing (NC-E10)
    await u.click(makeTasks());
    await u.keyboard("{Control>}{Enter}{/Control}");
    expect(onSubmit).toHaveBeenCalledTimes(1);

    await act(async () => answer(made));
    expect(onSubmitted).toHaveBeenCalledWith(made);
    expect(screen.getByRole("status").textContent).toBe("");
  });

  it("sends the text with a client id, and clears the draft on success without saving it again", async () => {
    const onSubmit = vi.fn().mockResolvedValue(made);
    const onSubmitted = vi.fn();
    const u = user();
    const { unmount } = render(
      <NoteEditor
        onClose={() => {}}
        onSubmit={onSubmit}
        onSubmitted={onSubmitted}
      />,
    );
    await u.type(field(), "call mum");
    await u.click(makeTasks());

    expect(onSubmit).toHaveBeenCalledWith(
      "call mum",
      expect.stringMatching(/^[0-9a-f-]{36}$/),
    );
    expect(clearDraft).toHaveBeenCalled();
    expect(onSubmitted).toHaveBeenCalledWith(made);
    unmount();
    expect(saveDraft).not.toHaveBeenCalled();
  });

  it("422 shows the reason under the text, keeps it editable, and clears when the text changes", async () => {
    const onSubmit = vi
      .fn()
      .mockResolvedValue({ error: "note.too_many_items" });
    const u = user();
    render(<NoteEditor onClose={() => {}} onSubmit={onSubmit} />);
    await u.type(field(), "a lot");
    await u.click(makeTasks());

    expect(alert()?.textContent).toBe(t("note.too_many_items"));
    expect(field().getAttribute("aria-describedby")).toBe(alert()?.id);
    expect((field() as HTMLTextAreaElement).readOnly).toBe(false);
    expect((field() as HTMLTextAreaElement).value).toBe("a lot");
    expect(clearDraft).not.toHaveBeenCalled();

    await u.type(field(), "er");
    expect(alert()).toBeNull();
  });

  it("429 counts down from Retry-After and keeps Make tasks off until it ends", async () => {
    const onSubmit = vi
      .fn()
      .mockResolvedValue({ error: "error.rate_limited", retryAfter: 2 });
    const u = user();
    render(<NoteEditor onClose={() => {}} onSubmit={onSubmit} />);
    await u.type(field(), "hello");
    await u.click(makeTasks());

    expect(alert()?.textContent).toBe(t("error.rate_limited", { seconds: 2 }));
    expect((makeTasks() as HTMLButtonElement).disabled).toBe(true);
    await advance(1000);
    expect(alert()?.textContent).toBe(t("error.rate_limited", { seconds: 1 }));

    // Typing doesn't lift a rate limit
    await u.type(field(), "!");
    expect((makeTasks() as HTMLButtonElement).disabled).toBe(true);

    await advance(1000);
    expect(alert()).toBeNull();
    expect((makeTasks() as HTMLButtonElement).disabled).toBe(false);
  });

  it("a failed send keeps the text and offers Retry with the same client id (T-NC-111)", async () => {
    const onSubmit = vi
      .fn()
      .mockResolvedValueOnce({ error: "note.send_failed" })
      .mockResolvedValueOnce(made);
    const onSubmitted = vi.fn();
    const u = user();
    render(
      <NoteEditor
        onClose={() => {}}
        onSubmit={onSubmit}
        onSubmitted={onSubmitted}
      />,
    );
    await u.type(field(), "call mum");
    await u.click(makeTasks());

    expect(alert()?.textContent).toBe(t("note.send_failed"));
    expect((field() as HTMLTextAreaElement).value).toBe("call mum");
    await u.click(screen.getByRole("button", { name: "Retry" }));

    expect(onSubmit).toHaveBeenCalledTimes(2);
    expect(onSubmit.mock.calls[1]).toEqual(onSubmit.mock.calls[0]);
    expect(onSubmitted).toHaveBeenCalledWith(made);
  });

  it("new words after a failure go out under a new client id", async () => {
    const onSubmit = vi
      .fn()
      .mockResolvedValueOnce({ error: "note.send_failed" })
      .mockResolvedValueOnce(made);
    const u = user();
    render(<NoteEditor onClose={() => {}} onSubmit={onSubmit} />);
    await u.type(field(), "call mum");
    await u.click(makeTasks());
    await u.type(field(), " tonight");
    await u.click(makeTasks());

    const [[, first], [text, second]] = onSubmit.mock.calls;
    expect(text).toBe("call mum tonight");
    expect(second).not.toBe(first);
  });

  it("× and Escape wait until the request has answered", async () => {
    const onClose = vi.fn();
    const u = user();
    render(
      <NoteEditor
        onClose={onClose}
        onSubmit={() => new Promise<NoteResult>(() => {})}
      />,
    );
    await u.type(field(), "call mum");
    await u.click(makeTasks());
    await u.click(screen.getByRole("button", { name: "Cancel" }));
    await u.keyboard("{Escape}");

    expect(onClose).not.toHaveBeenCalled();
    expect(screen.queryByRole("alertdialog")).toBeNull();
  });

  it("is axe clean while reading and after an error, in both themes", async () => {
    const onSubmit = vi.fn().mockResolvedValue({ error: "note.send_failed" });
    const u = user();
    render(<NoteEditor onClose={() => {}} onSubmit={onSubmit} />);
    await u.type(field(), "call mum");
    await u.click(makeTasks());
    expect(alert()).not.toBeNull();
    await expectAxeCleanInBothThemes();
  });
});
