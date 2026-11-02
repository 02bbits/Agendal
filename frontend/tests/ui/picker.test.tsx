import { act, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { Picker } from "../../src/ui/components/Picker";
import { Sheet } from "../../src/ui/components/Sheet";
import { type PickerOption } from "../../src/ui/components/usePickerKeyboard";
import { expectAxeCleanInBothThemes } from "./axe";

const OPTIONS: ReadonlyArray<PickerOption<string>> = [
  { value: "apple", label: "Apple" },
  { value: "banana", label: "Banana" },
  { value: "cherry", label: "Cherry" },
];

const mockMatchMedia = (matches: boolean) => {
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    value: vi.fn().mockImplementation((query) => ({
      matches,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });
};

describe("Picker", () => {
  beforeEach(() => {
    mockMatchMedia(true);
  });

  it("opens on click and shows the options with the selected one marked", async () => {
    render(
      <Picker
        label="Fruit"
        value="banana"
        options={OPTIONS}
        onChange={() => {}}
      />,
    );

    const trigger = screen.getByRole("button", { name: "Fruit" });
    expect(trigger.getAttribute("aria-expanded")).toBe("false");
    expect(screen.queryByRole("listbox")).toBeNull();

    await userEvent.click(trigger);

    expect(trigger.getAttribute("aria-expanded")).toBe("true");
    const listbox = screen.getByRole("listbox", { name: "Fruit" });
    expect(listbox).not.toBeNull();

    const options = screen.getAllByRole("option");
    expect(options).toHaveLength(3);
    expect(options[0]?.getAttribute("aria-selected")).toBe("false");
    expect(options[1]?.getAttribute("aria-selected")).toBe("true");
    expect(options[2]?.getAttribute("aria-selected")).toBe("false");
  });

  it("supports keyboard navigation and typeahead", async () => {
    render(
      <Picker
        label="Fruit"
        value="apple"
        options={OPTIONS}
        onChange={() => {}}
      />,
    );

    const trigger = screen.getByRole("button", { name: "Fruit" });
    trigger.focus();
    expect(document.activeElement).toBe(trigger);

    // ArrowDown opens and focuses the selected option
    fireEvent.keyDown(trigger, { key: "ArrowDown" });
    const appleOption = screen.getByRole("option", { name: "Apple" });
    expect(appleOption).not.toBeNull();

    // ArrowDown moves to next option
    fireEvent.keyDown(appleOption, { key: "ArrowDown" });
    const bananaOption = screen.getByRole("option", { name: "Banana" });
    expect(document.activeElement).toBe(bananaOption);

    // End moves to last option
    fireEvent.keyDown(bananaOption, { key: "End" });
    const cherryOption = screen.getByRole("option", { name: "Cherry" });
    expect(document.activeElement).toBe(cherryOption);

    // Home moves to first option
    fireEvent.keyDown(cherryOption, { key: "Home" });
    expect(document.activeElement).toBe(appleOption);

    // Typing a letter jumps (typeahead)
    fireEvent.keyDown(appleOption, { key: "c" });
    expect(document.activeElement).toBe(cherryOption);
  });

  it("selects on Enter and calls onChange, closing and focusing trigger", async () => {
    const onChange = vi.fn();
    render(
      <Picker
        label="Fruit"
        value="apple"
        options={OPTIONS}
        onChange={onChange}
      />,
    );

    const trigger = screen.getByRole("button", { name: "Fruit" });
    await userEvent.click(trigger);

    const cherryOption = screen.getByRole("option", { name: "Cherry" });
    fireEvent.keyDown(cherryOption, { key: "Enter" });

    expect(onChange).toHaveBeenCalledWith("cherry");
    expect(screen.queryByRole("listbox")).toBeNull();
    expect(document.activeElement).toBe(trigger);
  });

  it("closes on Escape and returns focus to trigger", async () => {
    render(
      <Picker
        label="Fruit"
        value="apple"
        options={OPTIONS}
        onChange={() => {}}
      />,
    );

    const trigger = screen.getByRole("button", { name: "Fruit" });
    await userEvent.click(trigger);
    expect(screen.getByRole("listbox")).not.toBeNull();

    const appleOption = screen.getByRole("option", { name: "Apple" });
    fireEvent.keyDown(appleOption, { key: "Escape" });

    expect(screen.queryByRole("listbox")).toBeNull();
    expect(document.activeElement).toBe(trigger);
  });

  it("phone width renders a Sheet", async () => {
    mockMatchMedia(false);
    const onChange = vi.fn();
    render(
      <Picker
        label="Fruit"
        value="banana"
        options={OPTIONS}
        onChange={onChange}
      />,
    );

    const trigger = screen.getByRole("button", { name: "Fruit" });
    await userEvent.click(trigger);

    // A dialog/sheet is rendered with the field label as title
    const dialog = screen.getByRole("dialog");
    expect(dialog).not.toBeNull();
    expect(screen.getByRole("heading", { name: "Fruit" })).not.toBeNull();

    const cherryOption = screen.getByRole("option", { name: "Cherry" });
    await userEvent.click(cherryOption);

    expect(onChange).toHaveBeenCalledWith("cherry");
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("supports screen variant, disabled, and helper text", () => {
    render(
      <Picker
        label="Fruit"
        value="banana"
        options={OPTIONS}
        onChange={() => {}}
        variant="screen"
        disabled
        helper="Choose your preferred fruit"
      />,
    );

    const trigger = screen.getByRole("button", {
      name: "Fruit",
    }) as HTMLButtonElement;
    expect(trigger.disabled).toBe(true);
    expect(screen.getByText("Choose your preferred fruit")).not.toBeNull();
  });

  it("opens popover inside closest modal, selects an option and leaves the sheet open", async () => {
    const onSheetClose = vi.fn();
    const onPickerChange = vi.fn();
    render(
      <Sheet open title="Test Sheet" onClose={onSheetClose} closeLabel="Close">
        <Picker
          label="Fruit"
          value="apple"
          options={OPTIONS}
          onChange={onPickerChange}
        />
      </Sheet>,
    );

    const trigger = screen.getByRole("button", { name: "Fruit" });
    await userEvent.click(trigger);

    const listbox = screen.getByRole("listbox", { name: "Fruit" });
    const modal = trigger.closest(".modal");
    expect(modal).not.toBeNull();
    expect(modal?.contains(listbox)).toBe(true);

    const cherryOption = screen.getByRole("option", { name: "Cherry" });
    await userEvent.click(cherryOption);

    expect(onPickerChange).toHaveBeenCalledWith("cherry");
    expect(onSheetClose).not.toHaveBeenCalled();
    expect(screen.getByRole("dialog")).not.toBeNull();
  });

  it("is axe clean in both themes when closed and open", async () => {
    const { container } = render(
      <main>
        <Picker
          label="Fruit"
          value="banana"
          options={OPTIONS}
          onChange={() => {}}
        />
      </main>,
    );

    await expectAxeCleanInBothThemes(container);

    await act(async () => {
      await userEvent.click(screen.getByRole("button", { name: "Fruit" }));
    });
    await expectAxeCleanInBothThemes(container);
  });
});
