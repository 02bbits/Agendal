import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { Sidebar } from "../../src/ui/features/shell/Sidebar";
import { AccountMenu } from "../../src/ui/features/shell/AccountMenu";

describe("AccountMenu and Sidebar integration (issue #149 C)", () => {
  const defaultProps = {
    accountName: "Jane Doe",
    email: "jane@example.com",
    theme: "system" as const,
    onThemeChange: vi.fn(),
    onAccount: vi.fn(),
    onSignOut: vi.fn(),
  };

  it("opens and closes via trigger button and click outside", async () => {
    const user = userEvent.setup();
    render(<Sidebar {...defaultProps} />);

    const trigger = screen.getByRole("button", { name: /Jane Doe/i });
    expect(trigger.getAttribute("aria-haspopup")).toBe("menu");
    expect(trigger.getAttribute("aria-expanded")).toBe("false");
    expect(screen.queryByRole("menu")).toBeNull();

    // Open menu
    await user.click(trigger);
    expect(trigger.getAttribute("aria-expanded")).toBe("true");
    const menu = screen.getByRole("menu", { name: "Account" });
    expect(menu).toBeTruthy();
    expect(screen.getByText("jane@example.com")).toBeTruthy();

    // Opened with the mouse: no row is highlighted yet
    expect(menu.querySelector('[data-active="true"]')).toBeNull();

    // A press during the theme transition lands on <html>: the menu stays open
    fireEvent.pointerDown(document.documentElement);
    expect(screen.queryByRole("menu")).not.toBeNull();

    // Pressing the trigger again closes it, and does not reopen it
    await user.click(trigger);
    expect(screen.queryByRole("menu")).toBeNull();
    expect(trigger.getAttribute("aria-expanded")).toBe("false");

    // Click outside closes
    await user.click(trigger);
    fireEvent.pointerDown(document.body);
    expect(screen.queryByRole("menu")).toBeNull();
    expect(trigger.getAttribute("aria-expanded")).toBe("false");
  });

  it("uses one highlight for the mouse and the arrow keys", async () => {
    const user = userEvent.setup();
    render(<Sidebar {...defaultProps} />);
    await user.click(screen.getByRole("button", { name: /Jane Doe/i }));
    const settingsItem = screen.getByRole("menuitem", { name: "Settings" });
    const signOutItem = screen.getByRole("menuitem", { name: "Sign out" });

    fireEvent.mouseMove(settingsItem);
    expect(settingsItem.getAttribute("data-active")).toBe("true");
    expect(document.activeElement).toBe(settingsItem);

    // The arrow keys carry on from the row under the mouse
    await user.keyboard("{ArrowDown}");
    expect(signOutItem.getAttribute("data-active")).toBe("true");
    expect(settingsItem.getAttribute("data-active")).toBe("false");
    expect(
      screen.getByRole("menu").querySelectorAll('[data-active="true"]'),
    ).toHaveLength(1);
  });

  it("handles keyboard navigation (ArrowDown, ArrowUp, Home, End, Tab)", async () => {
    const user = userEvent.setup();
    render(<Sidebar {...defaultProps} />);

    const trigger = screen.getByRole("button", { name: /Jane Doe/i });
    // Opened from the keyboard: it starts on the first item
    trigger.focus();
    await user.keyboard("{Enter}");

    const accountItem = screen.getByRole("menuitem", { name: "Account" });
    const settingsItem = screen.getByRole("menuitem", { name: "Settings" });
    const signOutItem = screen.getByRole("menuitem", { name: "Sign out" });

    // Opening focuses the first item
    expect(document.activeElement).toBe(accountItem);

    // ArrowDown moves to next item
    await user.keyboard("{ArrowDown}");
    expect(document.activeElement).toBe(settingsItem);

    // ArrowDown moves to Sign out
    await user.keyboard("{ArrowDown}");
    expect(document.activeElement).toBe(signOutItem);

    // ArrowDown wraps back to Account
    await user.keyboard("{ArrowDown}");
    expect(document.activeElement).toBe(accountItem);

    // ArrowUp wraps back to Sign out
    await user.keyboard("{ArrowUp}");
    expect(document.activeElement).toBe(signOutItem);

    // Home moves to Account
    await user.keyboard("{Home}");
    expect(document.activeElement).toBe(accountItem);

    // End moves to Sign out
    await user.keyboard("{End}");
    expect(document.activeElement).toBe(signOutItem);

    // Tab closes menu
    await user.keyboard("{Tab}");
    expect(screen.queryByRole("menu")).toBeNull();
  });

  it("Esc closes and returns focus to the trigger button", async () => {
    const user = userEvent.setup();
    render(<Sidebar {...defaultProps} />);

    const trigger = screen.getByRole("button", { name: /Jane Doe/i });
    await user.click(trigger);

    expect(screen.getByRole("menu")).toBeTruthy();

    await user.keyboard("{Escape}");
    expect(screen.queryByRole("menu")).toBeNull();
    expect(document.activeElement).toBe(trigger);
  });

  it("Account opens Settings on Account tab", async () => {
    const user = userEvent.setup();
    const onAccount = vi.fn();
    render(<Sidebar {...defaultProps} onAccount={onAccount} />);

    const trigger = screen.getByRole("button", { name: /Jane Doe/i });
    await user.click(trigger);

    const accountItem = screen.getByRole("menuitem", { name: "Account" });
    await user.click(accountItem);

    expect(onAccount).toHaveBeenCalledWith("account");
    expect(screen.queryByRole("menu")).toBeNull();
  });

  it("Settings opens Settings on default tab", async () => {
    const user = userEvent.setup();
    const onAccount = vi.fn();
    render(<Sidebar {...defaultProps} onAccount={onAccount} />);

    const trigger = screen.getByRole("button", { name: /Jane Doe/i });
    await user.click(trigger);

    const settingsItem = screen.getByRole("menuitem", { name: "Settings" });
    await user.click(settingsItem);

    expect(onAccount).toHaveBeenCalledWith(undefined);
    expect(screen.queryByRole("menu")).toBeNull();
  });

  it("Sign out calls the handler and closes menu", async () => {
    const user = userEvent.setup();
    const onSignOut = vi.fn();
    render(<Sidebar {...defaultProps} onSignOut={onSignOut} />);

    const trigger = screen.getByRole("button", { name: /Jane Doe/i });
    await user.click(trigger);

    const signOutItem = screen.getByRole("menuitem", { name: "Sign out" });
    await user.click(signOutItem);

    expect(onSignOut).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("menu")).toBeNull();
  });

  it("theme switch calls the setter", async () => {
    const user = userEvent.setup();
    const onThemeChange = vi.fn();
    render(
      <AccountMenu
        accountName="Jane Doe"
        email="jane@example.com"
        theme="system"
        onThemeChange={onThemeChange}
        onOpenSettings={vi.fn()}
        onSignOut={vi.fn()}
        onClose={vi.fn()}
      />,
    );

    const darkOption = screen.getByRole("radio", { name: "Dark" });
    await user.click(darkOption);

    expect(onThemeChange).toHaveBeenCalledWith("dark");
  });
});
