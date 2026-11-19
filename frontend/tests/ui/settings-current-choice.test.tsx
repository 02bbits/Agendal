import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Segmented } from "../../src/ui/components/Segmented";
import { ThemeTab } from "../../src/ui/features/settings/theme/ThemeTab";
import { ALL_THEME_PALETTES } from "../../src/ui/domain/theme";
import type { AccountSettings } from "../../src/ui";

const settings: AccountSettings = {
  theme: "light",
  weekStart: "mon",
  timeFormat: "24h",
  rememberDevice: true,
  palette: ALL_THEME_PALETTES[0]!.id,
};

describe("Tapping the choice already in use changes nothing", () => {
  afterEach(cleanup);

  it("a segmented control only reports a different choice", async () => {
    const onChange = vi.fn();
    render(
      <Segmented
        label="Appearance"
        value="light"
        onChange={onChange}
        options={[
          { value: "light", label: "Light" },
          { value: "dark", label: "Dark" },
        ]}
      />,
    );
    await userEvent.click(screen.getByRole("radio", { name: "Light" }));
    expect(onChange).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole("radio", { name: "Dark" }));
    expect(onChange).toHaveBeenCalledWith("dark", expect.anything());
  });

  it("the theme card in use doesn't run the theme change again", async () => {
    const onChange = vi.fn();
    render(<ThemeTab settings={settings} onChange={onChange} />);
    await userEvent.click(screen.getByText(ALL_THEME_PALETTES[0]!.name));
    expect(onChange).not.toHaveBeenCalled();
    await userEvent.click(screen.getByText(ALL_THEME_PALETTES[1]!.name));
    expect(onChange).toHaveBeenCalledWith({
      palette: ALL_THEME_PALETTES[1]!.id,
    });
  });
});
