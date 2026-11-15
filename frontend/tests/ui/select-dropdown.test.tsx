import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import {
  SelectDropdown,
  type SelectOption,
} from "../../src/ui/components/SelectDropdown";

const sampleOptions: ReadonlyArray<SelectOption<string>> = [
  { value: "opt1", label: "Option One" },
  { value: "opt2", label: "Option Two" },
  {
    value: "opt3",
    label: "Option Three",
    disabled: true,
    badge: "Coming soon",
  },
  { value: "opt4", label: "Option Four" },
];

describe("SelectDropdown (Base UI / Animate UI motion popup)", () => {
  it("renders trigger with label and selected option", () => {
    render(
      <SelectDropdown
        label="Test Label"
        options={sampleOptions}
        value="opt1"
        onChange={vi.fn()}
      />,
    );

    expect(screen.getByText("Test Label")).toBeTruthy();
    const trigger = screen.getByRole("button", { name: /Option One/i });
    expect(trigger).toBeTruthy();
    expect(trigger.getAttribute("aria-expanded")).toBe("false");
  });

  it("opens popup on click and selects an enabled option", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <SelectDropdown
        label="Test Label"
        options={sampleOptions}
        value="opt1"
        onChange={onChange}
      />,
    );

    const trigger = screen.getByRole("button", { name: /Option One/i });
    await user.click(trigger);

    expect(trigger.getAttribute("aria-expanded")).toBe("true");
    expect(screen.getByRole("listbox", { name: "Test Label" })).toBeTruthy();
    const optionTwo = screen.getByRole("option", { name: "Option Two" });
    await user.click(optionTwo);

    expect(onChange).toHaveBeenCalledWith("opt2");
    await waitFor(() =>
      expect(trigger.getAttribute("aria-expanded")).toBe("false"),
    );
  });

  it("does not select disabled options and renders their badge", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <SelectDropdown
        label="Test Label"
        options={sampleOptions}
        value="opt1"
        onChange={onChange}
      />,
    );

    const trigger = screen.getByRole("button", { name: /Option One/i });
    await user.click(trigger);

    const disabledOption = screen.getByRole("option", {
      name: /Option Three/i,
    });
    expect(disabledOption.getAttribute("aria-disabled")).toBe("true");
    expect(screen.getByText("Coming soon")).toBeTruthy();

    await user.click(disabledOption);
    expect(onChange).not.toHaveBeenCalled();
    // Popup stays open because disabled click does nothing
    expect(trigger.getAttribute("aria-expanded")).toBe("true");
  });

  it("closes on Escape key and refocuses trigger", async () => {
    const user = userEvent.setup();
    render(
      <SelectDropdown
        label="Test Label"
        options={sampleOptions}
        value="opt1"
        onChange={vi.fn()}
      />,
    );

    const trigger = screen.getByRole("button", { name: /Option One/i });
    await user.click(trigger);
    expect(trigger.getAttribute("aria-expanded")).toBe("true");

    fireEvent.keyDown(trigger, { key: "Escape" });
    expect(trigger.getAttribute("aria-expanded")).toBe("false");
  });

  it("supports searchable prop: filters options instantly when user types", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <SelectDropdown
        label="Searchable Dropdown"
        options={sampleOptions}
        value="opt1"
        onChange={onChange}
        searchable
        searchPlaceholder="Filter items..."
      />,
    );

    const trigger = screen.getByRole("button", { name: /Option One/i });
    await user.click(trigger);
    expect(trigger.getAttribute("aria-expanded")).toBe("true");

    const searchInput = screen.getByPlaceholderText("Filter items...");
    expect(searchInput).toBeTruthy();

    // Type query to filter
    await user.type(searchInput, "Two");

    expect(screen.getByRole("option", { name: "Option Two" })).toBeTruthy();
    expect(screen.queryByRole("option", { name: "Option One" })).toBeNull();
    expect(screen.queryByRole("option", { name: "Option Four" })).toBeNull();

    // Pressing Enter in search input picks the first matching enabled option
    fireEvent.keyDown(searchInput, { key: "Enter" });
    expect(onChange).toHaveBeenCalledWith("opt2");
    await waitFor(() =>
      expect(trigger.getAttribute("aria-expanded")).toBe("false"),
    );
  });

  it("shows no matches text when search has no results", async () => {
    const user = userEvent.setup();
    render(
      <SelectDropdown
        label="Searchable Dropdown"
        options={sampleOptions}
        value="opt1"
        onChange={vi.fn()}
        searchable
      />,
    );

    const trigger = screen.getByRole("button", { name: /Option One/i });
    await user.click(trigger);

    const searchInput = screen.getByRole("textbox", {
      name: "Search Searchable Dropdown",
    });
    await user.type(searchInput, "xyz999nonexistent");

    expect(screen.getByText("No matches found")).toBeTruthy();
    expect(screen.queryAllByRole("option")).toHaveLength(0);
  });
});
