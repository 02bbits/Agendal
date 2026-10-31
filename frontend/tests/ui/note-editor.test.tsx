import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { NoteEditor } from "../../src/ui";
import { expectAxeCleanInBothThemes } from "./axe";

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
    const onSubmit = vi.fn();
    render(<NoteEditor onClose={() => {}} onSubmit={onSubmit} />);
    expect((makeTasks() as HTMLButtonElement).disabled).toBe(true);
    await userEvent.type(field(), "a");
    expect((makeTasks() as HTMLButtonElement).disabled).toBe(false);
    await userEvent.click(makeTasks());
    expect(onSubmit).toHaveBeenCalledWith("a");
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
    const onSubmit = vi.fn();
    render(<NoteEditor onClose={() => {}} onSubmit={onSubmit} />);
    await userEvent.type(field(), "call mum{Control>}{Enter}{/Control}");
    await userEvent.keyboard("{Meta>}{Enter}{/Meta}");
    expect(onSubmit).toHaveBeenCalledTimes(2);
  });

  it("closes with × and Escape without asking", async () => {
    const onClose = vi.fn();
    render(<NoteEditor onClose={onClose} />);
    await userEvent.type(field(), "unsent");
    await userEvent.click(screen.getByRole("button", { name: "Close" }));
    await userEvent.keyboard("{Escape}");
    expect(onClose).toHaveBeenCalledTimes(2);
  });
});
